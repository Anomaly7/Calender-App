from datetime import datetime, time, timedelta
from typing import List, Tuple
from zoneinfo import ZoneInfo

PST = ZoneInfo("America/Los_Angeles")

def parse_event(event):
    start = event["start"]
    end = event["end"]

    if "dateTime" in start:
        start_dt = datetime.fromisoformat(start["dateTime"]).astimezone(PST)
        end_dt = datetime.fromisoformat(end["dateTime"]).astimezone(PST)
    else:
        # all-day events block the whole day
        start_dt = datetime.fromisoformat(start["date"]).replace(tzinfo=PST)
        end_dt = datetime.fromisoformat(end["date"]).replace(tzinfo=PST)

    return start_dt, end_dt


def merge_intervals(intervals):
    if not intervals:
        return []

    intervals.sort(key=lambda x: x[0])
    merged = [intervals[0]]

    for start, end in intervals[1:]:
        last_start, last_end = merged[-1]

        if start <= last_end:
            merged[-1] = (last_start, max(last_end, end))
        else:
            merged.append((start, end))

    return merged



from zoneinfo import ZoneInfo

PST = ZoneInfo("America/Los_Angeles")

def find_free_time(
    busy_intervals,
    target_date,
    day_start,
    day_end,
    min_minutes=30
):
    free = []
    min_duration = timedelta(minutes=min_minutes)

    now_pst = datetime.now(PST)

    start_dt = datetime.combine(target_date, day_start, tzinfo=PST)
    end_dt = datetime.combine(target_date, day_end, tzinfo=PST)

    # If today, don’t look at past time
    if target_date == now_pst.date():
        start_dt = max(start_dt, now_pst)

    # Busy blocks only for this date
    day_busy = [
        (s, e) for s, e in busy_intervals
        if s.date() == target_date
    ]

    merged = merge_intervals(day_busy)

    current = start_dt

    for start, end in merged:
        if start > current:
            if start - current >= min_duration:
                free.append((current, start))
        current = max(current, end)

    if current < end_dt and end_dt - current >= min_duration:
        free.append((current, end_dt))

    return free

def score_slot(start: datetime, end: datetime) -> int:
    duration_minutes = int((end - start).total_seconds() / 60)

    score = duration_minutes
    hour = start.hour

    if 10 <= hour <= 18:
        score += 100
    elif 8 <= hour < 10 or 18 < hour <= 21:
        score += 40
    else:
        score -= 50

    return score
