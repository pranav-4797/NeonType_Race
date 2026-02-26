# 🏎️ NeonType Race

> **A real-time multiplayer typing racing game — up to 4 players, no server, no account needed.**

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Play%20Now-00eeff?style=for-the-badge&logo=github)](https://YOUR-USERNAME.github.io/neontype-race/)
[![Players](https://img.shields.io/badge/Players-2--4-ffe600?style=for-the-badge)]()
[![No Server](https://img.shields.io/badge/Backend-None%20(P2P)-00ff88?style=for-the-badge)]()
[![GitHub Pages](https://img.shields.io/badge/Hosted%20on-GitHub%20Pages-7000ff?style=for-the-badge&logo=github)]()

---

## 📸 Overview

NeonType Race is a browser-based multiplayer typing game where players race to type the same paragraph as fast and accurately as possible — all within a calculated time limit. Built with pure HTML, CSS, and JavaScript using WebRTC (PeerJS) for real-time peer-to-peer communication. No backend, no database, no login.

---

## ✨ Features

| Feature | Details |
|---|---|
| 👥 Multiplayer | Up to **4 players** per room |
| ⚡ Real-time | Live WPM, progress bars, and position updates |
| ⏱️ Time Limit | Auto-calculated from text length based on 60 WPM baseline |
| 📝 Shared Text | All players type the exact same paragraph |
| 🎯 Accuracy Tracking | Live accuracy % per player |
| 🏆 Leaderboard | Post-race rankings with WPM, accuracy, finish time |
| 🚗 Car Customization | 4 car shapes × 12 colors, saved to localStorage |
| 🌐 P2P Architecture | WebRTC via PeerJS — no server costs |
| 📱 Responsive | Works on desktop and mobile |
| 🚀 Zero Setup | Open the URL and play |

---

## 🎮 How to Play

### Hosting a Room
1. Open the game URL
2. Enter your **racer name** and pick a **car + color**
3. Click **Host Game**
4. Share the **4-letter room code** with up to 3 friends
5. Click **Start Race** once everyone has joined

### Joining a Room
1. Open the same game URL on any browser/device
2. Enter your name and pick your car
3. Type the room code your friend shared
4. Click **Join** — you'll land in the lobby automatically

### Racing
- Everyone types the **same paragraph**
- The **circular timer** in the HUD counts down — finish before it hits zero
- Your **live WPM** shows in the top-right of the HUD
- Track cars moving along progress bars in real time
- First to finish the full text wins 🏆
- Players still typing when time runs out are marked **Timed Out**

---

## ⏱️ Time Limit Formula

The time limit is calculated automatically from the text length:

```
timeLimit = ceil( wordCount / 60 WPM × 60 seconds × 1.5 )
```

- **60 WPM** = average typing speed baseline
- **1.5×** = breathing room multiplier (not too easy, not too punishing)
- A ~100-word paragraph gives roughly **150 seconds**
- The limit is the same for all players in the room

---

## 🏗️ Project Structure

```
neontype-race/
├── index.html      # 2-page app (Landing + Game)
├── app.js          # All game logic, P2P networking, UI rendering
├── style.css       # Full styling — landing, lobby, race, results
├── bg.jpg          # Background image for landing page
└── README.md       # This file
```

### Architecture

```
Page 1: Landing
  └── Name input, car/color picker, Host or Join

Page 2: Game
  ├── Lobby View    — player slots, room code, start button
  ├── Race View     — HUD + tracks + typing area
  └── Result Overlay — leaderboard, play again
```

### Network Topology (Star)

```
        HOST (peer)
       /     |     \
   Guest1  Guest2  Guest3

- Host holds all DataConnections
- Guests connect only to host
- Host rebroadcasts PROGRESS / FINISHED / TIMEOUT to all other guests
- Host triggers END_RACE when all players finish or time out
```

---

## 🚀 Deploying to GitHub Pages

### 1. Create a repo
Go to [github.com/new](https://github.com/new) and create a **public** repository named `neontype-race`.

### 2. Upload files
Upload all 4 files to the repo root:
- `index.html`
- `app.js`
- `style.css`
- `bg.jpg`

### 3. Enable Pages
`Settings` → `Pages` → Source: **Deploy from branch** → Branch: `main` / `/ (root)` → **Save**

### 4. Done!
Your game will be live at:
```
https://YOUR-USERNAME.github.io/neontype-race/
```

> Replace `YOUR-USERNAME` with your actual GitHub username.

---

## 🛠️ Running Locally

No build step required. Just serve the files with any static server:

```bash
# Option 1 — Python (built-in)
python3 -m http.server 8080

# Option 2 — Node.js
npx serve .

# Option 3 — VS Code
# Install "Live Server" extension → right-click index.html → Open with Live Server
```

Then open `http://localhost:8080` in your browser.

> **Note:** Opening `index.html` directly as a `file://` URL won't work because PeerJS requires an HTTP context.

---

## 🌐 How P2P Works

NeonType Race uses **PeerJS** — a wrapper around the browser's built-in WebRTC DataChannels API.

1. **Signaling**: PeerJS uses a free public signaling server (`0.peerjs.com`) to help players discover each other by room code. This is only used during the handshake.
2. **Data transfer**: Once connected, all game data (progress, WPM, finish events) flows **directly between browsers** — no server in the middle.
3. **No cost**: The free PeerJS cloud tier is sufficient for friend groups.

### If connections fail
- Make sure both players are on the same network type (most home/mobile networks work fine)
- Corporate firewalls or strict NAT environments can block WebRTC — try a hotspot
- The room code is valid as long as the host's browser tab stays open

---

## 📦 Tech Stack

| Layer | Tech |
|---|---|
| Language | Vanilla JavaScript (ES6+) |
| Styling | Pure CSS (custom properties, grid, flexbox) |
| Networking | [PeerJS 1.5.2](https://peerjs.com/) (WebRTC) |
| Fonts | Google Fonts — Orbitron, Fira Code, Space Grotesk |
| Hosting | GitHub Pages (static) |
| Storage | `localStorage` (profile data only) |
| Dependencies | PeerJS only — no frameworks, no bundler |

---

## 🎨 Customization

### Adding more texts
Edit the `TEXTS` array in `app.js`. Each entry should be a single paragraph of ~80–120 words for the best time-limit experience:

```js
const TEXTS = [
    `Your paragraph here. Make it interesting — players will
     read it closely as they type every single character.`,
    // ... more entries
];
```

### Changing the time multiplier
In `app.js`, adjust `TIME_FACTOR`:

```js
const TIME_FACTOR = 1.5;  // 1.0 = tight, 2.0 = generous
const IDEAL_WPM   = 60;   // baseline speed used for calculation
```

### Adding more players
Change `MAX_PLAYERS` in `app.js` (PeerJS supports up to ~10 simultaneous connections on the free tier):

```js
const MAX_PLAYERS = 4; // increase to 6, 8, etc.
```

Also update `PLAYER_COLORS` and `PLAYER_EMOJIS` arrays with additional entries.

---

## 🐛 Known Limitations

- **Host dependency**: If the host closes their tab, all guests are disconnected. The host must keep the tab open for the duration of the session.
- **PeerJS free tier**: The public signaling server has rate limits. For large-scale use, self-host [peerjs-server](https://github.com/peers/peerjs-server).
- **Mobile keyboards**: On-screen keyboards on mobile may obscure the typing input — scroll down if needed.
- **No reconnection**: If a player disconnects mid-race, they cannot rejoin the same room.

---

## 📄 License

MIT — do whatever you want with it. A star ⭐ is always appreciated!

---

## 🙏 Credits

- **PeerJS** — WebRTC made simple: [peerjs.com](https://peerjs.com/)
- **Google Fonts** — Orbitron, Fira Code, Space Grotesk
- **Background image** — `bg.jpg` (included in repo)
- Built with ❤️ and too much caffeine
