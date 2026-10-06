// Cargador de assets. Busca cada archivo en assets/ por nombre; si falta,
// el juego dibuja un marcador de posición en su lugar.

const ASSET_ROOT = 'assets/';

const NINJA_IMAGES = {
  portrait: 'Retrato cuadrado (menús y barra de turnos)',
  idle: 'Ninja quieto en combate (mirando a la derecha)',
  attack: 'Ninja atacando (mirando a la derecha)',
};

// Lista completa de lo que el juego sabe usar.
function assetManifest(ninjas) {
  const list = [
    { key: 'bg/battle', path: 'bg/battle.png', kind: 'image', desc: 'Fondo de la pantalla de combate (960x540)' },
    { key: 'bgm/battle', path: 'bgm/battle.mp3', kind: 'audio', desc: 'Música de combate (en bucle)' },
    { key: 'sfx/hit', path: 'sfx/hit.mp3', kind: 'audio', desc: 'Golpe normal' },
    { key: 'sfx/jutsu', path: 'sfx/jutsu.mp3', kind: 'audio', desc: 'Lanzar un jutsu' },
    { key: 'sfx/chase', path: 'sfx/chase.mp3', kind: 'audio', desc: 'Persecución' },
    { key: 'sfx/heal', path: 'sfx/heal.mp3', kind: 'audio', desc: 'Curación' },
    { key: 'sfx/death', path: 'sfx/death.mp3', kind: 'audio', desc: 'Ninja derrotado' },
    { key: 'sfx/victory', path: 'sfx/victory.mp3', kind: 'audio', desc: 'Victoria' },
    { key: 'sfx/defeat', path: 'sfx/defeat.mp3', kind: 'audio', desc: 'Derrota' },
  ];
  for (const id of Object.keys(ninjas)) {
    for (const [img, desc] of Object.entries(NINJA_IMAGES)) {
      list.push({
        key: `ninjas/${id}/${img}`,
        path: `ninjas/${id}/${img}.png`,
        kind: 'image',
        desc: `${ninjas[id].name}: ${desc}`,
      });
    }
  }
  return list;
}

const Assets = {
  items: {},
  muted: false,

  load(ninjas) {
    const manifest = assetManifest(ninjas);
    return Promise.all(manifest.map((a) => this.loadOne(a))).then(() => manifest);
  },

  loadOne(a) {
    const src = ASSET_ROOT + a.path;
    return new Promise((resolve) => {
      const done = (el) => {
        this.items[a.key] = { ...a, src, el, loaded: !!el };
        resolve();
      };
      if (a.kind === 'image') {
        const img = new Image();
        img.onload = () => done(img);
        img.onerror = () => done(null);
        img.src = src;
      } else {
        const audio = new Audio();
        const timer = setTimeout(() => done(null), 4000);
        audio.addEventListener('canplaythrough', () => { clearTimeout(timer); done(audio); }, { once: true });
        audio.addEventListener('error', () => { clearTimeout(timer); done(null); }, { once: true });
        audio.preload = 'auto';
        audio.src = src;
      }
    });
  },

  image(key) {
    const it = this.items[key];
    return it && it.loaded ? it.el : null;
  },

  play(key, opts) {
    const it = this.items[key];
    if (this.muted || !it || !it.loaded) return;
    const a = opts && opts.loop ? it.el : it.el.cloneNode();
    a.loop = !!(opts && opts.loop);
    a.volume = opts && opts.volume != null ? opts.volume : 0.7;
    a.play().catch(() => {});
  },

  stop(key) {
    const it = this.items[key];
    if (it && it.loaded) it.el.pause();
  },
};

if (typeof module !== 'undefined') module.exports = { assetManifest };
