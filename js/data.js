// Datos de ninjas, jutsus y equipos del prototipo.
// Todo el combate lee de aquí: para añadir un ninja basta con añadir una entrada.
//
// Estados de control (los que activan persecuciones):
//   knockdown = derribo, highFloat = flotación alta, lowFloat = flotación baja, repulse = repulsión
//
// Objetivos (target):
//   single  = enemigo más adelantado de la misma fila
//   row     = toda la fila de ese enemigo
//   column  = la columna más adelantada del enemigo
//   all     = todos los enemigos
//   allies  = todos los aliados (curación)

const STATUS_NAMES = {
  knockdown: 'Derribo',
  highFloat: 'Flotación alta',
  lowFloat: 'Flotación baja',
  repulse: 'Repulsión',
};

const EFFECT_NAMES = {
  burn: 'Quemadura',
  poison: 'Veneno',
  immobile: 'Inmovilizado',
};

const ELEMENT_COLORS = {
  fuego: '#e2582b',
  viento: '#4fb36b',
  rayo: '#c9a227',
  tierra: '#9b7046',
  agua: '#3b82c4',
  ninguno: '#7a7f8c',
};

const NINJAS = {
  naruto: {
    name: 'Naruto Uzumaki',
    element: 'viento',
    hp: 2400, atk: 260, def: 120, speed: 110,
    normal: { name: 'Ataque normal', mult: 1.0, target: 'single', applies: null },
    mystery: {
      name: 'Rasengan', chakra: 40, cooldown: 2, mult: 2.4, target: 'single',
      applies: 'repulse',
    },
    chase: { name: 'Combo Uzumaki', trigger: 'highFloat', mult: 0.7, applies: 'knockdown' },
  },
  sasuke: {
    name: 'Sasuke Uchiha',
    element: 'rayo',
    hp: 2100, atk: 290, def: 100, speed: 130,
    normal: { name: 'Ataque normal', mult: 1.0, target: 'single', applies: 'knockdown' },
    mystery: {
      name: 'Chidori', chakra: 40, cooldown: 2, mult: 2.6, target: 'single',
      applies: 'highFloat', effect: { type: 'immobile', turns: 1, chance: 0.5 },
    },
    chase: { name: 'Shishi Rendan', trigger: 'knockdown', mult: 0.8, applies: 'highFloat' },
  },
  sakura: {
    name: 'Sakura Haruno',
    element: 'tierra',
    hp: 2000, atk: 220, def: 110, speed: 100,
    normal: { name: 'Ataque normal', mult: 1.0, target: 'single', applies: null },
    mystery: {
      name: 'Jutsu de curación', chakra: 30, cooldown: 3, mult: 1.6, target: 'allies',
      heal: true,
    },
    chase: { name: 'Puño de cerezo', trigger: 'lowFloat', mult: 0.9, applies: 'knockdown' },
  },
  kakashi: {
    name: 'Kakashi Hatake',
    element: 'rayo',
    hp: 2300, atk: 270, def: 130, speed: 120,
    normal: { name: 'Ataque normal', mult: 1.0, target: 'single', applies: 'highFloat' },
    mystery: {
      name: 'Raikiri', chakra: 50, cooldown: 3, mult: 1.5, target: 'column',
      applies: 'lowFloat',
    },
    chase: { name: 'Golpe de rayo', trigger: 'repulse', mult: 0.8, applies: 'lowFloat' },
  },

  itachi: {
    name: 'Itachi Uchiha',
    element: 'fuego',
    hp: 2300, atk: 280, def: 110, speed: 135,
    normal: { name: 'Ataque normal', mult: 1.0, target: 'single', applies: 'lowFloat' },
    mystery: {
      name: 'Amaterasu', chakra: 40, cooldown: 3, mult: 1.6, target: 'row',
      effect: { type: 'burn', turns: 2, chance: 1, power: 0.35 },
    },
    chase: { name: 'Bola de fuego', trigger: 'knockdown', mult: 0.8, applies: 'repulse' },
  },
  kisame: {
    name: 'Kisame Hoshigaki',
    element: 'agua',
    hp: 3000, atk: 230, def: 150, speed: 90,
    normal: { name: 'Ataque normal', mult: 1.0, target: 'single', applies: 'knockdown' },
    mystery: {
      name: 'Tiburón de agua', chakra: 40, cooldown: 2, mult: 1.4, target: 'column',
      applies: 'highFloat',
    },
    chase: { name: 'Samehada', trigger: 'repulse', mult: 0.8, applies: 'highFloat' },
  },
  deidara: {
    name: 'Deidara',
    element: 'tierra',
    hp: 2000, atk: 270, def: 90, speed: 115,
    normal: { name: 'Ataque normal', mult: 1.0, target: 'single', applies: 'knockdown' },
    mystery: {
      name: 'Arte explosivo C2', chakra: 50, cooldown: 3, mult: 1.1, target: 'all',
      applies: 'knockdown',
    },
    chase: { name: 'Araña explosiva', trigger: 'highFloat', mult: 0.7, applies: 'lowFloat' },
  },
  sasori: {
    name: 'Sasori',
    element: 'viento',
    hp: 2200, atk: 240, def: 120, speed: 105,
    normal: { name: 'Ataque normal', mult: 1.0, target: 'single', applies: 'repulse' },
    mystery: {
      name: 'Marioneta del tercer Kazekage', chakra: 40, cooldown: 2, mult: 1.8, target: 'single',
      effect: { type: 'poison', turns: 3, chance: 1, power: 0.25 },
    },
    chase: { name: 'Cola venenosa', trigger: 'lowFloat', mult: 0.7, applies: 'knockdown' },
  },
};

// Formaciones 3x3. row: 0-2 (arriba a abajo), col: 0 = delante, 2 = detrás.
const TEAMS = {
  player: [
    { id: 'naruto', row: 0, col: 0 },
    { id: 'sasuke', row: 1, col: 0 },
    { id: 'kakashi', row: 2, col: 1 },
    { id: 'sakura', row: 1, col: 2 },
  ],
  enemy: [
    { id: 'kisame', row: 1, col: 0 },
    { id: 'itachi', row: 0, col: 1 },
    { id: 'deidara', row: 2, col: 1 },
    { id: 'sasori', row: 1, col: 2 },
  ],
};

const BATTLE_RULES = {
  startChakra: 40,
  maxChakra: 100,
  chakraPerRound: 20,
  chakraPerHit: 5,
  critChance: 0.1,
  critMult: 1.5,
  maxRounds: 20,
};
