import { useState } from "react";

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
    <div>
      <h3>Manual Busy Times</h3>

      <input
        type="datetime-local"
        value={start}
        onChange={(e) => setStart(e.target.value)}
      />

      <input
        type="datetime-local"
        value={end}
        onChange={(e) => setEnd(e.target.value)}
      />

      <br /><br />

      <button onClick={addBusy}>Add Busy Slot</button>
      <button onClick={submit} disabled={loading}>
        Find Free Time
      </button>

      {error && <p style={{ color: "red" }}>{error}</p>}

      <ul>
        {manualBusy.map((b, i) => (
          <li key={i}>
            {b.start} → {b.end}
          </li>
        ))}
      </ul>
    </div>
  );
}
