// Genera assets/LISTA.md con todos los archivos que el juego espera.
// Uso: node tools/generar-lista-assets.js
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const root = path.join(__dirname, '..');
const ctx = { module: undefined };
vm.createContext(ctx);
for (const f of ['js/data.js', 'js/assets.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
}
const manifest = vm.runInContext('assetManifest(NINJAS)', ctx);

const lines = [
  '# Lista de assets',
  '',
  'Generada con `node tools/generar-lista-assets.js`. No la edites a mano.',
  'Para ver qué archivos tienes ya, abre `revision.html`.',
  '',
  '| Ruta | Tipo | Qué es |',
  '| --- | --- | --- |',
  ...manifest.map((a) => `| \`assets/${a.path}\` | ${a.kind === 'image' ? 'Imagen' : 'Audio'} | ${a.desc} |`),
  '',
];
fs.writeFileSync(path.join(root, 'assets', 'LISTA.md'), lines.join('\n'));
console.log(`assets/LISTA.md: ${manifest.length} archivos`);
