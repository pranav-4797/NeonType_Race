# 🚀 Neon Type Race

Real-time multiplayer typing race with neon glass UI and live WebSocket synchronization.

🌐 **Live Demo:** https://neon-type-race.vercel.app/

---

## ✨ Features

- 🏁 Real-time multiplayer (up to 4 players)
- 🔑 4-letter room code system
- ⏱ Auto-calculated race timer
- 📊 Live WPM, accuracy & progress tracking
- 🏆 Dynamic leaderboard with rankings
- 🔁 Play Again without recreating room
- 🎨 Neon + glassmorphism responsive UI
- 🔌 WebSocket-based instant updates

---

## 🛠 Tech Stack

**Frontend**
- HTML
- CSS (Glassmorphism + Neon UI)
- Vanilla JavaScript
- Deployed on Vercel

**Backend**
- FastAPI
- WebSockets
- Uvicorn
- Deployed on Render

---

## ⚙️ How It Works

1. Host creates a room → unique 4-letter code generated.
2. Players join using the room code.
3. Host starts race.
4. Server selects random text and calculates time limit.
5. Players type in real-time.
6. WPM, accuracy, and progress are synced via WebSockets.
7. Leaderboard appears after race ends.

---

## 📂 Project Structure


neon-type-race/
│
├── index.html

├── style.css

├── app.js

├── bg.jpg

├── vercel.json

│

├── server.py

├── requirements.txt

└── render.yaml


---

## 🚀 Run Locally

### 1️⃣ Backend

pip install -r requirements.txt
uvicorn server:app --reload

Runs on:

http://127.0.0.1:8000
2️⃣ Frontend

In app.js, set:

const RENDER_BACKEND_URL = 'http://127.0.0.1:8000';

Then open index.html using Live Server.

🔌 API Endpoints
POST /api/rooms/create
POST /api/rooms/join
GET  /api/rooms/{room_code}
GET  /health

WebSocket:

/ws/{room_code}/{player_id}
📌 Future Improvements

Global leaderboard

User authentication

Database integration

Spectator mode

Anti-cheat validation

👨‍💻 Author

Krishna
Engineering Student | Real-time Web Developer
