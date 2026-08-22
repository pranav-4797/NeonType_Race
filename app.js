// ─── Config ──────────────────────────────────────────────────────────────────
// 🔧 SET YOUR RENDER BACKEND URL HERE (after deploying server.py to Render.com)
// Example: 'https://neontype-race-backend.onrender.com'
// Leave as empty string '' to use same-origin /api
const RENDER_BACKEND_URL = 'https://neontype-race-1.onrender.com';

// Auto-detect: if a backend URL is configured use it, else fall back to same-origin
const _backendOrigin = RENDER_BACKEND_URL.replace(/\/$/, '');
const API_BASE = _backendOrigin ? `${_backendOrigin}/api` : '/api';
const WS_BASE  = _backendOrigin
    ? _backendOrigin.replace(/^http/, 'ws')
    : `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`;

const PB_KEY  = 'neontype_pb';   // localStorage: personal-best ghost run
const NAME_KEY = 'neontype_name'; // localStorage: remembered player name

// ─── UI Elements ─────────────────────────────────────────────────────────────
const screens = {
    home:    document.getElementById('screen-home'),
    lobby:   document.getElementById('screen-lobby'),
    race:    document.getElementById('screen-race'),
    summary: document.getElementById('screen-summary')
};

const btns = {
    host:      document.getElementById('btn-host'),
    join:      document.getElementById('btn-join'),
    spectate:  document.getElementById('btn-spectate'),
    copy:      document.getElementById('btn-copy-code'),
    start:     document.getElementById('btn-start-race'),
    addBot:    document.getElementById('btn-add-bot'),
    invite:    document.getElementById('btn-invite'),
    playAgain: document.getElementById('btn-play-again'),
    share:     document.getElementById('btn-share'),
    quit:      document.getElementById('btn-quit')
};

const els = {
    playerNameInput:  document.getElementById('input-player-name'),
    roomInput:        document.getElementById('input-room-code'),
    displayRoom:      document.getElementById('display-room-code'),
    lobbyTitle:       document.getElementById('lobby-title'),
    playersContainer: document.getElementById('players-container'),
    textDisplay:      document.getElementById('text-display'),
    typingInput:      document.getElementById('typing-input'),
    tracksContainer:  document.getElementById('tracks-container'),
    timerDisplay:     document.getElementById('timer-display'),
    spectateBanner:   document.getElementById('spectate-banner'),
    heatmapSection:   document.getElementById('heatmap-section')
};

// ─── Game State ───────────────────────────────────────────────────────────────
let ws          = null;
let myPlayerId  = null;
let myRoomCode  = null;
let isHost      = false;
let isSpectator = false;

let gameData = {
    text:       '',
    startTime:  null,
    timeLimit:  0,
    wordCount:  0,
    charCount:  0,
    players:    {},   // slot_index -> player object
    mySlot:     null,
    finished:   false,
    summaryShown: false
};

let timerInterval    = null;
let progressInterval = null;

// Ghost racer state
let ghostPB   = loadGhostPB();  // saved personal best {wpm, accuracy, date, samples:[{t,p}]}
let ghostState = null;          // live playback during a race
let mySamples  = [];            // this run's samples (candidate for new PB)
let raceStartWall = null;       // Date.now() when my first keystroke happened

// Heat map capture (my typing)
let hmTimes = [];        // cumulative ms at which char i was typed correctly
let hmErrors = [];       // wrong keystrokes recorded at char i
let prevTypedLen = 0;
let hmStartPerf = 0;     // performance.now() of first keystroke

// Summary state
let lastSummaryPlayers = null;
let hmSelectedId = null;

let tickCount = 0;

// ─── Utilities ────────────────────────────────────────────────────────────────
function showScreen(id) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[id].classList.add('active');
}

function uuidv4() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

function getPlayerName() {
    const name = (els.playerNameInput.value.trim() || 'Anonymous').substring(0, 16);
    try { localStorage.setItem(NAME_KEY, name); } catch (_) {}
    return name;
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ─── Toast Notifications ─────────────────────────────────────────────────────
const toastContainer = document.getElementById('toast-container');

function toast(message, type = 'info', duration = 3500) {
    const icons = { info: '💡', success: '✅', error: '⚠️' };
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span><span class="toast-msg">${escapeHtml(message)}</span>`;
    toastContainer.appendChild(el);

    // Force reflow so the entry animation always plays for stacked toasts
    void el.offsetWidth;

    setTimeout(() => {
        el.classList.add('leaving');
        el.addEventListener('animationend', () => el.remove(), { once: true });
        setTimeout(() => el.remove(), 500); // safety net
    }, duration);
    return el;
}

// ─── URL / Invite helpers ────────────────────────────────────────────────────
function setUrlParam(code) {
    try { history.replaceState(null, '', `${location.pathname}?room=${code}`); } catch (_) {}
}
function clearUrlParam() {
    try { history.replaceState(null, '', location.pathname); } catch (_) {}
}

async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (_) {
        // Fallback for non-secure contexts
        try {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            const ok = document.execCommand('copy');
            ta.remove();
            return ok;
        } catch (_) {
            return false;
        }
    }
}

// ─── Ghost PB storage ────────────────────────────────────────────────────────
function loadGhostPB() {
    try {
        const raw = localStorage.getItem(PB_KEY);
        if (!raw) return null;
        const pb = JSON.parse(raw);
        if (pb && Array.isArray(pb.samples) && pb.samples.length > 1) return pb;
    } catch (_) {}
    return null;
}
function saveGhostPB(pb) {
    try { localStorage.setItem(PB_KEY, JSON.stringify(pb)); } catch (_) {}
}

// ─── API ─────────────────────────────────────────────────────────────────────
async function apiFetch(path, method = 'GET', body = null) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const url = API_BASE + path;
    let res;
    try {
        res = await fetch(url, opts);
    } catch (networkErr) {
        const isVercel = location.hostname.includes('vercel.app');
        const noBackend = !RENDER_BACKEND_URL;
        if (isVercel && noBackend) {
            throw new Error(
                'Backend not configured. Open app.js and set RENDER_BACKEND_URL to your Render.com URL.'
            );
        }
        throw new Error(`Cannot reach backend (${url}). Is the Render server running?`);
    }
    if (!res.ok) {
        let detail = 'Unknown error';
        try {
            const j = await res.json();
            detail = j.detail || JSON.stringify(j);
        } catch (_) {
            detail = `HTTP ${res.status} ${res.statusText}`;
        }
        throw new Error(detail);
    }
    return res.json();
}

// ─── Backend Health Check ─────────────────────────────────────────────────────
async function checkBackendHealth() {
    const statusEl = document.getElementById('backend-status');
    if (!statusEl) return;
    statusEl.textContent = '⏳ Connecting to server...';
    statusEl.className = 'backend-status checking';
    try {
        const r = await fetch(API_BASE.replace('/api', '') + '/health');
        if (r.ok) {
            statusEl.textContent = '🟢 Server online';
            statusEl.className = 'backend-status online';
        } else {
            throw new Error('bad status');
        }
    } catch (_) {
        const isVercel = location.hostname.includes('vercel.app');
        if (isVercel && !RENDER_BACKEND_URL) {
            statusEl.innerHTML = '🔴 Backend not configured — set <code>RENDER_BACKEND_URL</code> in app.js';
        } else {
            statusEl.textContent = '🟡 Server offline or waking up (Render free tier takes ~30s)';
        }
        statusEl.className = 'backend-status offline';
    }
}
checkBackendHealth();

// ─── WebSocket ────────────────────────────────────────────────────────────────
function connectWS(roomCode, playerId, spectator = false) {
    ws = new WebSocket(`${WS_BASE}/ws/${roomCode}/${playerId}`);

    ws.onopen = () => console.log('WS connected', spectator ? '(spectator)' : '');

    ws.onmessage = (e) => {
        try { handleServerMessage(JSON.parse(e.data)); }
        catch (err) { console.error('WS parse error:', err); }
    };

    ws.onclose = (e) => {
        if (e.code === 1000) return;
        if (e.code === 1008) {
            toast('Room not found or no longer available.', 'error');
            resetGame();
            return;
        }
        toast(isSpectator
            ? 'Spectation ended — disconnected from server.'
            : 'Disconnected from server. Returning to home.', 'error');
        resetGame();
    };

    ws.onerror = () => {
        toast('Connection error.', 'error');
    };
}

function wsSend(msg) {
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

// ─── Server Message Handler ───────────────────────────────────────────────────
function handleServerMessage(msg) {
    switch (msg.type) {

        case 'room_state':
            syncPlayers(msg.players);
            updateLobbyUI();
            break;

        case 'player_joined':
            mergePlayers([msg.player]);
            if (screens.lobby.classList.contains('active')) {
                const isBot = !!msg.player.is_bot;
                toast(isBot
                    ? `🤖 ${msg.player.name} joined (~${msg.player.skill_wpm} WPM)`
                    : `${msg.player.emoji} ${msg.player.name} joined the room`, 'info', 2500);
            }
            updateLobbyUI();
            break;

        case 'player_left':
            delete gameData.players[msg.slot_index];
            updateLobbyUI();
            break;

        case 'race_started':
            startRace(msg.text, msg.time_limit, msg.players, msg.word_count, msg.char_count);
            break;

        case 'player_progress': {
            const p = gameData.players[msg.slot_index];
            if (p) { p.wpm = msg.wpm; p.progress = msg.progress; p.accuracy = msg.accuracy; }
            renderTracks();
            break;
        }

        case 'player_finished': {
            const p = gameData.players[msg.slot_index];
            if (p) { p.finished = true; p.finish_rank = msg.finish_rank; p.wpm = msg.wpm; p.accuracy = msg.accuracy; p.progress = 100; }
            renderTracks();
            if (!isSpectator && msg.player_id !== myPlayerId) {
                toast(`🏁 ${p ? p.name : 'A player'} finished #${msg.finish_rank} (${msg.wpm} WPM)`, 'info', 2500);
            }
            break;
        }

        case 'player_timeout': {
            const p = gameData.players[msg.slot_index];
            if (p) { p.finished = true; p.timed_out = true; p.wpm = msg.wpm; }
            renderTracks();
            break;
        }

        case 'spectate_snapshot':
            handleSpectateSnapshot(msg);
            break;

        case 'error':
            toast(msg.msg || 'Server error', 'error');
            break;

        case 'race_ended':
            syncPlayers(msg.players);
            renderTracks();
            stopTimers();
            showSummary(msg.players);
            break;
    }
}

// ─── Player State ─────────────────────────────────────────────────────────────
function syncPlayers(arr) {
    gameData.players = {};
    for (const p of arr) gameData.players[p.slot_index] = p;
}
function mergePlayers(arr) {
    for (const p of arr) gameData.players[p.slot_index] = p;
}

// ─── Lobby UI ─────────────────────────────────────────────────────────────────
function updateLobbyUI() {
    const count = Object.keys(gameData.players).length;
    els.playersContainer.innerHTML = '';

    for (const p of Object.values(gameData.players)) {
        const isMe  = p.id === myPlayerId;
        const isBot = !!p.is_bot;
        const card = document.createElement('div');
        card.className = `player-card ${isMe ? 'you' : 'opponent'} active`;
        card.style.borderColor = p.color;
        card.style.boxShadow   = `0 0 16px ${p.color}33`;
        card.innerHTML = `
            <div class="avatar" style="border-color:${p.color}">${p.emoji}</div>
            <h3>${escapeHtml(p.name)}${isBot ? '<span class="bot-tag">BOT</span>' : ''}</h3>
            <span class="status ready" style="color:${p.color}">${isMe ? '(You)' : (isBot ? `~${p.skill_wpm} WPM` : 'Ready')}</span>
            ${isBot && isHost ? `<button class="bot-remove" data-pid="${p.id}" title="Remove ${escapeHtml(p.name)}">✕</button>` : ''}
        `;
        els.playersContainer.appendChild(card);
    }

    btns.addBot.classList.toggle('hidden', !(isHost && !isSpectator && count < 4));
    btns.invite.classList.toggle('hidden', isSpectator);

    if (isSpectator) {
        els.lobbyTitle.innerText = count < 2
            ? '👀 Spectating — waiting for the race to start...'
            : `👀 Spectating ${count} players — waiting for host to start...`;
    } else if (isHost) {
        if (count >= 2) {
            btns.start.classList.remove('hidden');
            els.lobbyTitle.innerText = `${count} player${count > 1 ? 's' : ''} ready — Start the race!`;
        } else {
            btns.start.classList.add('hidden');
            els.lobbyTitle.innerText = 'Waiting for at least one more player... (or add a bot!)';
        }
    } else {
        els.lobbyTitle.innerText = count < 2
            ? 'Waiting for more players...'
            : `${count} players connected — waiting for host to start...`;
    }
}

// Remove-bot clicks (event delegation)
els.playersContainer.addEventListener('click', (e) => {
    const btn = e.target.closest('.bot-remove');
    if (!btn) return;
    wsSend({ type: 'remove_bot', player_id: btn.dataset.pid });
});

// ─── Race ─────────────────────────────────────────────────────────────────────
function startRace(text, timeLimit, playersArray, wordCount, charCount) {
    gameData.text        = text;
    gameData.timeLimit   = timeLimit;
    gameData.startTime   = null;
    gameData.finished    = false;
    gameData.summaryShown = false;
    gameData.wordCount   = wordCount || text.trim().split(/\s+/).length;
    gameData.charCount   = charCount || text.length;

    syncPlayers(playersArray);
    gameData.mySlot = null;
    for (const p of Object.values(gameData.players)) {
        if (p.id === myPlayerId) { gameData.mySlot = p.slot_index; break; }
    }

    // Reset my local counters
    const me = gameData.players[gameData.mySlot];
    if (me) Object.assign(me, { progress: 0, wpm: 0, accuracy: 100, finished: false, finish_rank: 0, timed_out: false });

    // Reset per-race feature state
    resetHeatmapCapture();
    mySamples = [];
    raceStartWall = null;
    hmSelectedId = null;
    lastSummaryPlayers = null;
    els.heatmapSection.classList.add('hidden');

    // Ghost racer: replay my personal best alongside me
    ghostState = (ghostPB && !isSpectator)
        ? { samples: ghostPB.samples, cur: 0, done: false }
        : null;

    els.typingInput.value = '';
    if (isSpectator) {
        els.typingInput.disabled   = true;
        els.typingInput.placeholder = '👀 Spectator mode — typing is disabled';
        els.spectateBanner.classList.remove('hidden');
    } else {
        els.typingInput.disabled   = false;
        els.typingInput.placeholder = 'Start typing here when the race begins...';
        els.spectateBanner.classList.add('hidden');
    }

    renderText(0);
    renderTracks();
    showScreen('race');
    startTimers(timeLimit, 0);
    if (!isSpectator) setTimeout(() => els.typingInput.focus(), 100);
}

// Spectator joining mid-lobby or mid-race
function handleSpectateSnapshot(msg) {
    if (msg.status === 'racing' && msg.text) {
        gameData.text        = msg.text;
        gameData.timeLimit   = msg.time_limit;
        gameData.startTime   = null;
        gameData.finished    = false;
        gameData.summaryShown = false;
        gameData.wordCount   = msg.word_count || msg.text.trim().split(/\s+/).length;
        gameData.charCount   = msg.char_count || msg.text.length;

        syncPlayers(msg.players);
        gameData.mySlot = null;

        resetHeatmapCapture();
        mySamples = [];
        ghostState = null;
        lastSummaryPlayers = null;
        hmSelectedId = null;
        els.heatmapSection.classList.add('hidden');

        els.typingInput.value = '';
        els.typingInput.disabled   = true;
        els.typingInput.placeholder = '👀 Spectator mode — typing is disabled';
        els.spectateBanner.classList.remove('hidden');

        renderText(0);
        renderTracks();
        showScreen('race');
        startTimers(msg.time_limit, Math.max(0, msg.elapsed || 0));
        toast(`👀 Watching ${msg.players.length} racers live`, 'info', 3000);
    } else {
        syncPlayers(msg.players || []);
        els.displayRoom.innerText = myRoomCode;
        showScreen('lobby');
        updateLobbyUI();
        toast(`👀 Spectating room ${myRoomCode} — the race will start automatically`, 'info', 4000);
    }
}

// ─── Timers ───────────────────────────────────────────────────────────────────
function startTimers(timeLimit, startOffsetSec = 0) {
    stopTimers();
    const deadline = Date.now() + Math.max(1, timeLimit - startOffsetSec) * 1000;
    tickCount = 0;

    timerInterval = setInterval(() => {
        const rem = Math.max(0, (deadline - Date.now()) / 1000);
        els.timerDisplay.innerText = `⏱ ${Math.ceil(rem)}s`;
        tickCount++;

        const elapsed = timeLimit - rem;

        // Sample my progress once per second (for personal-best ghost)
        if (!isSpectator && !gameData.finished && tickCount % 4 === 0) {
            const me = gameData.players[gameData.mySlot];
            if (me && raceStartWall) {
                mySamples.push({ t: +elapsed.toFixed(2), p: +Math.min(100, me.progress || 0).toFixed(1) });
            }
        }

        updateGhost(elapsed);

        if (rem <= 0) {
            els.timerDisplay.innerText = '⏱ 0s';
            handleTimeout();
        }
    }, 250);

    progressInterval = setInterval(() => {
        if (isSpectator || !gameData.startTime || gameData.finished) return;
        const me = gameData.players[gameData.mySlot];
        if (me) wsSend({ type: 'typing_progress', wpm: me.wpm, progress: me.progress, accuracy: me.accuracy });
    }, 200);
}

function stopTimers() {
    clearInterval(timerInterval);
    clearInterval(progressInterval);
    timerInterval = null;
    progressInterval = null;
}

function handleTimeout() {
    stopTimers();
    if (isSpectator || gameData.finished) return;
    gameData.finished = true;
    els.typingInput.disabled = true;
    const me = gameData.players[gameData.mySlot];
    wsSend({ type: 'timeout', wpm: me ? me.wpm : 0, ...heatmapPayload() });
}

// ─── Ghost Racer ──────────────────────────────────────────────────────────────
function ghostProgressAt(sec) {
    const s = ghostState.samples;
    if (!s || !s.length) return 0;
    if (sec <= s[0].t) return sec <= 0 ? 0 : (s[0].p * sec) / Math.max(0.001, s[0].t);
    for (let i = s.length - 1; i >= 0; i--) {
        if (s[i].t <= sec) {
            const a = s[i], b = s[i + 1];
            if (!b) return a.p;
            const f = (sec - a.t) / Math.max(0.001, b.t - a.t);
            return a.p + (b.p - a.p) * Math.min(1, Math.max(0, f));
        }
    }
    return 0;
}

function updateGhost(elapsed) {
    if (!ghostState) return;
    ghostState.cur = Math.min(100, ghostProgressAt(elapsed));
    if (ghostState.cur >= 100) ghostState.done = true;
    renderTracks();
}

// ─── Heat Map Capture ─────────────────────────────────────────────────────────
function resetHeatmapCapture() {
    hmTimes = [];
    hmErrors = [];
    prevTypedLen = 0;
    hmStartPerf = 0;
}

function heatmapPayload() {
    const len = gameData.text.length;
    const times = new Array(len).fill(null);
    const errors = new Array(len).fill(0);
    for (let i = 0; i < len; i++) {
        if (hmTimes[i] != null) times[i] = hmTimes[i];
        if (hmErrors[i]) errors[i] = hmErrors[i];
    }
    return { char_times: times, errors };
}

// ─── Typing ───────────────────────────────────────────────────────────────────
els.typingInput.addEventListener('input', () => {
    if (gameData.finished || isSpectator) return;
    const typed = els.typingInput.value;

    if (!gameData.startTime && typed.length > 0) {
        gameData.startTime = Date.now();
        raceStartWall = Date.now();
        hmStartPerf = performance.now();
    }

    // ── Heat map capture: what happened at each new position? ──
    if (typed.length > prevTypedLen) {
        const nowPerf = performance.now();
        for (let i = prevTypedLen; i < typed.length; i++) {
            if (typed[i] === gameData.text[i]) {
                if (hmTimes[i] == null) hmTimes[i] = Math.round(nowPerf - hmStartPerf);
            } else {
                hmErrors[i] = (hmErrors[i] || 0) + 1;
            }
        }
    } else if (typed.length < prevTypedLen) {
        // Backspaced — clear timings beyond the cursor so retypes re-record
        for (let i = typed.length; i < hmTimes.length; i++) hmTimes[i] = null;
    }
    prevTypedLen = typed.length;

    let correctChars = 0;
    for (let i = 0; i < typed.length; i++) {
        if (typed[i] === gameData.text[i]) correctChars++;
    }

    const progress = Math.min(100, (typed.length / gameData.text.length) * 100);
    const accuracy = typed.length > 0 ? Math.round((correctChars / typed.length) * 100) : 100;
    let wpm = 0;
    if (gameData.startTime) {
        const mins = (Date.now() - gameData.startTime) / 60000;
        if (mins > 0) wpm = Math.floor((correctChars / 5) / mins);
    }

    const me = gameData.players[gameData.mySlot];
    if (me) { me.progress = progress; me.wpm = wpm; me.accuracy = accuracy; }

    renderText(typed.length, typed);
    renderTracks();

    if (typed === gameData.text && !gameData.finished) {
        gameData.finished = true;
        stopTimers();
        els.typingInput.disabled = true;
        // Final sample for the ghost recorder
        if (raceStartWall) {
            const t = (Date.now() - raceStartWall) / 1000;
            mySamples.push({ t: +t.toFixed(2), p: 100 });
        }
        wsSend({ type: 'finish_race', wpm, accuracy, ...heatmapPayload() });
    }
});

els.typingInput.addEventListener('paste', e => e.preventDefault());

// ─── Render ───────────────────────────────────────────────────────────────────
function renderText(typedLength, typedText = '') {
    let html = '';
    for (let i = 0; i < gameData.text.length; i++) {
        const raw = gameData.text[i];
        const ch  = raw === ' ' ? '&nbsp;' : escapeHtml(raw);
        let cls = i === typedLength ? 'current' : '';
        if (i < typedLength) cls = typedText[i] === raw ? 'correct' : 'incorrect';
        html += `<span class="${cls}">${ch}</span>`;
    }
    els.textDisplay.innerHTML = html;
}

function renderTracks() {
    els.tracksContainer.innerHTML = '';
    const players = Object.values(gameData.players).sort((a, b) => a.slot_index - b.slot_index);

    for (const p of players) {
        const isMe     = p.id === myPlayerId;
        const progress = Math.min(100, p.progress || 0);
        const wpm      = p.wpm || 0;
        let badge = '';
        if (p.finished) badge = p.timed_out ? ' ⏰' : ` 🏁 #${p.finish_rank}`;

        const track = document.createElement('div');
        track.className = 'racer-track';
        track.innerHTML = `
            <div class="racer-info">
                <span class="racer-name" style="color:${p.color}">${p.emoji} ${escapeHtml(p.name)}${isMe ? ' <em>(You)</em>' : ''}</span>
                <span class="racer-wpm">${wpm} WPM${badge}</span>
            </div>
            <div class="track-bar">
                <div class="track-fill" style="width:${progress}%; background: linear-gradient(90deg, ${p.color}33, ${p.color})">
                    <span class="car-emoji">${p.emoji}</span>
                </div>
            </div>
        `;
        els.tracksContainer.appendChild(track);
    }

    // Ghost racer (my personal-best replay)
    if (ghostState && !gameData.summaryShown) {
        const gp = Math.min(100, ghostState.cur || 0);
        const gEl = document.createElement('div');
        gEl.className = 'racer-track ghost';
        gEl.innerHTML = `
            <div class="racer-info">
                <span class="racer-name">👻 Your PB · ${ghostPB.wpm} WPM${gp >= 100 ? ' 🏁' : ''}</span>
                <span class="racer-wpm">${Math.round(gp)}%</span>
            </div>
            <div class="track-bar">
                <div class="track-fill" style="width:${gp}%">
                    <span class="car-emoji">👻</span>
                </div>
            </div>
        `;
        els.tracksContainer.appendChild(gEl);
    }
}

// ─── Match Summary ────────────────────────────────────────────────────────────
function showSummary(playersArray) {
    if (gameData.summaryShown) return;
    gameData.summaryShown = true;
    gameData.finished = true;
    lastSummaryPlayers = playersArray;

    // Sort by finish_rank (finished first), then timed_out last
    const sorted = [...playersArray].sort((a, b) => {
        if (a.timed_out && !b.timed_out) return 1;
        if (!a.timed_out && b.timed_out) return -1;
        if (a.finish_rank && b.finish_rank) return a.finish_rank - b.finish_rank;
        if (a.finish_rank) return -1;
        if (b.finish_rank) return 1;
        return 0;
    });

    const winner = sorted.find(p => !p.timed_out && p.finish_rank === 1);
    const me     = playersArray.find(p => p.id === myPlayerId);
    const myRank = me && !me.timed_out ? me.finish_rank : null;

    // Headline
    const summaryTitle = document.getElementById('summary-title');
    const summarySubtitle = document.getElementById('summary-subtitle');

    if (winner) {
        const iWon = winner.id === myPlayerId;
        summaryTitle.innerHTML = iWon
            ? '🏆 You Won!'
            : `${winner.emoji} ${escapeHtml(winner.name)} Wins!`;
        summaryTitle.style.color = iWon ? 'var(--success)' : winner.color;
        summarySubtitle.innerText = iWon
            ? `First place with ${winner.wpm} WPM — Outstanding!`
            : `${winner.wpm} WPM — Better luck next time!`;
    } else {
        summaryTitle.innerHTML = "⏰ Time's Up!";
        summaryTitle.style.color = 'var(--text-muted)';
        summarySubtitle.innerText = 'Nobody finished in time.';
    }

    // Leaderboard rows
    const tbody = document.getElementById('summary-tbody');
    tbody.innerHTML = '';
    const medals = ['🥇', '🥈', '🥉'];

    sorted.forEach((p, idx) => {
        const isMe = p.id === myPlayerId;
        const rank = p.timed_out ? '⏰' : (medals[idx] || `#${idx + 1}`);
        const statusText = p.timed_out ? 'Timed out' : `#${p.finish_rank} Finished`;
        const tr = document.createElement('tr');
        tr.className = isMe ? 'my-row' : '';
        tr.innerHTML = `
            <td class="rank-cell">${rank}</td>
            <td class="player-cell">
                <span class="player-dot" style="background:${p.color}"></span>
                <span style="color:${p.color}">${p.emoji} ${escapeHtml(p.name)}${p.is_bot ? ' <span class="bot-tag">BOT</span>' : ''}</span>
                ${isMe ? '<span class="you-badge">You</span>' : ''}
            </td>
            <td class="stat-cell">${p.wpm} <span class="stat-label">WPM</span></td>
            <td class="stat-cell">${p.accuracy ?? '—'}<span class="stat-label">%</span></td>
            <td class="stat-cell progress-cell">${Math.round(p.progress ?? 0)}<span class="stat-label">%</span></td>
            <td class="status-cell">${statusText}</td>
        `;
        tbody.appendChild(tr);
    });

    // Race stats footer
    document.getElementById('summary-words').innerText  = gameData.wordCount;
    document.getElementById('summary-chars').innerText  = gameData.charCount;
    document.getElementById('summary-players').innerText = sorted.length;
    const finishedCount = sorted.filter(p => !p.timed_out).length;
    document.getElementById('summary-finished').innerText = `${finishedCount}/${sorted.length}`;

    // Personal-best ghost: save if this run beats the record
    if (me && !isSpectator && me.finished && !me.timed_out && (me.progress ?? 0) >= 99.5) {
        if (!ghostPB || me.wpm > (ghostPB.wpm || 0)) {
            ghostPB = {
                wpm: me.wpm,
                accuracy: me.accuracy,
                date: new Date().toISOString(),
                samples: mySamples.slice(-1200)
            };
            saveGhostPB(ghostPB);
            toast(`🏅 New personal best: ${me.wpm} WPM — saved as your ghost!`, 'success', 4500);
        }
    }

    // Heat map
    hmSelectedId = me && playersArray.some(p => p.id === me.id && p.heatmap) ? me.id : null;
    renderHeatmapSection(playersArray);

    // Share button only makes sense for a participant with stats
    btns.share.classList.toggle('hidden', !me);

    showScreen('summary');
    if (isHost) btns.playAgain.classList.remove('hidden');
}

// ─── Post-race Heat Map ───────────────────────────────────────────────────────
function renderHeatmapSection(playersArray) {
    const withData = (playersArray || []).filter(p => p.heatmap);
    els.heatmapSection.classList.toggle('hidden', withData.length === 0);
    if (!withData.length) return;

    const tabs = document.getElementById('hm-tabs');
    tabs.innerHTML = '';
    withData.forEach(p => {
        const b = document.createElement('button');
        b.className = 'hm-tab' + (p.id === hmSelectedId ? ' active' : '');
        if (p.id !== hmSelectedId) b.style.color = p.color;
        else b.style.color = '';
        b.innerHTML = `${p.emoji} ${escapeHtml(p.name)}${p.is_bot ? ' 🤖' : ''}`;
        b.addEventListener('click', () => {
            hmSelectedId = p.id;
            renderHeatmapSection(lastSummaryPlayers || playersArray);
        });
        tabs.appendChild(b);
    });

    if (!withData.some(p => p.id === hmSelectedId)) hmSelectedId = withData[0].id;
    const sel = withData.find(p => p.id === hmSelectedId) || withData[0];
    renderHeatmapBox(sel);
}

function renderHeatmapBox(p) {
    const box = document.getElementById('hm-box');
    const ct = (p.heatmap && p.heatmap.char_times) || [];
    const er = (p.heatmap && p.heatmap.errors) || [];

    // Convert cumulative times into per-character durations
    let prev = 0;
    const dur = [];
    for (let i = 0; i < ct.length; i++) {
        if (ct[i] == null) { dur.push(null); }
        else { dur.push(Math.max(0, ct[i] - prev)); prev = ct[i]; }
    }

    const known = dur.filter(d => d != null && d > 0).sort((a, b) => a - b);
    const med = known.length ? known[Math.floor(known.length / 2)] : 0;

    let html = '';
    for (let i = 0; i < gameData.text.length; i++) {
        const raw = gameData.text[i];
        const ch  = raw === ' ' ? '&nbsp;' : escapeHtml(raw);
        const d = dur[i];
        const e = er[i] || 0;

        let cls = '';
        if (ct[i] == null) {
            cls = 'hm-unreached';
        } else if (d != null && med > 0) {
            if (d <= med * 0.6) cls = 'hm-fast';
            else if (d <= med * 1.6) cls = '';
            else if (d <= med * 2.6) cls = 'hm-slow';
            else cls = 'hm-vslow';
        }
        if (e > 0) cls += ' hm-err';
        html += `<span class="${cls.trim()}"${e > 0 ? ` data-errors="${e}"` : ''}>${ch}</span>`;
    }
    box.innerHTML = html || '<span class="hm-unreached">No data for this run.</span>';
}

// ─── Share Result Card ────────────────────────────────────────────────────────
function roundRectPath(x, ctx, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, 0);
    ctx.arcTo(w, 0, w, h, r);
    ctx.arcTo(w, h, 0, h, r);
    ctx.arcTo(0, h, 0, 0, r);
    ctx.arcTo(0, 0, w, 0, r);
    ctx.closePath();
}

async function shareResultCard(me, players) {
    if (document.fonts && document.fonts.ready) {
        try { await document.fonts.ready; } catch (_) {}
    }

    const W = 1200, H = 630;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const x = canvas.getContext('2d');

    // Background
    const g = x.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#141204');
    g.addColorStop(1, '#261a02');
    x.fillStyle = g;
    x.fillRect(0, 0, W, H);

    const orb = (cx, cy, r, col) => {
        const rg = x.createRadialGradient(cx, cy, 0, cx, cy, r);
        rg.addColorStop(0, col);
        rg.addColorStop(1, 'rgba(0,0,0,0)');
        x.fillStyle = rg;
        x.fillRect(cx - r, cy - r, r * 2, r * 2);
    };
    orb(150, 120, 330, 'rgba(245,196,0,0.20)');
    orb(1060, 530, 360, 'rgba(255,106,0,0.18)');

    // Frame
    x.save();
    x.translate(36, 36);
    roundRectPath(0, x, W - 72, H - 72, 28);
    x.strokeStyle = 'rgba(245,196,0,0.5)';
    x.lineWidth = 3;
    x.stroke();
    x.restore();

    // Title
    x.textAlign = 'left';
    x.fillStyle = '#f5c400';
    x.font = '800 52px Inter, sans-serif';
    x.fillText('NEON_TYPE', 80, 128);
    x.fillStyle = '#ff6a00';
    x.font = '800 30px Inter, sans-serif';
    x.fillText('R A C E', 84, 172);

    x.textAlign = 'right';
    x.fillStyle = '#a09880';
    x.font = '500 26px Inter, sans-serif';
    x.fillText(new Date().toLocaleDateString(), W - 80, 128);

    // Rank line
    const rankText = me.timed_out
        ? '⏰ TIMED OUT'
        : (me.finish_rank === 1 ? '🏆 1st PLACE' : `🏁 #${me.finish_rank || '-'} FINISH`);
    x.textAlign = 'left';
    x.fillStyle = '#ffffff';
    x.font = '700 40px Inter, sans-serif';
    x.fillText(rankText, 80, 258);

    // Big WPM
    x.fillStyle = '#ffffff';
    x.font = '800 180px "Fira Code", monospace';
    const wpmStr = String(me.wpm ?? 0);
    x.fillText(wpmStr, 76, 462);
    const wpmWidth = x.measureText(wpmStr).width;
    x.fillStyle = '#f5c400';
    x.font = '800 60px Inter, sans-serif';
    x.fillText('WPM', 92 + wpmWidth, 462);

    // Sub stats
    x.fillStyle = '#a09880';
    x.font = '600 30px Inter, sans-serif';
    x.fillText(
        `Accuracy ${me.accuracy ?? '-'}%   •   ${players.length} player${players.length > 1 ? 's' : ''}   •   ${gameData.wordCount || '-'} words`,
        80, 542
    );
    x.textAlign = 'right';
    x.fillStyle = 'rgba(255,255,255,0.55)';
    x.font = '500 24px Inter, sans-serif';
    x.fillText(location.origin.replace(/^https?:\/\//, ''), W - 80, 542);

    const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
    if (!blob) throw new Error('Canvas export failed');
    const file = new File([blob], 'neontype-result.png', { type: 'image/png' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
            files: [file],
            title: 'NeonType Race Result',
            text: `I typed ${me.wpm} WPM (${me.accuracy}% accuracy) on NeonType Race! 🏎️`
        });
        toast('Result shared!', 'success');
    } else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'neontype-result.png';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        toast('Result card downloaded 📥', 'success');
    }
}

// ─── Button Handlers ──────────────────────────────────────────────────────────
btns.host.addEventListener('click', async () => {
    const name = getPlayerName();
    btns.host.disabled  = true;
    btns.host.innerText = 'Creating...';
    try {
        const data = await apiFetch('/rooms/create', 'POST', { player_name: name });
        myPlayerId = data.player_id;
        myRoomCode = data.room_code;
        isHost     = true;
        isSpectator = false;
        els.displayRoom.innerText = myRoomCode;
        setUrlParam(myRoomCode);
        showScreen('lobby');
        updateLobbyUI();
        connectWS(myRoomCode, myPlayerId);
        toast(`Room ${myRoomCode} created — share your invite link!`, 'success');
    } catch (err) {
        toast('Failed to create room: ' + err.message, 'error');
        btns.host.disabled  = false;
        btns.host.innerText = 'Host Game';
    }
});

async function doJoin(code) {
    const name = getPlayerName();
    btns.join.disabled  = true;
    btns.join.innerText = 'Joining...';
    try {
        const data = await apiFetch('/rooms/join', 'POST', { room_code: code, player_name: name });
        myPlayerId = data.player_id;
        myRoomCode = code;
        isHost     = false;
        isSpectator = false;
        els.displayRoom.innerText = myRoomCode;
        setUrlParam(myRoomCode);
        showScreen('lobby');
        updateLobbyUI();
        connectWS(myRoomCode, myPlayerId);
        toast(`Joined room ${code}!`, 'success');
    } catch (err) {
        toast('Could not join room: ' + err.message, 'error');
        btns.join.disabled  = false;
        btns.join.innerText = 'Join';
    }
}

function readRoomCode() {
    const code = els.roomInput.value.trim().toUpperCase();
    if (code.length !== 4) {
        toast('Enter a valid 4-character room code.', 'error');
        return null;
    }
    return code;
}

btns.join.addEventListener('click', () => {
    const code = readRoomCode();
    if (code) doJoin(code);
});

btns.spectate.addEventListener('click', async () => {
    const code = readRoomCode();
    if (!code) return;
    btns.spectate.disabled = true;
    try {
        await apiFetch(`/rooms/${code}`); // verify the room exists
        myPlayerId  = 'spectator:' + uuidv4();
        myRoomCode  = code;
        isHost      = false;
        isSpectator = true;
        els.displayRoom.innerText = code;
        setUrlParam(code);
        els.lobbyTitle.innerText = 'Connecting to room...';
        showScreen('lobby');
        connectWS(code, myPlayerId, true);
    } catch (err) {
        toast('Cannot spectate: ' + err.message, 'error');
    } finally {
        btns.spectate.disabled = false;
    }
});

btns.copy.addEventListener('click', async () => {
    const code = els.displayRoom.innerText;
    if (await copyText(code)) {
        toast(`Room code ${code} copied!`, 'success', 2000);
        btns.copy.innerText = '✅';
        setTimeout(() => btns.copy.innerText = '📋', 2000);
    } else {
        toast('Copy failed — code: ' + code, 'error');
    }
});

btns.invite.addEventListener('click', async () => {
    if (!myRoomCode) return;
    const link = `${location.origin}${location.pathname}?room=${myRoomCode}`;
    if (await copyText(link)) {
        toast('🔗 Invite link copied — send it to friends!', 'success');
    } else {
        toast('Copy failed — link: ' + link, 'error', 6000);
    }
});

btns.addBot.addEventListener('click', () => {
    wsSend({ type: 'add_bot' });
});

btns.start.addEventListener('click', () => wsSend({ type: 'start_race' }));

btns.playAgain.addEventListener('click', () => {
    if (isHost) {
        screens.summary.classList.remove('active');
        wsSend({ type: 'start_race' });
    }
});

btns.share.addEventListener('click', async () => {
    if (!lastSummaryPlayers) return;
    const me = lastSummaryPlayers.find(p => p.id === myPlayerId);
    if (!me) return toast('Nothing to share yet.', 'error');
    btns.share.disabled = true;
    try {
        await shareResultCard(me, lastSummaryPlayers);
    } catch (err) {
        console.error('Share failed:', err);
        toast('Could not generate the result image.', 'error');
    } finally {
        btns.share.disabled = false;
    }
});

btns.quit.addEventListener('click', resetGame);

// ─── Mobile: keep the typing box visible when the virtual keyboard opens ─────
if (window.visualViewport) {
    const onViewportResize = () => {
        if (!screens.race.classList.contains('active')) return;
        setTimeout(() => {
            els.typingInput.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }, 60);
    };
    window.visualViewport.addEventListener('resize', onViewportResize);
}
els.typingInput.addEventListener('focus', () => {
    if (!screens.race.classList.contains('active')) return;
    setTimeout(() => els.typingInput.scrollIntoView({ block: 'center', behavior: 'smooth' }), 150);
});

// ─── Invite deep link (?room=ABCD) ────────────────────────────────────────────
(function handleInviteLink() {
    const params = new URLSearchParams(location.search);
    const code = (params.get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
    if (!code) return;

    els.roomInput.value = code;

    let savedName = null;
    try { savedName = localStorage.getItem(NAME_KEY); } catch (_) {}

    if (savedName) {
        els.playerNameInput.value = savedName;
        toast(`Invite detected — joining room ${code}...`, 'info', 3000);
        setTimeout(() => doJoin(code), 800);
    } else {
        toast(`Invited to room ${code} — enter your name and hit Join!`, 'info', 5000);
        setTimeout(() => els.playerNameInput.focus(), 300);
    }
})();

// ─── Reset ────────────────────────────────────────────────────────────────────
function resetGame() {
    stopTimers();
    if (ws) { ws.onclose = null; ws.onerror = null; ws.close(1000); ws = null; }
    myPlayerId = null; myRoomCode = null; isHost = false; isSpectator = false;
    ghostState = null;
    mySamples = [];
    raceStartWall = null;
    lastSummaryPlayers = null;
    hmSelectedId = null;
    resetHeatmapCapture();
    gameData = {
        text: '', startTime: null, timeLimit: 0, wordCount: 0, charCount: 0,
        players: {}, mySlot: null, finished: false, summaryShown: false
    };
    els.typingInput.disabled   = true;
    els.typingInput.value      = '';
    els.typingInput.placeholder = 'Waiting for race to start...';
    els.spectateBanner.classList.add('hidden');
    btns.start.classList.add('hidden');
    btns.playAgain.classList.add('hidden');
    btns.addBot.classList.add('hidden');
    els.heatmapSection.classList.add('hidden');
    els.lobbyTitle.innerText       = 'Waiting for players...';
    els.playersContainer.innerHTML = '';
    els.tracksContainer.innerHTML  = '';
    els.timerDisplay.innerText     = '';
    screens.summary.classList.remove('active');
    clearUrlParam();
    showScreen('home');
}
