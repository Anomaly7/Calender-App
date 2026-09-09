export default function Results({ slots, timezone }) {
  return (
    <div className="card">
      <div className="card-title">
        <h2>Best Free Times</h2>
      </div>

      {slots.length === 0 ? (
        <p className="empty-state">
          No free slots yet — connect Google Calendar or add busy times, then find free time.
        </p>
      ) : (
        <ul className="free-list">
          {slots.map((slot, i) => (
            <li className={`free-item ${i === 0 ? "best" : ""}`} key={i}>
              <span>
                {i === 0 && <span className="best-badge">Best</span>}
                {formatTime(slot.start, timezone)} – {formatTime(slot.end, timezone)}
              </span>
              <span className="duration">{formatDuration(slot.duration_minutes)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatTime(iso, timeZone) {
  return new Date(iso).toLocaleTimeString(undefined, {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  });
}

function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours && mins) {
    return `${hours} hour${hours > 1 ? "s" : ""} ${mins} minute${mins > 1 ? "s" : ""}`;
  }

  if (hours) {
    return `${hours} hour${hours > 1 ? "s" : ""}`;
  }

  return `${mins} minute${mins > 1 ? "s" : ""}`;
}
