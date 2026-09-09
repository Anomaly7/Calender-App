import { useState } from "react";

function formatLocal(datetimeLocalValue) {
  // datetime-local values have no timezone - they're the browser's own
  // local time, so parsing/formatting them needs no zone conversion.
  const d = new Date(datetimeLocalValue);
  if (isNaN(d)) return datetimeLocalValue;

  return d.toLocaleString(undefined, {
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  });
}

export default function AvailabilityForm({
  manualBusy,
  setManualBusy,
  onSubmit
}) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function addBusy() {
    if (!start || !end) return;

    setManualBusy([...manualBusy, { start, end }]);
    setStart("");
    setEnd("");
  }

  function removeBusy(index) {
    setManualBusy(manualBusy.filter((_, i) => i !== index));
  }

  async function submit() {
    setLoading(true);
    setError("");

    try {
      await onSubmit(manualBusy);
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <div className="card-title">
        <h2>Manual Busy Times</h2>
      </div>

      <div className="datetime-row">
        <input
          type="datetime-local"
          value={start}
          onChange={(e) => setStart(e.target.value)}
        />
        <span className="arrow">→</span>
        <input
          type="datetime-local"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
        />
      </div>

      <div className="form-actions">
        <button className="btn-ghost" onClick={addBusy}>Add Busy Slot</button>
        <button className="btn btn-primary" onClick={submit} disabled={loading}>
          {loading && <span className="spinner" />}
          {loading ? "Finding..." : "Find Free Time"}
        </button>
      </div>

      {error && <p className="error-text">{error}</p>}

      {manualBusy.length === 0 ? (
        <p className="empty-state">No manual busy times added yet.</p>
      ) : (
        <ul className="chip-list">
          {manualBusy.map((b, i) => (
            <li className="chip" key={i}>
              <span>{formatLocal(b.start)} → {formatLocal(b.end)}</span>
              <button
                className="chip-remove"
                onClick={() => removeBusy(i)}
                aria-label="Remove this busy slot"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
