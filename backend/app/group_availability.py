from zoneinfo import ZoneInfo
from fastapi import APIRouter, Body, Query, Request
from datetime import datetime, time, timedelta
from app.availability import merge_intervals, find_free_time, score_slot

days: int = Query(1)
router = APIRouter()
PST = ZoneInfo("America/Los_Angeles")

@router.post("/availability/merge")
def merge_users_availability(
    request: Request,
    users_busy: list = Body(...),
    min_minutes: int = Query(30),
    day_start: str = Query("08:00"),
    day_end: str = Query("22:00"),
    days: int = Query(1)
):
    PST = ZoneInfo("America/Los_Angeles")

    # ---- Parse day bounds ----
    day_start_time = time.fromisoformat(day_start)
    day_end_time = time.fromisoformat(day_end)

    # ---- Inject Google busy (today only) ----
    if hasattr(request.app.state, "google_busy"):
        today = datetime.now(PST).date()
        google_today = [
            (s, e) for s, e in request.app.state.google_busy
            if s.date() == today
        ]
        users_busy.append(google_today)

    all_busy = []
    busy_output = []

    # ---- Normalize all busy blocks ----
    for user in users_busy:

        if isinstance(user, dict):
            user = [[user["start"], user["end"]]]

        for block in user:

            if isinstance(block, dict):
                start, end = block["start"], block["end"]
            else:
                start, end = block

            start_dt = datetime.fromisoformat(start) if isinstance(start, str) else start
            end_dt = datetime.fromisoformat(end) if isinstance(end, str) else end

            if start_dt.tzinfo is None:
                start_dt = start_dt.replace(tzinfo=PST)
            if end_dt.tzinfo is None:
                end_dt = end_dt.replace(tzinfo=PST)

            all_busy.append((start_dt, end_dt))

            label = "(imported)" if (
                hasattr(request.app.state, "google_busy")
                and (start_dt, end_dt) in request.app.state.google_busy
            ) else "(manual)"

            busy_output.append({
                "start": start_dt.isoformat(),
                "end": end_dt.isoformat(),
                "label": label
            })

    # ---- Merge busy intervals ----
    merged_busy = merge_intervals(all_busy)

    # ---- Compute free time ----
    results = []
    today = datetime.now(PST).date()

    for i in range(days):
        target_date = today + timedelta(days=i)

        free_slots = find_free_time(
            merged_busy,
            target_date=target_date,
            day_start=day_start_time,
            day_end=day_end_time,
            min_minutes=min_minutes
        )

        for start, end in free_slots:
            results.append({
                "date": target_date.isoformat(),
                "start": start.isoformat(),
                "end": end.isoformat(),
                "duration_minutes": int((end - start).total_seconds() / 60),
                "score": score_slot(start, end)
            })

    results.sort(key=lambda x: x["score"], reverse=True)

    return {
        "busy_times": busy_output,
        "ranked_free_time": results
    }

