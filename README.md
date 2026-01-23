# Calendar Availability App

**Live Demo:**  
👉 https://calender-app-one-xi.vercel.app

---

## 📌 Overview

The **Calendar Availability App** is a full-stack web application that helps users find the best available meeting times by combining multiple schedules.

Users can connect their Google Calendar, add manual busy times, and instantly see **ranked free-time slots**. The app is designed to solve a real coordination problem in a clean, user-friendly way.

No setup is required — simply open the live link above.

---

## ✨ What the App Does

- Imports busy events from Google Calendar
- Allows users to manually add busy time blocks
- Merges overlapping schedules automatically
- Finds valid free-time windows
- Ranks free times by quality (duration and time of day)
- Supports group scheduling via shareable links
- Saves schedules so data persists on refresh

---

## 🧠 Key Features

### Google Calendar Integration
- Secure OAuth login
- Reads busy events from the user’s primary calendar
- Automatically updates availability

### Smart Availability Engine
- Merges all busy intervals into a single schedule
- Detects free time within daily boundaries
- Filters out short or unusable gaps

### Ranked Results
- Longer time slots score higher
- Midday hours are prioritized
- Results are displayed in readable durations (e.g., *2 hours 15 minutes*)

### Group Scheduling
- Create a group link
- Combine availability from multiple users
- Find the best shared meeting times

### Persistent State
- Busy times and results remain saved when the page reloads
- No account creation required

---

## 🛠 Tech Stack

### Frontend
- React (Vite)
- JavaScript
- Deployed on **Vercel**

### Backend
- FastAPI (Python)
- Google Calendar API
- SQLite
- Deployed on **Render**

---

## 🚀 How to Use

1. Open the live demo link
2. Connect your Google Calendar
3. Add any additional busy times (optional)
4. Click **Find Free Time**
5. Review the best available time slots

---

## 🎯 Why This Project Matters

This project demonstrates:
- Real-world OAuth authentication
- Calendar data processing and interval merging
- Algorithmic time-window analysis
- Full-stack deployment
- Clean UI/UX focused on usability

It was built as a practical application, not a tutorial project.

---

## 👤 Author

**Samuel Esebor**  
Full-stack developer focused on building practical, real-world applications.

---

👉 **Live Demo:** https://calender-app-one-xi.vercel.app  
No setup required — just click and try it.
