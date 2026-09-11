import { useEffect, useState } from "react";

export default function ConnectApple({ authHeaders, onImported }) {
  const [status, setStatus] = useState({ connected: false, apple_email: null });
  const [appleEmail, setAppleEmail] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("https://calender-app-mm4q.onrender.com/auth/apple/status", { headers: authHeaders() })
      .then((res) => (res.ok ? res.json() : { connected: false, apple_email: null }))
      .then(setStatus)
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function connect() {
    if (!appleEmail || !appPassword) {
      setMessage("Enter your Apple ID email and an app-specific password.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("https://calender-app-mm4q.onrender.com/auth/apple/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ apple_email: appleEmail, app_password: appPassword }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.detail || "Couldn't connect Apple Calendar.");

      setStatus({ connected: true, apple_email: appleEmail });
      setAppPassword("");
      setMessage(`Connected - imported ${data.imported} event${data.imported === 1 ? "" : "s"}.`);
      await onImported();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function resync() {
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("https://calender-app-mm4q.onrender.com/auth/apple/resync", {
        method: "POST",
        headers: authHeaders(),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.detail || "Couldn't resync Apple Calendar.");

      setMessage(`Resynced - imported ${data.imported} event${data.imported === 1 ? "" : "s"}.`);
      await onImported();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function disconnect() {
    setLoading(true);
    setMessage("");

    try {
      await fetch("https://calender-app-mm4q.onrender.com/auth/apple/disconnect", {
        method: "POST",
        headers: authHeaders(),
      });
      setStatus({ connected: false, apple_email: null });
      await onImported();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <div className="card-title">
        <h2>Apple Calendar</h2>
        <span className={`status-pill ${status.connected ? "connected" : "disconnected"}`}>
          <span className="dot" />
          {status.connected ? "Connected" : "Not connected"}
        </span>
      </div>

      {status.connected ? (
        <>
          <p className="card-subtitle">Connected as {status.apple_email}.</p>
          <div className="btn-row">
            <button className="btn btn-primary" onClick={resync} disabled={loading}>
              {loading && <span className="spinner" />}
              Resync
            </button>
            <button className="btn-danger-ghost" onClick={disconnect} disabled={loading}>
              Disconnect
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="card-subtitle">
            Requires an app-specific password, not your regular Apple ID password. Generate one
            at appleid.apple.com under Sign-In and Security → App-Specific Passwords.
          </p>
          <div className="btn-row">
            <input
              type="email"
              placeholder="Apple ID email"
              value={appleEmail}
              onChange={(e) => setAppleEmail(e.target.value)}
            />
            <input
              type="password"
              placeholder="App-specific password"
              value={appPassword}
              onChange={(e) => setAppPassword(e.target.value)}
            />
            <button className="btn btn-primary" onClick={connect} disabled={loading}>
              {loading && <span className="spinner" />}
              Connect
            </button>
          </div>
        </>
      )}

      {message && <p className="empty-state">{message}</p>}
    </div>
  );
}
