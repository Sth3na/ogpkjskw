// Pantalla de combate en Canvas. Dibuja el estado de la batalla y reproduce
// los eventos del motor como animaciones.

const W = 960;
const H = 540;
const BOX_W = 84;
const BOX_H = 104;

// Posición en pantalla de una casilla 3x3. col 0 es la fila delantera.
function slotPosition(side, row, col) {
  const x = 380 - col * 105 + row * 18;
  const y = 175 + row * 120;
  return { x: side === 'player' ? x : W - x, y };
}

class BattleView {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.speed = 1;
    this.floaters = [];
    this.banner = null;
    this.views = {};
    this.active = null;
    this.battle = null;
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.frame(t));
  }

  setBattle(battle) {
    this.battle = battle;
    this.views = {};
    this.floaters = [];
    this.banner = null;
    this.active = null;
    this.chakra = { ...battle.chakra };
    this.round = 0;
    for (const u of battle.units) {
      const p = slotPosition(u.side, u.row, u.col);
      this.views[u.uid] = {
        home: p, x: p.x, y: p.y, tx: p.x, ty: p.y,
        hp: u.hp, shownHp: u.hp, alpha: 1, dead: false,
        flash: 0, status: null, pose: 'idle',
      };
    }
  }

  wait(ms) {
    return new Promise((r) => setTimeout(r, ms / this.speed));
  }

  float(uid, text, color, size) {
    const v = this.views[uid];
    this.floaters.push({ x: v.x + (Math.random() * 30 - 15), y: v.y - 40, text, color, size: size || 22, life: 1 });
  }

  showBanner(text, color, big) {
    this.banner = { text, color: color || '#fff', big: !!big, life: 1 };
  }

  moveTo(uid, targetUid) {
    const v = this.views[uid];
    const t = this.views[targetUid];
    const dir = this.battle.unit(uid).side === 'player' ? -1 : 1;
    v.tx = t.home.x + dir * 70;
    v.ty = t.home.y;
    v.pose = 'attack';
  }

  goHome(uid) {
    const v = this.views[uid];
    if (!v) return;
    v.tx = v.home.x;
    v.ty = v.home.y;
    v.pose = 'idle';
  }

  async play(events) {
    let mover = null;
    const back = () => {
      if (mover) this.goHome(mover);
      mover = null;
    };
    const b = this.battle;
    for (const e of events) {
      // Si se reinició el combate a mitad de animación, se deja de reproducir.
      if (this.battle !== b) return;
      switch (e.type) {
        case 'round':
          this.round = e.round;
          this.chakra = { ...e.chakra };
          this.showBanner(`Ronda ${e.round}`, '#ffd166', true);
          await this.wait(700);
          break;
        case 'turn':
          back();
          this.active = e.actor;
          await this.wait(150);
          break;
        case 'skill': {
          back();
          const u = this.battle.unit(e.actor);
          this.chakra = { ...e.chakra };
          if (e.kind === 'mystery') {
            this.showBanner(e.name, ELEMENT_COLORS[u.element], true);
            Assets.play('sfx/jutsu');
            await this.wait(550);
          }
          if (e.targets.length && u.side !== this.battle.unit(e.targets[0]).side) {
            mover = e.actor;
            this.moveTo(e.actor, e.targets[0]);
            await this.wait(260);
            Assets.play('sfx/hit');
          }
          break;
        }
        case 'chase':
          back();
          this.showBanner(`Persecución: ${this.battle.unit(e.actor).name} · ${e.name} · Combo ${e.combo}`, '#7fdbff');
          mover = e.actor;
          this.moveTo(e.actor, e.target);
          Assets.play('sfx/chase');
          await this.wait(320);
          break;
        case 'damage':
          this.views[e.target].hp = e.hp;
          this.views[e.target].flash = 1;
          this.float(e.target, (e.crit ? '¡Crítico! ' : '') + '-' + e.amount, e.crit ? '#ffd166' : '#ff6b6b', e.crit ? 28 : 22);
          await this.wait(140);
          break;
        case 'dot':
          this.views[e.target].hp = e.hp;
          this.views[e.target].flash = 1;
          this.float(e.target, `${EFFECT_NAMES[e.effect]} -${e.amount}`, '#ff9f43');
          await this.wait(350);
          break;
        case 'heal':
          this.views[e.target].hp = e.hp;
          this.float(e.target, '+' + e.amount, '#5ee08a');
          Assets.play('sfx/heal');
          await this.wait(120);
          break;
        case 'status':
          this.views[e.target].status = e.status;
          if (e.status) this.float(e.target, STATUS_NAMES[e.status], '#7fdbff', 18);
          break;
        case 'effect':
          this.float(e.target, EFFECT_NAMES[e.effect], '#c792ea', 18);
          break;
        case 'skip':
          this.float(e.actor, e.reason, '#c792ea');
          await this.wait(400);
          break;
        case 'chakra':
          this.chakra = { ...e.chakra };
          break;
        case 'death':
          this.views[e.target].dead = true;
          Assets.play('sfx/death');
          await this.wait(250);
          break;
        case 'end':
          back();
          this.active = null;
          this.showBanner(e.winner === 'player' ? '¡Victoria!' : 'Derrota', e.winner === 'player' ? '#ffd166' : '#ff6b6b', true);
          this.banner.life = 1e9;
          Assets.play(e.winner === 'player' ? 'sfx/victory' : 'sfx/defeat');
          break;
      }
    }
    await this.wait(250);
    back();
    await this.wait(200);
  }

  frame(time) {
    const dt = Math.min(0.05, (time - this.lastTime) / 1000) * this.speed;
    this.lastTime = time;
    this.update(dt);
    this.draw();
    requestAnimationFrame((t) => this.frame(t));
  }

  update(dt) {
    const k = 1 - Math.pow(0.0001, dt);
    for (const v of Object.values(this.views)) {
      v.x += (v.tx - v.x) * k;
      v.y += (v.ty - v.y) * k;
      v.shownHp += (v.hp - v.shownHp) * k;
      v.flash = Math.max(0, v.flash - dt * 4);
      if (v.dead) v.alpha = Math.max(0, v.alpha - dt * 1.5);
    }
    for (const f of this.floaters) {
      f.y -= 40 * dt;
      f.life -= dt * 0.9;
    }
    this.floaters = this.floaters.filter((f) => f.life > 0);
    if (this.banner) {
      this.banner.life -= dt * 0.8;
      if (this.banner.life <= 0) this.banner = null;
    }
  }

  draw() {
    const c = this.ctx;
    const bg = Assets.image('bg/battle');
    if (bg) {
      c.drawImage(bg, 0, 0, W, H);
    } else {
      const g = c.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#2b3a55');
      g.addColorStop(0.55, '#3f5a4a');
      g.addColorStop(1, '#2a3a2e');
      c.fillStyle = g;
      c.fillRect(0, 0, W, H);
      c.strokeStyle = 'rgba(255,255,255,0.06)';
      for (let i = 0; i < 12; i++) {
        c.beginPath();
        c.moveTo(0, 120 + i * 40);
        c.lineTo(W, 120 + i * 40);
        c.stroke();
      }
    }
    if (!this.battle) return;

    this.drawGrid('player');
    this.drawGrid('enemy');
    const order = this.battle.units.slice().sort((a, b) => this.views[a.uid].y - this.views[b.uid].y);
    for (const u of order) this.drawUnit(u);
    this.drawHud();
    for (const f of this.floaters) {
      c.globalAlpha = Math.min(1, f.life * 2);
      c.font = `bold ${f.size}px system-ui, sans-serif`;
      c.textAlign = 'center';
      c.lineWidth = 4;
      c.strokeStyle = '#000';
      c.strokeText(f.text, f.x, f.y);
      c.fillStyle = f.color;
      c.fillText(f.text, f.x, f.y);
      c.globalAlpha = 1;
    }
    if (this.banner) {
      const b = this.banner;
      c.globalAlpha = Math.min(1, b.life * 3);
      c.fillStyle = 'rgba(0,0,0,0.55)';
      const bh = b.big ? 64 : 40;
      c.fillRect(0, H / 2 - bh / 2 - 60, W, bh);
      c.font = `bold ${b.big ? 40 : 22}px system-ui, sans-serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillStyle = b.color;
      c.fillText(b.text, W / 2, H / 2 - 60);
      c.textBaseline = 'alphabetic';
      c.globalAlpha = 1;
    }
  }

  drawGrid(side) {
    const c = this.ctx;
    c.fillStyle = 'rgba(0,0,0,0.18)';
    for (let r = 0; r < 3; r++) {
      for (let col = 0; col < 3; col++) {
        const p = slotPosition(side, r, col);
        c.beginPath();
        c.ellipse(p.x, p.y + BOX_H / 2 - 6, 38, 12, 0, 0, Math.PI * 2);
        c.fill();
      }
    }
  }

  drawUnit(u) {
    const c = this.ctx;
    const v = this.views[u.uid];
    if (v.alpha <= 0) return;
    c.globalAlpha = v.alpha;
    const left = v.x - BOX_W / 2;
    const top = v.y - BOX_H / 2;

    if (this.active === u.uid && !v.dead) {
      c.fillStyle = '#ffd166';
      c.beginPath();
      c.moveTo(v.x - 10, top - 34);
      c.lineTo(v.x + 10, top - 34);
      c.lineTo(v.x, top - 22);
      c.fill();
    }

    const img = Assets.image(`ninjas/${u.id}/${v.pose}`) || Assets.image(`ninjas/${u.id}/idle`);
    if (img) {
      const s = Math.min((BOX_W + 30) / img.width, (BOX_H + 20) / img.height);
      const w = img.width * s;
      const h = img.height * s;
      c.save();
      c.translate(v.x, top + BOX_H);
      if (u.side === 'enemy') c.scale(-1, 1);
      c.drawImage(img, -w / 2, -h, w, h);
      c.restore();
    } else {
      c.fillStyle = ELEMENT_COLORS[u.element] || ELEMENT_COLORS.ninguno;
      roundRect(c, left, top, BOX_W, BOX_H, 10);
      c.fill();
      c.strokeStyle = u.side === 'player' ? '#9fd3ff' : '#ff9f9f';
      c.lineWidth = 3;
      c.stroke();
      c.fillStyle = '#fff';
      c.textAlign = 'center';
      c.font = 'bold 17px system-ui, sans-serif';
      c.fillText(u.name.split(' ')[0], v.x, top + 48);
      c.font = '11px system-ui, sans-serif';
      c.fillText('(sin imagen)', v.x, top + 70);
    }
    if (v.flash > 0) {
      c.fillStyle = `rgba(255,255,255,${v.flash * 0.6})`;
      roundRect(c, left, top, BOX_W, BOX_H, 10);
      c.fill();
    }

    // Barra de vida.
    const bw = BOX_W;
    const by = top - 14;
    c.fillStyle = 'rgba(0,0,0,0.7)';
    c.fillRect(left, by, bw, 8);
    c.fillStyle = u.side === 'player' ? '#5ee08a' : '#ff6b6b';
    c.fillRect(left + 1, by + 1, (bw - 2) * (v.shownHp / u.maxHp), 6);

    // Jutsu listo.
    if (u.mystery && u.cooldown === 0 && !v.dead) {
      c.fillStyle = '#7fdbff';
      c.beginPath();
      c.arc(left + bw + 6, by + 4, 4, 0, Math.PI * 2);
      c.fill();
    }

    if (v.status) {
      c.font = 'bold 12px system-ui, sans-serif';
      c.textAlign = 'center';
      c.fillStyle = '#7fdbff';
      c.fillText(STATUS_NAMES[v.status], v.x, top + BOX_H + 16);
    }
    if (u.effects.length && !v.dead) {
      c.font = '11px system-ui, sans-serif';
      c.textAlign = 'center';
      c.fillStyle = '#c792ea';
      c.fillText(u.effects.map((e) => EFFECT_NAMES[e.type]).join(', '), v.x, by - 5);
    }
    c.globalAlpha = 1;
  }

  drawHud() {
    const c = this.ctx;
    const max = this.battle.rules.maxChakra;
    const bar = (x, label, value, alignRight) => {
      c.fillStyle = 'rgba(0,0,0,0.6)';
      c.fillRect(x, 16, 300, 22);
      c.fillStyle = '#3fa9f5';
      const w = 296 * (value / max);
      c.fillRect(alignRight ? x + 298 - w : x + 2, 18, w, 18);
      c.fillStyle = '#fff';
      c.font = 'bold 13px system-ui, sans-serif';
      c.textAlign = alignRight ? 'right' : 'left';
      c.fillText(`${label}  Chakra ${value}/${max}`, alignRight ? x + 292 : x + 8, 32);
    };
    bar(20, 'Konoha', this.chakra.player, false);
    bar(W - 320, 'Akatsuki', this.chakra.enemy, true);
    c.fillStyle = '#fff';
    c.textAlign = 'center';
    c.font = 'bold 18px system-ui, sans-serif';
    c.fillText(`Ronda ${this.round}/${this.battle.rules.maxRounds}`, W / 2, 33);

    // Orden de turnos.
    const next = this.battle.queue.filter((u) => u.hp > 0).slice(0, 8);
    next.forEach((u, i) => {
      const x = W / 2 - (next.length - 1) * 17 + i * 34;
      const img = Assets.image(`ninjas/${u.id}/portrait`);
      c.save();
      c.beginPath();
      c.arc(x, 62, 14, 0, Math.PI * 2);
      c.fillStyle = ELEMENT_COLORS[u.element];
      c.fill();
      c.clip();
      if (img) c.drawImage(img, x - 14, 48, 28, 28);
      else {
        c.fillStyle = '#fff';
        c.font = 'bold 10px system-ui, sans-serif';
        c.fillText(shortName(u.name), x, 66);
      }
      c.restore();
      c.strokeStyle = u.side === 'player' ? '#9fd3ff' : '#ff9f9f';
      c.lineWidth = 2;
      c.beginPath();
      c.arc(x, 62, 14, 0, Math.PI * 2);
      c.stroke();
    });
  }
}

function shortName(name) {
  return name.slice(0, 3);
}

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
