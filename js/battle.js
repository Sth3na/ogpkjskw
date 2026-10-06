// Motor de combate. No dibuja nada: cada acción devuelve una lista de eventos
// que la pantalla (render.js) reproduce como animaciones.

class Battle {
  constructor(teams, ninjas, rules, rng) {
    this.rules = rules;
    this.rng = rng || Math.random;
    this.units = [];
    for (const side of ['player', 'enemy']) {
      teams[side].forEach((slot, i) => {
        const n = ninjas[slot.id];
        this.units.push({
          uid: side + i,
          id: slot.id,
          side,
          row: slot.row,
          col: slot.col,
          name: n.name,
          element: n.element,
          maxHp: n.hp,
          hp: n.hp,
          atk: n.atk,
          def: n.def,
          speed: n.speed,
          normal: n.normal,
          mystery: n.mystery,
          chase: n.chase,
          cooldown: 0,
          status: null,
          effects: [],
        });
      });
    }
    this.chakra = { player: rules.startChakra, enemy: rules.startChakra };
    this.round = 0;
    this.queue = [];
    this.over = false;
    this.winner = null;
  }

  unit(uid) {
    return this.units.find((u) => u.uid === uid);
  }

  alive(side) {
    return this.units.filter((u) => u.side === side && u.hp > 0);
  }

  foe(side) {
    return side === 'player' ? 'enemy' : 'player';
  }

  // Devuelve el ninja al que le toca actuar, empezando ronda si hace falta.
  // Los eventos de inicio de ronda se acumulan en pending y salen con la siguiente acción.
  nextActor() {
    if (this.over) return null;
    while (this.queue.length && this.queue[0].hp <= 0) this.queue.shift();
    if (!this.queue.length) this.startRound();
    return this.over ? null : this.queue[0];
  }

  startRound() {
    this.round++;
    this.pending = this.pending || [];
    if (this.round > this.rules.maxRounds) {
      // Si se acaba el tiempo, gana el defensor.
      this.finish('enemy');
      this.pending.push({ type: 'end', winner: 'enemy', reason: 'Se acabaron las rondas' });
      return;
    }
    if (this.round > 1) {
      for (const side of ['player', 'enemy']) this.addChakra(side, this.rules.chakraPerRound);
    }
    this.queue = this.units
      .filter((u) => u.hp > 0)
      .sort((a, b) => b.speed - a.speed || (a.side === 'player' ? -1 : 1));
    this.pending.push({ type: 'round', round: this.round, chakra: { ...this.chakra } });
  }

  addChakra(side, amount) {
    this.chakra[side] = Math.max(0, Math.min(this.rules.maxChakra, this.chakra[side] + amount));
  }

  canUseMystery(u) {
    const m = u.mystery;
    return !!m && u.cooldown === 0 && this.chakra[u.side] >= m.chakra;
  }

  // Elige objetivos según el tipo de ataque.
  targetsFor(u, skill) {
    if (skill.target === 'allies') return this.alive(u.side);
    const foes = this.alive(this.foe(u.side));
    if (!foes.length) return [];
    if (skill.target === 'all') return foes;
    if (skill.target === 'column') {
      const front = Math.min(...foes.map((f) => f.col));
      return foes.filter((f) => f.col === front);
    }
    const main = this.frontTarget(u, foes);
    if (skill.target === 'row') return foes.filter((f) => f.row === main.row);
    return [main];
  }

  // Enemigo más adelantado en la misma fila; si no hay, en la fila más cercana.
  frontTarget(u, foes) {
    return foes
      .slice()
      .sort((a, b) => Math.abs(a.row - u.row) - Math.abs(b.row - u.row) || a.col - b.col || a.row - b.row)[0];
  }

  damage(attacker, target, mult) {
    const base = attacker.atk * mult * (1 - target.def / (target.def + 400));
    const variance = 0.95 + this.rng() * 0.1;
    const crit = this.rng() < this.rules.critChance;
    const amount = Math.max(1, Math.round(base * variance * (crit ? this.rules.critMult : 1)));
    target.hp = Math.max(0, target.hp - amount);
    return { amount, crit };
  }

  hit(events, attacker, target, skill) {
    const { amount, crit } = this.damage(attacker, target, skill.mult);
    events.push({ type: 'damage', target: target.uid, amount, crit, hp: target.hp });
    if (target.hp <= 0) {
      target.status = null;
      events.push({ type: 'death', target: target.uid });
      return;
    }
    if (skill.applies) {
      target.status = skill.applies;
      events.push({ type: 'status', target: target.uid, status: skill.applies });
    }
    const eff = skill.effect;
    if (eff && this.rng() < eff.chance) {
      target.effects = target.effects.filter((e) => e.type !== eff.type);
      target.effects.push({ type: eff.type, turns: eff.turns, dmg: Math.round(attacker.atk * (eff.power || 0)) });
      events.push({ type: 'effect', target: target.uid, effect: eff.type, turns: eff.turns });
    }
  }

  // Ejecuta el turno del ninja actual. choice: 'mystery', 'normal' o null (automático).
  act(choice) {
    const u = this.nextActor();
    const events = this.pending || [];
    this.pending = [];
    if (!u) return events;
    this.queue.shift();

    events.push({ type: 'turn', actor: u.uid });
    if (u.cooldown > 0) u.cooldown--;

    // Efectos al inicio del turno.
    for (const e of u.effects) {
      if (e.type === 'burn' || e.type === 'poison') {
        u.hp = Math.max(0, u.hp - e.dmg);
        events.push({ type: 'dot', target: u.uid, effect: e.type, amount: e.dmg, hp: u.hp });
      }
    }
    const immobile = u.effects.some((e) => e.type === 'immobile');
    u.effects = u.effects.map((e) => ({ ...e, turns: e.turns - 1 })).filter((e) => e.turns > 0);
    if (u.hp <= 0) {
      events.push({ type: 'death', target: u.uid });
      this.checkEnd(events);
      return events;
    }
    if (immobile) {
      events.push({ type: 'skip', actor: u.uid, reason: 'Inmovilizado' });
      return events;
    }

    const useMystery = choice === 'normal' ? false : this.canUseMystery(u);
    const skill = useMystery ? u.mystery : u.normal;
    const targets = this.targetsFor(u, skill);
    if (useMystery) {
      this.addChakra(u.side, -skill.chakra);
      u.cooldown = skill.cooldown;
    }
    events.push({
      type: 'skill',
      actor: u.uid,
      name: skill.name,
      kind: useMystery ? 'mystery' : 'normal',
      targets: targets.map((t) => t.uid),
      chakra: { ...this.chakra },
    });

    if (skill.heal) {
      for (const t of targets) {
        const amount = Math.round(u.atk * skill.mult);
        t.hp = Math.min(t.maxHp, t.hp + amount);
        events.push({ type: 'heal', target: t.uid, amount, hp: t.hp });
      }
    } else {
      for (const t of targets) this.hit(events, u, t, skill);
      if (!useMystery) {
        this.addChakra(u.side, this.rules.chakraPerHit);
        events.push({ type: 'chakra', chakra: { ...this.chakra } });
      }
      this.runChases(events, u);
    }
    this.checkEnd(events);
    return events;
  }

  // Persecuciones: un aliado cuya persecución reacciona al estado del enemigo
  // la encadena. Cada ninja persigue como mucho una vez por cadena.
  runChases(events, starter) {
    const used = new Set([starter.uid]);
    let combo = 0;
    for (;;) {
      const foes = this.alive(this.foe(starter.side));
      const chaser = this.alive(starter.side)
        .filter((a) => !used.has(a.uid) && a.chase && !a.effects.some((e) => e.type === 'immobile'))
        .sort((a, b) => b.speed - a.speed)
        .find((a) => foes.some((f) => f.status === a.chase.trigger));
      if (!chaser) break;
      const target = foes.find((f) => f.status === chaser.chase.trigger);
      used.add(chaser.uid);
      combo++;
      target.status = null;
      events.push({
        type: 'chase',
        actor: chaser.uid,
        name: chaser.chase.name,
        trigger: chaser.chase.trigger,
        target: target.uid,
        combo,
      });
      this.hit(events, chaser, target, chaser.chase);
    }
    // Los estados de control duran solo hasta el final de la cadena.
    for (const f of this.units) {
      if (f.status) {
        f.status = null;
        events.push({ type: 'status', target: f.uid, status: null });
      }
    }
  }

  checkEnd(events) {
    if (this.over) return;
    if (!this.alive('enemy').length) this.finish('player');
    else if (!this.alive('player').length) this.finish('enemy');
    if (this.over) events.push({ type: 'end', winner: this.winner });
  }

  finish(winner) {
    this.over = true;
    this.winner = winner;
  }
}

if (typeof module !== 'undefined') module.exports = { Battle };
