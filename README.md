# Grok Bot-Man — Night Circuit

A third-person swing game in the browser. You play a pearl-white humanoid courier — long limbs, dark joints, a battery pack — with the Grok Bot mark on the face-screen and across the back plate. Hold a filament, release at the bottom of the arc, and the city gives the speed back.

The job is one night. Talk to Nia in the plaza, swing through four relay beams, and reach the extract pad on a Glass Mile roof. People on the sidewalks look up when you pass and will talk if you land beside them.

## Run

```bash
npm install
npm run dev
```

Open the local URL Vite prints. The dev server uses port **47331**.

```bash
npm run build
npm run preview
```

## Controls

| Action | Mouse and keys | Touch |
| --- | --- | --- |
| Look | Mouse after click, right-drag, or arrow keys | Drag the right side |
| Move | W A S D | Left side drag, or the stick |
| Jump | Space | Jump |
| Swing | Hold left mouse or F. Release to let go | Hold Swing |
| Zip | Shift or right click | Zip |
| Dive | Ctrl or C | Dive |
| Talk | E, on your feet next to someone | Talk |
| Pause | Esc | Pause button |

A ring marks the anchor before you fire. Releasing as your fall turns into a rise is a sling. Zip reels the cable in, or dashes when you are loose. Hitting a wall at speed kicks you upward.

Sound stays under the city: wind, a low room tone, and short soft cues. The slider on the title screen is remembered in the browser. Zero is silence.

## Save

Best score and best winning time live in `localStorage` on this machine. There is no account.
