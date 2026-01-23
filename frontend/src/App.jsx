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

  const [email, setEmail] = useState(null);

  // 🔹 MERGED BUSY TIMES (from backend)
  const [busyTimes, setBusyTimes] = useState(() => {
    const saved = localStorage.getItem("busyTimes");
    return saved ? JSON.parse(saved) : [];
  });

  const params = new URLSearchParams(window.location.search);
  const userId = params.get("user");

  useEffect(() => {
    if (userId) {
      localStorage.setItem("userId", userId);
    }
  }, [userId]);

  // 🔹 FREE TIMES
  const [freeTimes, setFreeTimes] = useState(() => {
    const saved = localStorage.getItem("freeTimes");
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    const userId = localStorage.getItem("userId");
    if (!userId) return;

    fetch(`https://calender-app-mm4q.onrender.com/auth/me?user=${userId}`)
      .then(res => res.json())
      .then(data => setEmail(data.email));
  }, []);
  
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

  useEffect(() => {
    if (manualBusy.length > 0) {
      // optional: auto re-run availability on reload
      console.log("Loaded saved busy slots:", manualBusy);
    }
  }, []);

  // 🧼 CLEAR EVERYTHING
  function clearAll() {
    setManualBusy([]);
    setBusyTimes([]);
    setFreeTimes([]);
    localStorage.removeItem("userId");
    localStorage.removeItem("manualBusy");
    localStorage.removeItem("busyTimes");
    localStorage.removeItem("freeTimes");

  }
  function logout() {
    const userId = localStorage.getItem("userId");

    fetch(`https://calender-app-mm4q.onrender.com/auth/logout?user=${userId}`, {
      method: "POST"
    }).then(() => {
      localStorage.clear();
      setEmail(null);
      setManualBusy([]);
      setBusyTimes([]);
      setFreeTimes([]);
      window.location.reload();
    });
  }

  function createGroupLink() {
    const groupId = crypto.randomUUID();
    const userId = localStorage.getItem("userId");

    fetch(
      `https://calender-app-mm4q.onrender.com/groups/join?group_id=${groupId}&user_id=${userId}`,
      { method: "POST" }
    );


    const link = `https://YOUR-VERCEL-APP.vercel.app?group=${groupId}`;

    navigator.clipboard.writeText(link)
      .then(() => {
        alert("Group link copied to clipboard!");
      })
      .catch(() => {
        alert(`Copy this link:\n${link}`);
      });
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
      <button onClick={logout}>
        Logout / Disconnect Google
      </button>
      <button onClick={createGroupLink}>
        Create Group Link
      </button>
      {email && <p>Logged in as: <strong>{email}</strong></p>}
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
