🚀 NeonType Race

Real-time Multiplayer Typing Race Game
Built with FastAPI, WebSockets & Vanilla JS
Live Demo: https://neon-type-race.vercel.app/

🎮 About The Project

NeonType Race is a real-time multiplayer typing game where up to 4 players compete in a live typing race.

Players:

Create or join a room

Share a 4-letter room code

Race against each other in real time

See live WPM, accuracy, and progress

View a detailed leaderboard summary at the end

The project is split into:

🌐 Frontend (Vercel Deployment)

⚙️ Backend API + WebSockets (Render Deployment)

✨ Features

🏁 Real-time multiplayer race (WebSocket powered)

👥 Up to 4 players per room

🔑 Auto-generated 4-letter room codes

📊 Live WPM & accuracy tracking

🎨 Neon glassmorphism UI

🏆 Dynamic leaderboard with rankings

🔄 Play Again functionality

📱 Fully responsive design

🧠 Tech Stack
Frontend

HTML5 – 

index

CSS3 (Glassmorphism UI) – 

style

Vanilla JavaScript (Game Logic + WebSockets) – 

app

Deployed on Vercel

SPA rewrite config – 

vercel

Backend

Python 3.11

FastAPI – 

server

Uvicorn

WebSockets

Deployed on Render

Render config – 

render

Requirements – 

requirements

🏗️ Project Structure
NeonType-Race/
│
├── index.html        # Frontend UI
├── style.css         # Styling & animations
├── app.js            # Game logic + WebSocket client
├── server.py         # FastAPI backend
├── requirements.txt  # Python dependencies
├── render.yaml       # Render deployment config
└── vercel.json       # Vercel routing config
🔄 How It Works
1️⃣ Room Creation

Host creates a room via REST API.

Backend generates a unique 4-letter code.

Player receives a unique UUID.

2️⃣ WebSocket Connection

Each player connects to:

/ws/{room_code}/{player_id}

This enables:

Live progress updates

Real-time WPM tracking

Race finish detection

Instant leaderboard broadcast

3️⃣ Race Logic

Backend selects a random paragraph.

Time limit is calculated dynamically.

Players send typing progress continuously.

Rankings assigned based on finish order.

Summary screen displays final results.

🚀 Deployment
Frontend (Vercel)

Push project to GitHub

Import into Vercel

Deploy

Ensure vercel.json is present for SPA routing

Backend (Render)

Create a new Web Service

Connect GitHub repository

Runtime: Python 3.11

Start Command:

uvicorn server:app --host 0.0.0.0 --port $PORT

Add requirements.txt

🔗 Connecting Frontend to Backend

In app.js, set:

const RENDER_BACKEND_URL = 'https://your-backend-name.onrender.com';
📊 Game Metrics Tracked

WPM (Words Per Minute)

Accuracy (%)

Progress (%)

Finish Rank

Timeout detection

Total words & characters per race

🔥 Future Improvements

Global leaderboard

User accounts & authentication

Database integration

Private friend invites

Sound effects & animations

Spectator mode

Mobile app version

🧪 Local Development
Backend
pip install -r requirements.txt
uvicorn server:app --reload
Frontend

Just open index.html in browser
(or use Live Server in VS Code)

🏆 Why This Project Is Strong

Real-time architecture

WebSocket-based multiplayer

Clean UI/UX

Proper deployment setup

Scalable structure

Production-ready routing

Handles disconnect logic

Smart race completion logic

This isn’t just a typing game — it’s a full real-time multiplayer system.

👨‍💻 Author

Pranav 
Engineering Student
Built for learning, hackathons & real-time system practice.
