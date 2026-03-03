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

##👨‍💻 Author

###Krishna
Engineering Student 
Real-time Web Developer
