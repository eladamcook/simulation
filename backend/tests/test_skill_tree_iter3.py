"""
Iteration 3 — Skill tree sub-skills with cascading XP.
Tests:
  - create sub-skill with parent_id; invalid parent returns 400
  - GET /skills returns new fields (parent_id, own_xp, total_xp, depth, has_children, level, current_xp, next_level_xp)
  - cascading XP: adding to child updates ancestors' total_xp
  - 3-level deep cascade
  - PUT /skills/{id} with parent_id (change parent), cycle-protection (self + descendant), invalid parent
  - DELETE cascades descendants; response shape; quests pointing to deleted skills get skill_id=null
  - character total_xp = sum of own_xp (no double counting)
  - profile returns same tree shape
  - quest pointed to sub-skill complete awards XP & cascades
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def user_token():
    email = f"TEST_iter3_{uuid.uuid4().hex[:8]}@nexus.com"
    r = requests.post(f"{API}/auth/register", json={
        "email": email, "password": "password123", "character_name": "TreeTester"
    })
    assert r.status_code == 200, r.text
    data = r.json()
    return {"token": data["token"], "user_id": data["user"]["id"], "email": email}


@pytest.fixture
def H(user_token):
    return {"Authorization": f"Bearer {user_token['token']}"}


def _clear_skills(H):
    r = requests.get(f"{API}/skills", headers=H)
    for s in r.json():
        requests.delete(f"{API}/skills/{s['id']}", headers=H)


# ---- 1. create root + sub-skill ----
def test_create_root_and_sub(H):
    _clear_skills(H)
    r = requests.post(f"{API}/skills", json={"name": "Guitar"}, headers=H)
    assert r.status_code == 200, r.text
    guitar = r.json()
    assert guitar["parent_id"] is None
    assert guitar["depth"] == 0
    assert guitar["own_xp"] == 0 and guitar["total_xp"] == 0
    assert guitar["has_children"] is False

    r = requests.post(f"{API}/skills", json={"name": "Bar Chords", "parent_id": guitar["id"]}, headers=H)
    assert r.status_code == 200, r.text
    bar = r.json()
    assert bar["parent_id"] == guitar["id"]
    assert bar["depth"] == 1

    # Parent should now show has_children=True
    r = requests.get(f"{API}/skills", headers=H)
    skills = r.json()
    g = next(s for s in skills if s["id"] == guitar["id"])
    assert g["has_children"] is True
    # All new fields present
    for k in ("parent_id", "own_xp", "total_xp", "depth", "has_children", "level", "current_xp", "next_level_xp"):
        assert k in g


def test_invalid_parent_returns_400(H):
    r = requests.post(f"{API}/skills", json={"name": "Bad", "parent_id": "nonexistent-id"}, headers=H)
    assert r.status_code == 400


# ---- 2. cascading XP (2 levels) ----
def test_cascading_xp_two_levels(H):
    _clear_skills(H)
    g = requests.post(f"{API}/skills", json={"name": "Guitar"}, headers=H).json()
    b = requests.post(f"{API}/skills", json={"name": "Bar Chords", "parent_id": g["id"]}, headers=H).json()
    r = requests.post(f"{API}/skills/{b['id']}/xp", json={"amount": 120}, headers=H)
    assert r.status_code == 200
    skills = {s["id"]: s for s in requests.get(f"{API}/skills", headers=H).json()}
    assert skills[b["id"]]["own_xp"] == 120
    assert skills[b["id"]]["total_xp"] == 120
    assert skills[b["id"]]["level"] == 2
    assert skills[g["id"]]["own_xp"] == 0
    assert skills[g["id"]]["total_xp"] == 120
    assert skills[g["id"]]["level"] == 2


# ---- 3. three-level cascade ----
def test_cascading_three_levels(H):
    _clear_skills(H)
    g = requests.post(f"{API}/skills", json={"name": "Guitar"}, headers=H).json()
    b = requests.post(f"{API}/skills", json={"name": "Bar Chords", "parent_id": g["id"]}, headers=H).json()
    p = requests.post(f"{API}/skills", json={"name": "Power F", "parent_id": b["id"]}, headers=H).json()
    assert p["depth"] == 2
    requests.post(f"{API}/skills/{p['id']}/xp", json={"amount": 50}, headers=H)
    skills = {s["id"]: s for s in requests.get(f"{API}/skills", headers=H).json()}
    assert skills[p["id"]]["total_xp"] == 50
    assert skills[b["id"]]["total_xp"] == 50
    assert skills[g["id"]]["total_xp"] == 50
    assert skills[p["id"]]["own_xp"] == 50
    assert skills[b["id"]]["own_xp"] == 0
    assert skills[g["id"]]["own_xp"] == 0


# ---- 4. PUT change parent ----
def test_put_change_parent(H):
    _clear_skills(H)
    a = requests.post(f"{API}/skills", json={"name": "A"}, headers=H).json()
    b = requests.post(f"{API}/skills", json={"name": "B"}, headers=H).json()
    c = requests.post(f"{API}/skills", json={"name": "C", "parent_id": a["id"]}, headers=H).json()
    r = requests.put(f"{API}/skills/{c['id']}", json={"parent_id": b["id"]}, headers=H)
    assert r.status_code == 200
    assert r.json()["parent_id"] == b["id"]


# ---- 5. cycle protection ----
def test_put_cycle_self(H):
    _clear_skills(H)
    a = requests.post(f"{API}/skills", json={"name": "A"}, headers=H).json()
    r = requests.put(f"{API}/skills/{a['id']}", json={"parent_id": a["id"]}, headers=H)
    assert r.status_code == 400
    assert "cycle" in r.json().get("detail", "").lower()


def test_put_cycle_descendant(H):
    _clear_skills(H)
    a = requests.post(f"{API}/skills", json={"name": "A"}, headers=H).json()
    b = requests.post(f"{API}/skills", json={"name": "B", "parent_id": a["id"]}, headers=H).json()
    # Attempt to set A's parent to B (B is A's descendant) -> cycle
    r = requests.put(f"{API}/skills/{a['id']}", json={"parent_id": b["id"]}, headers=H)
    assert r.status_code == 400
    assert "cycle" in r.json().get("detail", "").lower()


# ---- 6. DELETE cascades ----
def test_delete_cascades(H):
    _clear_skills(H)
    a = requests.post(f"{API}/skills", json={"name": "A"}, headers=H).json()
    b = requests.post(f"{API}/skills", json={"name": "B", "parent_id": a["id"]}, headers=H).json()
    c = requests.post(f"{API}/skills", json={"name": "C", "parent_id": b["id"]}, headers=H).json()
    r = requests.delete(f"{API}/skills/{a['id']}", headers=H)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["deleted"] is True
    assert body["removed_count"] == 3
    assert set(body["removed_ids"]) == {a["id"], b["id"], c["id"]}
    # All gone
    skills = requests.get(f"{API}/skills", headers=H).json()
    assert not any(s["id"] in body["removed_ids"] for s in skills)


# ---- 7. delete also nullifies quest.skill_id ----
def test_delete_nullifies_quest_skill_id(H):
    _clear_skills(H)
    # Clean quests
    for q in requests.get(f"{API}/quests", headers=H).json():
        requests.delete(f"{API}/quests/{q['id']}", headers=H)
    a = requests.post(f"{API}/skills", json={"name": "A"}, headers=H).json()
    b = requests.post(f"{API}/skills", json={"name": "B", "parent_id": a["id"]}, headers=H).json()
    quest = requests.post(f"{API}/quests", json={"title": "Practice B", "skill_id": b["id"], "xp_reward": 25}, headers=H).json()
    assert quest["skill_id"] == b["id"]
    requests.delete(f"{API}/skills/{a['id']}", headers=H)
    q2 = next(q for q in requests.get(f"{API}/quests", headers=H).json() if q["id"] == quest["id"])
    assert q2["skill_id"] is None


# ---- 8. character total_xp = sum of own_xp (no double count via cascading) ----
def test_character_total_no_double_count(H):
    _clear_skills(H)
    a = requests.post(f"{API}/skills", json={"name": "A"}, headers=H).json()
    b = requests.post(f"{API}/skills", json={"name": "B", "parent_id": a["id"]}, headers=H).json()
    requests.post(f"{API}/skills/{a['id']}/xp", json={"amount": 30}, headers=H)
    requests.post(f"{API}/skills/{b['id']}/xp", json={"amount": 70}, headers=H)
    ch = requests.get(f"{API}/character", headers=H).json()
    # Sum of own_xp = 30 + 70 = 100
    assert ch["total_xp"] == 100


# ---- 9. profile returns tree-shaped skills ----
def test_profile_tree_shape(H, user_token):
    skills = requests.get(f"{API}/users/{user_token['user_id']}/profile", headers=H).json()["skills"]
    if skills:
        s = skills[0]
        for k in ("parent_id", "own_xp", "total_xp", "depth", "has_children", "level"):
            assert k in s


# ---- 10. completing quest on sub-skill awards XP & cascades ----
def test_quest_complete_cascades_to_ancestors(H):
    _clear_skills(H)
    for q in requests.get(f"{API}/quests", headers=H).json():
        requests.delete(f"{API}/quests/{q['id']}", headers=H)
    g = requests.post(f"{API}/skills", json={"name": "Guitar"}, headers=H).json()
    b = requests.post(f"{API}/skills", json={"name": "Bar Chords", "parent_id": g["id"]}, headers=H).json()
    quest = requests.post(f"{API}/quests", json={"title": "Practice bars", "skill_id": b["id"], "xp_reward": 80}, headers=H).json()
    r = requests.post(f"{API}/quests/{quest['id']}/complete", headers=H)
    assert r.status_code == 200, r.text
    skills = {s["id"]: s for s in requests.get(f"{API}/skills", headers=H).json()}
    assert skills[b["id"]]["own_xp"] == 80, f"Sub-skill should have 80 own_xp, got {skills[b['id']]['own_xp']}"
    assert skills[b["id"]]["total_xp"] == 80
    assert skills[g["id"]]["total_xp"] == 80, f"Parent total_xp should cascade to 80, got {skills[g['id']]['total_xp']}"
    assert skills[g["id"]]["own_xp"] == 0
