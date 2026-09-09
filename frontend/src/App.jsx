import { useState, useEffect } from "react";
import "./App.css";

import AvailabilityForm from "./components/AvailabilityForm";
import GoogleConnect from "./components/GoogleConnect";
import Results from "./components/Results";
import DayTimeline from "./components/DayTimeline";

const MY_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

function formatDateTime(iso, timeZone) {
  return new Date(iso).toLocaleString(undefined, {
    timeZone,
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  });
}

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
  const groupIdFromLink = params.get("group");

  useEffect(() => {
    if (userId) {
      localStorage.setItem("userId", userId);
    }
  }, [userId]);

  useEffect(() => {
    if (groupIdFromLink) {
      localStorage.setItem("groupId", groupIdFromLink);
    }
  }, [groupIdFromLink]);

  useEffect(() => {
    // Google's OAuth redirect drops the ?group= param, so by the time we
    // learn the userId (from the redirect) the group id may only be in
    // localStorage, not the URL. Check both so the join actually happens
    // regardless of which one arrives first.
    const joiningUserId = userId || localStorage.getItem("userId");
    const joiningGroupId = groupIdFromLink || localStorage.getItem("groupId");

    if (!joiningUserId || !joiningGroupId) return;

    fetch(
      `https://calender-app-mm4q.onrender.com/groups/join?group_id=${joiningGroupId}&user_id=${joiningUserId}`,
      { method: "POST" }
    );
  }, [groupIdFromLink, userId]);

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

  // Busy/free times are scoped to "today" server-side, so cached results
  // from a previous visit (or an earlier day) are stale as soon as the
  // page loads. Re-fetch automatically instead of waiting for the user to
  // click "Find Free Time" again.
  useEffect(() => {
    if (localStorage.getItem("userId")) {
      fetchAvailability(manualBusy).catch(err => console.error(err));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  async function fetchAvailability(extraBusy = []) {
    const userId = localStorage.getItem("userId");
    if (!userId) return;

    const groupId = localStorage.getItem("groupId");
    const groupParam = groupId ? `&group=${groupId}` : "";

    const res = await fetch(
      `https://calender-app-mm4q.onrender.com/availability/merge?user_id=${userId}${groupParam}&min_minutes=30&day_start=08:00&day_end=22:00&timezone=${encodeURIComponent(MY_TIMEZONE)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(extraBusy.length ? [extraBusy] : []),
      }
    );

    if (!res.ok) {
      throw new Error("Failed to fetch availability");
    }

    const data = await res.json();
    setBusyTimes(data.busy_times);
    setFreeTimes(data.ranked_free_time);
  }

  // 🧼 CLEAR EVERYTHING
  function clearAll() {
    setManualBusy([]);
    setBusyTimes([]);
    setFreeTimes([]);
    localStorage.removeItem("userId");
    localStorage.removeItem("groupId");
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

    localStorage.setItem("groupId", groupId);

    const link = `https://calender-app-one-xi.vercel.app/?group=${groupId}`;

    navigator.clipboard.writeText(link)
      .then(() => {
        alert("Group link copied to clipboard!");
      })
      .catch(() => {
        alert(`Copy this link:\n${link}`);
      });
  }


  const currentUserId = localStorage.getItem("userId");
  const busyTimesWithTz = busyTimes.map((b) => {
    const isMine = b.owner === currentUserId;
    return {
      ...b,
      isMine,
      displayTz: isMine ? MY_TIMEZONE : (b.source_timezone || "America/Los_Angeles")
    };
  });
  const freeTimesWithTz = freeTimes.map((f) => ({ ...f, displayTz: MY_TIMEZONE }));

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark">🗓️</span>
          <h1>Lookout</h1>
        </div>
        {email && (
          <div className="user-chip">
            Signed in as <strong>{email}</strong>
          </div>
        )}
      </header>

      <GoogleConnect connected={!!email} />

      <AvailabilityForm
        manualBusy={manualBusy}
        setManualBusy={setManualBusy}
        onSubmit={fetchAvailability}
      />

      <div className="toolbar">
        <button className="btn-ghost" onClick={clearAll}>Clear Schedule</button>
        <button className="btn-ghost" onClick={logout}>Logout / Disconnect Google</button>
        <button className="btn btn-primary" onClick={createGroupLink}>Create Group Link</button>
      </div>

      <p className="tz-note">
        🌐 Your times: <strong>{MY_TIMEZONE}</strong> · Other group members'
        times are shown in the zone they were originally entered in
      </p>

      <div className="card">
        <div className="card-title">
          <h2>Busy Times</h2>
        </div>

        {busyTimesWithTz.length === 0 ? (
          <p className="empty-state">No busy times found for today.</p>
        ) : (
          <ul className="busy-list">
            {busyTimesWithTz.map((b, i) => (
              <li className="busy-item" key={i}>
                <span>
                  {formatDateTime(b.start, b.displayTz)} → {formatDateTime(b.end, b.displayTz)}
                </span>
                <span className="label">
                  {b.label}{!b.isMine && ` · ${b.displayTz}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Results slots={freeTimes} timezone={MY_TIMEZONE} />

      <DayTimeline busyTimes={busyTimesWithTz} freeTimes={freeTimesWithTz} timezone={MY_TIMEZONE} />
    </div>
  );
}
