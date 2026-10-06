// Arranque de la pantalla de combate y controles.

const $ = (id) => document.getElementById(id);
const view = new BattleView($('battle'));
let battle = null;
let runId = 0;
let auto = false;
let pendingChoice = null;

function logLine(text, cls) {
  const li = document.createElement('li');
  li.textContent = text;
  if (cls) li.className = cls;
  const log = $('log');
  log.appendChild(li);
  log.scrollTop = log.scrollHeight;
}

function describe(events) {
  const name = (uid) => battle.unit(uid).name;
  for (const e of events) {
    switch (e.type) {
      case 'round': logLine(`Ronda ${e.round}`, 'round'); break;
      case 'skill':
        logLine(`${name(e.actor)} usa ${e.name}` + (e.targets.length ? ` sobre ${e.targets.map(name).join(', ')}` : ''));
        break;
      case 'chase':
        logLine(`Persecución ${e.combo}: ${name(e.actor)} usa ${e.name} sobre ${name(e.target)} (${STATUS_NAMES[e.trigger]})`, 'chase');
        break;
      case 'damage': logLine(`  ${name(e.target)} recibe ${e.amount}${e.crit ? ' (crítico)' : ''}`); break;
      case 'heal': logLine(`  ${name(e.target)} recupera ${e.amount}`); break;
      case 'dot': logLine(`${name(e.target)} sufre ${EFFECT_NAMES[e.effect]}: ${e.amount}`); break;
      case 'effect': logLine(`  ${name(e.target)}: ${EFFECT_NAMES[e.effect]} (${e.turns} turnos)`); break;
      case 'skip': logLine(`${name(e.actor)} no puede actuar (${e.reason})`); break;
      case 'death': logLine(`  ${name(e.target)} ha caído`); break;
      case 'end':
        logLine((e.winner === 'player' ? '¡Victoria!' : 'Derrota') + (e.reason ? ` (${e.reason})` : ''), 'end');
        break;
    }
  }
}

// En modo manual, espera a que el jugador elija la acción de su ninja.
function askPlayer(actor) {
  const m = actor.mystery;
  $('actor-name').textContent = `Turno de ${actor.name}`;
  const btn = $('btn-mystery');
  btn.textContent = m ? `${m.name} (${m.chakra} chakra)` : 'Sin jutsu';
  btn.disabled = !battle.canUseMystery(actor);
  btn.title = actor.cooldown > 0 ? `Recarga: ${actor.cooldown} turno(s)` : '';
  $('actions').hidden = false;
  return new Promise((resolve) => {
    pendingChoice = (choice) => {
      pendingChoice = null;
      $('actions').hidden = true;
      resolve(choice);
    };
  });
}

async function run() {
  const id = ++runId;
  battle = new Battle(TEAMS, NINJAS, BATTLE_RULES);
  view.setBattle(battle);
  $('log').innerHTML = '';
  $('actions').hidden = true;
  if (pendingChoice) pendingChoice(null);

  while (!battle.over && id === runId) {
    const actor = battle.nextActor();
    if (battle.pending && battle.pending.length) {
      const start = battle.pending;
      battle.pending = [];
      describe(start);
      await view.play(start);
      if (id !== runId) return;
    }
    if (battle.over) break;
    let choice = null;
    if (actor.side === 'player' && !auto) {
      view.active = actor.uid;
      choice = await askPlayer(actor);
      if (id !== runId) return;
    }
    const events = battle.act(choice);
    describe(events);
    await view.play(events);
  }
}

$('btn-normal').onclick = () => pendingChoice && pendingChoice('normal');
$('btn-mystery').onclick = () => pendingChoice && pendingChoice('mystery');
$('btn-auto').onclick = () => {
  auto = !auto;
  $('btn-auto').textContent = `Automático: ${auto ? 'SÍ' : 'NO'}`;
  if (auto && pendingChoice) pendingChoice(null);
};
$('btn-speed').onclick = () => {
  view.speed = view.speed === 1 ? 2 : view.speed === 2 ? 4 : 1;
  $('btn-speed').textContent = `Velocidad x${view.speed}`;
};
$('btn-sound').onclick = () => {
  Assets.muted = !Assets.muted;
  $('btn-sound').textContent = `Sonido: ${Assets.muted ? 'NO' : 'SÍ'}`;
  if (Assets.muted) Assets.stop('bgm/battle');
  else Assets.play('bgm/battle', { loop: true, volume: 0.4 });
};
$('btn-restart').onclick = () => run();

// La música solo puede empezar tras un clic del usuario.
document.addEventListener('click', () => Assets.play('bgm/battle', { loop: true, volume: 0.4 }), { once: true });

Assets.load(NINJAS).then((manifest) => {
  const found = manifest.filter((a) => Assets.items[a.key].loaded).length;
  $('asset-summary').textContent = `Assets: ${found}/${manifest.length} cargados`;
  run();
});
