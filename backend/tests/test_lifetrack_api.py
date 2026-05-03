"""Backend tests for LIFETRACK_OS API (auth, character, skills, quests)."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://skill-tree-sim.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def user_ctx(session):
    email = f"test_{uuid.uuid4().hex[:8]}@nexus.com"
    r = session.post(f"{API}/auth/register", json={"email": email, "password": "pass1234", "character_name": "Runner"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert "token" in data and "user" in data
    assert data["user"]["email"] == email
    return {"email": email, "token": data["token"], "user": data["user"]}


@pytest.fixture(scope="module")
def auth_headers(user_ctx):
    return {"Authorization": f"Bearer {user_ctx['token']}", "Content-Type": "application/json"}


# ---------- Health ----------
def test_health(session):
    r = session.get(f"{API}/")
    assert r.status_code == 200
    assert r.json().get("status") == "online"


# ---------- Auth ----------
def test_login_existing_admin(session):
    r = session.post(f"{API}/auth/login", json={"email": "admin@nexus.com", "password": "admin123"})
    assert r.status_code == 200, r.text
    assert "token" in r.json()


def test_login_invalid(session):
    r = session.post(f"{API}/auth/login", json={"email": "admin@nexus.com", "password": "wrong"})
    assert r.status_code == 401


def test_me_requires_auth(session):
    r = session.get(f"{API}/auth/me")
    assert r.status_code in (401, 403)


def test_me_with_token(session, auth_headers, user_ctx):
    r = session.get(f"{API}/auth/me", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["email"] == user_ctx["email"]


def test_register_duplicate(session, user_ctx):
    r = session.post(f"{API}/auth/register", json={"email": user_ctx["email"], "password": "pass1234"})
    assert r.status_code == 400


# ---------- Character ----------
def test_get_character(session, auth_headers):
    r = session.get(f"{API}/character", headers=auth_headers)
    assert r.status_code == 200
    d = r.json()
    assert "character_name" in d
    bars = d["status_bars"]
    for k in ["health", "hunger", "hygiene", "energy", "social", "mood"]:
        assert k in bars
    assert d["overall_level"] >= 1
    assert "total_xp" in d and "next_level_xp" in d


def test_update_character_name(session, auth_headers):
    r = session.put(f"{API}/character/name", headers=auth_headers, json={"character_name": "NeoTester"})
    assert r.status_code == 200
    assert r.json()["character_name"] == "NeoTester"
    r2 = session.get(f"{API}/character", headers=auth_headers)
    assert r2.json()["character_name"] == "NeoTester"


def test_status_adjust_and_clamp(session, auth_headers):
    r = session.post(f"{API}/character/status/adjust", headers=auth_headers, json={"bar": "health", "delta": -5})
    assert r.status_code == 200
    v1 = r.json()["status_bars"]["health"]
    # Force clamp to 0
    r = session.post(f"{API}/character/status/adjust", headers=auth_headers, json={"bar": "health", "delta": -9999})
    assert r.json()["status_bars"]["health"] == 0
    # Force clamp to 100
    r = session.post(f"{API}/character/status/adjust", headers=auth_headers, json={"bar": "health", "delta": 9999})
    assert r.json()["status_bars"]["health"] == 100
    assert isinstance(v1, int)


def test_status_set_and_invalid(session, auth_headers):
    r = session.post(f"{API}/character/status/set", headers=auth_headers, json={"bar": "mood", "value": 42})
    assert r.status_code == 200
    assert r.json()["status_bars"]["mood"] == 42
    r = session.post(f"{API}/character/status/set", headers=auth_headers, json={"bar": "luck", "value": 50})
    assert r.status_code == 400


# ---------- Skills ----------
def test_skills_crud_and_xp(session, auth_headers):
    # Create
    r = session.post(f"{API}/skills", headers=auth_headers, json={"name": "Hacking", "description": "cyber", "color": "#FF00FF"})
    assert r.status_code == 200
    skill = r.json()
    sid = skill["id"]
    assert skill["level"] == 1 and skill["current_xp"] == 0
    assert skill["next_level_xp"] == 100  # level 1 requires 100

    # List
    r = session.get(f"{API}/skills", headers=auth_headers)
    assert r.status_code == 200
    assert any(s["id"] == sid for s in r.json())

    # Add 100 XP => level 2, current_xp 0, next requires 250
    r = session.post(f"{API}/skills/{sid}/xp", headers=auth_headers, json={"amount": 100})
    assert r.status_code == 200
    d = r.json()
    assert d["level"] == 2, d
    assert d["current_xp"] == 0
    assert d["next_level_xp"] == 250

    # Add 250 more => level 3
    r = session.post(f"{API}/skills/{sid}/xp", headers=auth_headers, json={"amount": 250})
    d = r.json()
    assert d["level"] == 3

    # Update
    r = session.put(f"{API}/skills/{sid}", headers=auth_headers, json={"name": "CyberHack"})
    assert r.status_code == 200
    assert r.json()["name"] == "CyberHack"

    # Delete
    r = session.delete(f"{API}/skills/{sid}", headers=auth_headers)
    assert r.status_code == 200
    r = session.put(f"{API}/skills/{sid}", headers=auth_headers, json={"name": "x"})
    assert r.status_code == 404


# ---------- Quests ----------
def test_quests_full_flow(session, auth_headers):
    # Create a skill for assignment
    rs = session.post(f"{API}/skills", headers=auth_headers, json={"name": "Parkour"})
    sid = rs.json()["id"]
    xp0 = rs.json()["total_xp"]

    # Create quest assigned to skill
    r = session.post(f"{API}/quests", headers=auth_headers, json={"title": "Rooftop run", "skill_id": sid, "xp_reward": 75})
    assert r.status_code == 200
    qid = r.json()["id"]
    assert r.json()["completed"] is False

    # List
    r = session.get(f"{API}/quests", headers=auth_headers)
    assert any(q["id"] == qid for q in r.json())

    # Update
    r = session.put(f"{API}/quests/{qid}", headers=auth_headers, json={"xp_reward": 120})
    assert r.status_code == 200 and r.json()["xp_reward"] == 120

    # Complete -> awards XP
    r = session.post(f"{API}/quests/{qid}/complete", headers=auth_headers)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["quest"]["completed"] is True
    assert body["skill"] is not None
    assert body["skill"]["total_xp"] == xp0 + 120

    # Double complete -> 400
    r = session.post(f"{API}/quests/{qid}/complete", headers=auth_headers)
    assert r.status_code == 400

    # Uncomplete -> rollback
    r = session.post(f"{API}/quests/{qid}/uncomplete", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["completed"] is False
    rs2 = session.get(f"{API}/skills", headers=auth_headers)
    sk = next(s for s in rs2.json() if s["id"] == sid)
    assert sk["total_xp"] == xp0

    # Create quest with invalid skill
    r = session.post(f"{API}/quests", headers=auth_headers, json={"title": "bad", "skill_id": "nope"})
    assert r.status_code == 400

    # Delete
    r = session.delete(f"{API}/quests/{qid}", headers=auth_headers)
    assert r.status_code == 200
    session.delete(f"{API}/skills/{sid}", headers=auth_headers)


def test_protected_routes_without_token(session):
    for path in ["/character", "/skills", "/quests"]:
        r = session.get(f"{API}{path}")
        assert r.status_code in (401, 403), f"{path} -> {r.status_code}"
