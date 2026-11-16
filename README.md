# Botz

A physics-based team sports game for mobile (installable PWA), where the players are small round robots. V1 ships a single mini-game: **soccer**, 3 botz per team. Full spec: [`specs/BOTZ_SPEC.md`](specs/BOTZ_SPEC.md); design mockups: `specs/`.

What makes it different from a plain "launch the blobs" game — two twists:

1. **Botz fall apart.** Every hard hit (bot–bot or bot–wall) knocks one of their 4 parts off — antenna (blurry aim ±10°), left / right arm (the trajectory drifts right / left), wheel (spins and brakes irregularly). Each lost part also makes the bot lighter. A bot with nothing left is a smoking wreck. Lost parts become physical debris on the pitch and stay lost for the whole match.
2. **The ball is an alarm clock that runs away.** It rings, flees the botz on its own during each resolution (sliding along walls, never staying stuck in a corner), and panics more and more as turns go by: *Somnolent* (turns 1–3) → *Réveillé* (4–6) → *Inquiet* (7–10) → *Panique* (11+). A goal calms it down by one notch. A hard hit stuns it for 1.5 s.

Built with TypeScript, Vite, [Phaser 3](https://phaser.io/) (rendering + game loop) and Phaser's built-in Matter.js integration (physics), stepped manually at a fixed 60 Hz. Shipped as a PWA (installable web app) on GitHub Pages at https://botz.pomponlabs.com.

## Requirements

- Node.js 18+

## Development

```bash
npm install
npm run dev       # starts Vite on http://localhost:5173
```

Open the URL in a browser, landscape orientation recommended (the game runs at a logical 1600x900 resolution, scaled with `Phaser.Scale.FIT`).

## Testing

Gameplay logic (turn state machine, aiming math, AI, part loss, panic, alarm steering, RNG) is framework-agnostic and unit-tested with Vitest:

```bash
npm run test        # run once
npm run test:watch  # watch mode
```

## Building for the web

```bash
npm run build      # type-checks then builds to dist/
npm run preview    # serve the production build locally
```

## Tuning

Every gameplay knob lives in `src/config/`:

| File | What |
|---|---|
| `physics.ts` | radii, restitution, friction, shot speed, fixed timestep |
| `parts.ts` | part-loss impact threshold, cooldown, mass loss, drift / aim-error / wheel effects, debris cap, `REPAIR_ON_GOAL` |
| `alarmClock.ts` | panic levels (turn thresholds, flee force, ring cadence), run time, stun, wall following |
| `game.ts` | goals to win, aim timer, settle thresholds |
| `theme.ts` | palette and fonts from the mockups |

All randomness (lost part choice, aim error, flee direction, AI noise) goes through the seeded `Rng` (`src/game/Rng.ts`), never `Math.random()`. A match is described by its seed (`MatchConfig.seed`).

## Project structure

```
src/
  main.ts             Phaser game bootstrap
  styles.css          @font-face for Bungee + Fredoka (src/assets/fonts, SIL OFL)
  config/             physics, parts, alarmClock, game, theme
  scenes/             BootScene (waits for fonts), MenuScene, GameScene, ResultScene
  game/
    Rng.ts            seeded random generator (mulberry32)
    TurnManager.ts    AIMING -> RESOLVING -> (GOAL_PAUSE) -> ... state machine
    DamageSystem.ts   hard-hit detection, part loss, per-bot cooldown
    Panic.ts          panic level from the turn number, calm-down on goal
    alarmSteering.ts  flee direction (away from bots, wall following, un-sticking)
    AimController.ts  touch input: drag-to-aim, tap-to-clear
    AIController.ts   rule-based AI (attacker / defender / support), difficulty noise
    entities/         Bot, BotParts (pure part logic), AlarmClock, Debris
    field/            SoccerField, fieldGeometry (wall distance queries)
    modes/            GameMode (interface), SoccerMode
    view/             BotView, AlarmClockView and their Graphics art (swap for sprites later)
    Audio.ts          synthesized SFX (Web Audio): clonks, alarm ring, stun, goal
  ui/                 Button, HUD, Overlays (pause, pass & play hand-off, goal flash, sparks)
  state/              settings.ts (sound, difficulty — persisted to localStorage)
```

## Website

The landing page (`public/about.html`), the privacy policy (`public/privacy.html`), the `CNAME` and the PWA manifest live in `public/` and are served with the game at **https://botz.pomponlabs.com**.

## Icons

`public/favicon.png`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png` and `resources/icon.png` are generated procedurally by `scripts/generate-assets.mjs` (a small from-scratch PNG encoder in `scripts/png.mjs`, no external image tools needed), in the same style as the in-game botz and alarm clock. Regenerate them whenever the design changes:

```bash
node scripts/generate-assets.mjs
```

## Deployment

Every push to `main` builds and deploys `dist/` to GitHub Pages (`.github/workflows/deploy.yml`). Static pages (`about.html`, `privacy.html`), the `CNAME` and the PWA manifest live in `public/`. In the repo settings, Pages → Source must be set to **GitHub Actions**.
