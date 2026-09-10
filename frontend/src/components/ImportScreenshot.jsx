import { useState } from "react";

// fetch() has no upload-progress event, so XHR is used here to show real
// upload progress, then an indeterminate bar while Claude analyzes the
// image (that part has no measurable progress to report).
function uploadWithProgress(url, formData, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    // Fallback in case a progress event with 100% never fires (some
    // networks/proxies only report progress coarsely) - the upload phase
    // being over at all is what should move us into "analyzing".
    xhr.upload.onloadend = () => onProgress(100);

    xhr.onload = () => {
      let data = null;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        // leave data as null; handled below
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data);
      } else {
        reject(new Error(data?.detail || `Import failed (${xhr.status})`));
      }
    };

    xhr.onerror = () => reject(new Error("Network error during upload"));

    xhr.send(formData);
  });
}

export default function ImportScreenshot({ onImported }) {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState("");
  const [phase, setPhase] = useState("idle"); // idle | uploading | analyzing
  const [progress, setProgress] = useState(0);

  const loading = phase !== "idle";

  async function upload() {
    const userId = localStorage.getItem("userId");
    if (!userId) {
      setStatus("Connect Google Calendar or sign in first.");
      return;
    }
    if (!file) return;

    setPhase("uploading");
    setProgress(0);
    setStatus("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const data = await uploadWithProgress(
        `https://calender-app-mm4q.onrender.com/import/screenshot?user_id=${userId}`,
        formData,
        (pct) => {
          setProgress(pct);
          if (pct >= 100) setPhase("analyzing");
        }
      );

      if (!data || data.imported === 0) {
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
      setPhase("idle");
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
          {phase === "uploading" && "Uploading..."}
          {phase === "analyzing" && "Analyzing..."}
          {phase === "idle" && "Import"}
        </button>
      </div>

      {loading && (
        <div className="progress-track">
          <div
            className={`progress-fill ${phase === "analyzing" ? "indeterminate" : ""}`}
            style={phase === "uploading" ? { width: `${progress}%` } : undefined}
          />
        </div>
      )}

      {status && <p className="empty-state">{status}</p>}
    </div>
  );
}
