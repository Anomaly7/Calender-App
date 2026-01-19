from fastapi import APIRouter, Body, Query, Request
from datetime import datetime, time
from app.availability import merge_intervals, find_free_time, score_slot


router = APIRouter()

@router.post("/availability/merge")
def merge_users_availability(
    request: Request,
    users_busy: list = Body(...),
    min_minutes: int = Query(30),
    day_start: str = Query("08:00"),
    day_end: str = Query("22:00")
    
):
    # Add Google Calendar as another user if connected
    if hasattr(request.app.state, "google_busy"):
        google_busy = request.app.state.google_busy
        if google_busy not in users_busy:
            users_busy.append(google_busy)


    all_busy = []

    day_start_time = time.fromisoformat(day_start)
    day_end_time = time.fromisoformat(day_end)


    for user in users_busy:
        for start, end in user:
            if isinstance(start, str):
                start_dt = datetime.fromisoformat(start)
                end_dt = datetime.fromisoformat(end)
            else:
                start_dt = start
                end_dt = end

            all_busy.append((start_dt, end_dt))


    merged_busy = merge_intervals(all_busy)
    free = find_free_time(
        merged_busy,
        day_start=day_start_time,
        day_end=day_end_time,
        min_minutes=min_minutes
    )

    ranked = []

    for slot in free:
        ranked.append({
            "start": slot[0].isoformat(),
            "end": slot[1].isoformat(),
            "duration_minutes": int((slot[1] - slot[0]).total_seconds() / 60),
            "score": score_slot(slot[0], slot[1])
        })

    ranked.sort(key=lambda x: x["score"], reverse=True)

    return {
        "ranked_free_time": ranked
    }

