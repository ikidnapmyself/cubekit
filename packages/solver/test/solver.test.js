import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Cube, CubieCube } from '@cubekit/engine';
import * as C from '../src/coords.js';
import { Solver, solve, randomScramble } from '../src/index.js';

const seeded = (seed = 1) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

test('coordinates are bijective and solved maps to zero', () => {
  const pairs = [
    [C.N_TWIST, C.setTwist, C.getTwist],
    [C.N_FLIP, C.setFlip, C.getFlip],
    [C.N_SLICE, C.setSlice, C.getSlice],
    [C.N_CORNER_PERM, C.setCornerPerm, C.getCornerPerm],
    [C.N_EDGE8_PERM, C.setEdge8Perm, C.getEdge8Perm],
    [C.N_SLICE_PERM, C.setSlicePerm, C.getSlicePerm],
  ];
  for (const [n, set, get] of pairs) {
    assert.equal(get(new CubieCube()), 0);
    const c = new CubieCube();
    for (let i = 0; i < n; i++) {
      set(c, i);
      assert.equal(get(c), i);
    }
  }
});

const solver = new Solver().init();

test('solved cube needs no moves', () => {
  assert.equal(solver.solve(new Cube()), '');
  assert.equal(solver.solve(new Cube().move('x y')), '');
});

test('solves short scrambles', () => {
  for (const alg of ['R', "R U R' U'", 'F2 B2 L2 R2 U2 D2', "U R2 F B R B2 R U2 L B2 R U' D' R2 F R' L B2 U2 F2"]) {
    const cube = new Cube().move(alg);
    assert.ok(cube.move(solver.solve(cube)).isSolved(), alg);
  }
});

test('solves random states within 21 moves', () => {
  const random = seeded(42);
  for (let i = 0; i < 30; i++) {
    const cube = Cube.random(random);
    const solution = solver.solve(cube);
    assert.ok(solution.split(' ').length <= 21);
    assert.ok(cube.move(solution).isSolved(), solution);
  }
});

test('accepts facelet strings and rotated cubes', () => {
  const cube = new Cube().move("x R U2 F' z L D'");
  assert.ok(cube.move(solve(cube.facelets)).isSolved());
});

test('rejects unsolvable cubes with a reason', () => {
  const f = [...new Cube().facelets];
  [f[5], f[10]] = [f[10], f[5]];
  assert.throws(() => solver.solve(f.join('')), /flipped/);
});

test('random-state scrambles reach the state they claim', () => {
  const scramble = randomScramble({ random: seeded(9) });
  const cube = new Cube().move(scramble);
  assert.ok(!cube.isSolved());
  assert.ok(cube.move(solve(cube)).isSolved());
});

test('improveForMs finds a short solution for a short scramble', () => {
  const cube = new Cube().move("R U R' U' F2 D L'");
  const solution = solver.solve(cube, { improveForMs: 2000 });
  assert.ok(solution.split(' ').length <= 7, solution);
  assert.ok(cube.move(solution).isSolved());
});

test('2x2 solutions are optimal and never exceed 11 moves', () => {
  const random = seeded(21);
  let t = performance.now();
  solver.init({ sizes: [2] });
  console.log(`2x2 tables ${Math.round(performance.now() - t)} ms`);
  for (let i = 0; i < 100; i++) {
    const cube = Cube.random(random, 2).move('x y');
    const solution = solver.solve(cube);
    assert.ok(solution === '' || solution.split(' ').length <= 11, solution);
    assert.ok(cube.move(solution).isSolved(), solution);
  }
  const short = Cube.fromAlgorithm("R U F' R2", 2);
  assert.equal(solver.solve(short).split(' ').length, 4);
  assert.equal(solver.solve(Cube.solved(2)), '');
});

test('2x2 random-state scrambles and facelet strings', () => {
  const scramble = randomScramble({ size: 2, random: seeded(4) });
  const cube = Cube.fromAlgorithm(scramble, 2);
  assert.ok(cube.move(solve(cube.facelets)).isSolved());
});

test('bigger cubes are refused with a clear message', () => {
  assert.throws(() => solver.solve(Cube.solved(4).move('R')), /only 2x2 and 3x3/);
});
