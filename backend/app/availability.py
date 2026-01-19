from datetime import datetime, time, timedelta
from typing import List, Tuple

def parse_event(event) -> Tuple[datetime, datetime]:
    start = event["start"]
    end = event["end"]

    if "dateTime" in start:
        start_dt = datetime.fromisoformat(start["dateTime"])
        end_dt = datetime.fromisoformat(end["dateTime"])
    else:
        # All-day event
        start_dt = datetime.fromisoformat(start["date"])
        end_dt = datetime.fromisoformat(end["date"])

    return start_dt, end_dt

def normalize_datetime(dt):
    """
    Convert timezone-aware datetimes to naive datetimes.
    Assumes local time for this app.
    """
    if isinstance(dt, datetime) and dt.tzinfo is not None:
        return dt.replace(tzinfo=None)
    return dt


def merge_intervals(intervals):
    if not intervals:
        return []

    normalized = []
    for start, end in intervals:
        start = normalize_datetime(start)
        end = normalize_datetime(end)
        normalized.append((start, end))

    # Safe to sort now
    normalized.sort(key=lambda x: x[0])

    merged = [normalized[0]]

    for current in normalized[1:]:
        last = merged[-1]

        if current[0] <= last[1]:
            merged[-1] = (last[0], max(last[1], current[1]))
        else:
            merged.append(current)

    return merged


def find_free_time(
    busy_intervals,
    day_start: time,
    day_end: time,
    min_minutes: int = 30
):
    free_slots = []
    today = datetime.now().date()
    min_duration = timedelta(minutes=min_minutes)

    merged_busy = merge_intervals(busy_intervals)

    current = datetime.combine(today, day_start)

    for start, end in merged_busy:
        if start > current:
            slot = (current, start)
            if slot[1] - slot[0] >= min_duration:
                free_slots.append(slot)
        current = max(current, end)

    end_of_day = datetime.combine(today, day_end)
    if current < end_of_day:
        slot = (current, end_of_day)
        if slot[1] - slot[0] >= min_duration:
            free_slots.append(slot)

    return free_slots

def score_slot(start: datetime, end: datetime) -> int:
    duration_minutes = int((end - start).total_seconds() / 60)

    # Base score from duration
    score = duration_minutes

    hour = start.hour

    # Time-of-day preference
    if 10 <= hour <= 18:
        score += 100     # prime hours
    elif 8 <= hour < 10 or 18 < hour <= 21:
        score += 40      # acceptable
    else:
        score -= 50      # awkward hours

    return score

