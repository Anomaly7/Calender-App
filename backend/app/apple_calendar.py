import os
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import caldav
from cryptography.fernet import Fernet, InvalidToken
from fastapi import APIRouter, Body, Depends, HTTPException

from app.auth_utils import get_current_user
from app.db import conn

router = APIRouter()
PST = ZoneInfo("America/Los_Angeles")

ICLOUD_CALDAV_URL = "https://caldav.icloud.com"


def _fernet():
    key = os.getenv("CALDAV_ENCRYPTION_KEY")
    if not key:
        raise HTTPException(
            status_code=500,
            detail="Apple Calendar isn't configured yet (missing CALDAV_ENCRYPTION_KEY)."
        )
    return Fernet(key.encode())


def _sync_apple_calendar(user_id, apple_email, app_password):
    try:
        client = caldav.DAVClient(url=ICLOUD_CALDAV_URL, username=apple_email, password=app_password)
        principal = client.principal()
        calendars = principal.calendars()
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Couldn't sign in to iCloud: {type(e).__name__}: {e}"
        )

    today = datetime.now(PST).date()
    window_start = datetime.combine(today - timedelta(days=7), datetime.min.time(), tzinfo=PST)
    window_end = datetime.combine(today + timedelta(days=366), datetime.min.time(), tzinfo=PST)

    conn.execute("DELETE FROM busy_times WHERE user_id = ? AND source = 'apple'", (user_id,))

    imported = 0
    for calendar in calendars:
        try:
            events = calendar.date_search(start=window_start, end=window_end, expand=True)
        except Exception:
            continue

        for event in events:
            try:
                vevents = event.icalendar_instance.walk("VEVENT")
            except Exception:
                continue

            for vevent in vevents:
                raw_start = vevent.get("dtstart").dt if vevent.get("dtstart") else None
                raw_end = vevent.get("dtend").dt if vevent.get("dtend") else None
                if raw_start is None or raw_end is None:
                    continue

                title = str(vevent.get("summary") or "")

                if not isinstance(raw_start, datetime):
                    start_dt = datetime.combine(raw_start, datetime.min.time(), tzinfo=PST)
                    end_dt = datetime.combine(raw_end, datetime.min.time(), tzinfo=PST)
                else:
                    start_dt = raw_start.astimezone(PST) if raw_start.tzinfo else raw_start.replace(tzinfo=PST)
                    end_dt = raw_end.astimezone(PST) if raw_end.tzinfo else raw_end.replace(tzinfo=PST)

                conn.execute(
                    "INSERT INTO busy_times (user_id, start, end_time, source, raw_timezone, title) VALUES (?, ?, ?, ?, ?, ?)",
                    (user_id, start_dt.isoformat(), end_dt.isoformat(), "apple", str(PST), title)
                )
                imported += 1

    conn.commit()
    return imported


@router.post("/auth/apple/connect")
def connect_apple(body: dict = Body(...), user_id: str = Depends(get_current_user)):
    apple_email = (body.get("apple_email") or "").strip()
    app_password = (body.get("app_password") or "").strip()

    if not apple_email or not app_password:
        raise HTTPException(status_code=400, detail="Apple ID email and app-specific password are both required.")

    imported = _sync_apple_calendar(user_id, apple_email, app_password)

    encrypted = _fernet().encrypt(app_password.encode()).decode()
    conn.execute(
        "INSERT INTO apple_credentials (user_id, apple_email, encrypted_password) VALUES (?, ?, ?) "
        "ON CONFLICT (user_id) DO UPDATE SET apple_email = EXCLUDED.apple_email, encrypted_password = EXCLUDED.encrypted_password",
        (user_id, apple_email, encrypted)
    )
    conn.commit()

    return {"connected": True, "imported": imported}


@router.get("/auth/apple/status")
def apple_status(user_id: str = Depends(get_current_user)):
    row = conn.execute(
        "SELECT apple_email FROM apple_credentials WHERE user_id = ?",
        (user_id,)
    ).fetchone()

    return {"connected": row is not None, "apple_email": row[0] if row else None}


@router.post("/auth/apple/resync")
def resync_apple(user_id: str = Depends(get_current_user)):
    row = conn.execute(
        "SELECT apple_email, encrypted_password FROM apple_credentials WHERE user_id = ?",
        (user_id,)
    ).fetchone()

    if not row:
        raise HTTPException(status_code=400, detail="Apple Calendar isn't connected.")

    apple_email, encrypted_password = row

    try:
        app_password = _fernet().decrypt(encrypted_password.encode()).decode()
    except InvalidToken:
        raise HTTPException(status_code=500, detail="Stored Apple credentials could not be decrypted.")

    imported = _sync_apple_calendar(user_id, apple_email, app_password)
    return {"connected": True, "imported": imported}


@router.post("/auth/apple/disconnect")
def disconnect_apple(user_id: str = Depends(get_current_user)):
    conn.execute("DELETE FROM apple_credentials WHERE user_id = ?", (user_id,))
    conn.execute("DELETE FROM busy_times WHERE user_id = ? AND source = 'apple'", (user_id,))
    conn.commit()

    return {"disconnected": True}
