# cubekit

NxN Rubik's cube monorepo (2x2 to 7x7 in the app, up to 12x12 in the engine) with three packages and no runtime dependencies.

| Package | What it is |
|---|---|
| `packages/engine` (`@cubekit/engine`) | NxN cube model: sticker + piece representations, WCA notation including big-cube moves (`R`, `2R`, `Rw`, `3Rw`, lowercase wide, `M E S` on odd sizes, `x y z`), validation, random states (2x2, 3x3), random-move scrambles |
| `packages/solver` (`@cubekit/solver`) | 3x3: Kociemba two-phase, ~0.8 s table build, then ≤21-move solutions in a few ms. 2x2: optimal (≤11 moves) from a full distance table, ~0.15 s build. 4x4+ not solved yet |
| `apps/web` (`@cubekit/web`) | Vite app: size picker 2x2–7x7, CSS-3D cube, drag-to-turn (any layer), keyboard, random-state scrambles, solve + step-through playback, color editor for entering a real cube |

```sh
npm install
npm run dev     # web app on http://localhost:5173
npm test        # engine + solver tests
npm run build   # static build in apps/web/dist
```

## Engine

```js
import { Cube, invertAlgorithm } from '@cubekit/engine';

const cube = new Cube().move("R U R' U' x M2");
cube.isSolved();            // false
cube.facelets;              // 54 chars, Kociemba order U1..U9 R.. F.. D.. L.. B..
cube.validate();            // { valid, error }

const big = Cube.solved(5).move("3Rw 2U' M2 x");
big.size;                   // 5
invertAlgorithm("R U2 F'"); // "F U2 R'"
```

## Solver

```js
import { solve, randomScramble } from '@cubekit/solver';

solve(cube);                         // "L D' F2 ..." (first solution ≤ 21 moves)
solve(cube, { improveForMs: 500 });  // keep searching for shorter ones
randomScramble();                    // WCA-style random-state scramble
solve(Cube.fromAlgorithm("R U F'", 2)); // optimal 2x2 solution
randomScramble({ size: 2 });
```

CLI: `node packages/solver/bin/solve.js "R U R' U' F2"`, a 54-char facelet string, or `--scramble`.

The web app runs the solver in a Web Worker so table generation never blocks the UI.
