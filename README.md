# ⚡ NeonType Race

> A high-octane, real-time multiplayer typing race game built with **FastAPI**, **WebSockets**, and modern **Cyberpunk Glassmorphism UI**.

![NeonType Race Preview Banner](bg.jpg)

[![FastAPI](https://img.shields.io/badge/FastAPI-0.111.0-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Python](https://img.shields.io/badge/Python-3.11-3776AB?style=flat-square&logo=python)](https://www.python.org/)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?style=flat-square&logo=javascript)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![WebSockets](https://img.shields.io/badge/WebSockets-Enabled-FF6600?style=flat-square&logo=websocket)](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API)
[![Render](https://img.shields.io/badge/Backend-Render-46E3B7?style=flat-square&logo=render)](https://render.com/)
[![Vercel](https://img.shields.io/badge/Frontend-Vercel-000000?style=flat-square&logo=vercel)](https://vercel.com/)

---

## 🌟 Highlights & Features

- 🏎️ **Real-Time Multiplayer Racing**: Host or join custom rooms supporting up to **4 players** per lobby.
- ⚡ **Instant Live Telemetry**: Dynamic live progress bars with animated racer avatars (🏎️, 🚙, 🚕, 🚗) updated in real-time over WebSockets.
- 🎯 **Live WPM & Accuracy Metrics**: Precision speed (Words Per Minute) and accuracy tracking calculated instantaneously per keystroke with character-by-character color cues.
- 🔑 **Simple Room Code Sharing**: 4-character room codes with one-click clipboard copying for quick lobby joins.
- ⏱️ **Smart Time Limits**: Dynamic race duration limits automatically computed based on text length and target WPM thresholds.
- 🏆 **Comprehensive Post-Race Leaderboard**: Detailed summary screen ranking all racers with WPM, accuracy %, completion status, finish rank, and race stats.
- 👑 **Dynamic Host Management & Fallbacks**: Auto-promotion of new lobby hosts if the original host disconnects.
- 🎨 **Futuristic Neon Aesthetics**: Dark-mode glassmorphism interface featuring glowing neon accents, ambient background orbs, and clean typography (`Inter` & `Fira Code`).

---

## 🏗️ Architecture & Tech Stack

### Frontend
- **HTML5 & CSS3**: Custom responsive layout with vanilla CSS design system, glassmorphism containers, keyframe glow animations, and CSS custom properties.
- **JavaScript (ES6+)**: Event-driven application architecture, real-time typing DOM diffing, timer management, and WebSocket protocol handling.

### Backend
- **Python 3.11 & FastAPI**: Asynchronous REST endpoints for room creation, joining, and room snapshots.
- **Uvicorn & WebSockets**: Low-latency, full-duplex WebSocket event streaming for real-time race telemetry and state synchronization.
- **Pydantic**: Request payload validation.

---

## 📁 Repository Structure

```
typing-race/
├── index.html         # Main single-page interface & layout
├── style.css          # Cyberpunk glassmorphism styling & animations
├── app.js             # Client logic, DOM handling, & WebSocket engine
├── server.py          # FastAPI application, room management & WebSocket router
├── bg.jpg             # Background artwork
├── requirements.txt   # Python dependencies
├── render.yaml        # Render backend deployment configuration
├── vercel.json        # Vercel SPA routing configuration
└── .python-version    # Python version specifier (3.11.0)
```

---

## 🚀 Quick Start & Local Setup

### Prerequisites
- **Python 3.10+**
- **pip** (Python package installer)
- Any modern web browser (Chrome, Firefox, Edge, Safari)

### 1. Clone the Repository
```bash
git clone https://github.com/pranav-4797/NeonType_Race.git
cd NeonType_Race
```

### 2. Set Up Python Backend
Create and activate a virtual environment:

**On Windows:**
```bash
python -m venv venv
venv\Scripts\activate
```

**On macOS/Linux:**
```bash
python3 -m venv venv
source venv/bin/activate
```

Install backend dependencies:
```bash
pip install -r requirements.txt
```

Start the FastAPI server using Uvicorn:
```bash
uvicorn server:app --reload --host 0.0.0.0 --port 8000
```
The backend API and WebSocket server will run on `http://localhost:8000`.

### 3. Launch Frontend
Open `index.html` directly in your browser, or serve it using a simple HTTP server:
```bash
# Python simple HTTP server (optional)
python -m http.server 3000
```
Visit `http://localhost:3000` in your web browser.

---

## 🔌 API & WebSocket Documentation

### REST Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/rooms/create` | Create a new lobby room. Returns room code and player ID. |
| `POST` | `/api/rooms/join` | Join an existing lobby using a 4-letter room code. |
| `GET` | `/api/rooms/{code}` | Retrieve public details and player list for a room. |
| `GET` | `/health` | Health check endpoint returning backend status and active room count. |

### WebSocket Protocol

Connect to `ws://<host>/ws/{room_code}/{player_id}`.

#### Client Events Sent to Server:
- `start_race`: Triggered by host to commence the countdown and race.
- `typing_progress`: Transmits current WPM, progress %, and accuracy %.
- `finish_race`: Sent when player completes the typing text.
- `timeout`: Sent when race timer expires before completion.

#### Server Events Broadcast to Clients:
- `room_state`: Initial state payload upon WebSocket connection.
- `player_joined`: Broadcasted when a new player joins the lobby.
- `race_started`: Transmits race text, time limit, and player data.
- `player_progress`: Live progress broadcast of rival players.
- `player_finished`: Broadcasted when a racer finishes the text.
- `player_timeout`: Broadcasted when a racer times out.
- `race_ended`: Signals end of race and returns final standings.
- `player_left`: Sent when a player disconnects.

---

## ☁️ Deployment Guide

### Deploying Backend to Render
1. Connect your GitHub repository to [Render](https://render.com/).
2. Render automatically detects `render.yaml`.
3. Build command: `pip install -r requirements.txt`
4. Start command: `uvicorn server:app --host 0.0.0.0 --port $PORT`

### Deploying Frontend to Vercel
1. Connect your repository to [Vercel](https://vercel.com/).
2. Vercel utilizes `vercel.json` for SPA rewrites.
3. Deploy directly without requiring a build step.

---

## 🎮 How to Play

1. **Enter Your Name**: Optional custom display name (up to 16 characters).
2. **Host a Game**: Click **Host Game** to generate a unique 4-character Room Code.
3. **Invite Friends**: Share the code or click 📋 to copy it. Friends join by entering the code and clicking **Join**.
4. **Start the Race**: Once at least 2 players have joined, the Host clicks **🏁 Start Race**.
5. **Type Fast & Accurately**: Type the displayed passage accurately. Correct characters light up in neon green; errors highlight in red.
6. **Claim Victory**: Complete the text before time runs out and view full stats on the final leaderboard!

---

## 📄 License

This project is licensed under the [MIT License](LICENSE). Feel free to use, modify, and distribute.

---

## 🧑‍💻 Author

Developed with ❤️ by **[Pranav Chopade](https://github.com/pranav-4797)**.
