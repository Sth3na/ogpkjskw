# Naruto Online HTML5

Juego web por turnos inspirado en Naruto Online, escrito desde cero en HTML5 y JavaScript.
Es de uso privado. Las imágenes y sonidos no vienen incluidos: el juego carga los que pongas
en `assets/` y dibuja marcadores de posición para los que falten.

## Cómo jugar

Abre `index.html` en el navegador (doble clic). No hace falta instalar nada.

- **Combate**: Konoha contra Akatsuki en formaciones 3x3. Cuando le toca a un ninja tuyo, elige
  ataque normal o jutsu. "Automático" deja que la IA juegue por ti.
- **Revisión de assets** (`revision.html`): muestra qué archivos de `assets/` se cargaron y cuáles faltan.

## Reglas del prototipo

- Los ninjas actúan por orden de velocidad en cada ronda.
- El chakra es compartido por el equipo: empieza en 40, sube 20 por ronda y 5 por cada ataque normal.
  Los jutsus cuestan chakra y tienen recarga.
- Algunos golpes dejan al enemigo en **derribo**, **flotación alta**, **flotación baja** o **repulsión**.
  Un aliado cuya persecución reacciona a ese estado ataca enseguida y puede encadenar un combo.
- Efectos: quemadura, veneno (daño por turno) e inmovilizado (pierde el turno).
- Gana quien derrote a todo el equipo rival. A las 20 rondas gana el defensor.

## Estructura

| Archivo | Qué hace |
| --- | --- |
| `js/data.js` | Ninjas, jutsus, persecuciones, formaciones y reglas. Para añadir un ninja, se añade aquí. |
| `js/battle.js` | Motor de combate (solo lógica, sin dibujo). |
| `js/render.js` | Pantalla de combate en Canvas y animaciones. |
| `js/assets.js` | Lista de assets esperados y cargador con marcadores de posición. |
| `js/main.js` | Controles de la página de combate. |
| `assets/LISTA.md` | Ruta de cada imagen y sonido que el juego sabe usar. |
| `tools/generar-lista-assets.js` | Regenera `assets/LISTA.md` (`node tools/generar-lista-assets.js`). |
| `tests/battle.test.js` | Simula 200 combates y comprueba que el motor no falla (`node tests/battle.test.js`). |

`html.zip` es Open Game Panel (un panel PHP para servidores de juegos) y no forma parte del juego.
