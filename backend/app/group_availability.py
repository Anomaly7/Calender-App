from zoneinfo import ZoneInfo
from fastapi import APIRouter, Body, Query, Request
from datetime import datetime, time, timedelta
from app.availability import merge_intervals, find_free_time, score_slot
from app.db import cursor

days: int = Query(1)
router = APIRouter()
PST = ZoneInfo("America/Los_Angeles")

@router.post("/availability/merge")
def merge_users_availability(
    request: Request,
    user_id: str = Query(...),
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

    # ---- Load user's stored busy times (Google + manual) ----
    cursor.execute(
        "SELECT start, end FROM busy_times WHERE user_id = ?",
        (user_id,)
    )

    db_busy = [
        (
            datetime.fromisoformat(start).astimezone(PST),
            datetime.fromisoformat(end).astimezone(PST)
        )
        for start, end in cursor.fetchall()
    ]

    if db_busy:
        users_busy.append(db_busy)


    all_busy = []
    busy_output = []


    group_id = request.query_params.get("group")

    if group_id:
        cursor.execute(
            "SELECT user_id FROM group_members WHERE group_id = ?",
            (group_id,)
        )

        members = [row[0] for row in cursor.fetchall()]

        for uid in members:
            cursor.execute(
                "SELECT start, end FROM busy_times WHERE user_id = ?",
                (uid,)
            )

            blocks = [
                (datetime.fromisoformat(s), datetime.fromisoformat(e))
                for s, e in cursor.fetchall()
            ]

            if blocks:
                users_busy.append(blocks)

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

@router.post("/groups/join")
def join_group(group_id: str = Query(...), user_id: str = Query(...)):
    from app.db import cursor, conn

    cursor.execute(
        "INSERT OR IGNORE INTO groups (id) VALUES (?)",
        (group_id,)
    )

    cursor.execute(
        "INSERT INTO group_members (group_id, user_id) VALUES (?, ?)",
        (group_id, user_id)
    )

    conn.commit()
    return {"joined": True}
