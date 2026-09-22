# Grok Bot-Man — Night Circuit

A browser game about swinging a humanoid robot through a night city, talking to the people under the roofs, and lighting four dead relays. One sitting, start to finish. The city is real-time 3D: moonlight, lit windows, wet streets, fog, and a body that swings on a filament.

## The hero

One original character, three references, none of them a copied asset pack.

- **Body:** pearl-white shell, dark actuators at the neck, shoulders, elbows, hips, and knees, a battery pack on the back, five-finger hands, flat feet. That is the Optimus silhouette, built as our own mesh. No Tesla model and no Tesla marks.
- **Figure:** long legs, narrow waist, one arm up on the filament, the other trailing, knees tucked, a full dive when you drop. The pose language is the swing, not a suit.
- **Face:** the helmet carries a lit face-screen of the Grok Bot mark — the irregular head and the two cutout eyes. The eyes shift a little with motion so the screen feels awake.

The filament is a data cable from the wrist launcher. It droops when it is slack and pulls tight when you are fast.

## What a run is

You start on a roof over Central Plaza. The camera is already moving through the city on the title screen. Drop in, swing down, and talk to Nia Voss. She sends you around the four wards:

1. Glass Mile, north, tall and cool.
2. Lantern Row, west, lower and brighter.
3. Foundry, east, short industrial blocks.
4. Antenna Ward, south, masts and longer gaps.

Touch a relay by swinging through its beam. After the fourth, an extract pad opens on a high Glass Mile roof. Land there to finish. Glitch drones wake up once the job starts. They hum, they telegraph a slow orb, and they are meant to be flown around, not fought.

You can ignore the job and swing. The city still talks.

## Controls

Hold to swing, release to fly. That is the whole skill.

| Action | Mouse and keys | Touch |
| --- | --- | --- |
| Look | Mouse when locked, right-drag, or arrow keys | Drag the right half of the screen |
| Move / steer | W A S D | Left stick |
| Jump | Space | Jump |
| Fire filament | Hold left mouse or F | Hold Swing |
| Release | Let go | Let go |
| Chain | Release and press again toward the next roof | Same |
| Reel / pay out | Mouse wheel, or W / S while attached | — |
| Zip | Shift or right mouse. Along the cable if attached, a dash if not | Zip |
| Dive | Ctrl or C | Dive |
| Talk | E, when you are on your feet next to someone | Talk |
| Pause | Esc | Pause |

Arrow keys always look, so the game is playable if the browser will not lock the pointer.

Swing rules that make it feel right:

- The cable is chosen from roof corners, ledges, and antennae in front of your look, with a small upward bias. A ring marks the point before you fire. Occluded points are ignored.
- The rope is a hard tether. Gravity makes the pendulum. Speed comes from releasing as your vertical speed flips at the bottom of the arc. That release is a Sling: a small boost and a combo step. No air horn.
- Reeling shortens the rope. Paying out gives you a longer, slower arc.
- Zip reels fast and, at the end of the rope, throws you forward.
- Dive adds fall speed. You can fire out of a dive.
- Hitting a wall at speed kicks you back upward instead of stopping you dead.
- Landing on roofs is solid. Ordinary landings do not hurt. A true crater does.

Camera sits behind you, leads your velocity, opens the field of view when you are fast, and tucks in before it enters a building. If you leave the mouse alone while swinging, it eases behind your travel direction. The moment you look, it gets out of the way.

## City

Eleven by eleven blocks, about 640 meters on a side. Streets, sidewalks, and a stone plaza are painted into the ground. Buildings are dark glass with real window grids, setbacks, roof boxes, and masts. Glass Mile is taller and cooler. Foundry is lower and warmer. Cars move on the avenues. A fountain sits in the plaza. Fog, a moon, wet asphalt, and a little bloom. The hero is pearl and clearcoat so the night reflects in the shell.

District names appear once, quietly, when you cross into them.

## People

Everyone on the street can be talked to. Nobody is a quest menu.

- Crowds walk the sidewalks, look up when you pass fast, and step aside if you land among them. A short line appears over their head. That is the flyby.
- On foot, within arm's reach, E opens a conversation. Citizens have their own two or three lines. Pointer lock lets go so you can read. Sound is a soft tick, not a voice.
- **Nia Voss**, dispatcher, Central Plaza. Starts the relay job.
- **Jun Park**, on a mid roof. Tells you how a Sling works, if you go and find him.
- **Ivo Pell**, Lantern Row. Talks about the city and the face on the helmet.
- **Mara Ell**, Foundry sidewalk. Repairs one sensor light, once.
- A few pairs stand and talk to each other until you interrupt.

Drones are not people. They patrol, glow, and lob a slow orb after the mission starts. Three sensor lights. A hit costs one and breaks the combo. Zero lights ends the run. Retry from the last relay, or from the opening roof.

Logits hang in the air on the lines you actually swing. They are worth score and a quiet chime. The combo climbs on Slings and near-misses and only breaks when you are hit.

## Sound

Sound sits under the city. It does not announce itself.

- A low room tone and a soft wind that follows speed. Both are quiet.
- The plaza fountain is local. You hear it when you are there.
- Drones hum when they are near, low, not a siren.
- Filament, release, Sling, pickup, relay, and damage are short and soft. Pickups use a quiet pentatonic note so a chain of them does not beep.
- No music bed, no voice synthesis, no looping jingle.
- The pause menu has a level. It is remembered in the browser. Zero is silence.

## Screens

- Title over the live city, with the job in one paragraph and the controls in a grid.
- Play HUD: sensor lights, the current objective, score, combo, speed, the anchor reticle, and a talk prompt only when one applies.
- Dialogue card at the bottom.
- Pause, with sound.
- Finish and failure cards with time, slings, logits, and score. Best time is kept on the machine.

## Build

Vite, TypeScript, one WebGL canvas, Three.js. No server, no account, no database. Modules: city, hero, player physics, people, relays and drones, audio, input, HUD. The page runs with `npm install` and `npm run dev`.

## Done when

- Title, swing, roof landings, dive, zip, wall kick, and a Sling all work on keyboard and mouse.
- Nia can start the job, all four relays can be lit, and the extract pad can be reached.
- Any nearby person can be talked to, and a fast pass makes them look up and speak.
- A fresh player can hear the city without wanting to mute it, and can mute it anyway.
- The run can be won, failed, and retried. Best time survives a refresh.

## Not in this build

- Multiplayer, accounts, or a live leaderboard
- A combat combo tree or guns
- An editor
- Cutscenes
