/**
 * NeonType Race — Multiplayer Typing Game
 * Fixed: cross-network join, serialization, STUN servers
 */

// ─── Config ───────────────────────────────────────────────────────────────────
const PEER_PREFIX     = 'ntr-';
const MAX_PLAYERS     = 4;
const COUNTDOWN_SECS  = 3;
const IDEAL_WPM       = 60;
const TIME_FACTOR     = 1.5;
const JOIN_TIMEOUT_MS = 12000;

// STUN servers for NAT traversal (required for cross-network play)
const PEER_CONFIG = {
    debug: 0,
    config: {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302'    },
            { urls: 'stun:stun1.l.google.com:19302'   },
            { urls: 'stun:stun2.l.google.com:19302'   },
            { urls: 'stun:stun3.l.google.com:19302'   },
            { urls: 'stun:stun.cloudflare.com:3478'   },
            { urls: 'stun:global.stun.twilio.com:3478'}
        ]
    }
};

// ─── THE CORE FIX ─────────────────────────────────────────────────────────────
// Host registers peer ID = PEER_PREFIX + roomCode  (e.g. "ntr-ABCD")
// Guest connects to     = PEER_PREFIX + roomCode  (same string, known from code)
// This is how guests find the host — no server lookup needed.
function hostPeerId(code)  { return PEER_PREFIX + code; }
// Guest gets a unique ID using timestamp to avoid "ID taken" collisions
function newGuestId()      { return PEER_PREFIX + 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2,5); }
// Room codes: no I/O/0/1 to avoid visual confusion
function makeRoomCode()    {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let c = '';
    for (let i = 0; i < 4; i++) c += chars[Math.floor(Math.random() * chars.length)];
    return c;
}

// ─── Texts (~100 words, 7 lines each) ─────────────────────────────────────────
const TEXTS = [
    `The city never sleeps. Beneath the flickering neon canopy, vendors hawk steaming bowls of ramen while drones weave between skyscrapers like silver fish through a glass sea. Data cables run under every surface, carrying the dreams of ten million connected souls. To live here is to exist in two worlds at once: the physical crush of bodies and concrete, and the invisible digital realm layered over everything like a second sky. Those who can read both worlds are the true navigators of this age. Everyone else is just passing through the corridors of a future already written.`,

    `Rain has a way of erasing the boundaries between things. Puddles reflect neon signs in shattered fragments, making the wet street look like a mosaic of broken light. Pedestrians become silhouettes with glowing edges, their umbrellas like black mushrooms pushing through a luminous underworld. The rhythm of the rain on the pavement is the city's own heartbeat, steady and relentless, punctuated by the hiss of tires and the distant thunder that rolls between towers. On nights like this, even the most hardened city dweller pauses, looks up, and remembers they are beautifully small.`,

    `Typing is a skill that rewards patience above all else. The fingers that move fastest are rarely the ones that started fastest. They are the ones that built their speed slowly, deliberately, through thousands of hours of careful repetition. Every character is a micro-decision: which finger, which motion, which fraction of a second. Speed emerges from the elimination of hesitation, and hesitation fades only when the body knows the keyboard so well that thought and motion become the same event. Practice is the slow accumulation of mastery, one keystroke at a time, until fluency becomes invisible.`,

    `Space is not empty. Between the visible stars, threads of gas and magnetic fields connect everything in a vast invisible web. Galaxies pull on each other across distances too great to comprehend, their influence travelling at the speed of gravity itself. Black holes anchor the centres of almost every galaxy we have studied, spinning slowly like cosmic engines powering the structure of the universe. Light that left distant stars before Earth existed is only now reaching our telescopes, carrying ancient information about a universe we can barely see. We are looking at ghosts, the radiant echoes of things long transformed.`,

    `Networks are not built from cables alone. They are built from trust, the quiet agreement between machines that the data passing between them is worth protecting, routing, and delivering intact. Every packet carries a tiny flag that says it came from somewhere real and is going somewhere real. The engineers who designed these protocols in sparse academic offices never imagined the volume that would one day travel through their inventions. Yet the architecture holds, because it was built on sound principles: redundancy, error correction, and the fundamental assumption that every message must get through.`,

    `Mountains teach humility in a way that nothing else can. They are indifferent to schedules, to ambitions, to the urgency that drives human beings through their daily lives. A storm on a high ridge waits for no one, and the climber who argues with the weather always loses in the end. What the mountains offer instead is a different kind of clarity, a sense of scale that persists long after the descent back to sea level. Problems that seemed overwhelming in the lowlands shrink when measured against granite ridgelines that have stood for millions of years without moving an inch.`,

    `The archive was three floors underground, temperature-controlled to preserve paper older than any living institution. Rows of grey metal shelves stretched into darkness beyond the reach of portable lights the researcher carried. Every box held a fragment of a world that had believed itself permanent. Letters, receipts, maps, census records, each one a small act of preservation by someone who had sensed, rightly, that the details mattered to the future. The researcher moved carefully, gloves on, breath fogging in the cool air, reading a world that had not expected to be read again by anyone.`
];

// ─── Cars ─────────────────────────────────────────────────────────────────────
function hexToRgb(hex) {
    hex = String(hex).replace('#','');
    if (hex.length === 3) hex = hex.split('').map(x=>x+x).join('');
    return { r:parseInt(hex.slice(0,2),16)||0, g:parseInt(hex.slice(2,4),16)||0, b:parseInt(hex.slice(4,6),16)||0 };
}
function darken(hex,a)  { const {r,g,b}=hexToRgb(hex),f=1-a; return `rgb(${Math.round(r*f)},${Math.round(g*f)},${Math.round(b*f)})`; }
function lighten(hex,a) { const {r,g,b}=hexToRgb(hex); return `rgb(${Math.round(r+(255-r)*a)},${Math.round(g+(255-g)*a)},${Math.round(b+(255-b)*a)})`; }

const CARS = [
    { id:'beetle', name:'Beetle', svg:(c)=>`<svg viewBox="0 0 100 44" xmlns="http://www.w3.org/2000/svg"><ellipse cx="50" cy="30" rx="43" ry="12" fill="${darken(c,.3)}"/><path d="M16 30 Q18 13 50 11 Q82 13 84 30 Z" fill="${c}"/><rect x="13" y="27" width="74" height="10" rx="5" fill="${darken(c,.18)}"/><ellipse cx="27" cy="37" rx="10" ry="6" fill="#1a1a1a"/><ellipse cx="27" cy="37" rx="6" ry="4" fill="#444"/><ellipse cx="73" cy="37" rx="10" ry="6" fill="#1a1a1a"/><ellipse cx="73" cy="37" rx="6" ry="4" fill="#444"/><rect x="34" y="16" width="32" height="12" rx="3" fill="rgba(180,230,255,.5)"/></svg>` },
    { id:'sedan',  name:'Sedan',  svg:(c)=>`<svg viewBox="0 0 100 44" xmlns="http://www.w3.org/2000/svg"><rect x="8" y="26" width="84" height="12" rx="4" fill="${darken(c,.22)}"/><path d="M20 26 L26 14 L74 14 L80 26 Z" fill="${c}"/><rect x="27" y="15" width="46" height="10" rx="2" fill="rgba(180,230,255,.5)"/><ellipse cx="25" cy="38" rx="9" ry="6" fill="#1a1a1a"/><ellipse cx="25" cy="38" rx="5" ry="3.5" fill="#444"/><ellipse cx="75" cy="38" rx="9" ry="6" fill="#1a1a1a"/><ellipse cx="75" cy="38" rx="5" ry="3.5" fill="#444"/><rect x="10" y="25" width="14" height="7" rx="2" fill="${lighten(c,.3)}"/><rect x="76" y="25" width="14" height="7" rx="2" fill="#cc9900"/></svg>` },
    { id:'sports', name:'Sports', svg:(c)=>`<svg viewBox="0 0 100 44" xmlns="http://www.w3.org/2000/svg"><rect x="6" y="26" width="88" height="11" rx="3" fill="${darken(c,.28)}"/><path d="M13 26 L21 15 L68 13 L87 26 Z" fill="${c}"/><rect x="23" y="14" width="40" height="10" rx="2" fill="rgba(180,230,255,.55)"/><ellipse cx="22" cy="37" rx="9" ry="6" fill="#1a1a1a"/><ellipse cx="22" cy="37" rx="5" ry="3.5" fill="#444"/><ellipse cx="78" cy="37" rx="9" ry="6" fill="#1a1a1a"/><ellipse cx="78" cy="37" rx="5" ry="3.5" fill="#444"/><rect x="7" y="24" width="16" height="7" rx="2" fill="${lighten(c,.3)}"/><rect x="77" y="24" width="16" height="7" rx="2" fill="#cc9900"/><rect x="55" y="22" width="22" height="4" rx="2" fill="${lighten(c,.12)}"/></svg>` },
    { id:'truck',  name:'Truck',  svg:(c)=>`<svg viewBox="0 0 100 44" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="20" width="92" height="18" rx="4" fill="${darken(c,.2)}"/><rect x="4" y="20" width="38" height="18" rx="4" fill="${c}"/><rect x="8" y="22" width="28" height="12" rx="2" fill="rgba(180,230,255,.45)"/><ellipse cx="20" cy="38" rx="9" ry="6" fill="#1a1a1a"/><ellipse cx="20" cy="38" rx="5" ry="3.5" fill="#444"/><ellipse cx="80" cy="38" rx="9" ry="6" fill="#1a1a1a"/><ellipse cx="80" cy="38" rx="5" ry="3.5" fill="#444"/><rect x="5" y="19" width="16" height="8" rx="2" fill="${lighten(c,.3)}"/></svg>` }
];

const PLAYER_COLORS = ['#00eeff','#ff003c','#ffe600','#00ff88'];
const PLAYER_EMOJIS = ['🏎️','🚙','🚕','🚗'];
const QUICK_COLORS  = ['#00eeff','#ff003c','#ffe600','#00ff88','#7000ff','#ff6600','#ffffff','#ff69b4','#00ccff','#ff4500','#39ff14','#ff00ff'];

// ─── Profile ──────────────────────────────────────────────────────────────────
let profile = { name:'Racer', carId:'beetle', carColor:'#00eeff' };
try { Object.assign(profile, JSON.parse(localStorage.getItem('neontype_profile')||'{}')); } catch(e) {}
function saveProfile() { try { localStorage.setItem('neontype_profile', JSON.stringify(profile)); } catch(e) {} }

// ─── State ────────────────────────────────────────────────────────────────────
let peer           = null;
let isHost         = false;
let roomCode       = '';
let mySlotIndex    = 0;
let guestConns     = {};   // peerId → DataConnection (host only)
let guestSlots     = {};   // peerId → slotIndex      (host only)
let nextSlot       = 1;
let hostConn       = null; // guest only
let players        = [];
let gameText       = '';
let timeLimit      = 0;
let startTime      = null;
let raceTimer      = null;
let finishedCount  = 0;
let cdTimer        = null; // countdown timeout
let joinTimer      = null; // join timeout

const $ = id => document.getElementById(id);

// ─── Networking helpers ───────────────────────────────────────────────────────
// DO NOT set serialization:'json' on peer.connect() — let PeerJS handle it natively.
// Just always send plain JS objects; PeerJS serializes them automatically.

function send(conn, data) {
    try { if (conn && conn.open) conn.send(data); }
    catch(e) { console.warn('send() failed:', e); }
}
function broadcastAll(data) {
    Object.values(guestConns).forEach(c => send(c, data));
}
function broadcastExcept(skipId, data) {
    Object.entries(guestConns).forEach(([id, c]) => { if (id !== skipId) send(c, data); });
}

// ─── Misc helpers ─────────────────────────────────────────────────────────────
function esc(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function calcLimit(text) {
    return Math.ceil(text.trim().split(/\s+/).length / IDEAL_WPM * 60 * TIME_FACTOR);
}
function fmtTime(s) {
    s = Math.max(0, Math.floor(s));
    return Math.floor(s/60) > 0 ? `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}` : `${s}s`;
}

// ─── Page / view ──────────────────────────────────────────────────────────────
function gotoGame()    { $('page-landing').classList.add('page-exit');    $('page-game').classList.add('page-active');    }
function gotoLanding() { $('page-landing').classList.remove('page-exit'); $('page-game').classList.remove('page-active'); }
function showView(v)   { document.querySelectorAll('.game-view').forEach(el => el.classList.remove('active')); $('view-'+v).classList.add('active'); }
function setStatus(msg, err=false) { const el=$('lobby-status'); if(el){el.textContent=msg; el.style.color=err?'var(--error)':'var(--primary)';} }

// ─── Player factory ───────────────────────────────────────────────────────────
function mkPlayer(slot, name, carId, carColor) {
    return { slotIndex:slot, name:name||`Player ${slot+1}`, carId:carId||'beetle',
             carColor:carColor||PLAYER_COLORS[slot]||'#00eeff',
             emoji:PLAYER_EMOJIS[slot]||'🚗', color:PLAYER_COLORS[slot]||'#00eeff',
             progress:0, wpm:0, accuracy:100, finished:false, finishRank:0, timedOut:false };
}
function me() { return players[mySlotIndex] || null; }
function carSvg(id, color) { return (CARS.find(c=>c.id===id)||CARS[0]).svg(color||'#00eeff'); }

// ─── Landing UI ───────────────────────────────────────────────────────────────
function initLanding() {
    $('input-player-name').value = profile.name;
    $('input-player-name').addEventListener('input', function() {
        profile.name = this.value.trim() || 'Racer'; saveProfile();
    });
    buildCars(); buildColors();
}

function buildCars() {
    const row = $('quick-car-row'); if (!row) return;
    row.innerHTML = '';
    CARS.forEach(car => {
        const d = document.createElement('div');
        d.className = 'qcar' + (car.id === profile.carId ? ' selected' : '');
        d.innerHTML = car.svg(profile.carColor) + `<span class="qcar-name">${car.name}</span>`;
        d.onclick = () => { profile.carId = car.id; saveProfile(); buildCars(); };
        row.appendChild(d);
    });
}

function buildColors() {
    const w = $('quick-colors'); if (!w) return;
    w.innerHTML = '';
    QUICK_COLORS.forEach(col => {
        const s = document.createElement('div');
        s.className = 'qcolor' + (col === profile.carColor ? ' selected' : '');
        s.style.background = col;
        s.onclick = () => {
            profile.carColor = col; saveProfile();
            document.querySelectorAll('.qcolor').forEach(x => x.classList.remove('selected'));
            s.classList.add('selected');
            buildCars();
        };
        w.appendChild(s);
    });
}

// ─── Lobby UI ─────────────────────────────────────────────────────────────────
function renderLobby() {
    const grid = $('lobby-players'); if (!grid) return;
    grid.innerHTML = '';
    for (let i = 0; i < MAX_PLAYERS; i++) {
        const p = players[i];
        const el = document.createElement('div');
        el.className = 'lp-slot ' + (p ? 'filled' : 'empty');
        if (p) el.style.setProperty('--p-color', p.color);
        el.innerHTML = p
            ? `<div class="lp-avatar">${carSvg(p.carId,p.carColor)}</div><div class="lp-name">${esc(p.name)}</div><div class="lp-badge ${i===0?'badge-host':'badge-joined'}">${i===0?'HOST':'JOINED'}</div>`
            : `<div class="lp-avatar" style="font-size:1.4rem;color:var(--muted)">?</div><div class="lp-name" style="color:var(--muted)">Open Slot</div><div class="lp-badge badge-waiting">WAITING</div>`;
        grid.appendChild(el);
    }
    const active = players.filter(Boolean).length;
    const sb = $('btn-start-race'), hint = $('lobby-hint');
    if (isHost) {
        if (active >= 2) {
            sb.classList.remove('hidden');
            if (hint) hint.style.display = 'none';
        } else {
            sb.classList.add('hidden');
            if (hint) { hint.style.display = 'block'; hint.textContent = `Need ${2-active} more player(s) to start...`; }
        }
        setStatus(`Your Room · ${active}/${MAX_PLAYERS} Players`);
    } else {
        setStatus(`Joined · ${active}/${MAX_PLAYERS} Players`);
    }
}

// ─── Race UI ──────────────────────────────────────────────────────────────────
function renderTracks() {
    const c = $('tracks-container'); if (!c) return;
    c.innerHTML = '';
    players.filter(Boolean).forEach(p => {
        const isMe = p.slotIndex === mySlotIndex;
        const row = document.createElement('div');
        row.className = 'racer-row'; row.id = `track-${p.slotIndex}`;
        row.style.setProperty('--p-color', p.color);
        row.innerHTML = `
            <div class="racer-meta">
                <span class="racer-name">${esc(p.name)}${isMe?' <em>(you)</em>':''}</span>
                <div class="racer-right">
                    <span class="racer-wpm" id="wpm-${p.slotIndex}">0 WPM</span>
                    <span class="racer-finish hidden" id="fin-${p.slotIndex}"></span>
                </div>
            </div>
            <div class="track-bar">
                <div class="track-fill" id="fill-${p.slotIndex}" style="width:0%">
                    <span class="track-car">${p.emoji}</span>
                </div>
            </div>`;
        c.appendChild(row);
    });
}

function updateTracks() {
    const ords = ['1st','2nd','3rd','4th'];
    players.filter(Boolean).forEach(p => {
        const fill=$(`fill-${p.slotIndex}`), wpmEl=$(`wpm-${p.slotIndex}`), finEl=$(`fin-${p.slotIndex}`), rowEl=$(`track-${p.slotIndex}`);
        if (fill)  fill.style.width  = Math.min(100, p.progress) + '%';
        if (wpmEl) wpmEl.textContent = p.wpm + ' WPM';
        if (rowEl && p.finished) rowEl.classList.add('finished');
        if (finEl && p.finished) { finEl.textContent = p.timedOut ? 'DNF' : (ords[p.finishRank-1]||p.finishRank+'th'); finEl.classList.remove('hidden'); }
    });
}

// ─── Text display ─────────────────────────────────────────────────────────────
function renderText(typed='') {
    const d = $('text-display'); if (!d) return;
    let html = '';
    for (let i = 0; i < gameText.length; i++) {
        const raw = gameText[i], ch = raw===' '?'&nbsp;':esc(raw);
        let cls = i < typed.length ? (typed[i]===raw?'correct':'incorrect') : i===typed.length?'current':'';
        html += `<span class="${cls}">${ch}</span>`;
    }
    d.innerHTML = html;
    const cur = d.querySelector('.current');
    if (cur) cur.scrollIntoView({ block:'nearest', behavior:'smooth' });
}

// ─── Timer ────────────────────────────────────────────────────────────────────
const CIRC = 2 * Math.PI * 18;
function updateRing(rem) {
    const fill=$('time-ring-fill'), num=$('time-remaining');
    if (!fill || !num) return;
    const frac = Math.max(0, rem / timeLimit);
    fill.style.strokeDashoffset = CIRC * (1 - frac);
    num.textContent = fmtTime(rem);
    fill.classList.remove('warn','danger');
    if      (frac <= 0.2) fill.classList.add('danger');
    else if (frac <= 0.4) fill.classList.add('warn');
}

function startTimer() {
    let rem = timeLimit; updateRing(rem);
    raceTimer = setInterval(() => { rem--; updateRing(rem); if (rem <= 0) { clearInterval(raceTimer); onTimeUp(); } }, 1000);
}

function onTimeUp() {
    const p = me();
    if (p && !p.finished) {
        p.timedOut = true; p.finished = true; p.finishRank = ++finishedCount;
        const inp = $('typing-input'); if (inp) inp.disabled = true;
        const msg = { type:'TIMEOUT', slotIndex:mySlotIndex, wpm:p.wpm };
        if (isHost) { broadcastAll(msg); checkDone(); } else send(hostConn, msg);
        updateTracks();
        showResult(p.finishRank, p.wpm, p.accuracy, true);
    }
}

function checkDone() {
    const active = players.filter(Boolean);
    if (active.length > 0 && active.every(p => p.finished)) {
        clearInterval(raceTimer);
        broadcastAll({ type:'END_RACE', players: active.map(p => ({ slotIndex:p.slotIndex, finishRank:p.finishRank, wpm:p.wpm, accuracy:p.accuracy, timedOut:p.timedOut })) });
    }
}

// ─── Countdown ────────────────────────────────────────────────────────────────
function startCountdown(cb) {
    const ov = $('countdown-overlay'), num = $('countdown-number');
    if (!ov || !num) { cb(); return; }
    ov.classList.remove('hidden');
    let n = COUNTDOWN_SECS;
    function tick() {
        num.classList.remove('pop'); void num.offsetWidth; num.classList.add('pop');
        num.textContent = n;
        if (n === 0) { num.textContent = 'GO!'; cdTimer = setTimeout(() => { ov.classList.add('hidden'); cb(); }, 700); }
        else { n--; cdTimer = setTimeout(tick, 1000); }
    }
    tick();
}

// ─── Prepare race ─────────────────────────────────────────────────────────────
function prepareRace(text, allPlayers, mySlot) {
    gameText = text; mySlotIndex = mySlot; timeLimit = calcLimit(text);
    players = allPlayers.map(p => ({ ...p, progress:0, wpm:0, accuracy:100, finished:false, finishRank:0, timedOut:false }));
    startTime = null; finishedCount = 0;
    $('hud-room').textContent = roomCode;
    $('hud-wpm').textContent  = '0';
    $('time-total-label').textContent = `/ ${fmtTime(timeLimit)}`;
    updateRing(timeLimit);
    $('result-overlay').classList.add('hidden');
    $('btn-play-again').classList.add('hidden');
    renderTracks(); renderText(''); updateTracks();
    const inp = $('typing-input');
    if (inp) { inp.value = ''; inp.disabled = true; inp.placeholder = 'Get ready...'; }
    showView('race');
    startCountdown(() => {
        startTime = Date.now();
        if (inp) { inp.disabled = false; inp.placeholder = 'Start typing...'; inp.focus(); }
        startTimer();
    });
}

// ─── Typing ───────────────────────────────────────────────────────────────────
function onType() {
    if (!startTime || !gameText) return;
    const inp = $('typing-input'), typed = inp.value;
    let correct = 0;
    for (let i = 0; i < typed.length; i++) if (typed[i] === gameText[i]) correct++;
    const accuracy = typed.length > 0 ? Math.round(correct / typed.length * 100) : 100;
    renderText(typed);
    const elapsed = (Date.now() - startTime) / 60000;
    const wpm = elapsed > 0 ? Math.floor(correct / 5 / elapsed) : 0;
    let matched = 0;
    for (let i = 0; i < gameText.length; i++) { if (typed[i] === gameText[i]) matched++; else break; }
    const progress = Math.min(100, matched / gameText.length * 100);
    const p = me(); if (!p) return;
    p.wpm = wpm; p.progress = progress; p.accuracy = accuracy;
    $('hud-wpm').textContent = wpm;
    const ac = $('my-accuracy'); if (ac) ac.textContent = `ACC: ${accuracy}%`;
    updateTracks();
    const msg = { type:'PROGRESS', slotIndex:mySlotIndex, wpm, progress, accuracy };
    if (isHost) broadcastAll(msg); else send(hostConn, msg);
    if (typed === gameText && !p.finished) finishMe(wpm, accuracy);
}

function finishMe(wpm, accuracy) {
    const p = me(); if (!p || p.finished) return;
    finishedCount++; p.finished = true; p.finishRank = finishedCount;
    updateTracks();
    const msg = { type:'FINISHED', slotIndex:mySlotIndex, finishRank:finishedCount, wpm, accuracy };
    if (isHost) { broadcastAll(msg); checkDone(); } else send(hostConn, msg);
    const inp = $('typing-input'); if (inp) inp.disabled = true;
    showResult(p.finishRank, wpm, accuracy, false);
}

function onRemoteFinish(d) {
    const p = players[d.slotIndex]; if (!p || p.finished) return;
    p.finished = true; p.finishRank = d.finishRank; p.wpm = d.wpm; p.accuracy = d.accuracy||100;
    finishedCount = Math.max(finishedCount, d.finishRank);
    updateTracks(); if (isHost) checkDone();
}

function onRemoteTimeout(d) {
    const p = players[d.slotIndex]; if (!p || p.finished) return;
    p.finished = true; p.timedOut = true; p.finishRank = ++finishedCount; p.wpm = d.wpm||0;
    updateTracks(); if (isHost) checkDone();
}

function onEndRace(fp) {
    (fp||[]).forEach(x => { const p = players[x.slotIndex]; if (p) Object.assign(p, x, {finished:true}); });
    clearInterval(raceTimer);
    const p = me();
    if (p && !p.finished) {
        p.finished = true; p.timedOut = true;
        const inp = $('typing-input'); if (inp) inp.disabled = true;
        showResult(players.filter(Boolean).length, p.wpm, p.accuracy, true);
    }
    updateTracks();
}

// ─── Results ──────────────────────────────────────────────────────────────────
function showResult(rank, wpm, accuracy, timedOut) {
    const ords = ['1st 🥇','2nd 🥈','3rd 🥉','4th'];
    const win  = rank === 1 && !timedOut;
    $('result-crown').textContent  = win ? '🏆' : timedOut ? '⏰' : rank===2 ? '🥈' : rank===3 ? '🥉' : '💀';
    $('result-title').textContent  = timedOut ? "Time's Up!" : win ? 'You Won!' : `You Finished ${ords[rank-1]||rank+'th'}`;
    $('result-title').style.color  = win ? 'var(--success)' : timedOut ? 'var(--warn)' : rank<=2 ? 'var(--primary)' : 'var(--error)';
    $('result-wpm').textContent    = `${wpm} WPM · ${accuracy}% Accuracy`;
    $('result-time-info').textContent = `Time limit was ${fmtTime(timeLimit)}`;
    const sorted = [...players].filter(p=>p).sort((a,b)=>(a.finishRank||99)-(b.finishRank||99));
    $('result-leaderboard').innerHTML = sorted.map(p => {
        const st = p.timedOut?'timeout':'finished', stTxt = p.timedOut?'Timed Out':(ords[p.finishRank-1]||p.finishRank+'th');
        return `<div class="lb-row ${p.slotIndex===mySlotIndex?'lb-me':''}" style="--p-color:${p.color}">
            <span class="lb-rank">${ords[(p.finishRank||4)-1]||p.finishRank+'th'}</span>
            <span class="lb-car">${p.emoji}</span><span class="lb-name">${esc(p.name)}</span>
            <span class="lb-wpm">${p.wpm} WPM</span><span class="lb-status ${st}">${stTxt}</span></div>`;
    }).join('');
    $('result-overlay').classList.remove('hidden');
    if (isHost) $('btn-play-again').classList.remove('hidden');
}

// ─── Peer teardown ────────────────────────────────────────────────────────────
function destroyPeer() {
    clearTimeout(joinTimer);
    if (peer) { try { peer.destroy(); } catch(e) {} peer = null; }
    hostConn = null;
}
function lockBtns(on) {
    ['btn-host','btn-join'].forEach(id => {
        const b = $(id); if (!b) return; b.disabled = on; b.style.opacity = on ? '0.5' : '';
    });
}

// ─── HOST ─────────────────────────────────────────────────────────────────────
function hostGame() {
    const name = ($('input-player-name').value||'').trim() || 'Racer';
    profile.name = name; saveProfile();
    destroyPeer();
    isHost = true; mySlotIndex = 0;
    guestConns = {}; guestSlots = {}; nextSlot = 1;
    roomCode = makeRoomCode();
    players  = [mkPlayer(0, name, profile.carId, profile.carColor)];
    lockBtns(true);

    // Host registers with the room-code-derived peer ID
    peer = new Peer(hostPeerId(roomCode), PEER_CONFIG);

    peer.on('open', id => {
        console.log('[Host] open, peerId:', id, 'room:', roomCode);
        $('display-room-code').textContent = roomCode;
        $('hud-room').textContent          = roomCode;
        renderLobby(); gotoGame(); showView('lobby');
        lockBtns(false);
    });

    peer.on('connection', conn => {
        console.log('[Host] incoming connection from:', conn.peer);

        // Reject if room full
        if (Object.keys(guestConns).length >= MAX_PLAYERS - 1) {
            conn.on('open', () => { send(conn, {type:'ERROR', msg:'Room is full.'}); setTimeout(()=>conn.close(), 800); });
            return;
        }

        const slot = nextSlot++;
        guestSlots[conn.peer] = slot;
        guestConns[conn.peer] = conn;
        players[slot] = mkPlayer(slot, `Player ${slot+1}`, 'sedan', PLAYER_COLORS[slot]);

        conn.on('open', () => {
            console.log('[Host] conn open with guest slot', slot);
            // Welcome message with current player list
            send(conn, { type:'WELCOME', slotIndex:slot, players:players.map(p=>p?{...p}:null), roomCode });
            // Tell other guests someone joined
            broadcastExcept(conn.peer, { type:'PLAYER_JOINED', slotIndex:slot, player:{...players[slot]} });
            renderLobby();
        });

        conn.on('data',  d    => handleHostData(conn.peer, d));
        conn.on('close', ()   => guestLeft(conn.peer));
        conn.on('error', err  => { console.error('[Host] conn err', err); guestLeft(conn.peer); });
    });

    peer.on('disconnected', () => { try { peer.reconnect(); } catch(e) {} });

    peer.on('error', err => {
        console.error('[Host] peer error:', err.type, err);
        lockBtns(false);
        if (err.type === 'unavailable-id') {
            // Room code collision — very rare, just regenerate
            roomCode = makeRoomCode();
            setTimeout(hostGame, 150);
        } else {
            alert(`Could not create room.\nError: ${err.type}\n\nPlease refresh and try again.`);
            resetGame();
        }
    });
}

function guestLeft(pid) {
    const slot = guestSlots[pid]; if (slot === undefined) return;
    delete guestConns[pid]; delete guestSlots[pid]; players[slot] = null;
    broadcastAll({ type:'PLAYER_LEFT', slotIndex:slot });
    renderLobby();
}

function handleHostData(pid, d) {
    const slot = guestSlots[pid];
    switch (d.type) {
        case 'IDENTIFY':
            if (slot !== undefined && players[slot]) {
                players[slot].name     = d.name     || players[slot].name;
                players[slot].carId    = d.carId    || players[slot].carId;
                players[slot].carColor = d.carColor || players[slot].carColor;
                // Re-send updated full list to the guest who just identified
                send(guestConns[pid], { type:'WELCOME', slotIndex:slot, players:players.map(p=>p?{...p}:null), roomCode });
                // Notify others of updated player info
                broadcastExcept(pid, { type:'PLAYER_UPDATE', slotIndex:slot, player:{...players[slot]} });
                renderLobby();
            }
            break;
        case 'PROGRESS':
            if (players[d.slotIndex]) { players[d.slotIndex].wpm=d.wpm; players[d.slotIndex].progress=d.progress; players[d.slotIndex].accuracy=d.accuracy; }
            updateTracks(); broadcastExcept(pid, d); break;
        case 'FINISHED': onRemoteFinish(d); broadcastExcept(pid, d); break;
        case 'TIMEOUT':  onRemoteTimeout(d); broadcastExcept(pid, d); break;
    }
}

// ─── GUEST ────────────────────────────────────────────────────────────────────
function joinGame(code) {
    const name = ($('input-player-name').value||'').trim() || 'Racer';
    profile.name = name; saveProfile();
    destroyPeer();
    isHost = false; roomCode = code; mySlotIndex = -1;
    lockBtns(true);

    peer = new Peer(newGuestId(), PEER_CONFIG);

    peer.on('open', id => {
        console.log('[Guest] open, peerId:', id, '— joining room:', code);
        gotoGame(); showView('lobby');
        $('display-room-code').textContent = code;
        setStatus('Connecting to host...');
        lockBtns(false);

        // Bail out with helpful message if join takes too long
        joinTimer = setTimeout(() => {
            if (mySlotIndex === -1) {
                alert(
                    `Could not connect to room "${code}".\n\n` +
                    `Please check:\n` +
                    `• The room code is correct (4 characters)\n` +
                    `• The host's browser tab is still open\n` +
                    `• Both of you are using the same URL\n\n` +
                    `If the problem persists, ask the host to create a new room.`
                );
                resetGame();
            }
        }, JOIN_TIMEOUT_MS);

        // Connect to host — peer ID is predictable from room code
        const conn = peer.connect(hostPeerId(code), {
            reliable: true
            // NOTE: Do NOT set serialization:'json' here — causes double-parse bug
        });
        hostConn = conn;

        conn.on('open', () => {
            console.log('[Guest] connected to host!');
            clearTimeout(joinTimer);
            setStatus('Connected! Waiting for host to start...');
            // Tell host who we are
            send(conn, { type:'IDENTIFY', name:profile.name, carId:profile.carId, carColor:profile.carColor });
        });

        conn.on('data',  d   => handleGuestData(d));

        conn.on('close', ()  => {
            clearTimeout(joinTimer);
            if (mySlotIndex !== -1) { alert('Host disconnected.'); resetGame(); }
        });

        conn.on('error', err => {
            console.error('[Guest] conn error:', err);
            clearTimeout(joinTimer);
            alert('Connection to host failed. Please try again.');
            resetGame();
        });
    });

    peer.on('disconnected', () => { try { peer.reconnect(); } catch(e) {} });

    peer.on('error', err => {
        console.error('[Guest] peer error:', err.type, err);
        clearTimeout(joinTimer);
        lockBtns(false);
        if (err.type === 'peer-unavailable') {
            alert(
                `Room "${code}" not found.\n\n` +
                `Please check:\n` +
                `• The 4-character code is correct\n` +
                `• The host's tab is still open on the same URL\n` +
                `• The host created the room on this same site`
            );
        } else if (err.type === 'unavailable-id') {
            // Guest ID collision — retry instantly with new ID
            setTimeout(() => joinGame(code), 100);
            return;
        } else {
            alert(`Connection error: ${err.type}\nPlease try again.`);
        }
        resetGame();
    });
}

function handleGuestData(d) {
    switch (d.type) {
        case 'WELCOME':
            console.log('[Guest] WELCOME — my slot:', d.slotIndex);
            clearTimeout(joinTimer);
            mySlotIndex = d.slotIndex;
            players = (d.players||[]).map(p => p ? {...p} : null);
            $('display-room-code').textContent = d.roomCode || roomCode;
            renderLobby(); break;
        case 'PLAYER_JOINED':  players[d.slotIndex] = d.player;  renderLobby(); break;
        case 'PLAYER_LEFT':    players[d.slotIndex] = null;       renderLobby(); break;
        case 'PLAYER_UPDATE':  players[d.slotIndex] = d.player;  renderLobby(); break;
        case 'START_RACE':
            prepareRace(d.text, d.players, mySlotIndex); break;
        case 'PROGRESS':
            if (players[d.slotIndex]) { players[d.slotIndex].wpm=d.wpm; players[d.slotIndex].progress=d.progress; players[d.slotIndex].accuracy=d.accuracy; }
            updateTracks(); break;
        case 'FINISHED': onRemoteFinish(d); break;
        case 'TIMEOUT':  onRemoteTimeout(d); break;
        case 'END_RACE': onEndRace(d.players); break;
        case 'ERROR':    alert(d.msg||'Room error.'); resetGame(); break;
    }
}

// ─── Reset ────────────────────────────────────────────────────────────────────
function resetGame() {
    clearInterval(raceTimer); clearTimeout(cdTimer); clearTimeout(joinTimer);
    destroyPeer();
    guestConns={}; guestSlots={}; nextSlot=1; players=[];
    isHost=false; gameText=''; startTime=null; timeLimit=0;
    mySlotIndex=0; finishedCount=0;
    const inp=$('typing-input');
    if(inp){inp.value='';inp.disabled=true;inp.placeholder='Waiting for countdown...';}
    ['result-overlay','countdown-overlay'].forEach(id=>{const el=$(id);if(el)el.classList.add('hidden');});
    ['btn-play-again','btn-start-race'].forEach(id=>{const el=$(id);if(el)el.classList.add('hidden');});
    const hw=$('hud-wpm'),ac=$('my-accuracy');
    if(hw)hw.textContent='0'; if(ac)ac.textContent='ACC: --%';
    lockBtns(false);
    gotoLanding();
}

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    initLanding();

    $('typing-input').addEventListener('input',   onType);
    $('typing-input').addEventListener('paste',   e => e.preventDefault());
    $('typing-input').addEventListener('keydown', e => { if (e.key==='Enter') e.preventDefault(); });

    $('btn-host').addEventListener('click', hostGame);

    $('btn-join').addEventListener('click', () => {
        const code = ($('input-room-code').value||'').trim().toUpperCase();
        if (code.length !== 4) { alert('Enter a 4-character room code.'); return; }
        joinGame(code);
    });

    $('input-room-code').addEventListener('input', function() {
        this.value = this.value.toUpperCase().replace(/[^A-Z0-9]/g,'');
    });
    $('input-room-code').addEventListener('keydown', e => { if (e.key==='Enter') $('btn-join').click(); });

    $('btn-copy-code').addEventListener('click', () => {
        const copy = () => navigator.clipboard.writeText(roomCode).catch(() => {
            const t=document.createElement('textarea'); t.value=roomCode;
            document.body.appendChild(t); t.select(); document.execCommand('copy'); document.body.removeChild(t);
        });
        copy();
        $('btn-copy-code').textContent='✅'; setTimeout(()=>$('btn-copy-code').textContent='📋', 2000);
    });

    $('btn-start-race').addEventListener('click', () => {
        if (!isHost) return;
        const text   = TEXTS[Math.floor(Math.random()*TEXTS.length)];
        const active = players.filter(Boolean);
        broadcastAll({ type:'START_RACE', text, players:active.map(p=>({...p})) });
        prepareRace(text, active, mySlotIndex);
    });

    $('btn-play-again').addEventListener('click', () => {
        if (!isHost) return;
        clearInterval(raceTimer);
        const text   = TEXTS[Math.floor(Math.random()*TEXTS.length)];
        const active = players.filter(Boolean);
        broadcastAll({ type:'START_RACE', text, players:active.map(p=>({...p})) });
        prepareRace(text, active, mySlotIndex);
    });

    $('btn-quit').addEventListener('click',  resetGame);
    $('btn-leave').addEventListener('click', resetGame);
});
