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

from fastapi import FastAPI, APIRouter, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ── Logging (must be defined before anything uses it) ────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI()
api_router = APIRouter(prefix="/api")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Game Constants ────────────────────────────────────────────────────────────
MAX_PLAYERS = 4
IDEAL_WPM   = 60
TIME_FACTOR = 1.5

TEXTS = [
    "The city never sleeps. Beneath the flickering neon canopy, vendors hawk steaming bowls of ramen while drones weave between skyscrapers like silver fish through a glass sea.",
    "Rain has a way of erasing the boundaries between things. Puddles reflect neon signs in shattered fragments, making the wet street look like a mosaic of broken light.",
    "Typing is a skill that rewards patience above all else. The fingers that move fastest are rarely the ones that started fastest — they are the ones that built their speed slowly.",
    "Space is not empty. Between the visible stars, threads of gas and magnetic fields connect everything in a vast invisible web. Galaxies pull on each other across distances too great to comprehend.",
    "Networks are not built from cables alone. They are built from trust — the quiet agreement between machines that the data passing between them is worth protecting, routing, and delivering intact.",
    "Mountains teach humility in a way that nothing else can. They are indifferent to schedules, to ambitions, to the urgency that drives human beings through their daily lives.",
    "The archive was three floors underground, temperature-controlled to preserve paper older than any living institution. Every box held a fragment of a world that had believed itself permanent.",
]

PLAYER_COLORS = ['#f5c400', '#ff6a00', '#00eeff', '#00ff88']
PLAYER_EMOJIS = ['🏎️', '🚙', '🚕', '🚗']

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

# ── Models ────────────────────────────────────────────────────────────────────
class RoomCreate(BaseModel):
    player_name: str = "Anonymous"

class RoomJoin(BaseModel):
    room_code:   str
    player_name: str = "Anonymous"

# ── REST Endpoints ────────────────────────────────────────────────────────────
@api_router.post("/rooms/create")
async def create_room(data: RoomCreate):
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
        'text':           None,
        'time_limit':     0,
        'start_time':     None,
        'finished_count': 0,
        'created_at':     datetime.now(timezone.utc).isoformat(),
    }
    connections[room_code] = {}

    logger.info(f"Room {room_code} created by {data.player_name}")
    return {'room_code': room_code, 'player_id': player_id, 'player': host}


@api_router.post("/rooms/join")
async def join_room(data: RoomJoin):
    code = data.room_code.upper().strip()

    if code not in active_rooms:
        raise HTTPException(status_code=404, detail="Room not found. Check the code and try again.")

    room = active_rooms[code]

    if room['status'] != 'lobby':
        raise HTTPException(status_code=400, detail="Race already in progress.")

    if len(room['players']) >= MAX_PLAYERS:
        raise HTTPException(status_code=400, detail="Room is full (max 4 players).")

    player_id  = str(uuid.uuid4())
    slot_index = len(room['players'])
    player     = create_player(slot_index, data.player_name, player_id)

    room['players'][player_id] = player

    logger.info(f"Player {data.player_name} joined room {code}")
    return {
        'room_code': code,
        'player_id': player_id,
        'player':    player,
        'players':   list(room['players'].values()),
    }


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

    if player_id not in room['players']:
        await websocket.close(code=1008, reason="Player not in room")
        return

    await websocket.accept()
    connections.setdefault(room_code, {})[player_id] = websocket
    logger.info(f"WS connected: player {player_id} in room {room_code}")

    # Send current room snapshot
    await websocket.send_json({
        'type':    'room_state',
        'players': list(room['players'].values()),
        'status':  room['status'],
    })

    # Notify others
    await broadcast(room_code, {
        'type':   'player_joined',
        'player': room['players'][player_id],
    }, exclude=player_id)

    try:
        while True:
            raw  = await websocket.receive_text()
            data = json.loads(raw)
            await handle_message(room_code, player_id, data)
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"WS error for {player_id}: {e}")
    finally:
        await handle_disconnect(room_code, player_id)


async def handle_message(room_code: str, player_id: str, data: dict):
    room = active_rooms.get(room_code)
    if not room:
        return

    msg_type = data.get('type')

    # ── start_race ──────────────────────────────────────────────────────────
    if msg_type == 'start_race':
        if player_id != room['host_id']:
            return
        if len(room['players']) < 2:
            ws = connections.get(room_code, {}).get(player_id)
            if ws:
                await ws.send_json({'type': 'error', 'msg': 'Need at least 2 players to start.'})
            return

        text       = random.choice(TEXTS)
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

        await broadcast_all(room_code, {
            'type':       'race_started',
            'text':       text,
            'time_limit': time_limit,
            'players':    list(room['players'].values()),
        })

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


async def handle_disconnect(room_code: str, player_id: str):
    connections.get(room_code, {}).pop(player_id, None)

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

    # If host left or room is empty, tear it down
    if player_id == room['host_id'] or len(room['players']) == 0:
        for ws in list(connections.get(room_code, {}).values()):
            try:
                await ws.close(code=1001, reason="Host left / room closed")
            except Exception:
                pass
        connections.pop(room_code, None)
        active_rooms.pop(room_code, None)
        logger.info(f"Room {room_code} closed")
    else:
        # If the host left, promote the next player
        if player_id == room['host_id']:
            new_host = next(iter(room['players']))
            room['host_id'] = new_host

# ── Include router ────────────────────────────────────────────────────────────
app.include_router(api_router)

# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "ok", "rooms": len(active_rooms)}
