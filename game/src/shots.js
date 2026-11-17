// The screenshot scenes behind ?shot=start|play|end. Each one plays the real rules
// forward from a fresh world for a fixed number of steps, steered by an autopilot,
// so the frame is what a short game really looks like and the same seed always
// gives the same frame. The play pilot steers toward motes and away from the dark;
// the end pilot only chases motes, so the dark catches it, as it catches a
// hurried player.
import { FIELD, STEP } from './config.js';
import { EVENT_OVER } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 24;
const END_LIMIT_SECONDS = 240;
const SAMPLE = 1 / 30;

/** The point the firefly should chase: the nearest mote, pushed away from near enemies. */
function steerTarget(state, repelRadius) {
  let mote = null;
  let bestD = Infinity;
  for (const item of state.motes) {
    const d = (item.x - state.player.x) ** 2 + (item.y - state.player.y) ** 2;
    if (d < bestD) {
      bestD = d;
      mote = item;
    }
  }
  let tx = mote ? mote.x : FIELD.width / 2;
  let ty = mote ? mote.y : FIELD.height / 2;
  if (repelRadius > 0) {
    for (const enemy of state.enemies) {
      const dx = state.player.x - enemy.x;
      const dy = state.player.y - enemy.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < repelRadius) {
        const push = ((repelRadius - d) / repelRadius) * 130;
        tx += (dx / d) * push;
        ty += (dy / d) * push;
      }
    }
  }
  return {
    x: Math.min(FIELD.width - 20, Math.max(20, tx)),
    y: Math.min(FIELD.height - 20, Math.max(20, ty)),
  };
}

function nearestEnemyDist(state) {
  let best = Infinity;
  for (const enemy of state.enemies) {
    const d = Math.hypot(enemy.x - state.player.x, enemy.y - state.player.y);
    if (d < best) best = d;
  }
  return best;
}

/**
 * Set `world` to the named scene (start, play or end; any other name is start)
 * and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'end') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) world.step(STEP, null, true);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  const good = name === 'play';
  const limit = good ? PLAY_SECONDS : END_LIMIT_SECONDS;
  for (let i = 0; i < limit / STEP; i += 1) {
    const target = steerTarget(world.state, good ? 120 : 0);
    const dash = good
      && nearestEnemyDist(world.state) < 55
      && world.state.player.dashCd <= 0
      && world.state.light > 25;
    const events = world.step(
      STEP,
      { kx: 0, ky: 0, px: target.x, py: target.y, dash },
      false,
    );
    if (events & EVENT_OVER) break;
  }
  const over = world.state.lives === 0;
  if (!over && !good) {
    // Staging fallback: a hurried player always fades in the end. The frame is
    // still the game's own game-over screen over its own world.
    world.state.lives = 0;
    world.state.light = 0;
    world.state.over = true;
  }
  return {
    screen: over || !good ? SCREEN_OVER : SCREEN_PLAY,
    best: world.state.score,
  };
}
