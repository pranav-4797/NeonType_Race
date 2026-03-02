// ─── Config ──────────────────────────────────────────────────────────────────

const BACKEND_URL = 'https://neontype-race-1.onrender.com';

const API_BASE = `${BACKEND_URL}/api`;
const WS_BASE  = BACKEND_URL.replace(/^http/, 'ws');

// ─── UI Elements ─────────────────────────────────────────────────────────────
const screens = {
    home:  document.getElementById('screen-home'),
    lobby: document.getElementById('screen-lobby'),
    race:  document.getElementById('screen-race')
};

const btns = {
    host:      document.getElementById('btn-host'),
    join:      document.getElementById('btn-join'),
    copy:      document.getElementById('btn-copy-code'),
    start:     document.getElementById('btn-start-race'),
    playAgain: document.getElementById('btn-play-again'),
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
    overlay:          document.getElementById('result-overlay'),
    resultTitle:      document.getElementById('result-title'),
    resultStats:      document.getElementById('result-stats'),
    timerDisplay:     document.getElementById('timer-display')
};

// ─── Game State ───────────────────────────────────────────────────────────────
let ws          = null;
let myPlayerId  = null;
let myRoomCode  = null;
let isHost      = false;

let gameData = {
    text:      '',
    startTime: null,
    timeLimit: 0,
    players:   {},   // slot_index -> player object
    mySlot:    null,
    finished:  false
};

let timerInterval    = null;
let progressInterval = null;

// ─── Utilities ────────────────────────────────────────────────────────────────
function showScreen(id) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[id].classList.add('active');
}

function getPlayerName() {
    return (els.playerNameInput.value.trim() || 'Anonymous').substring(0, 16);
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

async function apiFetch(path, method = 'GET', body = null) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(API_BASE + path, opts);
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(err.detail || 'Request failed');
    }
    return res.json();
}

// ─── WebSocket ────────────────────────────────────────────────────────────────
function connectWS(roomCode, playerId) {
    ws = new WebSocket(`${WS_BASE}/ws/${roomCode}/${playerId}`);

    ws.onopen = () => console.log('WS connected');

    ws.onmessage = (e) => {
        try { handleServerMessage(JSON.parse(e.data)); }
        catch (err) { console.error('WS parse error:', err); }
    };

    ws.onclose = (e) => {
        if (e.code !== 1000) {
            alert('Disconnected from server. Returning to home.');
            resetGame();
        }
    };

    ws.onerror = () => {
        alert('Connection error. Please try again.');
        resetGame();
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
            updateLobbyUI();
            break;

        case 'player_left':
            delete gameData.players[msg.slot_index];
            updateLobbyUI();
            break;

        case 'race_started':
            startRace(msg.text, msg.time_limit, msg.players);
            break;

        case 'player_progress': {
            const p = gameData.players[msg.slot_index];
            if (p) { p.wpm = msg.wpm; p.progress = msg.progress; p.accuracy = msg.accuracy; }
            renderTracks();
            break;
        }

        case 'player_finished': {
            const p = gameData.players[msg.slot_index];
            if (p) { p.finished = true; p.finish_rank = msg.finish_rank; p.wpm = msg.wpm; p.progress = 100; }
            renderTracks();
            if (msg.slot_index === gameData.mySlot && !gameData.finished) showResult(msg.finish_rank, msg.wpm);
            break;
        }

        case 'player_timeout': {
            const p = gameData.players[msg.slot_index];
            if (p) { p.finished = true; p.timed_out = true; p.wpm = msg.wpm; }
            renderTracks();
            if (msg.slot_index === gameData.mySlot && !gameData.finished) showResult(null, msg.wpm, true);
            break;
        }

        case 'race_ended':
            syncPlayers(msg.players);
            renderTracks();
            stopTimers();
            if (!gameData.finished) {
                const me = gameData.players[gameData.mySlot];
                if (me) showResult(me.finish_rank, me.wpm, me.timed_out);
            }
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
        const isMe = p.id === myPlayerId;
        const card = document.createElement('div');
        card.className = `player-card ${isMe ? 'you' : 'opponent'} active`;
        card.style.borderColor = p.color;
        card.style.boxShadow   = `0 0 16px ${p.color}33`;
        card.innerHTML = `
            <div class="avatar" style="border-color:${p.color}">${p.emoji}</div>
            <h3>${escapeHtml(p.name)}</h3>
            <span class="status ready" style="color:${p.color}">${isMe ? '(You)' : 'Ready'}</span>
        `;
        els.playersContainer.appendChild(card);
    }

    if (isHost) {
        if (count >= 2) {
            btns.start.classList.remove('hidden');
            els.lobbyTitle.innerText = `${count} player${count > 1 ? 's' : ''} ready — Start the race!`;
        } else {
            btns.start.classList.add('hidden');
            els.lobbyTitle.innerText = 'Waiting for at least one more player...';
        }
    } else {
        els.lobbyTitle.innerText = count < 2
            ? 'Waiting for more players...'
            : `${count} players connected — waiting for host to start...`;
    }
}

// ─── Race ─────────────────────────────────────────────────────────────────────
function startRace(text, timeLimit, playersArray) {
    gameData.text      = text;
    gameData.timeLimit = timeLimit;
    gameData.startTime = null;
    gameData.finished  = false;

    syncPlayers(playersArray);
    for (const p of Object.values(gameData.players)) {
        if (p.id === myPlayerId) { gameData.mySlot = p.slot_index; break; }
    }

    // Reset my local counters
    const me = gameData.players[gameData.mySlot];
    if (me) Object.assign(me, { progress: 0, wpm: 0, accuracy: 100, finished: false, finish_rank: 0, timed_out: false });

    renderText(0);
    renderTracks();
    els.typingInput.value    = '';
    els.typingInput.disabled = false;
    els.overlay.classList.add('hidden');
    btns.playAgain.classList.add('hidden');

    showScreen('race');
    startTimers(timeLimit);
    setTimeout(() => els.typingInput.focus(), 100);
}

// ─── Timers ───────────────────────────────────────────────────────────────────
function startTimers(timeLimit) {
    stopTimers();
    const deadline = Date.now() + timeLimit * 1000;

    timerInterval = setInterval(() => {
        const rem = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
        els.timerDisplay.innerText = `⏱ ${rem}s`;
        if (rem <= 0) handleTimeout();
    }, 250);

    progressInterval = setInterval(() => {
        if (!gameData.startTime || gameData.finished) return;
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
    if (gameData.finished) return;
    gameData.finished = true;
    els.typingInput.disabled = true;
    const me = gameData.players[gameData.mySlot];
    wsSend({ type: 'timeout', wpm: me ? me.wpm : 0 });
}

// ─── Typing ───────────────────────────────────────────────────────────────────
els.typingInput.addEventListener('input', () => {
    if (gameData.finished) return;
    const typed = els.typingInput.value;

    if (!gameData.startTime && typed.length > 0) gameData.startTime = Date.now();

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
        wsSend({ type: 'finish_race', wpm, accuracy });
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
}

// ─── Results ──────────────────────────────────────────────────────────────────
function showResult(rank, wpm, timedOut = false) {
    gameData.finished = true;
    if (timedOut) {
        els.resultTitle.style.color = 'var(--text-muted)';
        els.resultTitle.innerText   = "Time's Up! ⏰";
        els.resultStats.innerText   = `You typed ${wpm} WPM before time ran out.`;
    } else if (rank === 1) {
        els.resultTitle.style.color = 'var(--success)';
        els.resultTitle.innerText   = 'You Won! 🏆';
        els.resultStats.innerText   = `${wpm} WPM — First place!`;
    } else {
        els.resultTitle.style.color = 'var(--error)';
        els.resultTitle.innerText   = `You Finished #${rank}! 💥`;
        els.resultStats.innerText   = `${wpm} WPM`;
    }
    els.overlay.classList.remove('hidden');
    if (isHost) btns.playAgain.classList.remove('hidden');
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
        els.displayRoom.innerText = myRoomCode;
        showScreen('lobby');
        connectWS(myRoomCode, myPlayerId);
    } catch (err) {
        alert('Failed to create room: ' + err.message);
        btns.host.disabled  = false;
        btns.host.innerText = 'Host Game';
    }
});

btns.join.addEventListener('click', async () => {
    const code = els.roomInput.value.trim().toUpperCase();
    if (code.length < 4) return alert('Enter a valid 4-character room code.');
    const name = getPlayerName();
    btns.join.disabled  = true;
    btns.join.innerText = 'Joining...';
    try {
        const data = await apiFetch('/rooms/join', 'POST', { room_code: code, player_name: name });
        myPlayerId = data.player_id;
        myRoomCode = code;
        isHost     = false;
        els.displayRoom.innerText = myRoomCode;
        showScreen('lobby');
        connectWS(myRoomCode, myPlayerId);
    } catch (err) {
        alert('Could not join room: ' + err.message);
        btns.join.disabled  = false;
        btns.join.innerText = 'Join';
    }
});

btns.copy.addEventListener('click', () => {
    navigator.clipboard.writeText(els.displayRoom.innerText);
    btns.copy.innerText = '✅';
    setTimeout(() => btns.copy.innerText = '📋', 2000);
});

btns.start.addEventListener('click', () => wsSend({ type: 'start_race' }));

btns.playAgain.addEventListener('click', () => { if (isHost) wsSend({ type: 'start_race' }); });

btns.quit.addEventListener('click', resetGame);

// ─── Reset ────────────────────────────────────────────────────────────────────
function resetGame() {
    stopTimers();
    if (ws) { ws.onclose = null; ws.close(1000); ws = null; }
    myPlayerId = null; myRoomCode = null; isHost = false;
    gameData = { text: '', startTime: null, timeLimit: 0, players: {}, mySlot: null, finished: false };
    els.typingInput.disabled       = true;
    els.typingInput.value          = '';
    els.overlay.classList.add('hidden');
    btns.start.classList.add('hidden');
    btns.playAgain.classList.add('hidden');
    els.lobbyTitle.innerText       = 'Waiting for players...';
    els.playersContainer.innerHTML = '';
    els.tracksContainer.innerHTML  = '';
    els.timerDisplay.innerText     = '';
    showScreen('home');
}
