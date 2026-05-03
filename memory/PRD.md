# LIFETRACK_OS — Product Requirements

## Overview
Cyberpunk-themed gamified life-tracking Expo (React Native) mobile app with **user-to-user social layer**. Players create a character, track 6 vital stats, build custom skill trees, complete user-authored quests, **connect with other players via 6-char friend codes, build relationship bars, and assign quests to each other** that affect both XP and relationships.

## Core Features
### Solo
- **Auth**: JWT email/password; AsyncStorage Bearer token.
- **Character**: Renamable, HUD avatar, overall level, 6 status bars (Health/Hunger/Hygiene/Energy/Social/Mood) with -10/-5/+5/+10 controls clamped 0–100.
- **Skill Trees (branching)**: Fully custom skills with **unlimited-depth sub-skills** and **cascading XP**. Each skill has its own `own_xp` (from quests/manual) and a computed `total_xp` = own_xp + Σ(descendants' total_xp). Each skill levels independently from its total_xp (LV1→2 = 100 XP, +150 per level — giant levels). Add Sub-skill via `SUB` button. Cycle protection on parent reassignment. Cascade-delete on removal.
- **Quests**: Create personal quests with XP rewards. Skill picker includes **all skills (root + nested)**. Completing a skill-linked quest auto-awards XP to that exact skill — cascading bumps every ancestor.

### Social (NEW)
- **Friend Codes**: Every user gets a unique 6-char code (A-Z, 0-9) auto-generated on register.
- **Friend Requests**: Send by code → recipient accepts or declines.
- **Relationship Bar**: 0–100, starts at 50 on accept. Visualized per-friend (green ≥70, yellow ≥35, red <35).
- **View Profiles**: Tap a friend → see everything: character name, level, all 6 status bars, full skill tree, current relationship.
- **Assign Quests**: Send a quest to a friend with title, description, XP reward, optional target skill (from THEIR skill tree), optional deadline (days).
- **Quest Lifecycle**:
  - `pending` → recipient can ACCEPT or DECLINE
  - `accepted` → recipient can MARK COMPLETE or GIVE UP
  - `completed` → relationship +max(1, xp//5) AND XP awarded to recipient's skill
  - `declined` / `expired` → relationship -max(1, xp//5)
  - Deadlines auto-expire on next quests fetch.
- **Quests Tab Filter**: MINE / FROM FRIENDS / SENT.

## Backend Stack
FastAPI + MongoDB (motor) + bcrypt + PyJWT. Collections: `users`, `skills`, `quests`, `friendships`. All routes prefixed `/api`.

## Frontend Stack
Expo Router (file-based), React Native, axios, AsyncStorage, @expo/vector-icons. 5 bottom tabs: Character / Skills / Quests / Friends / Profile. Modal stack: `/friend/[id]` for profile views.

## Smart Business Hook
The relationship bar transforms LIFETRACK_OS into a **viral social accountability platform** — friends pressuring each other to follow through on real-world goals. Future monetization: premium quest pack IAPs, group challenges (3+ friends compete), public leaderboards by relationship score, push notifications for incoming quests/expiring deadlines (drives D1/D7 retention via social loop).

## Files
- Backend: `/app/backend/server.py`, `/app/backend/.env`
- Frontend: `/app/frontend/app/(tabs)/{character,skills,quests,friends,profile}.tsx`, `/app/frontend/app/friend/[id].tsx`, `/app/frontend/lib/{api.ts,auth.tsx,theme.ts}`
