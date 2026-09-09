export default function Results({ slots, timezone }) {
  if (!slots.length) return null;

  return (
    <div>
      <h3>Best Free Times</h3>

      <ul>
        {slots.map((slot, i) => (
          <li key={i}>
            {new Date(slot.start).toLocaleTimeString(undefined, { timeZone: timezone })} –{" "}
            {new Date(slot.end).toLocaleTimeString(undefined, { timeZone: timezone })}
            {" "}({formatDuration(slot.duration_minutes)})
          </li>
        ))}
      </ul>
    </div>
  );
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
