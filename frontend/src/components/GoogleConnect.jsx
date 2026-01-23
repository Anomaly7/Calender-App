export default function GoogleConnect() {

  function connectGoogle() {
    window.location.href = "https://calender-app-mm4q.onrender.com/auth/login";

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

