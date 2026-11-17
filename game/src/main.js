// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. The game moves between four screens: title, play, paused
// and game over.
//
// ?seed=N fixes the night's pattern. ?shot=start|play|end (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, LIVES, STEP } from './config.js';
import { createRandom } from './random.js';
import { createAudio } from './audio.js';
import { createWorld, EVENT_DASH, EVENT_HIT, EVENT_OVER, EVENT_PICKUP, EVENT_POWER, EVENT_WAVE } from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

// A test hook, only when the page is opened with ?debug: playtests read the
// world and the current screen through it. Normal play never sets it.
let currentScreen = SCREEN_TITLE;
if (params.has('debug')) {
  window.__lumen = {
    world,
    get screen() {
      return currentScreen;
    },
  };
}

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  currentScreen = scene.screen;
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, { muted: true });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas, (x, y) => renderer.toLogical(x, y));
  let screen = SCREEN_TITLE;
  let best = readBest();
  let muted = false;
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes and each hit.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    audio.unlock();
    audio.start();
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce(`Playing. ${LIVES} lives. Your light is your life.`);
  }

  function endGame() {
    screen = SCREEN_OVER;
    audio.over();
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(`Game over. Score ${world.state.score}. Best ${best}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      muted = !muted;
      audio.setMuted(muted);
    }
    if (actions & ACTION_CONFIRM) audio.unlock();
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER)) startGame();
    else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function playStep() {
    const keys = input.keyVector();
    const pointer = input.pointer();
    const ctl = {
      kx: keys.x,
      ky: keys.y,
      px: pointer ? pointer.x : null,
      py: pointer ? pointer.y : null,
      dash: input.takeDash(),
    };
    const events = world.step(STEP, ctl, false);
    if (events & EVENT_PICKUP) audio.pickup(world.state.combo);
    if (events & EVENT_DASH) audio.dash();
    if (events & EVENT_WAVE) audio.wave();
    if (events & EVENT_POWER) {
      if (world.state.player.shieldT > 0) audio.shield();
      else audio.flare();
    }
    if (events & EVENT_HIT) {
      audio.hit();
      announce(world.state.lives === 1 ? 'Hit. 1 life left.' : `Hit. ${world.state.lives} lives left.`);
    }
    if (events & EVENT_OVER) endGame();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    currentScreen = screen;
    if (screen === SCREEN_TITLE) {
      while (accumulator >= STEP) {
        world.step(STEP, null, true);
        accumulator -= STEP;
      }
    } else if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        playStep();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best, { muted });
  }

  // Leaving the tab pauses a running game rather than letting the dark close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Lumen. A firefly\u2019s light is its life. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
