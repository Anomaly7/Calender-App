import base64
import json
import os
import re
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

import anthropic
import icalendar
import recurring_ical_events
from fastapi import APIRouter, File, HTTPException, Query, UploadFile

from app.db import conn

router = APIRouter()
PST = ZoneInfo("America/Los_Angeles")

WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}

SCREENSHOT_PROMPT = """You are extracting a schedule from an image of a calendar, \
timetable, or list of classes/activities. Identify every distinct recurring time \
block shown (e.g. a class, meeting, or activity).

For each one, determine:
- title: its name/label as shown (e.g. "ENGR 351 - Microelectronics I")
- days: array of the weekdays it occurs on, using full names only: \
"Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"
- start_time: 24-hour "HH:MM" format
- end_time: 24-hour "HH:MM" format

Respond with ONLY a JSON array, no other text, no markdown code fences. Example:
[{"title": "ENGR 351 Lecture", "days": ["Monday", "Wednesday", "Friday"], "start_time": "08:00", "end_time": "09:30"}]

If you can't confidently identify any schedule information in the image, respond \
with an empty array: []"""


def extract_json_array(text):
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text)
    data = json.loads(text)
    if not isinstance(data, list):
        raise ValueError("Expected a JSON array")
    return data


def weekday_to_date(weekday_name, week_start):
    try:
        idx = WEEKDAYS.index(str(weekday_name).strip().capitalize())
    except ValueError:
        return None
    return week_start + timedelta(days=idx)


@router.post("/import/ics")
async def import_ics(user_id: str = Query(...), file: UploadFile = File(...)):
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
            "INSERT INTO busy_times (user_id, start, end, source, raw_timezone, title) VALUES (?, ?, ?, ?, ?, ?)",
            (user_id, start_dt.isoformat(), end_dt.isoformat(), "ics", str(PST), title)
        )
        imported += 1

    conn.commit()

    return {"imported": imported}


@router.post("/import/screenshot")
async def import_screenshot(user_id: str = Query(...), file: UploadFile = File(...)):
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="Screenshot import isn't configured yet (missing ANTHROPIC_API_KEY)."
        )

    media_type = file.content_type or ""
    if media_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Please upload a JPEG, PNG, GIF, or WebP image.")

    content = await file.read()
    image_data = base64.standard_b64encode(content).decode("utf-8")

    client = anthropic.Anthropic(api_key=api_key)

    try:
        message = client.messages.create(
            model="claude-sonnet-5",
            max_tokens=2048,
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {"type": "base64", "media_type": media_type, "data": image_data}
                    },
                    {"type": "text", "text": SCREENSHOT_PROMPT}
                ]
            }]
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Couldn't reach the AI service: {e}")

    raw_text = message.content[0].text if message.content else "[]"

    try:
        events = extract_json_array(raw_text)
    except (json.JSONDecodeError, ValueError):
        raise HTTPException(
            status_code=502,
            detail="Couldn't understand a schedule in that image. Try a clearer screenshot."
        )

    today = datetime.now(PST).date()
    week_start = today - timedelta(days=(today.weekday() + 1) % 7)  # Sunday of this week

    conn.execute(
        "DELETE FROM busy_times WHERE user_id = ? AND source = 'screenshot'",
        (user_id,)
    )

    imported = 0

    for ev in events:
        title = str(ev.get("title") or "").strip()
        days = ev.get("days") or []
        start_time_str = ev.get("start_time")
        end_time_str = ev.get("end_time")

        if not (days and start_time_str and end_time_str):
            continue

        try:
            start_t = time.fromisoformat(start_time_str)
            end_t = time.fromisoformat(end_time_str)
        except ValueError:
            continue

        for day_name in days:
            d = weekday_to_date(day_name, week_start)
            if d is None:
                continue

            start_dt = datetime.combine(d, start_t, tzinfo=PST)
            end_dt = datetime.combine(d, end_t, tzinfo=PST)

            conn.execute(
                "INSERT INTO busy_times (user_id, start, end, source, raw_timezone, title) VALUES (?, ?, ?, ?, ?, ?)",
                (user_id, start_dt.isoformat(), end_dt.isoformat(), "screenshot", str(PST), title)
            )
            imported += 1

    conn.commit()

    return {"imported": imported, "parsed": events}
