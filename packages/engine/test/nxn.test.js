import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Cube, CubieCube, formatAlgorithm, invertAlgorithm, moveDefinition, randomMoves } from '../src/index.js';

const seeded = (seed = 1) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const same = (size, a, b) =>
  assert.equal(Cube.fromAlgorithm(a, size).facelets, Cube.fromAlgorithm(b, size).facelets, `${size}x${size}: ${a} == ${b}`);

test('every size from 2 to 7 has the right sticker count and starts solved', () => {
  for (let n = 2; n <= 7; n++) {
    const cube = Cube.solved(n);
    assert.equal(cube.size, n);
    assert.equal(cube.facelets.length, 6 * n * n);
    assert.ok(cube.isSolved());
    assert.ok(cube.validate().valid);
  }
});

test('every layer move has order 4 on every size', () => {
  for (let n = 2; n <= 7; n++) {
    const names = ['U', 'R', 'F', 'D', 'L', 'B', 'x', 'y', 'z'];
    for (let d = 2; d <= n; d++) names.push(`${d}R`, `${d}Uw`, `${d}F`);
    if (n % 2) names.push('M', 'E', 'S');
    for (const name of names) {
      const once = Cube.fromAlgorithm(name, n);
      assert.equal(Cube.fromAlgorithm(`${name}2 ${name}2`, n).facelets, Cube.solved(n).facelets, `${n}: ${name}`);
      assert.equal(Cube.fromAlgorithm(`${name} ${name}'`, n).facelets, Cube.solved(n).facelets);
      assert.notEqual(once.facelets, Cube.solved(n).facelets, `${n}: ${name} changes something`);
    }
  }
});

test('big-cube notation composes from single slices', () => {
  same(4, 'Rw', 'R 2R');
  same(4, 'r', 'Rw');
  same(5, '3Rw', 'R 2R 3R');
  same(5, 'M', '3L');
  same(5, 'M', "3R'");
  same(4, 'x', "Rw 2L' L'");
  same(6, '3R', "4L'");
  same(7, 'y', "U 2U 3U E' 3D' 2D' D'");
  same(3, '2R', "M'");
  same(2, 'x', "R L'");
});

test('parsing big-cube moves', () => {
  assert.equal(formatAlgorithm("3Rw2 2R' 1R 2Rw 1Fw Uw'"), "3Rw2 2R' R Rw F Uw'");
  assert.equal(invertAlgorithm("3Rw 2U2 F'"), "F 2U2 3Rw'");
});

test('invalid moves for a size are rejected', () => {
  assert.throws(() => Cube.solved(4).move('M'), /odd/);
  assert.throws(() => Cube.solved(3).move('4R'), /past/);
  assert.throws(() => moveDefinition('R', 1), /size/);
});

test('random-move scrambles undo cleanly on every size', () => {
  const random = seeded(5);
  for (let n = 2; n <= 7; n++) {
    const scramble = randomMoves(n, undefined, random);
    const cube = Cube.solved(n).move(scramble);
    assert.ok(!cube.isSolved());
    assert.ok(cube.move(invertAlgorithm(scramble)).isSolved());
  }
});

test('2x2 maps onto corners with DBL held fixed', () => {
  const random = seeded(11);
  for (let i = 0; i < 100; i++) {
    const scramble = randomMoves(2, 15, random);
    const cube = Cube.fromAlgorithm(`${scramble} x y`, 2);
    const cc = cube.toCubie();
    assert.equal(cc.cp[6], 6);
    assert.equal(cc.co[6], 0);
    assert.equal(cc.verifyCorners(), null);
  }
  assert.ok(Cube.fromAlgorithm("R U2 R' y2", 2).validate().valid);
  for (let i = 0; i < 50; i++) assert.ok(Cube.random(random, 2).validate().valid);
});

test('2x2 validation catches a twisted corner', () => {
  const f = [...Cube.solved(2).facelets];
  // URF corner: U4 (3), R1 (4), F2 (9) cycled one step.
  [f[3], f[4], f[9]] = [f[9], f[3], f[4]];
  assert.match(new Cube(f.join('')).validate().error, /twisted/);
});

test('cubie toFacelets2x2 round-trips', () => {
  const cc = CubieCube.fromFacelets2x2(Cube.fromAlgorithm("R U F' U2 R'", 2).facelets);
  assert.equal(CubieCube.fromFacelets2x2(cc.toFacelets2x2()).equals(cc), true);
});
