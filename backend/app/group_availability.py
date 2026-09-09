from zoneinfo import ZoneInfo
from fastapi import APIRouter, Body, Query, Request
from datetime import datetime, time
from app.availability import merge_intervals, find_free_time, score_slot
from app.db import conn

router = APIRouter()
PST = ZoneInfo("America/Los_Angeles")

@router.post("/availability/merge")
def merge_users_availability(
    request: Request,
    user_id: str = Query(...),
    users_busy: list = Body(...),
    min_minutes: int = Query(30),
    day_start: str = Query("08:00"),
    day_end: str = Query("22:00")
    ):

    PST = ZoneInfo("America/Los_Angeles")

    # ---- Parse day bounds ----
    day_start_time = time.fromisoformat(day_start)
    day_end_time = time.fromisoformat(day_end)

    # ---- Normalize this request's manually-submitted busy blocks ----
    manual_blocks = []

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
            else:
                start_dt = start_dt.astimezone(PST)

            if end_dt.tzinfo is None:
                end_dt = end_dt.replace(tzinfo=PST)
            else:
                end_dt = end_dt.astimezone(PST)

            manual_blocks.append((start_dt, end_dt))

    # Persist them so other group members can see this user's busy times too -
    # previously manual entries only ever lived in this one response.
    conn.execute(
        "DELETE FROM busy_times WHERE user_id = ? AND source = 'manual'",
        (user_id,)
    )

    for start_dt, end_dt in manual_blocks:
        conn.execute(
            "INSERT INTO busy_times (user_id, start, end, source) VALUES (?, ?, ?, ?)",
            (user_id, start_dt.isoformat(), end_dt.isoformat(), "manual")
        )

    conn.commit()

    # ---- Gather busy times for this user + any group members, all from the DB ----
    today = datetime.now(PST).date()
    member_ids = [user_id]
    seen_member_keys = {user_id.strip().lower()}

    group_id = request.query_params.get("group")

    if group_id:
        for row in conn.execute(
            "SELECT user_id FROM group_members WHERE group_id = ?",
            (group_id,)
        ).fetchall():
            member_key = row[0].strip().lower()
            if member_key not in seen_member_keys:
                seen_member_keys.add(member_key)
                member_ids.append(row[0])

    all_busy = []
    busy_output = []
    seen_intervals = set()

    for uid in member_ids:
        rows = conn.execute(
            "SELECT start, end, source FROM busy_times WHERE user_id = ?",
            (uid,)
        ).fetchall()

        for start, end, source in rows:
            start_dt = datetime.fromisoformat(start).astimezone(PST)
            end_dt = datetime.fromisoformat(end).astimezone(PST)

            # Only consider busy time that falls on today (PST) - matches
            # what find_free_time computes free time for by default.
            if start_dt.date() != today:
                continue

            # Duplicate rows can pile up from things like a stale duplicate
            # group membership or a re-import - never show the same busy
            # interval twice.
            key = (start_dt.isoformat(), end_dt.isoformat())
            if key in seen_intervals:
                continue
            seen_intervals.add(key)

            all_busy.append((start_dt, end_dt))

            busy_output.append({
                "start": start_dt.isoformat(),
                "end": end_dt.isoformat(),
                "label": "(imported)" if source == "google" else "(manual)"
            })

    # ---- Merge busy intervals ----
    merged_busy = merge_intervals(all_busy)

    # ---- Compute free time (today only) ----
    results = []

    free_slots = find_free_time(
        merged_busy,
        target_date=today,
        day_start=day_start_time,
        day_end=day_end_time,
        min_minutes=min_minutes
    )

    for start, end in free_slots:
        results.append({
            "date": today.isoformat(),
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
    conn.execute(
        "INSERT OR IGNORE INTO groups (id) VALUES (?)",
        (group_id,)
    )

    existing_members = conn.execute(
        "SELECT user_id FROM group_members WHERE group_id = ?",
        (group_id,)
    ).fetchall()

    already_member = any(
        row[0].strip().lower() == user_id.strip().lower()
        for row in existing_members
    )

    if not already_member:
        conn.execute(
            "INSERT INTO group_members (group_id, user_id) VALUES (?, ?)",
            (group_id, user_id)
        )

    conn.commit()
    return {"joined": True}
