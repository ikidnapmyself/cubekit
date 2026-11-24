import { assertSize, stickers, dot, rotateClockwise, stickerAt } from './geometry.js';

const X = [1, 0, 0];
const Y = [0, 1, 0];
const Z = [0, 0, 1];
const neg = (v) => v.map((n) => -n + 0);

const FACE_AXES = { U: Y, D: neg(Y), R: X, L: neg(X), F: Z, B: neg(Z) };
const SLICE_AXES = { M: neg(X), E: neg(Y), S: Z };
const ROTATION_AXES = { x: X, y: Y, z: Z };

// Canonical move names: R, 2R (inner slice), Rw (two layers), 3Rw (three layers),
// M E S (middle slice, odd sizes), x y z (whole cube).
const NAME = /^(?:(\d+)?([URFDLB])(w)?|([MES])|([xyz]))$/;

export const MOVE_NAMES = Object.freeze(['U', 'D', 'R', 'L', 'F', 'B', 'Uw', 'Dw', 'Rw', 'Lw', 'Fw', 'Bw', 'M', 'E', 'S', 'x', 'y', 'z']);
export const FACE_MOVES = Object.freeze(['U', 'R', 'F', 'D', 'L', 'B']);

export function canonicalMoveName(name) {
  const match = NAME.exec(name);
  if (!match) return null;
  const [, depth, face, wide] = match;
  if (!face) return name;
  const n = depth === undefined ? (wide ? 2 : 1) : Number(depth);
  if (n < 1) return null;
  if (n === 1) return face;
  if (wide) return n === 2 ? `${face}w` : `${n}${face}w`;
  return `${n}${face}`;
}

// Every move is a clockwise quarter turn (seen from the tip of `axis`) of the
// layers whose doubled coordinate along `axis` is listed in `layers`.
export function moveDefinition(name, size = 3) {
  assertSize(size);
  const match = NAME.exec(canonicalMoveName(name) ?? '');
  if (!match) throw new Error(`Unknown move "${name}"`);
  const [, depth, face, wide, slice, rotation] = match;
  const m = size - 1;
  const coordinate = (d) => m - 2 * (d - 1);
  if (rotation) return { axis: [...ROTATION_AXES[rotation]], layers: Array.from({ length: size }, (_, i) => coordinate(i + 1)) };
  if (slice) {
    if (size % 2 === 0) throw new Error(`${slice} needs an odd-sized cube`);
    return { axis: [...SLICE_AXES[slice]], layers: [0] };
  }
  const n = depth === undefined ? (wide ? 2 : 1) : Number(depth);
  if (n > size) throw new Error(`${name} reaches past the ${size} layers of a ${size}x${size}`);
  const layers = wide ? Array.from({ length: n }, (_, i) => coordinate(i + 1)) : [coordinate(n)];
  return { axis: [...FACE_AXES[face]], layers };
}

function quarterPermutation(name, size) {
  const { axis, layers } = moveDefinition(name, size);
  const all = stickers(size);
  const perm = all.map((s) => s.index);
  for (const s of all) {
    if (!layers.includes(dot(s.position, axis))) continue;
    const target = stickerAt(rotateClockwise(s.position, axis), rotateClockwise(s.normal, axis), size);
    perm[target] = s.index;
  }
  return perm;
}

// perm[i] = index of the sticker whose color lands on position i.
const compose = (p, q) => q.map((i) => p[i]);
const cache = new Map();

export function permutation(name, amount = 1, size = 3) {
  const id = `${size}:${name}:${amount}`;
  let perm = cache.get(id);
  if (!perm) {
    const quarter = quarterPermutation(name, size);
    perm = quarter;
    for (let i = 1; i < amount; i++) perm = compose(perm, quarter);
    cache.set(id, (perm = Object.freeze(perm)));
  }
  return perm;
}
