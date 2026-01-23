export default function GoogleConnect() {

  function connectGoogle() {
    window.location.href = "http://localhost:8000/auth/login";
  }

  return (
    <div style={{ marginBottom: "20px" }}>
      <h3>Google Calendar</h3>
      <button onClick={connectGoogle}>
        Connect Google Calendar
      </button>
    </div>
  );
}

