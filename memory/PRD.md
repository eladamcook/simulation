# LIFETRACK_OS — Product Requirements

## Overview
A cyberpunk-themed gamified life-tracking Expo (React Native) mobile app. Users create a character, track 6 customizable vital stats, build a fully custom skill tree, and complete user-authored quests that award XP toward giant skill levels.

## Core Features (MVP)
- **Auth**: JWT email/password (register, login, /me); token stored in AsyncStorage; Bearer auth on all protected routes.
- **Character Screen**: Renamable character, avatar HUD frame, overall level + XP badge, 6 adjustable status bars (Health, Hunger, Hygiene, Energy, Social, Mood) each with -10/-5/+5/+10 controls, clamped 0–100.
- **Skill Trees**: Fully user-customizable skills (name, description, color). Each skill has its own level progression (LV1→LV2 at 100 XP, LV2→LV3 at 250 XP, +150 XP each subsequent level — "giant levels"). +25 / +100 quick-add XP buttons + edit/delete.
- **Quests**: User-created quests with title, description, XP reward, optional assigned skill. Mark complete → XP awarded to skill; uncomplete → XP rolled back. Edit/delete supported.
- **Profile**: Email, character name, stats (skills/quests/completed/total XP), logout.
- **Cyberpunk UI**: Neon cyan/magenta/purple on deep void backgrounds, hard edges, HUD-style segmented status bars, monospace-feel typography.

## Backend Stack
FastAPI + MongoDB (motor) + bcrypt + PyJWT. All routes prefixed `/api`. Collections: `users`, `skills`, `quests`.

## Frontend Stack
Expo Router (file-based), React Native, axios, AsyncStorage, @expo/vector-icons.

## Smart Business Enhancement
The XP/level economy is intentionally tunable per skill — future monetization could offer "premium quest packs" (curated quest templates for fitness, learning, mindfulness) sold as one-time IAPs, plus a Pro tier unlocking unlimited skills/custom HUD themes. Daily streak tracking + push reminders would drive D7/D30 retention.

## Files
- Backend: `/app/backend/server.py`, `/app/backend/.env`
- Frontend: `/app/frontend/app/{_layout,index,login,register}.tsx`, `/app/frontend/app/(tabs)/{_layout,character,skills,quests,profile}.tsx`, `/app/frontend/lib/{api.ts,auth.tsx,theme.ts}`
