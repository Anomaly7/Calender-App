const USER_COLORS = [
  "#fca5a5", // red
  "#93c5fd", // blue
  "#86efac", // green
  "#fde68a", // yellow
  "#d8b4fe", // purple
];

function formatTime(iso) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text);
  alert("Copied to clipboard!");
}

function renderHours(dayStart, dayEnd) {
  const hoursDiv = document.querySelector(".hours");
  hoursDiv.innerHTML = "";

  const startHour = parseInt(dayStart.split(":")[0]);
  const endHour = parseInt(dayEnd.split(":")[0]);

  for (let h = startHour; h <= endHour; h++) {
    const div = document.createElement("div");
    div.className = "hour";
    div.textContent = `${h}:00`;
    hoursDiv.appendChild(div);
  }
}


function minutesSinceStart(date, dayStart) {
  const [h, m] = dayStart.split(":").map(Number);
  return (date.getHours() - h) * 60 + (date.getMinutes() - m);
}


function renderBusyBlocks(usersBusy, dayStart) {
  const grid = document.getElementById("calendarGrid");
  const userCount = usersBusy.length;

  usersBusy.forEach((userIntervals, userIndex) => {
    const color = USER_COLORS[userIndex % USER_COLORS.length];

    userIntervals.forEach(interval => {
      const start = new Date(interval[0]);
      const end = new Date(interval[1]);

      const startMinutes = minutesSinceStart(start, dayStart);
      const endMinutes = minutesSinceStart(end, dayStart);

      const top = startMinutes;
      const height = Math.max(0, endMinutes - startMinutes);

      const block = document.createElement("div");
      block.className = "busy-block";
      block.style.top = `${top}px`;
      block.style.height = `${height}px`;

      // 🔑 lane math
      const GAP = 6; // px gap between lanes
      const laneWidth = 100 / userCount;
      block.style.width = `calc(${laneWidth}% - ${GAP}px)`;
      block.style.left = `calc(${laneWidth * userIndex}% + ${GAP / 2}px)`;


      block.style.background = color;

      block.innerHTML = `
        <div class="block-content">
            <strong>User ${userIndex + 1}</strong>
            <small>${formatTime(interval[0])} → ${formatTime(interval[1])}</small>
        </div>
      `;
      grid.appendChild(block);
    });
  });
}

function connectGoogle() {
  window.location.href = "http://127.0.0.1:8000/auth/login";
}

async function findAvailability() {
    const minMinutes = document.getElementById("minMinutes").value;
    const input = document.getElementById("busyInput").value;
    const dayStart = document.getElementById("dayStart").value;
    const dayEnd = document.getElementById("dayEnd").value;


    let usersBusy;
    try {
        usersBusy = JSON.parse(input);
    } catch {
        results.innerHTML = "Invalid JSON input";
        return;
    }

    const response = await fetch(
        `http://127.0.0.1:8000/availability/merge?min_minutes=${minMinutes}&day_start=${dayStart}&day_end=${dayEnd}`,
        {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(usersBusy)
        }
    );

    const data = await response.json();
    results.innerHTML = "";

    const grid = document.getElementById("calendarGrid");
    grid.innerHTML = "";
    renderHours(dayStart, dayEnd);
    renderBusyBlocks(usersBusy, dayStart);


    data.ranked_free_time.forEach((slot, index) => {
        const start = new Date(slot.start);
        const end = new Date(slot.end);

        const top = minutesSinceStart(start, dayStart);
        const height = slot.duration_minutes;

        const block = document.createElement("div");
        block.className = "free-block" + (index === 0 ? " best" : "");
        block.style.top = `${top}px`;
        block.style.height = `${height}px`;

        block.innerHTML = `
        <div class="block-content">
            <strong>${formatTime(slot.start)} → ${formatTime(slot.end)}</strong>
            <small>${slot.duration_minutes} min</small>
            ${index === 0 ? "<small>BEST OPTION</small>" : ""}
        </div>
        `;


        grid.appendChild(block);
    });

}

async function checkGoogleStatus() {
  const res = await fetch("http://127.0.0.1:8000/auth/status");
  const data = await res.json();

  const status = document.getElementById("googleStatus");
  const connectBtn = document.getElementById("googleBtn");
  const disconnectBtn = document.getElementById("googleDisconnectBtn");

  if (data.connected) {
    status.textContent = "Google Calendar connected";
    status.style.color = "green";
    connectBtn.textContent = "Reconnect Google Calendar";
    disconnectBtn.style.display = "inline-block";
  } else {
    status.textContent = "Not connected";
    status.style.color = "#666";
    connectBtn.textContent = "Connect Google Calendar";
    disconnectBtn.style.display = "none";
  }
}


checkGoogleStatus();

async function disconnectGoogle() {
  await fetch("http://127.0.0.1:8000/auth/disconnect", {
    method: "POST"
  });
  location.reload();
}


