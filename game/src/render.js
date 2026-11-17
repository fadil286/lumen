// The renderer: one canvas, one logical field (960x540) letterboxed into the
// window. Everything is drawn from state alone, so a staged state and a played
// state paint exactly the same way. Shake is a function of time, never of
// Math.random, so a screenshot is the same frame every time.
import { COLORS, FIELD, PLAYER } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function glowCircle(ctx, x, y, radius, color, alpha) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let view = { scale: 1, ox: 0, oy: 0, w: 0, h: 0, dpr: 1 };
  let bgGrad = null;
  let vigGrad = null;

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = canvas.clientWidth || FIELD.width;
    const ch = canvas.clientHeight || FIELD.height;
    if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) {
      canvas.width = Math.round(cw * dpr);
      canvas.height = Math.round(ch * dpr);
    }
    const scale = Math.min(cw / FIELD.width, ch / FIELD.height);
    view = {
      scale,
      ox: (cw - FIELD.width * scale) / 2,
      oy: (ch - FIELD.height * scale) / 2,
      w: cw,
      h: ch,
      dpr,
    };
    bgGrad = ctx.createLinearGradient(0, 0, 0, ch);
    bgGrad.addColorStop(0, COLORS.bgTop);
    bgGrad.addColorStop(1, COLORS.bgBottom);
    vigGrad = ctx.createRadialGradient(
      cw / 2, ch / 2, Math.min(cw, ch) * 0.42,
      cw / 2, ch / 2, Math.max(cw, ch) * 0.75,
    );
    vigGrad.addColorStop(0, 'rgba(0,0,0,0)');
    vigGrad.addColorStop(1, 'rgba(4,6,18,0.55)');
  }

  function toLogical(cx, cy) {
    return { x: (cx - view.ox) / view.scale, y: (cy - view.oy) / view.scale };
  }

  function drawBackground(state) {
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, view.w, view.h);
    for (const dot of state.ambient) {
      const tw = 0.3 + 0.3 * Math.sin(dot.phase * 2);
      ctx.globalAlpha = tw;
      ctx.fillStyle = COLORS.star;
      ctx.beginPath();
      ctx.arc(dot.x, dot.y, dot.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawMote(mote) {
    const pulse = 1 + 0.18 * Math.sin(mote.t * 4);
    glowCircle(ctx, mote.x, mote.y, mote.r * 4.2 * pulse, COLORS.gold, 0.5);
    ctx.fillStyle = COLORS.goldSoft;
    ctx.beginPath();
    ctx.arc(mote.x, mote.y, mote.r * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff8dd';
    ctx.beginPath();
    ctx.arc(mote.x, mote.y, mote.r * 0.45 * pulse, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPower(power) {
    const bob = Math.sin(power.t * 2.4) * 4;
    const y = power.y + bob;
    const blink = power.ttl < 3 ? 0.45 + 0.55 * Math.abs(Math.sin(power.t * 6)) : 1;
    ctx.globalAlpha = blink;
    if (power.kind === 'flare') {
      glowCircle(ctx, power.x, y, 34, COLORS.gold, 0.6);
      ctx.fillStyle = COLORS.gold;
      ctx.beginPath();
      for (let i = 0; i < 8; i += 1) {
        const ang = (i * Math.PI) / 4 + power.t * 0.6;
        const r = i % 2 === 0 ? 14 : 5;
        const px = power.x + Math.cos(ang) * r;
        const py = y + Math.sin(ang) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    } else {
      glowCircle(ctx, power.x, y, 30, COLORS.cyan, 0.5);
      ctx.strokeStyle = COLORS.cyan;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(power.x, y, 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = COLORS.cyan;
      ctx.beginPath();
      ctx.arc(power.x, y, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawEnemy(enemy, state) {
    if (enemy.kind === 'wisp') {
      // Trailing tail.
      for (let i = 3; i >= 1; i -= 1) {
        ctx.globalAlpha = 0.14 * (4 - i);
        ctx.fillStyle = COLORS.wispRim;
        ctx.beginPath();
        ctx.arc(enemy.x - enemy.vx * 0.03 * i, enemy.y - enemy.vy * 0.03 * i, enemy.r * (1 - i * 0.18), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = COLORS.wisp;
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, enemy.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = COLORS.wispRim;
      ctx.lineWidth = 2;
      ctx.stroke();
      // Two red eyes, looking at the player.
      const ang = Math.atan2(state.player.y - enemy.y, state.player.x - enemy.x);
      const ex = Math.cos(ang);
      const ey = Math.sin(ang);
      ctx.fillStyle = '#ff5c5c';
      ctx.beginPath();
      ctx.arc(enemy.x + ex * 4 - ey * 4.5, enemy.y + ey * 4 + ex * 4.5, 2.4, 0, Math.PI * 2);
      ctx.arc(enemy.x + ex * 4 + ey * 4.5, enemy.y + ey * 4 - ex * 4.5, 2.4, 0, Math.PI * 2);
      ctx.fill();
    } else if (enemy.kind === 'darter') {
      const flash = enemy.state === 'aim' ? 0.5 + 0.5 * Math.sin(enemy.t * 22) : 0;
      ctx.save();
      ctx.translate(enemy.x, enemy.y);
      ctx.rotate(Math.atan2(enemy.vy, enemy.vx) + Math.PI / 4);
      ctx.fillStyle = COLORS.darter;
      ctx.fillRect(-enemy.r * 0.8, -enemy.r * 0.8, enemy.r * 1.6, enemy.r * 1.6);
      ctx.strokeStyle = COLORS.darterRim;
      ctx.lineWidth = 2;
      ctx.strokeRect(-enemy.r * 0.8, -enemy.r * 0.8, enemy.r * 1.6, enemy.r * 1.6);
      ctx.restore();
      if (flash > 0) {
        ctx.globalAlpha = flash * 0.7;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, enemy.r + 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    } else {
      // Eater: a green blob with a mouth that opens and closes.
      const open = 0.4 + 0.35 * Math.sin(enemy.t * 5);
      ctx.fillStyle = COLORS.eater;
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, enemy.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = COLORS.eaterRim;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#0b1026';
      ctx.beginPath();
      ctx.moveTo(enemy.x, enemy.y);
      ctx.arc(enemy.x, enemy.y, enemy.r * 0.72, -open, open);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawPlayer(state) {
    const p = state.player;
    const blink = p.invuln > 0 ? 0.55 + 0.45 * Math.sin(state.time * 22) : 1;
    const lightFrac = Math.max(0, state.light / 100);
    ctx.globalAlpha = blink;
    // Halo: brighter when the firefly is full of light.
    glowCircle(ctx, p.x, p.y, 58, COLORS.gold, 0.4 + 0.3 * lightFrac);
    // Wings, flapping.
    const flap = Math.sin(p.flap) * 0.55;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.face);
    ctx.fillStyle = 'rgba(255, 233, 168, 0.75)';
    ctx.beginPath();
    ctx.ellipse(-2, -8, 9, 4.5, -0.5 - flap * 0.4, 0, Math.PI * 2);
    ctx.ellipse(-2, 8, 9, 4.5, 0.5 + flap * 0.4, 0, Math.PI * 2);
    ctx.fill();
    // Body: dark shell, bright core.
    ctx.fillStyle = '#3a2a08';
    ctx.beginPath();
    ctx.arc(0, 0, PLAYER.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath();
    ctx.arc(2, 0, PLAYER.radius * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Shield ring.
    if (p.shieldT > 0) {
      ctx.strokeStyle = COLORS.cyan;
      ctx.globalAlpha = 0.75 * blink;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, PLAYER.radius + 9 + Math.sin(state.time * 6) * 1.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.globalAlpha = 1;
  }

  function drawParticles(state) {
    for (const pt of state.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.max);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawHud(state, best, muted) {
    ctx.textBaseline = 'alphabetic';
    // Score, top left.
    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.textDim;
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillText('SCORE', 20, 30);
    ctx.fillStyle = COLORS.text;
    ctx.font = '800 34px system-ui, sans-serif';
    ctx.fillText(String(state.score), 20, 64);
    // Combo under the score.
    if (state.combo > 1) {
      ctx.fillStyle = COLORS.gold;
      ctx.font = '800 20px system-ui, sans-serif';
      ctx.fillText(`COMBO x${state.combo}`, 20, 92);
      ctx.fillStyle = 'rgba(255,209,102,0.35)';
      ctx.fillRect(20, 100, 110, 5);
      ctx.fillStyle = COLORS.gold;
      ctx.fillRect(20, 100, 110 * (state.comboT / 2.5), 5);
    }
    // Wave, top centre.
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.textDim;
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillText('WAVE', FIELD.width / 2, 30);
    ctx.fillStyle = COLORS.text;
    ctx.font = '800 26px system-ui, sans-serif';
    ctx.fillText(String(state.wave), FIELD.width / 2, 58);
    // Lives + sound, top right.
    ctx.textAlign = 'right';
    for (let i = 0; i < 3; i += 1) {
      const x = FIELD.width - 26 - i * 26;
      const alive = i < state.lives;
      if (alive) glowCircle(ctx, x, 26, 12, COLORS.gold, 0.55);
      ctx.fillStyle = alive ? COLORS.goldSoft : 'rgba(170,179,214,0.35)';
      ctx.beginPath();
      ctx.arc(x, 26, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = COLORS.textDim;
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.fillText(muted ? 'M: SOUND OFF' : 'M: SOUND ON', FIELD.width - 16, 58);
    // Light bar, bottom centre.
    const barW = 420;
    const barX = (FIELD.width - barW) / 2;
    const barY = FIELD.height - 34;
    const frac = Math.max(0, state.light / 100);
    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.textDim;
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillText('LIGHT', barX, barY - 8);
    ctx.fillStyle = 'rgba(11,16,38,0.7)';
    roundRectPath(ctx, barX, barY, barW, 14, 7);
    ctx.fill();
    const grad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
    grad.addColorStop(0, '#ff5c5c');
    grad.addColorStop(0.45, COLORS.gold);
    grad.addColorStop(1, COLORS.goldSoft);
    ctx.fillStyle = grad;
    if (frac > 0.02) {
      roundRectPath(ctx, barX, barY, Math.max(14, barW * frac), 14, 7);
      ctx.fill();
    }
    // Dash pip: a small bar that fills as the dash recharges.
    const dashFrac = 1 - state.player.dashCd / 0.9;
    ctx.fillStyle = 'rgba(255,233,168,0.35)';
    ctx.fillRect(barX, barY + 20, barW, 3);
    ctx.fillStyle = COLORS.goldSoft;
    ctx.fillRect(barX, barY + 20, barW * Math.max(0, Math.min(1, dashFrac)), 3);
    ctx.textAlign = 'right';
    ctx.fillStyle = COLORS.textDim;
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.fillText('SPACE / CLICK: DASH', barX + barW, barY - 8);
  }

  function drawBanner(state) {
    if (state.bannerT <= 0 || !state.banner) return;
    const a = Math.min(1, state.bannerT / 0.6);
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.goldSoft;
    ctx.font = '800 44px system-ui, sans-serif';
    ctx.fillText(state.banner, FIELD.width / 2, 150);
    ctx.globalAlpha = 1;
  }

  function drawTitle(state, best) {
    ctx.fillStyle = 'rgba(11, 16, 38, 0.45)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.save();
    ctx.shadowColor = COLORS.gold;
    ctx.shadowBlur = 34;
    ctx.fillStyle = COLORS.goldSoft;
    ctx.font = '800 104px system-ui, sans-serif';
    ctx.fillText('LUMEN', FIELD.width / 2, 190);
    ctx.restore();
    ctx.fillStyle = COLORS.text;
    ctx.font = '500 21px system-ui, sans-serif';
    ctx.fillText('a firefly\u2019s light is its life', FIELD.width / 2, 228);
    ctx.fillStyle = COLORS.textDim;
    ctx.font = '400 17px system-ui, sans-serif';
    ctx.fillText('Move: mouse or WASD  \u00b7  Dash: Space or click (costs light)', FIELD.width / 2, 292);
    ctx.fillText('Collect golden motes to feed your light  \u00b7  Dodge the dark', FIELD.width / 2, 318);
    ctx.fillText('Wisps chase  \u00b7  Darters lunge  \u00b7  Eaters steal your motes', FIELD.width / 2, 344);
    if (best > 0) {
      ctx.fillStyle = COLORS.gold;
      ctx.font = '700 19px system-ui, sans-serif';
      ctx.fillText(`BEST  ${best}`, FIELD.width / 2, 388);
    }
    const blink = 0.55 + 0.45 * Math.sin(state.time * 3.2);
    ctx.globalAlpha = blink;
    ctx.fillStyle = COLORS.text;
    ctx.font = '700 22px system-ui, sans-serif';
    ctx.fillText('PRESS SPACE OR CLICK TO START', FIELD.width / 2, 448);
    ctx.globalAlpha = 1;
  }

  function drawPaused() {
    ctx.fillStyle = 'rgba(11, 16, 38, 0.6)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.text;
    ctx.font = '800 56px system-ui, sans-serif';
    ctx.fillText('PAUSED', FIELD.width / 2, 260);
    ctx.fillStyle = COLORS.textDim;
    ctx.font = '400 18px system-ui, sans-serif';
    ctx.fillText('Press P to resume', FIELD.width / 2, 300);
  }

  function drawOver(state, best) {
    ctx.fillStyle = 'rgba(11, 16, 38, 0.55)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    const pw = 460;
    const ph = 250;
    const px = (FIELD.width - pw) / 2;
    const py = (FIELD.height - ph) / 2 - 10;
    ctx.fillStyle = COLORS.panel;
    roundRectPath(ctx, px, py, pw, ph, 20);
    ctx.fill();
    ctx.strokeStyle = COLORS.panelEdge;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.goldSoft;
    ctx.font = '800 40px system-ui, sans-serif';
    ctx.fillText('THE LIGHT FADES', FIELD.width / 2, py + 62);
    ctx.fillStyle = COLORS.text;
    ctx.font = '800 30px system-ui, sans-serif';
    ctx.fillText(`SCORE  ${state.score}`, FIELD.width / 2, py + 118);
    ctx.fillStyle = COLORS.textDim;
    ctx.font = '500 18px system-ui, sans-serif';
    ctx.fillText(`BEST  ${best}`, FIELD.width / 2, py + 152);
    if (state.score > 0 && state.score >= best) {
      ctx.fillStyle = COLORS.gold;
      ctx.font = '700 17px system-ui, sans-serif';
      ctx.fillText('NEW BEST!', FIELD.width / 2, py + 180);
    }
    // The restart prompt does not blink: time is frozen on this screen, so a
    // blink would freeze at an arbitrary dimness.
    ctx.fillStyle = COLORS.text;
    ctx.font = '700 19px system-ui, sans-serif';
    ctx.fillText('PRESS SPACE OR CLICK TO PLAY AGAIN', FIELD.width / 2, py + 222);
  }

  return {
    toLogical,
    draw(state, screen, best, viewOpts) {
      resize();
      ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
      // Shake: a function of time, so the frame is reproducible.
      const shx = state.shake > 0 ? Math.sin(state.time * 127.1) * state.shake : 0;
      const shy = state.shake > 0 ? Math.cos(state.time * 311.7) * state.shake : 0;
      ctx.save();
      ctx.translate(view.ox + shx * view.scale, view.oy + shy * view.scale);
      ctx.scale(view.scale, view.scale);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, FIELD.width, FIELD.height);
      ctx.clip();
      drawBackground(state);
      for (const mote of state.motes) drawMote(mote);
      for (const power of state.powers) drawPower(power);
      for (const enemy of state.enemies) drawEnemy(enemy, state);
      if (screen !== SCREEN_TITLE) drawPlayer(state);
      else drawPlayer(state);
      drawParticles(state);
      if (state.flash > 0) {
        ctx.fillStyle = `rgba(255, 244, 200, ${state.flash * 0.5})`;
        ctx.fillRect(0, 0, FIELD.width, FIELD.height);
      }
      drawBanner(state);
      if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) drawHud(state, best, viewOpts.muted);
      if (screen === SCREEN_TITLE) drawTitle(state, best);
      else if (screen === SCREEN_PAUSED) drawPaused();
      else if (screen === SCREEN_OVER) drawOver(state, best);
      ctx.restore();
      // Vignette over the whole field.
      ctx.fillStyle = vigGrad;
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
      ctx.restore();
    },
  };
}
