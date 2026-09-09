const PX_PER_HOUR = 44;

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

// Greedy lane assignment so overlapping busy blocks sit side by side
// instead of stacking on top of each other.
function assignLanes(blocks) {
  const sorted = [...blocks].sort((a, b) => a.startMin - b.startMin);
  const laneEnds = [];

  const placed = sorted.map((block) => {
    let lane = laneEnds.findIndex((end) => end <= block.startMin);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(block.endMin);
    } else {
      laneEnds[lane] = block.endMin;
    }
    return { ...block, lane };
  });

  return { placed, laneCount: Math.max(1, laneEnds.length) };
}

export default function DayTimeline({
  busyTimes,
  freeTimes,
  timezone,
  dayStartHour = 8,
  dayEndHour = 22
}) {
  const totalMinutes = (dayEndHour - dayStartHour) * 60;
  const totalHeight = (dayEndHour - dayStartHour) * PX_PER_HOUR;

  // Everything is plotted on ONE shared axis - the viewer's own timezone.
  // A group member's block still keeps its own timezone in the text list
  // above, but here it has to line up against the same clock as everyone
  // else's blocks, or overlaps/gaps would be plotted in the wrong place.
  function toSpan(startIso, endIso) {
    const startMin = wallClockMinutes(startIso, timezone, dayStartHour);
    const endMin = wallClockMinutes(endIso, timezone, dayStartHour);
    return {
      startMin: Math.max(0, startMin),
      endMin: Math.min(totalMinutes, endMin <= 0 ? totalMinutes : endMin)
    };
  }

  const busyBlocks = busyTimes
    .map((b) => {
      const { startMin, endMin } = toSpan(b.start, b.end);
      if (endMin <= 0 || startMin >= totalMinutes) return null;
      return { ...b, startMin, endMin };
    })
    .filter(Boolean);

  const { placed: busyLaned, laneCount } = assignLanes(busyBlocks);

  const now = new Date();
  const nowMin = wallClockMinutes(now.toISOString(), timezone, dayStartHour);
  const showNowLine = nowMin >= 0 && nowMin <= totalMinutes;

  const hourMarks = Array.from({ length: dayEndHour - dayStartHour + 1 }, (_, i) => dayStartHour + i);

  return (
    <div className="card">
      <div className="card-title">
        <h2>Today at a Glance</h2>
      </div>

      <div className="timeline">
        <div className="timeline-hours" style={{ height: `${totalHeight}px` }}>
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

        <div className="timeline-track" style={{ height: `${totalHeight}px` }}>
          {hourMarks.map((h) => (
            <div
              className="timeline-gridline"
              key={h}
              style={{ top: `${(h - dayStartHour) * PX_PER_HOUR}px` }}
            />
          ))}

          {freeTimes.map((slot, i) => {
            const { startMin, endMin } = toSpan(slot.start, slot.end);
            if (endMin <= 0 || startMin >= totalMinutes) return null;

            return (
              <div
                key={`free-${i}`}
                className={`timeline-block free ${i === 0 ? "best" : ""}`}
                style={{
                  top: `${(startMin / totalMinutes) * totalHeight}px`,
                  height: `${Math.max(4, ((endMin - startMin) / totalMinutes) * totalHeight)}px`
                }}
                title={`Free · ${slot.duration_minutes} min`}
              />
            );
          })}

          {busyLaned.map((b, i) => (
            <div
              key={`busy-${i}`}
              className="timeline-block busy"
              style={{
                top: `${(b.startMin / totalMinutes) * totalHeight}px`,
                height: `${Math.max(4, ((b.endMin - b.startMin) / totalMinutes) * totalHeight)}px`,
                left: `${(b.lane / laneCount) * 100}%`,
                width: `${100 / laneCount}%`
              }}
              title={`Busy ${b.label || ""}`}
            />
          ))}

          {showNowLine && (
            <div
              className="timeline-now-line"
              style={{ top: `${(nowMin / totalMinutes) * totalHeight}px` }}
            />
          )}
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
