import { useState } from "react";

export default function AvailabilityForm({
  manualBusy,
  setManualBusy,
  onResults,
  onBusyUpdate
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
      const userId = localStorage.getItem("userId");
      const groupId = localStorage.getItem("groupId");

      const res = await fetch(
        `http://localhost:8000/availability/merge?user_id=${userId}&group=${groupId}&min_minutes=30&day_start=08:00&day_end=22:00&days=1`,

        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify([manualBusy]),
        }
      );

      if (!res.ok) {
        throw new Error("Failed to fetch availability");
      }

      const data = await res.json();
      onBusyUpdate(data.busy_times);
      onResults(data.ranked_free_time);
    } catch (err) {
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
