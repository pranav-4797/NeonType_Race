/**
 * NeonType Race — 4-Player, 2-Page, Timed Typing Game
 * Page 1: Landing (join/host)
 * Page 2: Lobby → Race → Results
 *
 * Time limit = ceil(wordCount / IDEAL_WPM * 60 * FACTOR) seconds
 * Ideal WPM  = 60 (average typist)
 * Factor     = 1.5 (gives comfortable but real pressure)
 */

// ─── Config ───────────────────────────────────────────────────────────────────
const PEER_PREFIX     = 'neontype-race-';
const MAX_PLAYERS     = 4;
const COUNTDOWN_SECS  = 3;
const IDEAL_WPM       = 60;    // baseline typing speed
const TIME_FACTOR     = 1.5;   // multiplier for breathing room

// ─── Rich paragraph texts (7 lines / ~400-500 chars each) ────────────────────
const TEXTS = [
    `The city never sleeps. Beneath the flickering neon canopy, vendors hawk steaming bowls of ramen while drones weave between skyscrapers like silver fish through a glass sea. Data cables run under every surface, carrying the dreams of ten million connected souls. To live here is to exist in two worlds at once: the physical crush of bodies and concrete, and the invisible digital realm layered over everything like a second sky. Those who can read both worlds — the glowing signs above and the data streams below — are the true navigators of this age. Everyone else is just passing through.`,

    `Rain has a way of erasing the boundaries between things. Puddles reflect neon signs in shattered fragments, making the wet street look like a mosaic of broken light. Pedestrians become silhouettes with glowing edges, their umbrellas like black mushrooms pushing through a luminous underworld. The rhythm of the rain on the pavement is the city's own heartbeat, steady and relentless, punctuated by the hiss of tires and the distant thunder that rolls between towers. On nights like this, even the most hardened city dweller pauses, looks up, and remembers they are small.`,

    `Typing is a skill that rewards patience above all else. The fingers that move fastest are rarely the ones that started fastest — they are the ones that built their speed slowly, deliberately, through thousands of hours of careful repetition. Every character is a micro-decision: which finger, which motion, which fraction of a second. Speed emerges from the elimination of hesitation, and hesitation fades only when the body knows the keyboard so well that thought and motion become the same event. Practice is not punishment. Practice is the slow accumulation of mastery, one keystroke at a time, until fluency becomes invisible.`,

    `Space is not empty. Between the visible stars, threads of gas and magnetic fields connect everything in a vast invisible web. Galaxies pull on each other across distances too great to comprehend, their influence travelling at the speed of gravity itself. Black holes anchor the centres of almost every galaxy we have studied, spinning slowly like cosmic engines powering the structure of the universe. Light that left distant stars before Earth existed is only now reaching our telescopes, carrying ancient information about a universe we can barely see. We are, in every sense, looking at ghosts — the radiant echoes of things long transformed.`,

    `The archive was three floors underground, temperature-controlled to the exact degree required to preserve paper that was older than any living institution. Rows of grey metal shelves stretched into darkness beyond the reach of the portable lights the researcher carried. Every box held a fragment of a world that had believed itself permanent. Letters, receipts, maps, census records — each one a small act of preservation by someone who had sensed, rightly, that the details mattered. The researcher moved carefully, gloves on, breath fogging slightly in the cool air, reading a world that had not expected to be read.`,

    `Networks are not built from cables alone. They are built from trust — the quiet agreement between machines that the data passing between them is worth protecting, routing, and delivering intact. Every packet carries a tiny flag that says: I came from somewhere real, and I am going somewhere real, and I matter. The engineers who designed these protocols in sparse academic offices never imagined the volume that would one day travel through their inventions. Yet the architecture holds, because it was built on sound principles: redundancy, error correction, and the fundamental assumption that the message must get through.`,

    `Mountains teach humility in a way that nothing else can. They are indifferent to schedules, to ambitions, to the urgency that drives human beings through their daily lives. A storm on a high ridge waits for no one, and the climber who argues with the weather always loses. What the mountains offer instead is a different kind of clarity — a sense of scale that persists long after the descent. Problems that seemed overwhelming at sea level shrink when measured against granite ridgelines that have stood for millions of years. The peak is not the point. Learning to belong to something larger than yourself is.`
];

// ─── Car SVGs ─────────────────────────────────────────────────────────────────
function hexToRgb(hex) {
    const r = parseInt(hex.slice(1,3),16);
    const g = parseInt(hex.slice(3,5),16);
    const b = parseInt(hex.slice(5,7),16);
    return {r,g,b};
}
function darken(hex, amt) {
    const {r,g,b} = hexToRgb(hex);
    const f = 1 - amt;
    return `rgb(${Math.round(r*f)},${Math.round(g*f)},${Math.round(b*f)})`;
}
function lighten(hex, amt) {
    const {r,g,b} = hexToRgb(hex);
    return `rgb(${Math.round(r+(255-r)*amt)},${Math.round(g+(255-g)*amt)},${Math.round(b+(255-b)*amt)})`;
}

const CARS = [
    {
        id: 'beetle', name: 'Beetle',
        svg: (c) => `<svg viewBox="0 0 100 44" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="50" cy="30" rx="43" ry="12" fill="${darken(c,0.3)}"/>
            <path d="M16 30 Q18 13 50 11 Q82 13 84 30 Z" fill="${c}"/>
            <rect x="13" y="27" width="74" height="10" rx="5" fill="${darken(c,0.18)}"/>
            <ellipse cx="27" cy="37" rx="10" ry="6" fill="#1a1a1a"/><ellipse cx="27" cy="37" rx="6" ry="4" fill="#444"/>
            <ellipse cx="73" cy="37" rx="10" ry="6" fill="#1a1a1a"/><ellipse cx="73" cy="37" rx="6" ry="4" fill="#444"/>
            <rect x="34" y="16" width="32" height="12" rx="3" fill="rgba(180,230,255,0.5)"/>
        </svg>`
    },
    {
        id: 'sedan', name: 'Sedan',
        svg: (c) => `<svg viewBox="0 0 100 44" xmlns="http://www.w3.org/2000/svg">
            <rect x="8" y="26" width="84" height="12" rx="4" fill="${darken(c,0.22)}"/>
            <path d="M20 26 L26 14 L74 14 L80 26 Z" fill="${c}"/>
            <rect x="27" y="15" width="46" height="10" rx="2" fill="rgba(180,230,255,0.5)"/>
            <ellipse cx="25" cy="38" rx="9" ry="6" fill="#1a1a1a"/><ellipse cx="25" cy="38" rx="5" ry="3.5" fill="#444"/>
            <ellipse cx="75" cy="38" rx="9" ry="6" fill="#1a1a1a"/><ellipse cx="75" cy="38" rx="5" ry="3.5" fill="#444"/>
            <rect x="10" y="25" width="14" height="7" rx="2" fill="${lighten(c,0.3)}"/>
            <rect x="76" y="25" width="14" height="7" rx="2" fill="#cc9900"/>
        </svg>`
    },
    {
        id: 'sports', name: 'Sports',
        svg: (c) => `<svg viewBox="0 0 100 44" xmlns="http://www.w3.org/2000/svg">
            <rect x="6" y="26" width="88" height="11" rx="3" fill="${darken(c,0.28)}"/>
            <path d="M13 26 L21 15 L68 13 L87 26 Z" fill="${c}"/>
            <rect x="23" y="14" width="40" height="10" rx="2" fill="rgba(180,230,255,0.55)"/>
            <ellipse cx="22" cy="37" rx="9" ry="6" fill="#1a1a1a"/><ellipse cx="22" cy="37" rx="5" ry="3.5" fill="#444"/>
            <ellipse cx="78" cy="37" rx="9" ry="6" fill="#1a1a1a"/><ellipse cx="78" cy="37" rx="5" ry="3.5" fill="#444"/>
            <rect x="7" y="24" width="16" height="7" rx="2" fill="${lighten(c,0.3)}"/>
            <rect x="77" y="24" width="16" height="7" rx="2" fill="#cc9900"/>
            <rect x="55" y="22" width="22" height="4" rx="2" fill="${lighten(c,0.12)}"/>
        </svg>`
    },
    {
        id: 'truck', name: 'Truck',
        svg: (c) => `<svg viewBox="0 0 100 44" xmlns="http://www.w3.org/2000/svg">
            <rect x="4" y="20" width="92" height="18" rx="4" fill="${darken(c,0.2)}"/>
            <rect x="4" y="20" width="38" height="18" rx="4" fill="${c}"/>
            <rect x="8" y="22" width="28" height="12" rx="2" fill="rgba(180,230,255,0.45)"/>
            <ellipse cx="20" cy="38" rx="9" ry="6" fill="#1a1a1a"/><ellipse cx="20" cy="38" rx="5" ry="3.5" fill="#444"/>
            <ellipse cx="80" cy="38" rx="9" ry="6" fill="#1a1a1a"/><ellipse cx="80" cy="38" rx="5" ry="3.5" fill="#444"/>
            <rect x="5" y="19" width="16" height="8" rx="2" fill="${lighten(c,0.3)}"/>
        </svg>`
    }
];

const PLAYER_COLORS = ['#00eeff','#ff003c','#ffe600','#00ff88'];
const PLAYER_EMOJIS = ['🏎️','🚙','🚕','🚗'];

// Quick palette for landing page
const QUICK_COLORS = [
    '#00eeff','#ff003c','#ffe600','#00ff88','#7000ff','#ff6600',
    '#ffffff','#ff69b4','#00ccff','#ff4500','#39ff14','#ff00ff'
];

// ─── Profile (localStorage) ───────────────────────────────────────────────────
let profile = {
    name: 'Racer',
    carId: 'beetle',
    carColor: '#00eeff',
    ...JSON.parse(localStorage.getItem('neontype_profile') || '{}')
};
function saveProfile() {
    localStorage.setItem('neontype_profile', JSON.stringify(profile));
}

// ─── Game State ───────────────────────────────────────────────────────────────
let peer         = null;
let isHost       = false;
let roomCode     = '';
let mySlotIndex  = 0;

let guestConns   = {};  // peerId → DataConnection
let guestSlots   = {};  // peerId → slotIndex
let nextSlot     = 1;
let hostConn     = null;

let players      = [];
let gameText     = '';
let timeLimit    = 0;   // seconds
let startTime    = null;
let raceTimer    = null;
let finishedCount = 0;
let countdownTimer = null;

// ─── DOM helpers ──────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

// ─── Time limit calculation ───────────────────────────────────────────────────
function calcTimeLimit(text) {
    // words = chars / 5 (standard)
    const words = text.trim().split(/\s+/).length;
    const secs = Math.ceil((words / IDEAL_WPM) * 60 * TIME_FACTOR);
    return secs;
}

function formatTime(secs) {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return m > 0 ? `${m}:${s.toString().padStart(2,'0')}` : `${s}s`;
}

// ─── Page transitions ─────────────────────────────────────────────────────────
function goToGame() {
    const landing = $('page-landing');
    const game    = $('page-game');
    landing.classList.add('page-exit');
    game.classList.add('page-active');
    landing.addEventListener('transitionend', () => landing.classList.remove('page-active'), { once: true });
}

function goToLanding() {
    const landing = $('page-landing');
    const game    = $('page-game');
    landing.classList.remove('page-exit');
    game.classList.remove('page-active');
}

// ─── View management (lobby / race within game page) ─────────────────────────
function showView(name) {
    document.querySelectorAll('.game-view').forEach(v => v.classList.remove('active'));
    $(`view-${name}`).classList.add('active');
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function generateCode() {
    return Math.random().toString(36).substring(2,6).toUpperCase();
}
function escHtml(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function safeSend(conn, data) {
    try { if (conn && conn.open) conn.send(data); } catch(e) {}
}
function broadcastAll(data) {
    Object.values(guestConns).forEach(c => safeSend(c, data));
}
function broadcastExcept(excludePeerId, data) {
    Object.entries(guestConns).forEach(([pid,c]) => {
        if (pid !== excludePeerId) safeSend(c, data);
    });
}

// ─── Car SVG ──────────────────────────────────────────────────────────────────
function getCarSvg(carId, color) {
    const car = CARS.find(c => c.id === carId) || CARS[0];
    return car.svg(color);
}

// ─── Player helpers ───────────────────────────────────────────────────────────
function makePlayer(slot, name, carId, carColor) {
    return {
        slotIndex: slot,
        name: name || `Player ${slot+1}`,
        carId: carId || 'beetle',
        carColor: carColor || PLAYER_COLORS[slot],
        emoji: PLAYER_EMOJIS[slot],
        color: PLAYER_COLORS[slot],
        progress: 0, wpm: 0, accuracy: 100,
        finished: false, finishRank: 0, timedOut: false,
        finishTime: null
    };
}
function getMyPlayer() { return players[mySlotIndex]; }

// ─── Landing Page UI ──────────────────────────────────────────────────────────
function initLandingUI() {
    // Name
    $('input-player-name').value = profile.name;
    $('input-player-name').addEventListener('input', function() {
        profile.name = this.value.trim() || 'Racer';
        saveProfile();
    });

    // Car grid
    const carRow = $('quick-car-row');
    carRow.innerHTML = '';
    CARS.forEach(car => {
        const div = document.createElement('div');
        div.className = 'qcar' + (car.id === profile.carId ? ' selected' : '');
        div.innerHTML = car.svg(profile.carColor) + `<span class="qcar-name">${car.name}</span>`;
        div.addEventListener('click', () => {
            profile.carId = car.id;
            saveProfile();
            document.querySelectorAll('.qcar').forEach(el => el.classList.remove('selected'));
            div.classList.add('selected');
            // update all car svgs with new car shape
            refreshLandingCars();
        });
        carRow.appendChild(div);
    });

    // Color swatches
    const colorRow = $('quick-colors');
    colorRow.innerHTML = '';
    QUICK_COLORS.forEach(col => {
        const sw = document.createElement('div');
        sw.className = 'qcolor' + (col === profile.carColor ? ' selected' : '');
        sw.style.background = col;
        sw.addEventListener('click', () => {
            profile.carColor = col;
            saveProfile();
            document.querySelectorAll('.qcolor').forEach(el => el.classList.remove('selected'));
            sw.classList.add('selected');
            refreshLandingCars();
        });
        colorRow.appendChild(sw);
    });
}

function refreshLandingCars() {
    document.querySelectorAll('.qcar').forEach((el, i) => {
        const car = CARS[i];
        if (!car) return;
        el.innerHTML = car.svg(profile.carColor) + `<span class="qcar-name">${car.name}</span>`;
        el.className = 'qcar' + (car.id === profile.carId ? ' selected' : '');
    });
}

// ─── Lobby UI ─────────────────────────────────────────────────────────────────
function renderLobby() {
    const grid = $('lobby-players');
    grid.innerHTML = '';
    for (let i = 0; i < MAX_PLAYERS; i++) {
        const p = players[i];
        const slot = document.createElement('div');
        slot.className = 'lp-slot ' + (p ? 'filled' : 'empty');
        if (p) slot.style.setProperty('--p-color', p.color);
        slot.innerHTML = p
            ? `<div class="lp-avatar">${getCarSvg(p.carId, p.carColor)}</div>
               <div class="lp-name">${escHtml(p.name)}</div>
               <div class="lp-badge ${i===0?'badge-host':'badge-joined'}">${i===0?'HOST':'JOINED'}</div>`
            : `<div class="lp-avatar" style="font-size:1.8rem;color:var(--muted)">?</div>
               <div class="lp-name" style="color:var(--muted)">Open Slot</div>
               <div class="lp-badge badge-waiting">WAITING</div>`;
        grid.appendChild(slot);
    }

    const active = players.filter(Boolean).length;
    if (isHost) {
        const startBtn = $('btn-start-race');
        const hint     = $('lobby-hint');
        if (active >= 2) {
            startBtn.classList.remove('hidden');
            hint.style.display = 'none';
        } else {
            startBtn.classList.add('hidden');
            hint.style.display = 'block';
            hint.textContent = `Waiting for at least 1 more player... (${active}/${MAX_PLAYERS})`;
        }
    }
    $('lobby-status').textContent = isHost
        ? `Your Room · ${active}/${MAX_PLAYERS} Players`
        : `Joined Room · ${active}/${MAX_PLAYERS} Players`;
}

// ─── Race UI ──────────────────────────────────────────────────────────────────
function renderTracks() {
    const container = $('tracks-container');
    container.innerHTML = '';
    players.filter(Boolean).forEach(p => {
        const isMe = p.slotIndex === mySlotIndex;
        const row  = document.createElement('div');
        row.className = 'racer-row';
        row.id = `track-${p.slotIndex}`;
        row.style.setProperty('--p-color', p.color);
        row.innerHTML = `
            <div class="racer-meta">
                <span class="racer-name">
                    ${escHtml(p.name)}${isMe ? ' <em>(you)</em>' : ''}
                </span>
                <div class="racer-right">
                    <span class="racer-wpm" id="wpm-${p.slotIndex}">0 WPM</span>
                    <span class="racer-finish hidden" id="finish-${p.slotIndex}"></span>
                </div>
            </div>
            <div class="track-bar">
                <div class="track-fill" id="fill-${p.slotIndex}" style="width:0%">
                    <span class="track-car">${p.emoji}</span>
                </div>
            </div>`;
        container.appendChild(row);
    });
}

function updateTracksUI() {
    players.filter(Boolean).forEach(p => {
        const fill   = $(`fill-${p.slotIndex}`);
        const wpmEl  = $(`wpm-${p.slotIndex}`);
        const finEl  = $(`finish-${p.slotIndex}`);
        const rowEl  = $(`track-${p.slotIndex}`);
        if (fill)  fill.style.width = Math.min(100, p.progress) + '%';
        if (wpmEl) wpmEl.textContent = p.wpm + ' WPM';
        if (rowEl && p.finished) rowEl.classList.add('finished');
        if (finEl && p.finished) {
            const ordinals = ['1st','2nd','3rd','4th'];
            finEl.textContent = p.timedOut ? 'TIME' : (ordinals[p.finishRank-1] || p.finishRank+'th');
            finEl.classList.remove('hidden');
        }
    });
}

// ─── Text rendering ───────────────────────────────────────────────────────────
function renderText(typed = '') {
    const display = $('text-display');
    let html = '';
    for (let i = 0; i < gameText.length; i++) {
        const raw = gameText[i];
        const ch  = raw === ' ' ? '&nbsp;' : escHtml(raw);
        let cls = '';
        if (i < typed.length)       cls = typed[i] === raw ? 'correct' : 'incorrect';
        else if (i === typed.length) cls = 'current';
        html += `<span class="${cls}">${ch}</span>`;
    }
    display.innerHTML = html;
    const cur = display.querySelector('.current');
    if (cur) cur.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

// ─── HUD clock ────────────────────────────────────────────────────────────────
const RING_CIRCUMFERENCE = 2 * Math.PI * 18; // r=18

function updateTimerRing(remaining) {
    const fraction = Math.max(0, remaining / timeLimit);
    const offset   = RING_CIRCUMFERENCE * (1 - fraction);
    const fill     = $('time-ring-fill');
    const numEl    = $('time-remaining');
    if (!fill) return;

    fill.style.strokeDashoffset = offset;
    numEl.textContent = formatTime(remaining);

    fill.classList.remove('warn','danger');
    if (fraction <= 0.2) fill.classList.add('danger');
    else if (fraction <= 0.4) fill.classList.add('warn');
}

function startRaceTimer() {
    let remaining = timeLimit;
    updateTimerRing(remaining);

    raceTimer = setInterval(() => {
        remaining--;
        updateTimerRing(remaining);
        if (remaining <= 0) {
            clearInterval(raceTimer);
            handleTimeUp();
        }
    }, 1000);
}

function handleTimeUp() {
    // Mark local player as timed out if not finished
    const me = getMyPlayer();
    if (me && !me.finished) {
        me.timedOut = true;
        me.finished = true;
        me.finishRank = ++finishedCount;
        $('typing-input').disabled = true;

        const timeoutMsg = { type: 'TIMEOUT', slotIndex: mySlotIndex, wpm: me.wpm };
        if (isHost) broadcastAll(timeoutMsg);
        else safeSend(hostConn, timeoutMsg);

        updateTracksUI();

        // host triggers end if all done
        if (isHost) checkAllFinished();

        showResult(me.finishRank, me.wpm, me.accuracy, true);
    }
}

function checkAllFinished() {
    const active = players.filter(Boolean);
    if (active.every(p => p.finished)) {
        clearInterval(raceTimer);
        const snapshot = active.map(p => ({
            slotIndex: p.slotIndex,
            finishRank: p.finishRank,
            wpm: p.wpm,
            accuracy: p.accuracy,
            timedOut: p.timedOut
        }));
        broadcastAll({ type: 'END_RACE', players: snapshot });
    }
}

// ─── Countdown ────────────────────────────────────────────────────────────────
function startCountdown(onComplete) {
    const overlay = $('countdown-overlay');
    const numEl   = $('countdown-number');
    overlay.classList.remove('hidden');
    let count = COUNTDOWN_SECS;
    numEl.textContent = count;
    numEl.classList.add('pop');

    countdownTimer = setInterval(() => {
        count--;
        numEl.classList.remove('pop');
        void numEl.offsetWidth;
        numEl.classList.add('pop');
        if (count === 0) {
            numEl.textContent = 'GO!';
            setTimeout(() => {
                clearInterval(countdownTimer);
                overlay.classList.add('hidden');
                onComplete();
            }, 700);
        } else {
            numEl.textContent = count;
        }
    }, 1000);
}

// ─── Race start ───────────────────────────────────────────────────────────────
function prepareRace(text, allPlayers, mySlot) {
    gameText     = text;
    mySlotIndex  = mySlot;
    timeLimit    = calcTimeLimit(text);
    players      = allPlayers.map(p => ({ ...p, progress:0, wpm:0, accuracy:100, finished:false, finishRank:0, timedOut:false, finishTime:null }));
    startTime    = null;
    finishedCount = 0;

    // HUD
    $('hud-room').textContent = roomCode;
    $('hud-wpm').textContent  = '0';
    $('time-total-label').textContent = `/ ${formatTime(timeLimit)}`;
    updateTimerRing(timeLimit);

    // Reset result overlay
    $('result-overlay').classList.add('hidden');
    $('btn-play-again').classList.add('hidden');

    renderTracks();
    renderText('');
    updateTracksUI();

    const input = $('typing-input');
    input.value = '';
    input.disabled = true;
    input.placeholder = 'Get ready...';

    showView('race');

    startCountdown(() => {
        startTime = Date.now();
        input.disabled = false;
        input.placeholder = 'Start typing...';
        input.focus();
        startRaceTimer();
    });
}

// ─── Typing input ─────────────────────────────────────────────────────────────
$('typing-input').addEventListener('input', () => {
    if (!startTime) return;
    const input = $('typing-input');
    const typed  = input.value;

    // Count correct chars at each position
    let correct = 0;
    for (let i = 0; i < typed.length; i++) {
        if (typed[i] === gameText[i]) correct++;
    }

    const accuracy = typed.length > 0 ? Math.round((correct / typed.length) * 100) : 100;
    renderText(typed);

    const elapsed = (Date.now() - startTime) / 60000;
    const wpm     = elapsed > 0 ? Math.floor((correct / 5) / elapsed) : 0;

    // Progress = consecutive correct chars from start
    let matched = 0;
    for (let i = 0; i < gameText.length; i++) {
        if (typed[i] === gameText[i]) matched++;
        else break;
    }
    const progress = Math.min(100, (matched / gameText.length) * 100);

    const me   = getMyPlayer();
    me.wpm      = wpm;
    me.progress = progress;
    me.accuracy = accuracy;

    $('hud-wpm').textContent   = wpm;
    $('my-accuracy').textContent = `ACC: ${accuracy}%`;
    updateTracksUI();

    const msg = { type: 'PROGRESS', slotIndex: mySlotIndex, wpm, progress, accuracy };
    if (isHost) broadcastAll(msg);
    else safeSend(hostConn, msg);

    if (typed === gameText && !me.finished) {
        finishTyping(mySlotIndex, wpm, accuracy);
    }
});

$('typing-input').addEventListener('paste',   e => e.preventDefault());
$('typing-input').addEventListener('keydown', e => { if (e.key === 'Enter') e.preventDefault(); });

// ─── Finish ───────────────────────────────────────────────────────────────────
function finishTyping(slot, wpm, accuracy) {
    const p = players[slot];
    if (!p || p.finished) return;
    finishedCount++;
    p.finished = true;
    p.finishRank = finishedCount;
    p.finishTime = Date.now();
    updateTracksUI();

    const msg = { type: 'FINISHED', slotIndex: slot, finishRank: finishedCount, wpm, accuracy };
    if (isHost) { broadcastAll(msg); checkAllFinished(); }
    else         safeSend(hostConn, msg);

    if (slot === mySlotIndex) {
        $('typing-input').disabled = true;
        showResult(p.finishRank, wpm, accuracy, false);
    }
}

function handleRemoteFinish(data) {
    const p = players[data.slotIndex];
    if (!p || p.finished) return;
    p.finished = true;
    p.finishRank = data.finishRank;
    p.wpm = data.wpm;
    p.accuracy = data.accuracy || 100;
    finishedCount = Math.max(finishedCount, data.finishRank);
    updateTracksUI();
    if (isHost) checkAllFinished();
}

function handleRemoteTimeout(data) {
    const p = players[data.slotIndex];
    if (!p || p.finished) return;
    p.finished = true;
    p.timedOut = true;
    p.finishRank = ++finishedCount;
    p.wpm = data.wpm;
    updateTracksUI();
    if (isHost) checkAllFinished();
}

function applyEndRace(finalPlayers) {
    finalPlayers.forEach(fp => {
        const p = players[fp.slotIndex];
        if (p) {
            p.finishRank = fp.finishRank;
            p.wpm = fp.wpm;
            p.accuracy = fp.accuracy;
            p.timedOut = fp.timedOut;
            p.finished = true;
        }
    });
    clearInterval(raceTimer);
    const me = getMyPlayer();
    if (me && !me.finished) {
        me.finished = true;
        me.timedOut = true;
        $('typing-input').disabled = true;
        showResult(me.finishRank || players.filter(Boolean).length, me.wpm, me.accuracy, true);
    }
    updateTracksUI();
}

// ─── Result overlay ───────────────────────────────────────────────────────────
function showResult(rank, wpm, accuracy, timedOut) {
    const ordinals = ['1st 🥇','2nd 🥈','3rd 🥉','4th'];
    const isWinner = rank === 1 && !timedOut;

    $('result-crown').textContent = isWinner ? '🏆' : timedOut ? '⏰' : rank===2 ? '🥈' : rank===3 ? '🥉' : '💀';
    $('result-title').textContent = timedOut ? "Time's Up!" : isWinner ? 'You Won!' : `You Finished ${ordinals[rank-1]||rank+'th'}`;
    $('result-title').style.color = isWinner ? 'var(--success)' : timedOut ? 'var(--warn)' : rank<=2 ? 'var(--primary)' : 'var(--error)';
    $('result-wpm').textContent   = `${wpm} WPM · ${accuracy}% Accuracy`;
    $('result-time-info').textContent = `Time limit was ${formatTime(timeLimit)}`;

    // Leaderboard
    const sorted = [...players].filter(p => p && p.finished).sort((a,b) => a.finishRank - b.finishRank);
    $('result-leaderboard').innerHTML = sorted.map(p => {
        const statusCls = p.timedOut ? 'timeout' : 'finished';
        const statusTxt = p.timedOut ? 'Timed Out' : (ordinals[p.finishRank-1] || p.finishRank+'th');
        return `<div class="lb-row ${p.slotIndex===mySlotIndex?'lb-me':''}" style="--p-color:${p.color}">
            <span class="lb-rank">${ordinals[p.finishRank-1]||p.finishRank+'th'}</span>
            <span class="lb-car">${p.emoji}</span>
            <span class="lb-name">${escHtml(p.name)}</span>
            <span class="lb-wpm">${p.wpm} WPM</span>
            <span class="lb-status ${statusCls}">${statusTxt}</span>
        </div>`;
    }).join('');

    $('result-overlay').classList.remove('hidden');
    if (isHost) $('btn-play-again').classList.remove('hidden');
}

// ─── Host init ────────────────────────────────────────────────────────────────
function hostGame() {
    const name = $('input-player-name').value.trim() || 'Racer';
    profile.name = name;
    saveProfile();

    if (peer) peer.destroy();
    isHost = true;
    roomCode = generateCode();
    mySlotIndex = 0;
    guestConns = {}; guestSlots = {}; nextSlot = 1;
    players = [makePlayer(0, name, profile.carId, profile.carColor)];

    peer = new Peer(PEER_PREFIX + roomCode);
    peer.on('open', () => {
        $('display-room-code').textContent = roomCode;
        $('hud-room').textContent = roomCode;
        renderLobby();
        goToGame();
        showView('lobby');
    });

    peer.on('connection', (conn) => {
        if (Object.keys(guestConns).length >= MAX_PLAYERS - 1) {
            conn.on('open', () => { safeSend(conn, { type: 'ERROR', msg: 'Room is full.' }); setTimeout(() => conn.close(), 500); });
            return;
        }
        const slot = nextSlot++;
        guestSlots[conn.peer] = slot;
        guestConns[conn.peer] = conn;
        players[slot] = makePlayer(slot, `Player ${slot+1}`, 'beetle', PLAYER_COLORS[slot]);

        conn.on('open', () => {
            safeSend(conn, { type: 'WELCOME', slotIndex: slot, players: [...players], roomCode });
            broadcastExcept(conn.peer, { type: 'PLAYER_JOINED', slotIndex: slot, player: { ...players[slot] } });
            renderLobby();
        });
        conn.on('data', d => handleHostData(conn.peer, d));
        conn.on('close', () => guestLeft(conn.peer));
        conn.on('error', () => guestLeft(conn.peer));
    });
    peer.on('error', peerError);
}

function guestLeft(peerId) {
    const slot = guestSlots[peerId];
    if (slot === undefined) return;
    delete guestConns[peerId]; delete guestSlots[peerId];
    players[slot] = null;
    broadcastAll({ type: 'PLAYER_LEFT', slotIndex: slot });
    renderLobby();
}

function handleHostData(peerId, data) {
    switch (data.type) {
        case 'IDENTIFY':
            // Guest sends their name/car after connect
            if (players[guestSlots[peerId]]) {
                players[guestSlots[peerId]].name = data.name;
                players[guestSlots[peerId]].carId = data.carId;
                players[guestSlots[peerId]].carColor = data.carColor;
                broadcastExcept(peerId, { type: 'PLAYER_UPDATE', slotIndex: guestSlots[peerId], player: { ...players[guestSlots[peerId]] } });
                renderLobby();
            }
            break;
        case 'PROGRESS': {
            const p = players[data.slotIndex];
            if (p) { p.wpm = data.wpm; p.progress = data.progress; p.accuracy = data.accuracy; }
            updateTracksUI();
            broadcastExcept(peerId, data);
            break;
        }
        case 'FINISHED':
            handleRemoteFinish(data);
            broadcastExcept(peerId, data);
            break;
        case 'TIMEOUT':
            handleRemoteTimeout(data);
            broadcastExcept(peerId, data);
            break;
    }
}

// ─── Guest init ───────────────────────────────────────────────────────────────
function joinGame(code) {
    const name = $('input-player-name').value.trim() || 'Racer';
    profile.name = name;
    saveProfile();

    if (peer) peer.destroy();
    isHost = false;
    roomCode = code;
    mySlotIndex = -1;

    peer = new Peer(PEER_PREFIX + generateCode() + '-g');
    peer.on('open', () => {
        goToGame();
        showView('lobby');
        $('display-room-code').textContent = code;
        $('lobby-status').textContent = 'Connecting to host...';

        const conn = peer.connect(PEER_PREFIX + code);
        hostConn = conn;

        conn.on('open', () => {
            $('lobby-status').textContent = 'Connected! Waiting for host to start...';
            // Send identity
            safeSend(conn, { type: 'IDENTIFY', name: profile.name, carId: profile.carId, carColor: profile.carColor });
        });
        conn.on('data', d => handleGuestData(d));
        conn.on('close', () => { alert('Disconnected from host.'); resetGame(); });
        conn.on('error', () => { alert('Lost connection to host.'); resetGame(); });
    });
    peer.on('error', peerError);
}

function handleGuestData(data) {
    switch (data.type) {
        case 'WELCOME':
            mySlotIndex = data.slotIndex;
            players = data.players;
            $('display-room-code').textContent = data.roomCode;
            renderLobby();
            break;
        case 'PLAYER_JOINED':
            players[data.slotIndex] = data.player;
            renderLobby();
            break;
        case 'PLAYER_LEFT':
            players[data.slotIndex] = null;
            renderLobby();
            break;
        case 'PLAYER_UPDATE':
            players[data.slotIndex] = data.player;
            renderLobby();
            break;
        case 'START_RACE':
            prepareRace(data.text, data.players, mySlotIndex);
            break;
        case 'PROGRESS': {
            const p = players[data.slotIndex];
            if (p) { p.wpm = data.wpm; p.progress = data.progress; p.accuracy = data.accuracy; }
            updateTracksUI();
            break;
        }
        case 'FINISHED':
            handleRemoteFinish(data);
            break;
        case 'TIMEOUT':
            handleRemoteTimeout(data);
            break;
        case 'END_RACE':
            applyEndRace(data.players);
            break;
        case 'ERROR':
            alert(data.msg || 'An error occurred.');
            resetGame();
            break;
    }
}

function peerError(err) {
    console.error('PeerJS error:', err);
    if (err.type === 'peer-unavailable') alert('Room not found! Check the code and try again.');
    else alert('Connection error. Please try again.');
    resetGame();
}

// ─── Button wiring ────────────────────────────────────────────────────────────
$('btn-host').addEventListener('click', hostGame);

$('btn-join').addEventListener('click', () => {
    const code = $('input-room-code').value.trim().toUpperCase();
    if (code.length < 4) { alert('Enter a valid 4-character room code.'); return; }
    joinGame(code);
});

$('input-room-code').addEventListener('input', function() {
    this.value = this.value.toUpperCase().replace(/[^A-Z0-9]/g,'');
});
$('input-room-code').addEventListener('keydown', e => {
    if (e.key === 'Enter') $('btn-join').click();
});

$('btn-copy-code').addEventListener('click', () => {
    navigator.clipboard.writeText(roomCode).catch(()=>{});
    $('btn-copy-code').textContent = '✅';
    setTimeout(() => $('btn-copy-code').textContent = '📋', 2000);
});

$('btn-start-race').addEventListener('click', () => {
    if (!isHost) return;
    const text = TEXTS[Math.floor(Math.random() * TEXTS.length)];
    const active = players.filter(Boolean);
    broadcastAll({ type: 'START_RACE', text, players: active });
    prepareRace(text, active, mySlotIndex);
});

$('btn-play-again').addEventListener('click', () => {
    if (!isHost) return;
    clearInterval(raceTimer);
    const text = TEXTS[Math.floor(Math.random() * TEXTS.length)];
    const active = players.filter(Boolean);
    broadcastAll({ type: 'START_RACE', text, players: active });
    prepareRace(text, active, 0);
});

$('btn-quit').addEventListener('click', resetGame);
$('btn-leave').addEventListener('click', resetGame);

// ─── Reset ────────────────────────────────────────────────────────────────────
function resetGame() {
    clearInterval(raceTimer);
    clearInterval(countdownTimer);
    if (peer) { try { peer.destroy(); } catch(e) {} peer = null; }

    hostConn = null;
    guestConns = {}; guestSlots = {};
    nextSlot = 1; players = [];
    isHost = false; gameText = '';
    startTime = null; timeLimit = 0;
    mySlotIndex = 0; finishedCount = 0;

    const input = $('typing-input');
    input.value = ''; input.disabled = true;
    input.placeholder = 'Waiting for countdown...';

    $('result-overlay').classList.add('hidden');
    $('btn-play-again').classList.add('hidden');
    $('countdown-overlay').classList.add('hidden');
    $('btn-start-race').classList.add('hidden');
    $('hud-wpm').textContent = '0';
    $('my-accuracy').textContent = 'ACC: --%';

    goToLanding();
}

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    initLandingUI();
});
