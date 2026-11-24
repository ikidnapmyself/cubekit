import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  Cube,
  CubieCube,
  SOLVED,
  MOVE_NAMES,
  parseAlgorithm,
  formatAlgorithm,
  invertAlgorithm,
  simplifyAlgorithm,
} from '../src/index.js';

const SUPERFLIP = "U R2 F B R B2 R U2 L B2 R U' D' R2 F R' L B2 U2 F2";

const seeded = (seed = 1) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

test('solved cube is solved and valid', () => {
  const c = new Cube();
  assert.equal(c.facelets, SOLVED);
  assert.ok(c.isSolved());
  assert.deepEqual(c.validate(), { valid: true, error: null });
});

test('every move has order 4 and its inverse undoes it', () => {
  for (const name of MOVE_NAMES) {
    assert.notEqual(new Cube().move(name).facelets, SOLVED, name);
    assert.equal(new Cube().move(`${name} ${name} ${name} ${name}`).facelets, SOLVED, `${name}^4`);
    assert.equal(new Cube().move(`${name} ${name}'`).facelets, SOLVED, `${name} ${name}'`);
    assert.equal(new Cube().move(`${name}2`).facelets, new Cube().move(`${name} ${name}`).facelets);
  }
});

test('U turn moves the front row to the left face', () => {
  const c = new Cube().move('U');
  assert.deepEqual(c.face('L').slice(0, 3), ['F', 'F', 'F']);
  assert.deepEqual(c.face('F').slice(0, 3), ['R', 'R', 'R']);
});

test('R turn moves front stickers up', () => {
  const c = new Cube().move('R');
  assert.deepEqual([2, 5, 8].map((i) => c.face('U')[i]), ['F', 'F', 'F']);
  assert.deepEqual([2, 5, 8].map((i) => c.face('F')[i]), ['D', 'D', 'D']);
});

test("R U R' U' has order 6", () => {
  assert.ok(new Cube().move("R U R' U' ".repeat(6)).isSolved());
  assert.ok(!new Cube().move("R U R' U' ".repeat(3)).isSolved());
});

test('slices, wide moves and rotations agree with face turns', () => {
  const eq = (a, b) => assert.equal(new Cube().move(a).facelets, new Cube().move(b).facelets, `${a} == ${b}`);
  eq('r', "R M'");
  eq('Rw', 'r');
  eq('x', "R M' L'");
  eq('y', "U E' D'");
  eq('z', "F S B'");
  eq('u', "U E'");
  eq('f', 'F S');
});

test('whole-cube rotations count as solved', () => {
  assert.ok(new Cube().move("x y z' y2").isSolved());
  assert.ok(!new Cube().move('M').isSolved());
  assert.ok(new Cube().move("M E S M' E' S'").validate().valid);
});

test('notation parsing and formatting', () => {
  assert.equal(formatAlgorithm("R U2' F' (r u) x2 Rw' M"), "R U2 F' Rw Uw x2 Rw' M");
  assert.equal(formatAlgorithm("RUR'U'"), "R U R' U'");
  assert.throws(() => parseAlgorithm('R Q'), SyntaxError);
  assert.equal(invertAlgorithm("R U2 F'"), "F U2 R'");
  assert.equal(simplifyAlgorithm("R R U U' F2 F2 L"), 'R2 L');
});

test('superflip flips every edge and nothing else', () => {
  const cc = new Cube().move(SUPERFLIP).toCubie();
  assert.deepEqual(cc.ep, [...Array(12).keys()]);
  assert.deepEqual(cc.cp, [...Array(8).keys()]);
  assert.deepEqual(cc.eo, Array(12).fill(1));
  assert.deepEqual(cc.co, Array(8).fill(0));
});

test('cubie multiplication matches facelet moves', () => {
  const moveCubie = Object.fromEntries([...'URFDLB'].map((m) => [m, new Cube().move(m).toCubie()]));
  const random = seeded(7);
  for (let t = 0; t < 50; t++) {
    const alg = Array.from({ length: 25 }, () => 'URFDLB'[Math.floor(random() * 6)]);
    let cc = new CubieCube();
    for (const m of alg) cc = cc.multiply(moveCubie[m]);
    const cube = new Cube().move(alg.join(' '));
    assert.equal(cc.toFacelets(), cube.facelets);
    assert.ok(CubieCube.fromFacelets(cube.facelets).equals(cc));
  }
});

test('a rotated cube maps onto cubies relative to its centers', () => {
  assert.equal(new Cube().move("y R U F'").toCubie().verify(), null);
  assert.ok(new Cube().move('x2').toCubie().isSolved());
  assert.ok(new Cube().move("x R U R' U' x'").toCubie().equals(new Cube().move("R F R' F'").toCubie()));
});

test('random states are valid', () => {
  const random = seeded(3);
  for (let i = 0; i < 200; i++) assert.deepEqual(Cube.random(random).validate(), { valid: true, error: null });
});

test('validation catches impossible cubes', () => {
  const swap = (cube, a, b) => {
    const f = [...cube.facelets];
    [f[a], f[b]] = [f[b], f[a]];
    return new Cube(f.join(''));
  };
  assert.match(swap(new Cube(), 5, 10).validate().error, /flipped/);
  assert.match(swap(swap(new Cube(), 8, 9), 9, 20).validate().error, /twisted/);
  const twoEdges = new CubieCube();
  [twoEdges.ep[0], twoEdges.ep[1]] = [1, 0];
  assert.match(new Cube(twoEdges.toFacelets()).validate().error, /parity/);
  assert.match(new Cube().withSticker(0, 'R').validate().error, /appears/);
});
