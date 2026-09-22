# Handover — Grok Bot Man

Move this project off Cursor cloud and keep working in a normal local folder.

Local folder: `C:\Users\Dell\Desktop\Grok-Bot-Man`

GitHub remote (this is the copy to clone): https://github.com/tanayvasishtha/Grok-Bot-Man

Cursor cloud repo to delete yourself, after the folder is on the PC and the game runs: https://cursor.com/codebase/anurag-ojha/grok-bot-man

## 1. Put the repo on the PC

In PowerShell:

```powershell
git clone https://github.com/tanayvasishtha/Grok-Bot-Man.git "C:\Users\Dell\Desktop\Grok-Bot-Man"
cd "C:\Users\Dell\Desktop\Grok-Bot-Man"
npm install
npx vite --host 127.0.0.1 --port 47331 --strictPort
```

Open http://127.0.0.1:47331/

Node.js is required. If `node -v` fails, install it from https://nodejs.org and run the commands again.

If `C:\Users\Dell\Desktop\Grok-Bot-Man` already exists and is not this repo, pick it up or delete that empty folder before cloning.

## 2. New Cursor session

1. Cursor → File → Open Folder → `C:\Users\Dell\Desktop\Grok-Bot-Man`
2. Start a new chat in that window.
3. Paste this so the new session knows where things stand:

```text
This is Grok Bot-Man — Night Circuit, a Vite + TypeScript + Three.js browser game. The local folder is C:\Users\Dell\Desktop\Grok-Bot-Man. Run it with: npx vite --host 127.0.0.1 --port 47331 --strictPort then open http://127.0.0.1:47331/ . The playable night mission is already built: swing, sling, zip, dive, wall kick, street NPCs, four relays, extract, quiet audio, pause, win and lose. Read PLAN.md and HANDOVER.md before changing anything. Do not recreate the game.
```

## 3. Delete the Cursor cloud copy

Do this only after step 1 works on the PC. Deleting the cloud repo does not delete `C:\Users\Dell\Desktop\Grok-Bot-Man`.

On the repo page, use Settings and delete `anurag-ojha/grok-bot-man`: https://cursor.com/codebase/anurag-ojha/grok-bot-man

Or in WSL, after `origin auth login`:

```bash
origin repo delete anurag-ojha/grok-bot-man --yes
```

## What is already built

One night in a procedural city. Hold to swing, release at the bottom of the arc for a sling, plus reel, zip, dive, wall kick, and roof landings. Talk to Nia Voss, Jun Park, Ivo Pell, and Mara Ell. Clear Glass Mile, Lantern Row, Foundry, and Antenna Ward in any order, then reach the extract pad. Glitch drones, three sensor lights, checkpoint retry. Wind and soft cues only. Best score and volume live in `localStorage`.

Stack: Vite, TypeScript, Three.js. No backend. Source is under `src/game/`. Dev server port is 47331.
