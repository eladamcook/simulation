from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict

import bcrypt
import jwt
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field


# ---------------- DB Setup ----------------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 7

app = FastAPI(title="LIFETRACK_OS API")
api_router = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# ---------------- Helpers ----------------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def default_status_bars() -> Dict[str, int]:
    return {"health": 80, "hunger": 60, "hygiene": 70, "energy": 75, "social": 50, "mood": 70}


def xp_required_for_level(level: int) -> int:
    # Cyberpunk progression: 100, 250, 450, 700... (giant levels need lots of XP)
    return 100 + (level - 1) * 150


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def get_current_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> dict:
    if not creds or not creds.credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = creds.credentials
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Invalid token type")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# ---------------- Models ----------------
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    character_name: str = Field(min_length=1, max_length=32, default="Runner")


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    token: str
    user: dict


class CharacterNameUpdate(BaseModel):
    character_name: str = Field(min_length=1, max_length=32)


class StatusUpdate(BaseModel):
    bar: str  # health|hunger|hygiene|energy|social|mood
    delta: int  # +/- value


class StatusSet(BaseModel):
    bar: str
    value: int


class SkillCreate(BaseModel):
    name: str = Field(min_length=1, max_length=40)
    description: Optional[str] = ""
    color: Optional[str] = "#00F0FF"


class SkillUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None


class XPGain(BaseModel):
    amount: int


class QuestCreate(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    description: Optional[str] = ""
    skill_id: Optional[str] = None
    xp_reward: int = Field(ge=1, le=10000, default=50)


class QuestUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    skill_id: Optional[str] = None
    xp_reward: Optional[int] = None


# ---------------- Auth Routes ----------------
@api_router.post("/auth/register", response_model=AuthResponse)
async def register(payload: RegisterRequest):
    email = payload.email.lower().strip()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": email,
        "password_hash": hash_password(payload.password),
        "character_name": payload.character_name.strip(),
        "status_bars": default_status_bars(),
        "created_at": now_iso(),
    }
    await db.users.insert_one(user_doc)
    token = create_access_token(user_id, email)
    user_doc.pop("_id", None)
    user_doc.pop("password_hash", None)
    return {"token": token, "user": user_doc}


@api_router.post("/auth/login", response_model=AuthResponse)
async def login(payload: LoginRequest):
    email = payload.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(user["id"], email)
    user.pop("_id", None)
    user.pop("password_hash", None)
    return {"token": token, "user": user}


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user


# ---------------- Character Routes ----------------
@api_router.get("/character")
async def get_character(user: dict = Depends(get_current_user)):
    skills = await db.skills.find({"user_id": user["id"]}, {"_id": 0}).to_list(1000)
    total_xp = sum(s.get("total_xp", 0) for s in skills)
    # Overall level: every 500 XP
    overall_level = 1 + total_xp // 500
    return {
        "character_name": user.get("character_name", "Runner"),
        "status_bars": user.get("status_bars", default_status_bars()),
        "overall_level": overall_level,
        "total_xp": total_xp,
        "next_level_xp": ((overall_level) * 500),
        "email": user.get("email"),
    }


@api_router.put("/character/name")
async def update_character_name(payload: CharacterNameUpdate, user: dict = Depends(get_current_user)):
    name = payload.character_name.strip()
    await db.users.update_one({"id": user["id"]}, {"$set": {"character_name": name}})
    return {"character_name": name}


VALID_BARS = {"health", "hunger", "hygiene", "energy", "social", "mood"}


@api_router.post("/character/status/adjust")
async def adjust_status(payload: StatusUpdate, user: dict = Depends(get_current_user)):
    if payload.bar not in VALID_BARS:
        raise HTTPException(status_code=400, detail="Invalid status bar")
    bars = user.get("status_bars", default_status_bars())
    new_val = max(0, min(100, bars.get(payload.bar, 50) + payload.delta))
    bars[payload.bar] = new_val
    await db.users.update_one({"id": user["id"]}, {"$set": {"status_bars": bars}})
    return {"status_bars": bars}


@api_router.post("/character/status/set")
async def set_status(payload: StatusSet, user: dict = Depends(get_current_user)):
    if payload.bar not in VALID_BARS:
        raise HTTPException(status_code=400, detail="Invalid status bar")
    val = max(0, min(100, payload.value))
    bars = user.get("status_bars", default_status_bars())
    bars[payload.bar] = val
    await db.users.update_one({"id": user["id"]}, {"$set": {"status_bars": bars}})
    return {"status_bars": bars}


# ---------------- Skills Routes ----------------
def compute_skill_level(total_xp: int) -> dict:
    level = 1
    remaining = total_xp
    while remaining >= xp_required_for_level(level):
        remaining -= xp_required_for_level(level)
        level += 1
    return {
        "level": level,
        "current_xp": remaining,
        "next_level_xp": xp_required_for_level(level),
    }


def serialize_skill(s: dict) -> dict:
    info = compute_skill_level(s.get("total_xp", 0))
    return {
        "id": s["id"],
        "name": s["name"],
        "description": s.get("description", ""),
        "color": s.get("color", "#00F0FF"),
        "total_xp": s.get("total_xp", 0),
        **info,
    }


@api_router.get("/skills")
async def list_skills(user: dict = Depends(get_current_user)):
    skills = await db.skills.find({"user_id": user["id"]}, {"_id": 0}).to_list(1000)
    skills.sort(key=lambda x: x.get("created_at", ""))
    return [serialize_skill(s) for s in skills]


@api_router.post("/skills")
async def create_skill(payload: SkillCreate, user: dict = Depends(get_current_user)):
    skill_id = str(uuid.uuid4())
    doc = {
        "id": skill_id,
        "user_id": user["id"],
        "name": payload.name.strip(),
        "description": (payload.description or "").strip(),
        "color": payload.color or "#00F0FF",
        "total_xp": 0,
        "created_at": now_iso(),
    }
    await db.skills.insert_one(doc)
    doc.pop("_id", None)
    return serialize_skill(doc)


@api_router.put("/skills/{skill_id}")
async def update_skill(skill_id: str, payload: SkillUpdate, user: dict = Depends(get_current_user)):
    skill = await db.skills.find_one({"id": skill_id, "user_id": user["id"]}, {"_id": 0})
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")
    update = {k: v for k, v in payload.model_dump(exclude_none=True).items()}
    if update:
        await db.skills.update_one({"id": skill_id}, {"$set": update})
    skill = await db.skills.find_one({"id": skill_id}, {"_id": 0})
    return serialize_skill(skill)


@api_router.delete("/skills/{skill_id}")
async def delete_skill(skill_id: str, user: dict = Depends(get_current_user)):
    res = await db.skills.delete_one({"id": skill_id, "user_id": user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Skill not found")
    # Unlink quests pointing to this skill
    await db.quests.update_many({"user_id": user["id"], "skill_id": skill_id}, {"$set": {"skill_id": None}})
    return {"deleted": True}


@api_router.post("/skills/{skill_id}/xp")
async def add_xp(skill_id: str, payload: XPGain, user: dict = Depends(get_current_user)):
    skill = await db.skills.find_one({"id": skill_id, "user_id": user["id"]}, {"_id": 0})
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")
    new_total = max(0, skill.get("total_xp", 0) + payload.amount)
    await db.skills.update_one({"id": skill_id}, {"$set": {"total_xp": new_total}})
    skill["total_xp"] = new_total
    return serialize_skill(skill)


# ---------------- Quests Routes ----------------
def serialize_quest(q: dict) -> dict:
    return {
        "id": q["id"],
        "title": q["title"],
        "description": q.get("description", ""),
        "skill_id": q.get("skill_id"),
        "xp_reward": q.get("xp_reward", 50),
        "completed": q.get("completed", False),
        "completed_at": q.get("completed_at"),
        "created_at": q.get("created_at"),
    }


@api_router.get("/quests")
async def list_quests(user: dict = Depends(get_current_user)):
    quests = await db.quests.find({"user_id": user["id"]}, {"_id": 0}).to_list(1000)
    quests.sort(key=lambda q: (q.get("completed", False), q.get("created_at", "")))
    return [serialize_quest(q) for q in quests]


@api_router.post("/quests")
async def create_quest(payload: QuestCreate, user: dict = Depends(get_current_user)):
    if payload.skill_id:
        skill = await db.skills.find_one({"id": payload.skill_id, "user_id": user["id"]})
        if not skill:
            raise HTTPException(status_code=400, detail="Skill not found")
    quest_id = str(uuid.uuid4())
    doc = {
        "id": quest_id,
        "user_id": user["id"],
        "title": payload.title.strip(),
        "description": (payload.description or "").strip(),
        "skill_id": payload.skill_id,
        "xp_reward": payload.xp_reward,
        "completed": False,
        "completed_at": None,
        "created_at": now_iso(),
    }
    await db.quests.insert_one(doc)
    doc.pop("_id", None)
    return serialize_quest(doc)


@api_router.put("/quests/{quest_id}")
async def update_quest(quest_id: str, payload: QuestUpdate, user: dict = Depends(get_current_user)):
    quest = await db.quests.find_one({"id": quest_id, "user_id": user["id"]}, {"_id": 0})
    if not quest:
        raise HTTPException(status_code=404, detail="Quest not found")
    update = {k: v for k, v in payload.model_dump(exclude_none=True).items()}
    if update:
        await db.quests.update_one({"id": quest_id}, {"$set": update})
    quest = await db.quests.find_one({"id": quest_id}, {"_id": 0})
    return serialize_quest(quest)


@api_router.delete("/quests/{quest_id}")
async def delete_quest(quest_id: str, user: dict = Depends(get_current_user)):
    res = await db.quests.delete_one({"id": quest_id, "user_id": user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Quest not found")
    return {"deleted": True}


@api_router.post("/quests/{quest_id}/complete")
async def complete_quest(quest_id: str, user: dict = Depends(get_current_user)):
    quest = await db.quests.find_one({"id": quest_id, "user_id": user["id"]}, {"_id": 0})
    if not quest:
        raise HTTPException(status_code=404, detail="Quest not found")
    if quest.get("completed"):
        raise HTTPException(status_code=400, detail="Quest already completed")
    await db.quests.update_one(
        {"id": quest_id},
        {"$set": {"completed": True, "completed_at": now_iso()}},
    )
    awarded_skill = None
    if quest.get("skill_id"):
        skill = await db.skills.find_one({"id": quest["skill_id"], "user_id": user["id"]}, {"_id": 0})
        if skill:
            new_total = skill.get("total_xp", 0) + quest.get("xp_reward", 0)
            await db.skills.update_one({"id": skill["id"]}, {"$set": {"total_xp": new_total}})
            skill["total_xp"] = new_total
            awarded_skill = serialize_skill(skill)
    quest = await db.quests.find_one({"id": quest_id}, {"_id": 0})
    return {"quest": serialize_quest(quest), "skill": awarded_skill}


@api_router.post("/quests/{quest_id}/uncomplete")
async def uncomplete_quest(quest_id: str, user: dict = Depends(get_current_user)):
    quest = await db.quests.find_one({"id": quest_id, "user_id": user["id"]}, {"_id": 0})
    if not quest:
        raise HTTPException(status_code=404, detail="Quest not found")
    if not quest.get("completed"):
        raise HTTPException(status_code=400, detail="Quest not completed")
    await db.quests.update_one(
        {"id": quest_id},
        {"$set": {"completed": False, "completed_at": None}},
    )
    # Roll back XP if a skill was attached
    if quest.get("skill_id"):
        skill = await db.skills.find_one({"id": quest["skill_id"], "user_id": user["id"]}, {"_id": 0})
        if skill:
            new_total = max(0, skill.get("total_xp", 0) - quest.get("xp_reward", 0))
            await db.skills.update_one({"id": skill["id"]}, {"$set": {"total_xp": new_total}})
    quest = await db.quests.find_one({"id": quest_id}, {"_id": 0})
    return serialize_quest(quest)


# ---------------- Health ----------------
@api_router.get("/")
async def root():
    return {"status": "online", "service": "LIFETRACK_OS"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.skills.create_index("user_id")
    await db.quests.create_index("user_id")
    # Seed admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@nexus.com").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "character_name": "ADMIN_OS",
            "status_bars": default_status_bars(),
            "created_at": now_iso(),
        })


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
