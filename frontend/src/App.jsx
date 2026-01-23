import { useState, useEffect } from "react";
import "./App.css";

import AvailabilityForm from "./components/AvailabilityForm";
import GoogleConnect from "./components/GoogleConnect";
import Results from "./components/Results";

export default function App() {
  // 🔹 MANUAL BUSY SLOTS (input form)
  const [manualBusy, setManualBusy] = useState(() => {
    const saved = localStorage.getItem("manualBusy");
    return saved ? JSON.parse(saved) : [];
  });

  // 🔹 MERGED BUSY TIMES (from backend)
  const [busyTimes, setBusyTimes] = useState(() => {
    const saved = localStorage.getItem("busyTimes");
    return saved ? JSON.parse(saved) : [];
  });

  // 🔹 FREE TIMES
  const [freeTimes, setFreeTimes] = useState(() => {
    const saved = localStorage.getItem("freeTimes");
    return saved ? JSON.parse(saved) : [];
  });

  // 🔁 Persist everything
  useEffect(() => {
    localStorage.setItem("manualBusy", JSON.stringify(manualBusy));
  }, [manualBusy]);

  useEffect(() => {
    localStorage.setItem("busyTimes", JSON.stringify(busyTimes));
  }, [busyTimes]);

  useEffect(() => {
    localStorage.setItem("freeTimes", JSON.stringify(freeTimes));
  }, [freeTimes]);

  // 🧼 CLEAR EVERYTHING
  function clearAll() {
    setManualBusy([]);
    setBusyTimes([]);
    setFreeTimes([]);
    localStorage.clear();
  }

  return (
    <div>
      <GoogleConnect />

      <AvailabilityForm
        manualBusy={manualBusy}
        setManualBusy={setManualBusy}
        onResults={setFreeTimes}
        onBusyUpdate={setBusyTimes}
      />

      <button onClick={clearAll} style={{ marginBottom: "20px" }}>
        Clear Schedule
      </button>

      <h3>Busy Times</h3>
      <ul>
        {busyTimes.map((b, i) => (
          <li key={i}>
            {new Date(b.start).toLocaleString()} →{" "}
            {new Date(b.end).toLocaleString()} {b.label}
          </li>
        ))}
      </ul>

      <Results slots={freeTimes} />
    </div>
  );
}
