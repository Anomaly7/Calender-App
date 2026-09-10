import { useState } from "react";

export default function ImportScreenshot({ onImported }) {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function upload() {
    const userId = localStorage.getItem("userId");
    if (!userId) {
      setStatus("Connect Google Calendar or sign in first.");
      return;
    }
    if (!file) return;

    setLoading(true);
    setStatus("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(
        `https://calender-app-mm4q.onrender.com/import/screenshot?user_id=${userId}`,
        { method: "POST", body: formData }
      );

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.detail || "Import failed");
      }

      if (data.imported === 0) {
        setStatus("Didn't find any recognizable schedule in that image - try a clearer screenshot.");
      } else {
        const names = [...new Set((data.parsed || []).map((e) => e.title).filter(Boolean))];
        setStatus(
          `Imported ${data.imported} time block${data.imported === 1 ? "" : "s"}` +
          (names.length ? `: ${names.join(", ")}` : "")
        );
      }
      setFile(null);
      await onImported();
    } catch (err) {
      console.error(err);
      setStatus(err.message || "Something went wrong reading that screenshot.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <div className="card-title">
        <h2>Import Schedule Screenshot</h2>
      </div>
      <p className="card-subtitle">
        Upload a screenshot of a weekly schedule (like a course timetable) and it'll be
        read into your calendar as recurring busy times for this week.
      </p>

      <div className="btn-row">
        <input
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          onChange={(e) => setFile(e.target.files[0] || null)}
        />
        <button className="btn btn-primary" onClick={upload} disabled={!file || loading}>
          {loading && <span className="spinner" />}
          {loading ? "Reading..." : "Import"}
        </button>
      </div>

      {status && <p className="empty-state">{status}</p>}
    </div>
  );
}
