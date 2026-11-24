#!/usr/bin/env node
import { Cube } from '@cubekit/engine';
import { Solver, randomScramble } from '../src/index.js';

const input = process.argv.slice(2).join(' ').trim();
if (!input || input === '-h' || input === '--help') {
  console.log(`Usage:
  cubekit-solve "<scramble>"         e.g. cubekit-solve "R U R' U' F2"
  cubekit-solve <54 facelets>        URFDLB order, e.g. UUUUUUUUURRR...BBB
  cubekit-solve --scramble           print a random-state scramble`);
  process.exit(input ? 0 : 1);
}

try {
  if (input === '--scramble') {
    console.log(randomScramble());
    process.exit(0);
  }
  const cube = /^[URFDLB]{54}$/.test(input) ? new Cube(input) : new Cube().move(input);
  const solver = new Solver();
  let t = performance.now();
  solver.init();
  const tables = performance.now() - t;
  t = performance.now();
  const solution = solver.solve(cube, { improveForMs: 1000 });
  const ms = performance.now() - t;
  console.log(solution || '(already solved)');
  console.error(`${solution ? solution.split(' ').length : 0} moves · tables ${tables.toFixed(0)} ms · search ${ms.toFixed(1)} ms`);
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
