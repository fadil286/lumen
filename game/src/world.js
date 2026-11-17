// The world: everything that moves, collides and scores. A fixed-step simulation
// with a seeded random source, so the same inputs always replay the same night.
// The player is a firefly whose light is its life: motes feed it, the dark burns
// it, and a dash spends it. Three enemies hunt in different ways, waves get
// thicker, and two power-ups answer back.
import { COMBO, FIELD, LIGHT, LIVES, PLAYER, SPAWN, WAVE } from './config.js';

export const EVENT_PICKUP = 1;
export const EVENT_HIT = 2;
export const EVENT_OVER = 4;
export const EVENT_WAVE = 8;
export const EVENT_POWER = 16;
export const EVENT_DASH = 32;

const KIND_WISP = 'wisp';
const KIND_DARTER = 'darter';
const KIND_EATER = 'eater';
const POWER_FLARE = 'flare';
const POWER_SHIELD = 'shield';

function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function createWorld(random) {
  const state = freshState();

  function freshState() {
    return {
      time: 0,
      score: 0,
      combo: 1,
      comboT: 0,
      light: LIGHT.start,
      lives: LIVES,
      wave: 1,
      waveT: 0,
      banner: '',
      bannerT: 0,
      shake: 0,
      shakeT: 0,
      flash: 0,
      over: false,
      player: {
        x: FIELD.width / 2,
        y: FIELD.height / 2,
        vx: 0,
        vy: 0,
        face: -Math.PI / 2,
        invuln: 0,
        dashT: 0,
        dashCd: 0,
        dashX: 0,
        dashY: -1,
        shieldT: 0,
        flap: 0,
      },
      motes: [],
      enemies: [],
      powers: [],
      particles: [],
      ambient: [],
      moteT: 0,
      enemyT: 1.2,
      powerT: SPAWN.powerInterval,
      nextPower: POWER_FLARE,
    };
  }

  function spawnAmbient() {
    state.ambient = [];
    for (let i = 0; i < 42; i += 1) {
      state.ambient.push({
        x: random.range(0, FIELD.width),
        y: random.range(0, FIELD.height),
        r: random.range(0.6, 1.8),
        phase: random.range(0, Math.PI * 2),
        speed: random.range(2, 9),
      });
    }
  }

  function spawnBurst(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const angle = random.range(0, Math.PI * 2);
      const v = random.range(speed * 0.3, speed);
      state.particles.push({
        x,
        y,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v,
        life: random.range(0.3, 0.7),
        max: 0.7,
        size: random.range(1.5, 3.5),
        color,
      });
    }
    if (state.particles.length > 320) state.particles.splice(0, state.particles.length - 320);
  }

  function farFromPlayer(x, y, minDist) {
    return dist2(x, y, state.player.x, state.player.y) > minDist * minDist;
  }

  function randomEdgePoint(minDist) {
    for (let tries = 0; tries < 12; tries += 1) {
      const side = random.int(4);
      let x;
      let y;
      if (side === 0) {
        x = random.range(24, FIELD.width - 24);
        y = 24;
      } else if (side === 1) {
        x = random.range(24, FIELD.width - 24);
        y = FIELD.height - 24;
      } else if (side === 2) {
        x = 24;
        y = random.range(24, FIELD.height - 24);
      } else {
        x = FIELD.width - 24;
        y = random.range(24, FIELD.height - 24);
      }
      if (farFromPlayer(x, y, minDist)) return { x, y };
    }
    return { x: 40, y: 40 };
  }

  function spawnMoteCluster() {
    // Keep a cluster clear of the firefly, so a fresh start is never a free
    // combo: the player has to fly to the light.
    let cx = random.range(60, FIELD.width - 60);
    let cy = random.range(60, FIELD.height - 60);
    for (let tries = 0; tries < 10; tries += 1) {
      cx = random.range(60, FIELD.width - 60);
      cy = random.range(60, FIELD.height - 60);
      if (farFromPlayer(cx, cy, 160)) break;
    }
    const count = 3 + random.int(SPAWN.moteCluster - 2);
    for (let i = 0; i < count; i += 1) {
      state.motes.push({
        x: Math.min(FIELD.width - 16, Math.max(16, cx + random.range(-46, 46))),
        y: Math.min(FIELD.height - 16, Math.max(16, cy + random.range(-46, 46))),
        r: 6,
        t: random.range(0, Math.PI * 2),
        ttl: SPAWN.moteTtl,
      });
    }
  }

  function spawnEnemy() {
    const roll = random.next();
    let kind = KIND_WISP;
    if (state.wave >= 3 && roll < 0.2) kind = KIND_EATER;
    else if (state.wave >= 2 && roll < 0.45) kind = KIND_DARTER;
    const at = randomEdgePoint(190);
    const enemy = {
      kind,
      x: at.x,
      y: at.y,
      vx: 0,
      vy: 0,
      r: kind === KIND_DARTER ? 11 : 13,
      t: random.range(0, Math.PI * 2),
      state: 'drift',
      stateT: random.range(0.5, 1.5),
      lockX: 0,
      lockY: 0,
    };
    state.enemies.push(enemy);
  }

  function spawnPower() {
    const at = randomEdgePoint(150);
    state.powers.push({
      kind: state.nextPower,
      x: at.x,
      y: at.y,
      t: 0,
      ttl: SPAWN.powerTtl,
    });
    state.nextPower = state.nextPower === POWER_FLARE ? POWER_SHIELD : POWER_FLARE;
  }

  function collectMote(mote) {
    if (state.comboT > 0) state.combo = Math.min(state.combo + 1, COMBO.max);
    else state.combo = 1;
    state.comboT = COMBO.window;
    state.score += COMBO.moteScore * state.combo;
    state.light = Math.min(LIGHT.max, state.light + LIGHT.mote);
    spawnBurst(mote.x, mote.y, '#ffd166', 10, 130);
  }

  function clearEnemies() {
    let cleared = 0;
    for (const enemy of state.enemies) {
      spawnBurst(enemy.x, enemy.y, '#b9a7ff', 12, 170);
      cleared += 1;
    }
    state.enemies = [];
    state.score += 150 + cleared * 25;
    state.flash = 1;
  }

  function loseLife() {
    state.lives -= 1;
    if (state.lives <= 0) {
      state.over = true;
      state.light = 0;
      spawnBurst(state.player.x, state.player.y, '#ffd166', 40, 260);
      return EVENT_OVER;
    }
    state.light = LIGHT.deathRefill;
    state.player.invuln = PLAYER.invulnAfterDeath;
    // Breathing room: shove the dark back from the revived firefly.
    for (const enemy of state.enemies) {
      const d = Math.sqrt(dist2(enemy.x, enemy.y, state.player.x, state.player.y)) || 1;
      if (d < 170) {
        enemy.x = state.player.x + ((enemy.x - state.player.x) / d) * 170;
        enemy.y = state.player.y + ((enemy.y - state.player.y) / d) * 170;
      }
    }
    return EVENT_HIT;
  }

  function hitPlayer(enemy) {
    if (state.player.shieldT > 0) {
      // A shielded firefly burns what touches it.
      spawnBurst(enemy.x, enemy.y, '#7fe7dc', 14, 180);
      state.enemies.splice(state.enemies.indexOf(enemy), 1);
      state.score += 15;
      return EVENT_HIT;
    }
    state.light -= LIGHT.hit;
    state.player.invuln = PLAYER.invulnAfterHit;
    const d = Math.sqrt(dist2(enemy.x, enemy.y, state.player.x, state.player.y)) || 1;
    state.player.vx += ((state.player.x - enemy.x) / d) * 320;
    state.player.vy += ((state.player.y - enemy.y) / d) * 320;
    state.shake = 11;
    state.shakeT = 0.35;
    spawnBurst(state.player.x, state.player.y, '#ff5c5c', 16, 200);
    if (state.light <= 0) return loseLife();
    return EVENT_HIT;
  }

  function stepPlayer(dt, ctl) {
    const p = state.player;
    p.invuln = Math.max(0, p.invuln - dt);
    p.dashCd = Math.max(0, p.dashCd - dt);
    p.shieldT = Math.max(0, p.shieldT - dt);
    p.flap += dt * 22;

    // Dash: a burst of speed that spends light and grants a blink of safety.
    if (ctl.dash && p.dashCd <= 0 && p.dashT <= 0 && state.light > PLAYER.dashCost) {
      let dx = ctl.kx;
      let dy = ctl.ky;
      if (dx === 0 && dy === 0 && ctl.px !== null && ctl.py !== null) {
        dx = ctl.px - p.x;
        dy = ctl.py - p.y;
      }
      if (dx === 0 && dy === 0) {
        dx = Math.cos(p.face);
        dy = Math.sin(p.face);
      }
      const len = Math.hypot(dx, dy) || 1;
      p.dashX = dx / len;
      p.dashY = dy / len;
      p.dashT = PLAYER.dashTime;
      p.dashCd = PLAYER.dashCooldown;
      p.invuln = Math.max(p.invuln, 0.35);
      state.light -= PLAYER.dashCost;
      spawnBurst(p.x, p.y, '#ffe9a8', 8, 90);
      return EVENT_DASH;
    }

    if (p.dashT > 0) {
      p.dashT -= dt;
      p.vx = p.dashX * PLAYER.dashSpeed;
      p.vy = p.dashY * PLAYER.dashSpeed;
    } else if (ctl.kx !== 0 || ctl.ky !== 0) {
      p.vx += ctl.kx * PLAYER.accel * dt;
      p.vy += ctl.ky * PLAYER.accel * dt;
    } else if (ctl.px !== null && ctl.py !== null) {
      // Chase the pointer: faster when it is far, gentle when it is near.
      const dx = ctl.px - p.x;
      const dy = ctl.py - p.y;
      const d = Math.hypot(dx, dy);
      if (d > 4) {
        const want = Math.min(PLAYER.maxSpeed, d * 4.5);
        p.vx += ((dx / d) * want - p.vx) * Math.min(1, dt * 10);
        p.vy += ((dy / d) * want - p.vy) * Math.min(1, dt * 10);
      } else {
        p.vx *= Math.max(0, 1 - 6 * dt);
        p.vy *= Math.max(0, 1 - 6 * dt);
      }
    } else {
      p.vx *= Math.max(0, 1 - 3.5 * dt);
      p.vy *= Math.max(0, 1 - 3.5 * dt);
    }

    const speed = Math.hypot(p.vx, p.vy);
    const cap = p.dashT > 0 ? PLAYER.dashSpeed : PLAYER.maxSpeed;
    if (speed > cap) {
      p.vx = (p.vx / speed) * cap;
      p.vy = (p.vy / speed) * cap;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.x < PLAYER.radius) {
      p.x = PLAYER.radius;
      p.vx = Math.abs(p.vx) * 0.4;
    }
    if (p.x > FIELD.width - PLAYER.radius) {
      p.x = FIELD.width - PLAYER.radius;
      p.vx = -Math.abs(p.vx) * 0.4;
    }
    if (p.y < PLAYER.radius) {
      p.y = PLAYER.radius;
      p.vy = Math.abs(p.vy) * 0.4;
    }
    if (p.y > FIELD.height - PLAYER.radius) {
      p.y = FIELD.height - PLAYER.radius;
      p.vy = -Math.abs(p.vy) * 0.4;
    }
    if (speed > 12) p.face = Math.atan2(p.vy, p.vx);
    if (p.dashT > 0) {
      state.particles.push({
        x: p.x,
        y: p.y,
        vx: -p.vx * 0.08,
        vy: -p.vy * 0.08,
        life: 0.3,
        max: 0.3,
        size: 5,
        color: '#ffe9a8',
      });
    }
    return 0;
  }

  function stepEnemy(dt, enemy) {
    const p = state.player;
    const speedScale = 1 + 0.06 * (state.wave - 1);
    enemy.t += dt;
    if (enemy.kind === KIND_WISP) {
      const d = Math.sqrt(dist2(enemy.x, enemy.y, p.x, p.y)) || 1;
      const wob = Math.sin(enemy.t * 3.1) * 0.55;
      const nx = (p.x - enemy.x) / d;
      const ny = (p.y - enemy.y) / d;
      const sp = (55 + 7 * state.wave) * speedScale;
      enemy.vx = (nx - ny * wob) * sp;
      enemy.vy = (ny + nx * wob) * sp;
    } else if (enemy.kind === KIND_DARTER) {
      enemy.stateT -= dt;
      if (enemy.state === 'drift') {
        const d = Math.sqrt(dist2(enemy.x, enemy.y, p.x, p.y)) || 1;
        enemy.vx = ((p.x - enemy.x) / d) * 42;
        enemy.vy = ((p.y - enemy.y) / d) * 42;
        if (enemy.stateT <= 0) {
          enemy.state = 'aim';
          enemy.stateT = 0.5;
        }
      } else if (enemy.state === 'aim') {
        enemy.vx *= 0.9;
        enemy.vy *= 0.9;
        if (enemy.stateT <= 0) {
          const d = Math.sqrt(dist2(enemy.x, enemy.y, p.x, p.y)) || 1;
          enemy.lockX = (p.x - enemy.x) / d;
          enemy.lockY = (p.y - enemy.y) / d;
          enemy.state = 'lunge';
          enemy.stateT = 0.35;
        }
      } else if (enemy.state === 'lunge') {
        enemy.vx = enemy.lockX * 430;
        enemy.vy = enemy.lockY * 430;
        if (enemy.stateT <= 0) {
          enemy.state = 'recover';
          enemy.stateT = 0.9;
        }
      } else {
        enemy.vx *= Math.max(0, 1 - 4 * dt);
        enemy.vy *= Math.max(0, 1 - 4 * dt);
        if (enemy.stateT <= 0) {
          enemy.state = 'drift';
          enemy.stateT = random.range(1.4, 2.6);
        }
      }
    } else {
      // Eater: hunts the nearest mote and swallows it.
      let best = null;
      let bestD = Infinity;
      for (const mote of state.motes) {
        const d = dist2(enemy.x, enemy.y, mote.x, mote.y);
        if (d < bestD) {
          bestD = d;
          best = mote;
        }
      }
      if (best) {
        const d = Math.sqrt(bestD) || 1;
        enemy.vx = ((best.x - enemy.x) / d) * 74;
        enemy.vy = ((best.y - enemy.y) / d) * 74;
        if (d < enemy.r + best.r) {
          state.motes.splice(state.motes.indexOf(best), 1);
          enemy.r = Math.min(20, enemy.r + 0.6);
          spawnBurst(best.x, best.y, '#5cff8a', 6, 90);
        }
      } else {
        enemy.vx *= 0.98;
        enemy.vy *= 0.98;
      }
    }
    enemy.x += enemy.vx * dt;
    enemy.y += enemy.vy * dt;
    enemy.x = Math.min(FIELD.width - enemy.r, Math.max(enemy.r, enemy.x));
    enemy.y = Math.min(FIELD.height - enemy.r, Math.max(enemy.r, enemy.y));
  }

  function stepPlay(dt, ctl) {
    let events = 0;
    state.time += dt;
    state.comboT = Math.max(0, state.comboT - dt);
    if (state.comboT === 0) state.combo = 1;
    state.bannerT = Math.max(0, state.bannerT - dt);
    state.shakeT = Math.max(0, state.shakeT - dt);
    if (state.shakeT === 0) state.shake = 0;
    state.flash = Math.max(0, state.flash - dt * 2.2);

    // Light always burns a little: standing still is a slow loss.
    state.light -= LIGHT.drain * dt;
    if (state.light <= 0 && !state.over) events |= loseLife();

    // Waves.
    state.waveT += dt;
    if (state.waveT >= WAVE.duration) {
      state.waveT = 0;
      state.wave += 1;
      state.banner = `WAVE ${state.wave}`;
      state.bannerT = WAVE.bannerTime;
      events |= EVENT_WAVE;
    }

    events |= stepPlayer(dt, ctl);
    if (state.over) return events | EVENT_OVER;

    // Motes: spawn, drift, magnet, expire, collect.
    state.moteT -= dt;
    if (state.moteT <= 0) {
      spawnMoteCluster();
      state.moteT = SPAWN.moteInterval;
    }
    for (let i = state.motes.length - 1; i >= 0; i -= 1) {
      const mote = state.motes[i];
      mote.t += dt;
      mote.ttl -= dt;
      if (mote.ttl <= 0) {
        state.motes.splice(i, 1);
        continue;
      }
      const d2 = dist2(mote.x, mote.y, state.player.x, state.player.y);
      if (d2 < PLAYER.magnetRadius * PLAYER.magnetRadius) {
        const d = Math.sqrt(d2) || 1;
        const pull = 300 * (1 - d / PLAYER.magnetRadius);
        mote.x += ((state.player.x - mote.x) / d) * pull * dt;
        mote.y += ((state.player.y - mote.y) / d) * pull * dt;
      }
      if (d2 < (PLAYER.radius + mote.r + 4) * (PLAYER.radius + mote.r + 4)) {
        collectMote(mote);
        state.motes.splice(i, 1);
        events |= EVENT_PICKUP;
      }
    }

    // Enemies: spawn, move, touch. The swarm is capped, so a long night stays
    // readable (and the chase stays a pack, not an endless pile).
    const interval = Math.max(SPAWN.enemyMin, SPAWN.enemyBase - SPAWN.enemyPerWave * (state.wave - 1));
    state.enemyT -= dt;
    if (state.enemyT <= 0) {
      if (state.enemies.length < 20) spawnEnemy();
      state.enemyT = interval;
    }
    for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
      const enemy = state.enemies[i];
      stepEnemy(dt, enemy);
      if (state.player.invuln <= 0 && !state.over) {
        const rr = PLAYER.radius + enemy.r - 2;
        if (dist2(enemy.x, enemy.y, state.player.x, state.player.y) < rr * rr) {
          events |= hitPlayer(enemy);
          if (state.over) return events | EVENT_OVER;
        }
      }
    }

    // Enemies keep their distance from each other: a chase stays a pack, not a pile.
    for (let i = 0; i < state.enemies.length; i += 1) {
      for (let j = i + 1; j < state.enemies.length; j += 1) {
        const a = state.enemies[i];
        const b = state.enemies[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        const min = a.r + b.r + 2;
        if (d > 0 && d < min) {
          const push = (min - d) / 2;
          const nx = dx / d;
          const ny = dy / d;
          a.x -= nx * push;
          a.y -= ny * push;
          b.x += nx * push;
          b.y += ny * push;
        }
      }
    }

    // Power-ups: spawn, bob, collect.
    state.powerT -= dt;
    if (state.powerT <= 0) {
      spawnPower();
      state.powerT = SPAWN.powerInterval;
    }
    for (let i = state.powers.length - 1; i >= 0; i -= 1) {
      const power = state.powers[i];
      power.t += dt;
      power.ttl -= dt;
      if (power.ttl <= 0) {
        state.powers.splice(i, 1);
        continue;
      }
      const rr = PLAYER.radius + 14;
      if (dist2(power.x, power.y, state.player.x, state.player.y) < rr * rr) {
        if (power.kind === POWER_FLARE) clearEnemies();
        else state.player.shieldT = 8;
        spawnBurst(power.x, power.y, power.kind === POWER_FLARE ? '#ffd166' : '#7fe7dc', 18, 200);
        state.powers.splice(i, 1);
        events |= EVENT_POWER;
      }
    }

    // Particles.
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const pt = state.particles[i];
      pt.life -= dt;
      if (pt.life <= 0) {
        state.particles.splice(i, 1);
        continue;
      }
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= Math.max(0, 1 - 2.4 * dt);
      pt.vy *= Math.max(0, 1 - 2.4 * dt);
    }
    for (const dot of state.ambient) {
      dot.y -= dot.speed * dt;
      dot.phase += dt;
      if (dot.y < -4) {
        dot.y = FIELD.height + 4;
        dot.x = random.range(0, FIELD.width);
      }
    }
    return events;
  }

  function stepAttract(dt) {
    state.time += dt;
    const p = state.player;
    // A lazy wander: the firefly drifts in slow loops while the title shows.
    const tx = FIELD.width / 2 + Math.sin(state.time * 0.23) * 260;
    const ty = FIELD.height / 2 + Math.cos(state.time * 0.31) * 120;
    p.vx += ((tx - p.x) * 0.9 - p.vx) * Math.min(1, dt * 2);
    p.vy += ((ty - p.y) * 0.9 - p.vy) * Math.min(1, dt * 2);
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.flap += dt * 22;
    state.moteT -= dt;
    if (state.moteT <= 0) {
      spawnMoteCluster();
      state.moteT = SPAWN.moteInterval * 1.6;
    }
    for (let i = state.motes.length - 1; i >= 0; i -= 1) {
      const mote = state.motes[i];
      mote.t += dt;
      mote.ttl -= dt;
      if (mote.ttl <= 0) state.motes.splice(i, 1);
    }
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const pt = state.particles[i];
      pt.life -= dt;
      if (pt.life <= 0) state.particles.splice(i, 1);
    }
    for (const dot of state.ambient) {
      dot.y -= dot.speed * dt;
      dot.phase += dt;
      if (dot.y < -4) {
        dot.y = FIELD.height + 4;
        dot.x = random.range(0, FIELD.width);
      }
    }
    return 0;
  }

  function reset() {
    const kept = state;
    Object.assign(state, freshState());
    state.ambient = kept.ambient;
    spawnAmbient();
    spawnMoteCluster();
    spawnMoteCluster();
  }

  reset();

  return {
    state,
    reset,
    step(dt, ctl, attract) {
      if (state.over) return EVENT_OVER;
      return attract ? stepAttract(dt) : stepPlay(dt, ctl);
    },
  };
}
