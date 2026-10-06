// Prueba rápida del motor: node tests/battle.test.js
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ctx = { module: undefined, console };
vm.createContext(ctx);
for (const f of ['js/data.js', 'js/battle.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), ctx, { filename: f });
}
const { Battle, NINJAS, TEAMS, BATTLE_RULES } = vm.runInContext('({ Battle, NINJAS, TEAMS, BATTLE_RULES })', ctx);

function seeded(seed) {
  return () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
}

let wins = { player: 0, enemy: 0 };
let rounds = 0;
let chases = 0;
let maxCombo = 0;
const runs = 200;
for (let s = 1; s <= runs; s++) {
  const b = new Battle(TEAMS, NINJAS, BATTLE_RULES, seeded(s));
  let guard = 0;
  while (!b.over) {
    for (const e of b.act(null)) {
      if (e.type === 'chase') { chases++; maxCombo = Math.max(maxCombo, e.combo); }
      if (e.type === 'damage' && (e.amount <= 0 || Number.isNaN(e.amount))) throw new Error('daño inválido');
    }
    if (++guard > 1000) throw new Error('el combate no termina');
  }
  for (const u of b.units) if (u.hp < 0 || u.hp > u.maxHp) throw new Error('vida fuera de rango');
  for (const side of ['player', 'enemy']) {
    if (b.chakra[side] < 0 || b.chakra[side] > BATTLE_RULES.maxChakra) throw new Error('chakra fuera de rango');
  }
  wins[b.winner]++;
  rounds += b.round;
}
console.log(`combates: ${runs}, victorias:`, wins, `rondas medias: ${(rounds / runs).toFixed(1)}`,
  `persecuciones/combate: ${(chases / runs).toFixed(1)}, combo máximo: ${maxCombo}`);
console.log('OK');
