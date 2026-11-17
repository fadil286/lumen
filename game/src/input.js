// Keyboard + mouse (and pointer) input. The game is steered two ways at once: the
// firefly chases the pointer, and WASD / arrow keys push it directly. Space or a
// click dashes; Space / Enter / click confirms on menus; P pauses; M mutes.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;

const KEY_DIRS = {
  ArrowLeft: [-1, 0],
  KeyA: [-1, 0],
  ArrowRight: [1, 0],
  KeyD: [1, 0],
  ArrowUp: [0, -1],
  KeyW: [0, -1],
  ArrowDown: [0, 1],
  KeyS: [0, 1],
};

export function createInput(canvas, toLogical) {
  const keys = new Set();
  let actions = 0;
  let dashQueued = false;
  let pointer = null;
  let pointerSeen = false;

  function onKeyDown(event) {
    if (event.code in KEY_DIRS) {
      keys.add(event.code);
      event.preventDefault();
      return;
    }
    if (event.code === 'Space' || event.code === 'Enter') {
      actions |= ACTION_CONFIRM;
      dashQueued = true;
      event.preventDefault();
    } else if (event.code === 'KeyP' || event.code === 'Escape') {
      actions |= ACTION_PAUSE;
    } else if (event.code === 'KeyM') {
      actions |= ACTION_MUTE;
    }
  }

  function onKeyUp(event) {
    keys.delete(event.code);
  }

  function onPointerMove(event) {
    const rect = canvas.getBoundingClientRect();
    pointer = toLogical(event.clientX - rect.left, event.clientY - rect.top);
    pointerSeen = true;
  }

  function onPointerDown(event) {
    const rect = canvas.getBoundingClientRect();
    pointer = toLogical(event.clientX - rect.left, event.clientY - rect.top);
    pointerSeen = true;
    actions |= ACTION_CONFIRM;
    dashQueued = true;
  }

  function onBlur() {
    keys.clear();
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerdown', onPointerDown);

  return {
    // One-shot actions since the last call (confirm / pause / mute).
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    // The keyboard steering vector, each axis in [-1, 1].
    keyVector() {
      let x = 0;
      let y = 0;
      for (const code of keys) {
        const dir = KEY_DIRS[code];
        if (dir) {
          x += dir[0];
          y += dir[1];
        }
      }
      const len = Math.hypot(x, y);
      if (len > 1) {
        x /= len;
        y /= len;
      }
      return { x, y };
    },
    // The pointer's logical position, or null when the mouse never moved.
    pointer() {
      return pointerSeen ? pointer : null;
    },
    // True once per Space / click, consumed by the caller.
    takeDash() {
      const taken = dashQueued;
      dashQueued = false;
      return taken;
    },
  };
}
