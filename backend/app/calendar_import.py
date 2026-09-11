from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

import icalendar
import recurring_ical_events
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.auth_utils import get_current_user
from app.db import conn

router = APIRouter()
PST = ZoneInfo("America/Los_Angeles")


@router.post("/import/ics")
async def import_ics(file: UploadFile = File(...), user_id: str = Depends(get_current_user)):
    content = await file.read()

    try:
        calendar = icalendar.Calendar.from_ical(content)
    except Exception:
        raise HTTPException(status_code=400, detail="Could not read that file as a valid .ics calendar")

    # A generous window around today - covers anything worth importing
    # without materializing an unbounded number of recurring instances.
    today = datetime.now(PST).date()
    window_start = today - timedelta(days=7)
    window_end = today + timedelta(days=60)

    try:
        events = recurring_ical_events.of(calendar).between(window_start, window_end)
    except Exception:
        raise HTTPException(status_code=400, detail="Could not read events from that .ics file")

    conn.execute(
        "DELETE FROM busy_times WHERE user_id = ? AND source = 'ics'",
        (user_id,)
    )

    imported = 0

    for event in events:
        raw_start = event.get("dtstart").dt
        raw_end = event.get("dtend").dt
        title = str(event.get("summary") or "")

        # All-day events come back as bare `date` objects, not `datetime`.
        if isinstance(raw_start, date) and not isinstance(raw_start, datetime):
            start_dt = datetime.combine(raw_start, time.min, tzinfo=PST)
            end_dt = datetime.combine(raw_end, time.min, tzinfo=PST)
        else:
            start_dt = raw_start.astimezone(PST) if raw_start.tzinfo else raw_start.replace(tzinfo=PST)
            end_dt = raw_end.astimezone(PST) if raw_end.tzinfo else raw_end.replace(tzinfo=PST)

        conn.execute(
            "INSERT INTO busy_times (user_id, start, end_time, source, raw_timezone, title) VALUES (?, ?, ?, ?, ?, ?)",
            (user_id, start_dt.isoformat(), end_dt.isoformat(), "ics", str(PST), title)
        )
        imported += 1

    conn.commit()

    return {"imported": imported}
