const PX_PER_HOUR = 44;

function todayLocal() {
  const d = new Date();
  return ymd(d);
}

function ymd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return ymd(dt);
}

function dayOfWeek(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).getDay(); // 0 = Sunday .. 6 = Saturday
}

function dayNumber(dateStr) {
  return String(Number(dateStr.split("-")[2]));
}

function weekdayLabel(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "short" });
}

function monthDayLabel(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "numeric", day: "numeric" });
}

function wallClockMinutes(iso, timeZone, dayStartHour) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(new Date(iso));

  const hour = Number(parts.find((p) => p.type === "hour").value) % 24;
  const minute = Number(parts.find((p) => p.type === "minute").value);

  return (hour - dayStartHour) * 60 + minute;
}

function formatHourLabel(hour) {
  const h = ((hour % 24) + 24) % 24;
  if (h === 0) return "12 AM";
  if (h === 12) return "12 PM";
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

function formatBlockTime(iso, timeZone) {
  return new Date(iso).toLocaleTimeString(undefined, {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  });
}

// Greedy lane assignment so overlapping busy blocks sit side by side
// instead of stacking on top of each other. Lanes are computed per cluster
// of mutually-overlapping blocks, not for the whole day at once - a block
// that doesn't overlap anything should always render full width, even if
// two other blocks elsewhere that same day happen to overlap each other.
function assignLanes(blocks) {
  const sorted = [...blocks].sort((a, b) => a.startMin - b.startMin);
  const placed = [];

  let cluster = [];
  let clusterEnd = -Infinity;

  function flushCluster() {
    if (cluster.length === 0) return;

    const laneEnds = [];
    const withLane = cluster.map((block) => {
      let lane = laneEnds.findIndex((end) => end <= block.startMin);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(block.endMin);
      } else {
        laneEnds[lane] = block.endMin;
      }
      return { ...block, lane };
    });

    const laneCount = laneEnds.length;
    withLane.forEach((b) => placed.push({ ...b, laneCount }));
    cluster = [];
  }

  for (const block of sorted) {
    if (cluster.length > 0 && block.startMin >= clusterEnd) {
      flushCluster();
    }
    cluster.push(block);
    clusterEnd = cluster.length === 1 ? block.endMin : Math.max(clusterEnd, block.endMin);
  }
  flushCluster();

  return placed;
}

// A group member's own busy block never needs a label - it's obviously
// yours. Someone else's block shows the part of their email before the
// @, which is all we have (we only ever store an email, not a display
// name pulled from their Google profile).
function ownerLabel(owner, currentUserId) {
  if (!owner || owner === currentUserId) return null;
  return owner.split("@")[0];
}

export default function CalendarView({
  mode,
  busyTimes,
  freeTimes,
  timezone,
  currentUserId,
  dayStartHour = 8,
  dayEndHour = 22
}) {
  const today = todayLocal();
  const weekStart = addDays(today, -dayOfWeek(today));
  const dates = mode === "week" ? Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)) : [today];

  const totalMinutes = (dayEndHour - dayStartHour) * 60;
  const totalHeight = (dayEndHour - dayStartHour) * PX_PER_HOUR;
  const hourMarks = Array.from({ length: dayEndHour - dayStartHour + 1 }, (_, i) => dayStartHour + i);

  function toSpan(startIso, endIso) {
    const startMin = wallClockMinutes(startIso, timezone, dayStartHour);
    const endMin = wallClockMinutes(endIso, timezone, dayStartHour);
    return {
      startMin: Math.max(0, startMin),
      endMin: Math.min(totalMinutes, endMin <= 0 ? totalMinutes : endMin)
    };
  }

  const now = new Date();
  const nowMin = wallClockMinutes(now.toISOString(), timezone, dayStartHour);
  const showNowLine = nowMin >= 0 && nowMin <= totalMinutes;

  const best = freeTimes[0];
  const showHeaders = mode === "week";

  return (
    <div className="card">
      <div className="card-title">
        <h2>Calendar</h2>
      </div>

      <div className="calendar">
        <div className="calendar-hours">
          {showHeaders && <div className="calendar-header-spacer" />}
          <div className="calendar-hours-track" style={{ height: `${totalHeight}px` }}>
            {hourMarks.map((h) => (
              <div
                className="timeline-hour-label"
                key={h}
                style={{ top: `${(h - dayStartHour) * PX_PER_HOUR}px` }}
              >
                {formatHourLabel(h)}
              </div>
            ))}
          </div>
        </div>

        <div className="calendar-main">
          {showHeaders && (
            <div className="calendar-headers-row">
              {dates.map((date) => {
                const isToday = date === today;
                return (
                  <div className={`calendar-day-header ${isToday ? "today" : ""}`} key={date}>
                    <span className="wd">{weekdayLabel(date)}</span>
                    <span className="md">
                      {isToday ? (
                        <span className="today-circle">{dayNumber(date)}</span>
                      ) : (
                        monthDayLabel(date)
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="calendar-grid-frame">
            {dates.map((date) => {
              const isToday = date === today;

              const dayBusy = busyTimes
                .filter((b) => b.date === date)
                .map((b) => ({ ...b, ...toSpan(b.start, b.end) }))
                .filter((b) => b.endMin > 0 && b.startMin < totalMinutes);

              const busyLaned = assignLanes(dayBusy);

              const dayFree = freeTimes
                .filter((f) => f.date === date)
                .map((f) => ({ ...f, ...toSpan(f.start, f.end), isBest: f === best }))
                .filter((f) => f.endMin > 0 && f.startMin < totalMinutes);

              return (
                <div className="timeline-track" style={{ height: `${totalHeight}px` }} key={date}>
                  {hourMarks.map((h) => (
                    <div
                      className="timeline-gridline"
                      key={h}
                      style={{ top: `${(h - dayStartHour) * PX_PER_HOUR}px` }}
                    />
                  ))}

                  {dayFree.map((f, i) => (
                    <div
                      key={`free-${i}`}
                      className={`timeline-block free ${f.isBest ? "best" : ""}`}
                      style={{
                        top: `${(f.startMin / totalMinutes) * totalHeight}px`,
                        height: `${Math.max(4, ((f.endMin - f.startMin) / totalMinutes) * totalHeight)}px`
                      }}
                      title={`Free · ${f.duration_minutes} min`}
                    >
                      <div className="block-content">
                        <span className="block-time">
                          {formatBlockTime(f.start, timezone)} – {formatBlockTime(f.end, timezone)}
                        </span>
                        <span className="block-sub">{f.isBest ? "Best free slot" : "Free"}</span>
                      </div>
                    </div>
                  ))}

                  {busyLaned.map((b, i) => {
                    const owner = ownerLabel(b.owner, currentUserId);
                    return (
                      <div
                        key={`busy-${i}`}
                        className="timeline-block busy"
                        style={{
                          top: `${(b.startMin / totalMinutes) * totalHeight}px`,
                          height: `${Math.max(4, ((b.endMin - b.startMin) / totalMinutes) * totalHeight)}px`,
                          left: `calc(${(b.lane / b.laneCount) * 100}% + 2px)`,
                          width: `calc(${100 / b.laneCount}% - 4px)`
                        }}
                        title={`${b.title || b.label || "Busy"}${owner ? ` · ${owner}` : ""}`}
                      >
                        <div className="block-content">
                          {b.title ? (
                            <>
                              <span className="block-time">{b.title}</span>
                              <span className="block-sub">
                                {formatBlockTime(b.start, timezone)} – {formatBlockTime(b.end, timezone)}
                              </span>
                              {owner && <span className="block-sub">{owner}</span>}
                            </>
                          ) : (
                            <>
                              <span className="block-time">
                                {formatBlockTime(b.start, timezone)} – {formatBlockTime(b.end, timezone)}
                              </span>
                              <span className="block-sub">{owner || b.label}</span>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {isToday && showNowLine && (
                    <div
                      className="timeline-now-line"
                      style={{ top: `${(nowMin / totalMinutes) * totalHeight}px` }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="timeline-legend">
        <span><span className="swatch busy" /> Busy</span>
        <span><span className="swatch free" /> Free</span>
        <span><span className="swatch free best" /> Best free slot</span>
      </div>
    </div>
  );
}
