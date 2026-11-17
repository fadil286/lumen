# Lumen

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/fadil286/lumen/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/fadil286/lumen/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

A firefly's light is its life. Steer a firefly through a dark night, collect
golden light motes to feed your light, and dodge the dark: wisps that chase,
darters that lunge, and eaters that steal your motes. Light always burns a
little, a dash spends it, and at zero light you lose a life. Three lives,
waves that get thicker, combo multipliers up to x8, and two power-ups (Flare
clears the dark, Shield burns what touches you).

## Play

Open `game/index.html` in a browser, or serve it locally:

```sh
node serve.ts
# then open http://localhost:8080
```

- **Move:** mouse or WASD / arrow keys
- **Dash:** Space or click (costs 8 light, brief invulnerability)
- **Pause:** P · **Mute:** M

## How it is built

Plain HTML, CSS and vanilla JavaScript — no libraries, no build step, no
network request, everything synthesized or drawn in code (sound is WebAudio).
`main.ts` (Node 22, standard library only) hands the game in to the make.fun
scorer: it copies `game/` and `screenshots/` to `/output` and writes
`/output/dossier.json`. Screenshots are staged from the game itself:
`?shot=start|play|end&seed=1` plays the real rules forward with an autopilot
and paints the frame.
