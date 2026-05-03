"""Iteration 2: Friends system + social quests with deadlines/relationships."""
import os, uuid, re, time
import pytest, requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://skill-tree-sim.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


def _mk_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _register(s, name="Runner"):
    email = f"test_{uuid.uuid4().hex[:10]}@nexus.com"
    r = s.post(f"{API}/auth/register", json={"email": email, "password": "pass1234", "character_name": name})
    assert r.status_code == 200, r.text
    d = r.json()
    return {"email": email, "token": d["token"], "user": d["user"], "headers": {"Authorization": f"Bearer {d['token']}", "Content-Type": "application/json"}}


@pytest.fixture(scope="module")
def session():
    return _mk_session()


@pytest.fixture(scope="module")
def alice(session):
    return _register(session, "Alice")


@pytest.fixture(scope="module")
def bob(session):
    return _register(session, "Bob")


# ---------- Friend code generation ----------
class TestFriendCode:
    def test_register_returns_6char_friend_code(self, alice):
        code = alice["user"].get("friend_code")
        assert code and len(code) == 6 and re.fullmatch(r"[A-Z0-9]{6}", code), f"bad code: {code!r}"

    def test_me_returns_friend_code(self, session, alice):
        r = session.get(f"{API}/auth/me", headers=alice["headers"])
        assert r.status_code == 200
        assert r.json().get("friend_code") == alice["user"]["friend_code"]

    def test_admin_has_friend_code(self, session):
        r = session.post(f"{API}/auth/login", json={"email": "admin@nexus.com", "password": "admin123"})
        assert r.status_code == 200
        assert r.json()["user"].get("friend_code")


# ---------- Friend Requests ----------
class TestFriendRequests:
    def test_reject_self_code(self, session, alice):
        r = session.post(f"{API}/friends/request", headers=alice["headers"], json={"code": alice["user"]["friend_code"]})
        assert r.status_code == 400

    def test_reject_unknown_code(self, session, alice):
        r = session.post(f"{API}/friends/request", headers=alice["headers"], json={"code": "ZZZZZZ"})
        assert r.status_code == 404

    def test_send_accept_flow_and_duplicate(self, session, alice, bob):
        # Alice sends to Bob
        r = session.post(f"{API}/friends/request", headers=alice["headers"], json={"code": bob["user"]["friend_code"]})
        assert r.status_code == 200, r.text
        req_id = r.json()["id"]

        # Duplicate while pending
        r = session.post(f"{API}/friends/request", headers=alice["headers"], json={"code": bob["user"]["friend_code"]})
        assert r.status_code == 400

        # Alice cannot accept her own outgoing request
        r = session.post(f"{API}/friends/requests/{req_id}/accept", headers=alice["headers"])
        assert r.status_code == 403

        # Bob sees incoming
        r = session.get(f"{API}/friends/requests", headers=bob["headers"])
        assert r.status_code == 200
        body = r.json()
        assert any(x["id"] == req_id for x in body.get("incoming", []))

        # Alice sees outgoing
        r = session.get(f"{API}/friends/requests", headers=alice["headers"])
        assert any(x["id"] == req_id for x in r.json().get("outgoing", []))

        # Bob accepts
        r = session.post(f"{API}/friends/requests/{req_id}/accept", headers=bob["headers"])
        assert r.status_code == 200

        # Duplicate after friendship
        r = session.post(f"{API}/friends/request", headers=alice["headers"], json={"code": bob["user"]["friend_code"]})
        assert r.status_code == 400

    def test_friends_list_has_relationship_50(self, session, alice, bob):
        r = session.get(f"{API}/friends", headers=alice["headers"])
        assert r.status_code == 200
        arr = r.json()
        f = next((x for x in arr if x["user_id"] == bob["user"]["id"]), None)
        assert f is not None
        assert f["relationship"] == 50
        assert f["overall_level"] >= 1
        assert "total_xp" in f


# ---------- Profile viewing ----------
class TestProfileView:
    def test_view_friend_profile(self, session, alice, bob):
        r = session.get(f"{API}/users/{bob['user']['id']}/profile", headers=alice["headers"])
        assert r.status_code == 200, r.text
        p = r.json()
        assert p["character_name"] == "Bob"
        assert p["friend_code"] == bob["user"]["friend_code"]
        for k in ["health", "hunger", "hygiene", "energy", "social", "mood"]:
            assert k in p["status_bars"]
        assert "skills" in p
        assert p["relationship"] == 50

    def test_view_stranger_profile_forbidden(self, session, alice):
        stranger = _register(_mk_session(), "Stranger")
        r = session.get(f"{API}/users/{stranger['user']['id']}/profile", headers=alice["headers"])
        assert r.status_code == 403


# ---------- Social Quests ----------
class TestSocialQuests:
    def test_assign_and_complete_flow(self, session, alice, bob):
        # Bob creates a skill so Alice can target it
        r = session.post(f"{API}/skills", headers=bob["headers"], json={"name": "Fitness", "color": "#00FF00"})
        assert r.status_code == 200
        skill_id = r.json()["id"]

        # Alice assigns to Bob with skill_id on Bob's skill
        r = session.post(f"{API}/friends/{bob['user']['id']}/quests", headers=alice["headers"], json={
            "title": "Run 5k", "description": "cyberpunk marathon", "xp_reward": 100,
            "to_user_id": bob["user"]["id"], "skill_id": skill_id,
            "deadline": None,
        })
        assert r.status_code == 200, r.text
        q = r.json()
        qid = q["id"]
        assert q["from_user_id"] == alice["user"]["id"]
        assert q["to_user_id"] == bob["user"]["id"]
        assert q["assignment_status"] == "pending"

        # Bob lists quests - sees it as incoming
        r = session.get(f"{API}/quests", headers=bob["headers"])
        incoming = [x for x in r.json() if x["id"] == qid]
        assert len(incoming) == 1
        assert incoming[0]["from_character_name"] == "Alice"

        # Alice lists quests - sees it as sent
        r = session.get(f"{API}/quests", headers=alice["headers"])
        sent = [x for x in r.json() if x["id"] == qid]
        assert len(sent) == 1
        assert sent[0]["to_character_name"] == "Bob"

        # Alice cannot accept (only recipient can)
        r = session.post(f"{API}/quests/{qid}/accept", headers=alice["headers"])
        assert r.status_code == 404

        # Bob accepts
        r = session.post(f"{API}/quests/{qid}/accept", headers=bob["headers"])
        assert r.status_code == 200
        assert r.json()["assignment_status"] == "accepted"

        # Bob completes -> +20 relationship (100//5=20), XP to Bob's skill
        r = session.post(f"{API}/quests/{qid}/complete", headers=bob["headers"])
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["quest"]["completed"] is True
        assert body["quest"]["assignment_status"] == "completed"
        assert body["skill"] is not None
        assert body["skill"]["total_xp"] == 100
        assert body["relationship"] == 70  # 50 + 20

        # Verify Bob's skill XP persisted
        r = session.get(f"{API}/skills", headers=bob["headers"])
        sk = next(s for s in r.json() if s["id"] == skill_id)
        assert sk["total_xp"] == 100

        # Alice's skills NOT affected
        r = session.get(f"{API}/skills", headers=alice["headers"])
        assert all(s["id"] != skill_id for s in r.json())

    def test_decline_drops_relationship(self, session, alice, bob):
        r = session.post(f"{API}/friends/{bob['user']['id']}/quests", headers=alice["headers"], json={
            "title": "Skip leg day", "xp_reward": 50,
            "to_user_id": bob["user"]["id"], "deadline": None,
        })
        assert r.status_code == 200
        qid = r.json()["id"]

        # Bob declines (50//5=10 drop). current rel=70 -> 60
        r = session.post(f"{API}/quests/{qid}/decline", headers=bob["headers"])
        assert r.status_code == 200
        body = r.json()
        assert body["quest"]["assignment_status"] == "declined"
        assert body["relationship"] == 60

    def test_assign_requires_friendship(self, session, alice):
        stranger = _register(_mk_session(), "Rando")
        r = session.post(f"{API}/friends/{stranger['user']['id']}/quests", headers=alice["headers"], json={
            "title": "x", "xp_reward": 10, "to_user_id": stranger["user"]["id"],
        })
        assert r.status_code == 403

    def test_skill_id_must_belong_to_recipient(self, session, alice, bob):
        # Alice creates her own skill
        r = session.post(f"{API}/skills", headers=alice["headers"], json={"name": "AliceSkill"})
        alice_skill = r.json()["id"]
        # Try to assign with Alice's skill to Bob -> 400
        r = session.post(f"{API}/friends/{bob['user']['id']}/quests", headers=alice["headers"], json={
            "title": "bad", "xp_reward": 10, "to_user_id": bob["user"]["id"], "skill_id": alice_skill,
        })
        assert r.status_code == 400

    def test_auto_expire_past_deadline(self, session, alice, bob):
        # Past deadline
        past = "2020-01-01T00:00:00+00:00"
        r = session.post(f"{API}/friends/{bob['user']['id']}/quests", headers=alice["headers"], json={
            "title": "Expired", "xp_reward": 25,
            "to_user_id": bob["user"]["id"], "deadline": past,
        })
        assert r.status_code == 200
        qid = r.json()["id"]

        # Get relationship before Bob's list call (which triggers auto-expire)
        r = session.get(f"{API}/friends", headers=alice["headers"])
        rel_before = next(x for x in r.json() if x["user_id"] == bob["user"]["id"])["relationship"]

        # Bob GET /quests triggers auto_expire (25//5=5 drop)
        r = session.get(f"{API}/quests", headers=bob["headers"])
        q = next(x for x in r.json() if x["id"] == qid)
        assert q["assignment_status"] == "expired"

        r = session.get(f"{API}/friends", headers=alice["headers"])
        rel_after = next(x for x in r.json() if x["user_id"] == bob["user"]["id"])["relationship"]
        assert rel_after == rel_before - 5


# ---------- Self quests still work ----------
class TestSelfQuestsStillWork:
    def test_self_quest_complete(self, session, alice):
        r = session.post(f"{API}/skills", headers=alice["headers"], json={"name": "Solo"})
        sid = r.json()["id"]
        r = session.post(f"{API}/quests", headers=alice["headers"], json={"title": "Self", "skill_id": sid, "xp_reward": 30})
        qid = r.json()["id"]
        assert r.json()["assignment_status"] == "self"
        r = session.post(f"{API}/quests/{qid}/complete", headers=alice["headers"])
        assert r.status_code == 200
        body = r.json()
        assert body["skill"]["total_xp"] == 30
        assert body["relationship"] is None


# ---------- Unfriend ----------
class TestUnfriend:
    def test_unfriend_removes(self, session, alice, bob):
        r = session.delete(f"{API}/friends/{bob['user']['id']}", headers=alice["headers"])
        assert r.status_code == 200
        r = session.get(f"{API}/friends", headers=alice["headers"])
        assert all(x["user_id"] != bob["user"]["id"] for x in r.json())
        # profile now 403
        r = session.get(f"{API}/users/{bob['user']['id']}/profile", headers=alice["headers"])
        assert r.status_code == 403
