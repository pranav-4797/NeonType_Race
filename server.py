import os
import uuid
import json
import random
import string
import math
import logging
import asyncio
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional, Dict

from fastapi import FastAPI, APIRouter, WebSocket, WebSocketDisconnect, HTTPException, Response, Request
from fastapi.responses import JSONResponse
from settings import SECRET_KEY
from cookie_utils import set_player_cookie, read_player_cookie
from cache import init_cache
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ── Logging (mut be defined before anything uses it) ────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI()
init_cache(app)
api_router = APIRouter(prefix="/api")

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Cache-Control Middleware ──────────────────────────────────────────────────
@app.middleware("http")
async def add_cache_headers(request: Request, call_next):
    response = await call_next(request)
    if request.url.path.endswith(('.css', '.js', '.jpg', '.png', '.svg', '.ico')):
        response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
    return response

# ── Game Constants ────────────────────────────────────────────────────────────
MAX_PLAYERS = 4
IDEAL_WPM   = 60
TIME_FACTOR = 2.5

TEXTS = [
    "The city never sleeps. Beneath the flickering neon canopy, vendors hawk steaming bowls of ramen while drones weave between skyscrapers like silver fish through a glass sea.",
    "Rain has a way of erasing the boundaries between things. Puddles reflect neon signs in shattered fragments, making the wet street look like a mosaic of broken light.",
    "Typing is a skill that rewards patience above all else. The fingers that move fastest are rarely the ones that started fastest — they are the ones that built their speed slowly.",
    "Space is not empty. Between the visible stars, threads of gas and magnetic fields connect everything in a vast invisible web. Galaxies pull on each other across distances too great to comprehend.",
    "Networks are not built from cables alone. They are built from trust — the quiet agreement between machines that the data passing between them is worth protecting, routing, and delivering intact.",
    "Mountains teach humility in a way that nothing else can. They are indifferent to schedules, to ambitions, to the urgency that drives human beings through their daily lives.",
    "The archive was three floors underground, temperature-controlled to preserve paper older than any living institution. Every box held a fragment of a world that had believed itself permanent.",
]

TEXTS_BY_LEVEL = {
    "easy": [
        "The sun rises over a quiet town. Birds sing in the trees and flowers bloom in the garden. It is a beautiful morning.",
        "A cat naps on a warm windowsill. The sunlight falls on its soft fur. Outside the window leaves dance in the breeze.",
        "She walked to the store and bought some bread. The air was cool and fresh. She smiled at the people she passed on the way.",
        "The dog ran across the park chasing a red ball. Children laughed and played on the swings nearby. It was a perfect day.",
        "He opened the book and began to read. The story was about a brave knight who saved a kingdom from a dragon.",
        "Rain fell softly on the roof. Inside the house it was warm and cozy. A cup of tea sat steaming on the table.",
        "The beach was quiet in the early morning. Waves rolled gently onto the sand. Seagulls flew overhead calling to each other.",
        "She planted flowers in her garden every spring. The roses were her favorite. They bloomed in shades of red pink and white.",
        "The old man sat on the bench watching the world go by. He remembered the days when he was young and full of energy.",
        "Music filled the room as she played the piano. The melody was soft and sweet. Everyone in the house stopped to listen.",
        "The train arrived at the station on time. People hurried to find their seats. The journey would take about two hours.",
        "Stars filled the night sky like tiny diamonds. The moon was full and bright. It was a perfect night for stargazing.",
        "The children built a sandcastle on the beach. They used buckets and shovels to shape the towers and walls.",
        "He cooked dinner for his family every evening. Tonight he made pasta with tomato sauce. Everyone said it was delicious.",
        "The library was a quiet place full of books. She spent hours there reading stories about faraway lands and great adventures.",
    ],
    "medium": [
        "The city never sleeps. Beneath the flickering neon canopy, vendors hawk steaming bowls of ramen while drones weave between skyscrapers like silver fish through a glass sea.",
        "Rain has a way of erasing the boundaries between things. Puddles reflect neon signs in shattered fragments, making the wet street look like a mosaic of broken light.",
        "Typing is a skill that rewards patience above all else. The fingers that move fastest are rarely the ones that started fastest — they are the ones that built their speed slowly.",
        "Mountains teach humility in a way that nothing else can. They are indifferent to schedules, to ambitions, to the urgency that drives human beings through their daily lives.",
        "The archive was three floors underground, temperature-controlled to preserve paper older than any living institution. Every box held a fragment of a world that had believed itself permanent.",
        "Coffee shops have become the modern writer's studio. The hum of conversation, the clatter of cups, and the smell of fresh espresso create a rhythm that many find essential for creative work.",
        "The ocean is a world unto itself, filled with creatures that have never seen sunlight. In the deepest trenches, life thrives in conditions that would destroy most surface organisms.",
        "Photography is the art of capturing a moment that will never return. The best photographers do not simply point and shoot — they wait, observe, and anticipate the perfect instant.",
        "The market was alive with color and noise. Vendors called out prices while customers squeezed fruit and haggled over fish. Somewhere a radio played a song everyone seemed to know.",
        "Software development is an exercise in controlled complexity. Every line of code adds possibility and risk in equal measure. The best engineers write less, not more.",
        "Autumn transforms the landscape into a canvas of warm colors. Leaves turn from green to gold, orange, and crimson before falling to the ground in a quiet farewell to summer.",
        "The telescope revealed galaxies that had been invisible to the naked eye. Each point of light was a sun, possibly orbited by worlds where life might have taken hold.",
        "Chess is a game of infinite possibility played on a board of sixty-four squares. Every move opens new paths while closing others, demanding both vision and discipline from the player.",
        "The old lighthouse stood alone on the rocky coast, its beam sweeping across the dark water. For over a century it had guided ships safely through the treacherous strait.",
        "Language shapes the way we think about the world. People who speak different languages often perceive time, space, and color in subtly different ways that reveal the power of words.",
    ],
    "hard": [
        "Space is not empty. Between the visible stars, threads of gas and magnetic fields connect everything in a vast invisible web. Galaxies pull on each other across distances too great to comprehend.",
        "Networks are not built from cables alone. They are built from trust — the quiet agreement between machines that the data passing between them is worth protecting, routing, and delivering intact.",
        "Quantum mechanics reveals a universe fundamentally different from the one we experience at human scale. Particles exist in superpositions of states, collapsing into definite outcomes only when measured by an observer.",
        "The blockchain is essentially a distributed ledger that records transactions across thousands of computers simultaneously. Its cryptographic foundations ensure that once data is written, altering it retroactively becomes computationally infeasible.",
        "Neuroplasticity demonstrates that the human brain is not a fixed organ but a dynamic, constantly reorganizing network. Every experience, every thought, every repetition physically reshapes the neural pathways within our skulls.",
        "The Turing test, proposed in 1950, asks whether a machine can exhibit intelligent behavior indistinguishable from that of a human. Decades later, the philosophical implications of this question remain deeply contested among researchers.",
        "Compilers perform a remarkable transformation: they convert human-readable source code into sequences of binary instructions that a processor can execute at billions of operations per second without any understanding of meaning.",
        "The theory of general relativity describes gravity not as a force but as a curvature of spacetime caused by mass and energy. Objects follow the straightest possible paths through this curved geometry.",
        "Cryptographic hash functions are designed to be one-way transformations: given an input, computing the hash is trivial, but reversing the process to recover the original data is computationally intractable by design.",
        "Distributed systems face the CAP theorem, which states that a networked data store cannot simultaneously guarantee consistency, availability, and partition tolerance — at most two of these three properties can be achieved.",
        "The double-slit experiment demonstrates wave-particle duality: when individual photons are fired at two narrow slits, they produce an interference pattern on the detector, as if each photon passes through both slits simultaneously.",
        "Machine learning algorithms identify patterns in data by optimizing mathematical functions over millions of parameters. The resulting models can generalize to new inputs, but their internal reasoning often remains opaque to human interpretation.",
        "Evolutionary algorithms simulate natural selection by maintaining populations of candidate solutions that compete, reproduce, and mutate over successive generations, gradually converging on optimal or near-optimal solutions to complex optimization problems.",
        "The halting problem, proven undecidable by Alan Turing in 1936, shows that no general algorithm can determine whether an arbitrary program will eventually terminate or run forever — a fundamental limit of computation.",
        "Functional programming treats computation as the evaluation of mathematical functions, avoiding mutable state and side effects. This paradigm enables powerful abstractions like higher-order functions, monads, and lazy evaluation that simplify concurrent programming.",
    ],
}

def get_random_text(level: str = "medium") -> str:
    """Pick a random paragraph from the specified difficulty pool."""
    pool = TEXTS_BY_LEVEL.get(level.lower().strip() if level else "medium", TEXTS_BY_LEVEL["medium"])
    return random.choice(pool)

PLAYER_COLORS = ['#f5c400', '#ff6a00', '#00eeff', '#00ff88']
PLAYER_EMOJIS = ['🏎️', '🚙', '🚕', '🚗']

# ── Bot configuration ─────────────────────────────────────────────────────────
BOT_NAMES        = ['Turbo Bot', 'Nitro Bot', 'Vector Bot']
BOT_SKILL_RANGE  = (38, 82)      # WPM range for bots
BOT_TICK_SECONDS = 0.5           # how often bots broadcast progress

# ── In-Memory State ───────────────────────────────────────────────────────────
active_rooms:  Dict[str, dict] = {}
connections:   Dict[str, Dict[str, WebSocket]] = {}

# ── Helpers ───────────────────────────────────────────────────────────────────
def generate_room_code() -> str:
    return ''.join(random.choices(string.ascii_uppercase, k=4))

def calc_time_limit(text: str) -> int:
    words = len(text.strip().split())
    return math.ceil((words / IDEAL_WPM) * 60 * TIME_FACTOR)

def create_player(slot: int, name: str, player_id: str) -> dict:
    return {
        'id':          player_id,
        'slot_index':  slot,
        'name':        (name or f'Player {slot + 1}')[:16],
        'emoji':       PLAYER_EMOJIS[slot],
        'color':       PLAYER_COLORS[slot],
        'progress':    0,
        'wpm':         0,
        'accuracy':    100,
        'finished':    False,
        'finish_rank': 0,
        'timed_out':   False,
        'finish_time': None,
        'is_bot':      False,
    }

async def broadcast(room_code: str, message: dict, exclude: Optional[str] = None):
    if room_code not in connections:
        return
    dead = []
    for pid, ws in connections[room_code].items():
        if pid == exclude:
            continue
        try:
            await ws.send_json(message)
        except Exception:
            dead.append(pid)
    for pid in dead:
        connections[room_code].pop(pid, None)

async def broadcast_all(room_code: str, message: dict):
    await broadcast(room_code, message, exclude=None)


def normalize_heatmap(data: dict, room: dict) -> dict:
    """Sanitize a client-supplied per-character timing/error profile."""
    text_len = len(room.get('text') or '')

    def _clean(key: str) -> list:
        raw = data.get(key)
        if not isinstance(raw, list):
            return []
        cleaned = []
        for v in raw[:text_len]:
            if v is None:
                cleaned.append(None)
                continue
            try:
                cleaned.append(max(0, int(v)))
            except (TypeError, ValueError):
                cleaned.append(None)
        return cleaned

    return {'char_times': _clean('char_times'), 'errors': _clean('errors')}


async def run_bot(room_code: str, bot_id: str, text: str, time_limit: int):
    """Simulate a bot typist racing in real time alongside humans."""
    room = active_rooms.get(room_code)
    bot = room['players'].get(bot_id) if room else None
    if not bot:
        return

    words    = len(text.strip().split())
    skill    = bot.get('skill_wpm', 50)
    duration = max(8.0, (words / skill) * 60.0)
    started  = datetime.now(timezone.utc)
    reached  = 0.0
    step     = BOT_TICK_SECONDS

    try:
        while True:
            await asyncio.sleep(step)
            room = active_rooms.get(room_code)
            if not room or room['status'] != 'racing':
                return
            bot = room['players'].get(bot_id)
            if not bot or bot['finished']:
                return

            elapsed = (datetime.now(timezone.utc) - started).total_seconds()
            frac    = min(1.0, elapsed / duration)
            prog    = max(reached, min(100.0, (frac ** 0.95) * 100 + random.uniform(-1.0, 1.0)))
            reached = prog
            chars   = int(len(text) * prog / 100)
            live_wpm = int((chars / 5) / (elapsed / 60)) if elapsed > 2 else 0

            if frac >= 1.0:
                room['finished_count'] += 1
                bot.update({
                    'finished': True, 'finish_rank': room['finished_count'],
                    'wpm': skill, 'accuracy': random.randint(93, 99),
                    'progress': 100.0,
                    'finish_time': datetime.now(timezone.utc).isoformat(),
                })
                await broadcast_all(room_code, {
                    'type': 'player_finished', 'player_id': bot_id,
                    'slot_index': bot['slot_index'], 'finish_rank': bot['finish_rank'],
                    'wpm': bot['wpm'], 'accuracy': bot['accuracy'],
                })
                await check_race_end(room_code)
                return

            if elapsed >= time_limit:
                room['finished_count'] += 1
                bot.update({
                    'finished': True, 'timed_out': True,
                    'finish_rank': room['finished_count'], 'wpm': live_wpm,
                })
                await broadcast_all(room_code, {
                    'type': 'player_timeout', 'player_id': bot_id,
                    'slot_index': bot['slot_index'], 'wpm': bot['wpm'],
                })
                await check_race_end(room_code)
                return

            bot['wpm']      = min(live_wpm, int(skill * 1.35))
            bot['progress'] = round(prog, 1)
            bot['accuracy'] = random.randint(94, 100)
            await broadcast(room_code, {
                'type': 'player_progress', 'player_id': bot_id,
                'slot_index': bot['slot_index'], 'wpm': bot['wpm'],
                'progress': bot['progress'], 'accuracy': bot['accuracy'],
            })
    except asyncio.CancelledError:
        raise

# ── Models ────────────────────────────────────────────────────────────────────
class RoomCreate(BaseModel):
    player_name: str = "Anonymous"
    difficulty:  Optional[str] = "medium"

class RoomJoin(BaseModel):
    room_code:   str
    player_name: str = "Anonymous"

# ── REST Endpoints ────────────────────────────────────────────────────────────
@api_router.get("/text")
async def get_text(level: str = "medium"):
    """Return a random typing paragraph for the given difficulty level."""
    return {"text": get_random_text(level), "level": level}

@api_router.get("/player-prefs")
async def get_player_prefs(request: Request):
    """Read saved player preferences from signed cookie."""
    name, difficulty = read_player_cookie(request)
    return {"name": name, "difficulty": difficulty or "medium"}

@api_router.post("/rooms/create")
async def create_room(data: RoomCreate, response: Response):
    # Generate a unique room code
    room_code = generate_room_code()
    attempts = 0
    while room_code in active_rooms and attempts < 100:
        room_code = generate_room_code()
        attempts += 1

    player_id = str(uuid.uuid4())
    host      = create_player(0, data.player_name, player_id)

    active_rooms[room_code] = {
        'code':           room_code,
        'host_id':        player_id,
        'players':        {player_id: host},
        'status':         'lobby',
        'difficulty':     data.difficulty or 'medium',
        'text':           None,
        'time_limit':     0,
        'start_time':     None,
        'finished_count': 0,
        'created_at':     datetime.now(timezone.utc).isoformat(),
    }
    connections[room_code] = {}

    logger.info(f"Room {room_code} created by {data.player_name}")
    resp = JSONResponse({'room_code': room_code, 'player_id': player_id, 'player': host, 'difficulty': data.difficulty or 'medium'})
    set_player_cookie(resp, data.player_name or "", data.difficulty or "medium")
    return resp


@api_router.post("/rooms/join")
async def join_room(data: RoomJoin, response: Response):
    code = data.room_code.upper().strip()

    if code not in active_rooms:
        raise HTTPException(status_code=404, detail="Room not found. Check the code and try again.")

    room = active_rooms[code]

    if room['status'] != 'lobby':
        raise HTTPException(status_code=400, detail="Race already in progress.")

    if len(room['players']) >= MAX_PLAYERS:
        raise HTTPException(status_code=400, detail="Room is full (max 4 players).")

    player_id  = str(uuid.uuid4())
    used_slots = {p['slot_index'] for p in room['players'].values()}
    slot_index = next(i for i in range(MAX_PLAYERS) if i not in used_slots)
    player     = create_player(slot_index, data.player_name, player_id)

    room['players'][player_id] = player

    logger.info(f"Player {data.player_name} joined room {code}")
    resp = JSONResponse({
        'room_code': code,
        'player_id': player_id,
        'player':    player,
        'players':   list(room['players'].values()),
    })
    set_player_cookie(resp, data.player_name or "", room.get('difficulty', 'medium'))
    return resp


@api_router.get("/rooms/{room_code}")
async def get_room(room_code: str):
    code = room_code.upper().strip()
    if code not in active_rooms:
        raise HTTPException(status_code=404, detail="Room not found.")
    room = active_rooms[code]
    return {'room_code': code, 'players': list(room['players'].values()), 'status': room['status']}

# ── WebSocket ─────────────────────────────────────────────────────────────────
@app.websocket("/ws/{room_code}/{player_id}")
async def websocket_endpoint(websocket: WebSocket, room_code: str, player_id: str):
    room_code = room_code.upper().strip()

    if room_code not in active_rooms:
        await websocket.close(code=1008, reason="Room not found")
        return

    room = active_rooms[room_code]

    is_spectator = player_id.startswith('spectator:')
    if not is_spectator and player_id not in room['players']:
        await websocket.close(code=1008, reason="Player not in room")
        return

    await websocket.accept()
    connections.setdefault(room_code, {})[player_id] = websocket

    # ── Spectator connection: read-only and invisible to players ──────────────
    if is_spectator:
        snapshot = {
            'type':        'spectate_snapshot',
            'status':      room['status'],
            'players':     list(room['players'].values()),
            'text':        room['text'] or '',
            'time_limit':  room['time_limit'],
            'word_count':  len((room['text'] or '').split()),
            'char_count':  len(room['text'] or ''),
            'elapsed':     0.0,
        }
        if room['status'] == 'racing' and room['start_time']:
            started = datetime.fromisoformat(room['start_time'])
            snapshot['elapsed'] = (datetime.now(timezone.utc) - started).total_seconds()

        await websocket.send_json(snapshot)
        logger.info(f"Spectator {player_id} watching room {room_code}")

        try:
            while True:
                # Spectators are read-only; handle heartbeat if sent
                raw = await websocket.receive_text()
                try:
                    data = json.loads(raw)
                    if data.get('type') == 'ping':
                        await websocket.send_json({'type': 'pong'})
                except Exception:
                    pass
        except WebSocketDisconnect:
            pass
        except Exception as e:
            logger.error(f"Spectator WS error: {e}")
        finally:
            if connections.get(room_code, {}).get(player_id) is websocket:
                connections.get(room_code, {}).pop(player_id, None)
        return

    logger.info(f"WS connected: player {player_id} in room {room_code}")

    # Send current room snapshot
    await websocket.send_json({
        'type':    'room_state',
        'players': list(room['players'].values()),
        'status':  room['status'],
        'host_id': room['host_id'],
    })

    # Notify others
    await broadcast(room_code, {
        'type':   'player_joined',
        'player': room['players'][player_id],
    }, exclude=player_id)

    try:
        while True:
            raw  = await websocket.receive_text()
            try:
                data = json.loads(raw)
            except Exception as json_err:
                logger.warning(f"Invalid JSON from {player_id}: {json_err}")
                continue
            try:
                await handle_message(room_code, player_id, data)
            except Exception as msg_err:
                logger.error(f"Error handling message from {player_id}: {msg_err}")
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"WS error for {player_id}: {e}")
    finally:
        if connections.get(room_code, {}).get(player_id) is websocket:
            connections.get(room_code, {}).pop(player_id, None)
        await handle_disconnect(room_code, player_id, websocket)


async def handle_message(room_code: str, player_id: str, data: dict):
    room = active_rooms.get(room_code)
    if not room:
        return

    msg_type = data.get('type')

    # ── ping / heartbeat ────────────────────────────────────────────────────
    if msg_type == 'ping':
        ws = connections.get(room_code, {}).get(player_id)
        if ws:
            try:
                await ws.send_json({'type': 'pong'})
            except Exception:
                pass
        return

    # ── add_bot ─────────────────────────────────────────────────────────────
    if msg_type == 'add_bot':
        ws = connections.get(room_code, {}).get(player_id)
        if player_id != room['host_id'] or room['status'] != 'lobby':
            return
        if len(room['players']) >= MAX_PLAYERS:
            if ws:
                await ws.send_json({'type': 'error', 'msg': 'Room is full — no space for another bot.'})
            return
        used_slots = {p['slot_index'] for p in room['players'].values()}
        slot = next(i for i in range(MAX_PLAYERS) if i not in used_slots)
        bot_id = f"bot-{uuid.uuid4()}"
        bot = create_player(slot, random.choice(BOT_NAMES), bot_id)
        bot['is_bot']    = True
        bot['emoji']     = '🤖'
        bot['skill_wpm'] = random.randint(*BOT_SKILL_RANGE)
        room['players'][bot_id] = bot
        logger.info(f"Bot '{bot['name']}' ({bot['skill_wpm']} wpm) added to {room_code}")
        await broadcast_all(room_code, {'type': 'player_joined', 'player': bot})

    # ── remove_bot ──────────────────────────────────────────────────────────
    elif msg_type == 'remove_bot':
        if player_id != room['host_id'] or room['status'] != 'lobby':
            return
        target_id = data.get('player_id', '')
        target = room['players'].get(target_id)
        if target and target['is_bot']:
            room['players'].pop(target_id, None)
            logger.info(f"Bot removed from {room_code}")
            await broadcast_all(room_code, {
                'type':       'player_left',
                'player_id':  target_id,
                'slot_index': target['slot_index'],
            })

    # ── start_race ──────────────────────────────────────────────────────────
    elif msg_type == 'start_race':
        if player_id != room['host_id']:
            return
        if len(room['players']) < 1:
            ws = connections.get(room_code, {}).get(player_id)
            if ws:
                await ws.send_json({'type': 'error', 'msg': 'No players in room to start.'})
            return

        difficulty = data.get('difficulty') or room.get('difficulty') or 'medium'
        text       = get_random_text(difficulty)
        time_limit = calc_time_limit(text)

        room.update({
            'status':         'racing',
            'text':           text,
            'time_limit':     time_limit,
            'start_time':     datetime.now(timezone.utc).isoformat(),
            'finished_count': 0,
        })
        for p in room['players'].values():
            p.update({'progress': 0, 'wpm': 0, 'accuracy': 100,
                      'finished': False, 'finish_rank': 0,
                      'timed_out': False, 'finish_time': None})

        word_count = len(text.strip().split())
        char_count = len(text)
        await broadcast_all(room_code, {
            'type':       'race_started',
            'text':       text,
            'time_limit': time_limit,
            'word_count': word_count,
            'char_count': char_count,
            'players':    list(room['players'].values()),
        })

        # Launch bot typists (cancel any stale tasks from a previous race first)
        for task in (room.pop('bot_tasks', None) or []):
            task.cancel()
        bot_ids = [pid for pid, p in room['players'].items() if p['is_bot']]
        room['bot_tasks'] = [
            asyncio.create_task(run_bot(room_code, bid, text, time_limit))
            for bid in bot_ids
        ]

    # ── typing_progress ─────────────────────────────────────────────────────
    elif msg_type == 'typing_progress':
        player = room['players'].get(player_id)
        if not player or room['status'] != 'racing' or player['finished']:
            return
        player['wpm']      = int(data.get('wpm', 0))
        player['progress'] = float(data.get('progress', 0))
        player['accuracy'] = int(data.get('accuracy', 100))

        await broadcast(room_code, {
            'type':        'player_progress',
            'player_id':   player_id,
            'slot_index':  player['slot_index'],
            'wpm':         player['wpm'],
            'progress':    player['progress'],
            'accuracy':    player['accuracy'],
        }, exclude=player_id)

    # ── finish_race ─────────────────────────────────────────────────────────
    elif msg_type == 'finish_race':
        player = room['players'].get(player_id)
        if not player or player['finished']:
            return

        room['finished_count'] += 1
        player.update({
            'finished':    True,
            'finish_rank': room['finished_count'],
            'wpm':         int(data.get('wpm', 0)),
            'accuracy':    int(data.get('accuracy', 100)),
            'progress':    100,
            'finish_time': datetime.now(timezone.utc).isoformat(),
        })
        player['heatmap'] = normalize_heatmap(data, room)

        await broadcast_all(room_code, {
            'type':        'player_finished',
            'player_id':   player_id,
            'slot_index':  player['slot_index'],
            'finish_rank': player['finish_rank'],
            'wpm':         player['wpm'],
            'accuracy':    player['accuracy'],
        })
        await check_race_end(room_code)

    # ── timeout ─────────────────────────────────────────────────────────────
    elif msg_type == 'timeout':
        player = room['players'].get(player_id)
        if not player or player['finished']:
            return

        room['finished_count'] += 1
        player.update({
            'finished':    True,
            'timed_out':   True,
            'finish_rank': room['finished_count'],
            'wpm':         int(data.get('wpm', 0)),
        })
        player['heatmap'] = normalize_heatmap(data, room)

        await broadcast_all(room_code, {
            'type':       'player_timeout',
            'player_id':  player_id,
            'slot_index': player['slot_index'],
            'wpm':        player['wpm'],
        })
        await check_race_end(room_code)


async def check_race_end(room_code: str):
    room = active_rooms.get(room_code)
    if not room:
        return
    if all(p['finished'] for p in room['players'].values()):
        room['status'] = 'finished'
        await broadcast_all(room_code, {
            'type':    'race_ended',
            'players': list(room['players'].values()),
        })
        # Allow play-again: reset status to lobby so host can restart
        room['status'] = 'lobby'


async def handle_disconnect(room_code: str, player_id: str, websocket: WebSocket = None):
    # Check if a different (newer) socket connection already replaced this one
    current_ws = connections.get(room_code, {}).get(player_id)
    if websocket is not None and current_ws is not None and current_ws is not websocket:
        return

    room = active_rooms.get(room_code)
    if not room:
        return

    # Wait grace period (4 seconds) for transient disconnects or page reloads to reconnect
    await asyncio.sleep(4)

    # If the player reconnected during the grace period, preserve their session
    reconnected_ws = connections.get(room_code, {}).get(player_id)
    if reconnected_ws is not None and (websocket is None or reconnected_ws is not websocket):
        logger.info(f"Player {player_id} reconnected to room {room_code} within grace period")
        return

    room = active_rooms.get(room_code)
    if not room:
        return

    player = room['players'].pop(player_id, None)
    if not player:
        return

    logger.info(f"Player {player_id} disconnected from room {room_code}")

    await broadcast(room_code, {
        'type':       'player_left',
        'player_id':  player_id,
        'slot_index': player['slot_index'],
    })

    human_players = [p for p in room['players'].values() if not p.get('is_bot')]

    # If no human players remain, tear down the room
    if len(human_players) == 0:
        # Stop any running bot simulations
        for task in (room.pop('bot_tasks', None) or []):
            task.cancel()
        for ws in list(connections.get(room_code, {}).values()):
            try:
                await ws.close(code=1001, reason="Room closed - all human players left")
            except Exception:
                pass
        connections.pop(room_code, None)
        active_rooms.pop(room_code, None)
        logger.info(f"Room {room_code} closed (no human players left)")
    else:
        # If the host disconnected, promote the first remaining human player
        if player_id == room['host_id']:
            new_host = human_players[0]
            room['host_id'] = new_host['id']
            logger.info(f"Host transferred to {new_host['name']} ({new_host['id']}) in room {room_code}")
            await broadcast_all(room_code, {
                'type':      'new_host',
                'host_id':   new_host['id'],
                'host_name': new_host['name'],
            })

# ── Include router ────────────────────────────────────────────────────────────
app.include_router(api_router)

# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "ok", "rooms": len(active_rooms)}
