import { FACES } from './geometry.js';

// Kociemba cubie order.
export const CORNERS = Object.freeze(['URF', 'UFL', 'ULB', 'UBR', 'DFR', 'DLF', 'DBL', 'DRB']);
export const EDGES = Object.freeze(['UR', 'UF', 'UL', 'UB', 'DR', 'DF', 'DL', 'DB', 'FR', 'FL', 'BL', 'BR']);

// Facelet indices of each cubie position, listed in its reference orientation.
export const CORNER_FACELETS = Object.freeze([
  [8, 9, 20], [6, 18, 38], [0, 36, 47], [2, 45, 11],
  [29, 26, 15], [27, 44, 24], [33, 53, 42], [35, 17, 51],
]);
export const EDGE_FACELETS = Object.freeze([
  [5, 10], [7, 19], [3, 37], [1, 46], [32, 16], [28, 25],
  [30, 43], [34, 52], [23, 12], [21, 41], [50, 39], [48, 14],
]);

const CORNER_COLORS = CORNERS.map((name) => [...name]);
const EDGE_COLORS = EDGES.map((name) => [...name]);
const CENTERS = [4, 13, 22, 31, 40, 49];
const OPPOSITE = { U: 'D', D: 'U', R: 'L', L: 'R', F: 'B', B: 'F' };

// 3x3 corner facelet -> the matching 2x2 facelet.
const to2x2 = (i) => {
  const face = Math.floor(i / 9);
  const r = Math.floor((i % 9) / 3);
  return face * 4 + (r / 2) * 2 + (i % 3) / 2;
};

const range = (n) => Array.from({ length: n }, (_, i) => i);

function parity(perm) {
  let p = 0;
  for (let i = 0; i < perm.length; i++)
    for (let j = i + 1; j < perm.length; j++) if (perm[j] < perm[i]) p ^= 1;
  return p;
}

function shuffle(arr, random) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export class CubieCube {
  constructor(cp = range(8), co = Array(8).fill(0), ep = range(12), eo = Array(12).fill(0)) {
    this.cp = [...cp];
    this.co = [...co];
    this.ep = [...ep];
    this.eo = [...eo];
  }

  clone() {
    return new CubieCube(this.cp, this.co, this.ep, this.eo);
  }

  // Applies `b` after `this`.
  multiply(b) {
    const r = new CubieCube();
    for (let i = 0; i < 8; i++) {
      r.cp[i] = this.cp[b.cp[i]];
      r.co[i] = (this.co[b.cp[i]] + b.co[i]) % 3;
    }
    for (let i = 0; i < 12; i++) {
      r.ep[i] = this.ep[b.ep[i]];
      r.eo[i] = (this.eo[b.ep[i]] + b.eo[i]) % 2;
    }
    return r;
  }

  equals(o) {
    const same = (a, b) => a.every((v, i) => v === b[i]);
    return same(this.cp, o.cp) && same(this.co, o.co) && same(this.ep, o.ep) && same(this.eo, o.eo);
  }

  isSolved() {
    return this.equals(new CubieCube());
  }

  // Colors are re-labelled by the centers, so a cube in any whole-cube
  // orientation maps onto the cubie model in its current orientation.
  static fromFacelets(facelets) {
    if (typeof facelets !== 'string' || facelets.length !== 54)
      throw new Error('Facelets must be a 54-character string');
    const centers = CENTERS.map((i) => facelets[i]);
    if (new Set(centers).size !== 6) throw new Error('The six centers must all be different colors');
    const relabel = Object.fromEntries(centers.map((c, f) => [c, FACES[f]]));
    const f = [...facelets].map((c) => relabel[c]);
    if (f.includes(undefined)) throw new Error('Every sticker must match one of the center colors');
    for (const face of FACES) {
      const n = f.filter((c) => c === face).length;
      if (n !== 9) throw new Error(`Color ${face} appears ${n} times, expected 9`);
    }

    const cc = new CubieCube();
    for (let i = 0; i < 8; i++) {
      const slots = CORNER_FACELETS[i];
      const ori = slots.findIndex((s) => f[s] === 'U' || f[s] === 'D');
      if (ori < 0) throw new Error(`Corner at ${CORNERS[i]} has no U or D sticker`);
      const c1 = f[slots[(ori + 1) % 3]];
      const c2 = f[slots[(ori + 2) % 3]];
      const j = CORNER_COLORS.findIndex((c) => c[1] === c1 && c[2] === c2 && c[0] === f[slots[ori]]);
      if (j < 0) throw new Error(`Corner at ${CORNERS[i]} has an impossible color combination`);
      cc.cp[i] = j;
      cc.co[i] = ori;
    }
    for (let i = 0; i < 12; i++) {
      const [a, b] = EDGE_FACELETS[i].map((s) => f[s]);
      let j = EDGE_COLORS.findIndex((c) => c[0] === a && c[1] === b);
      if (j >= 0) {
        cc.ep[i] = j;
        cc.eo[i] = 0;
        continue;
      }
      j = EDGE_COLORS.findIndex((c) => c[0] === b && c[1] === a);
      if (j < 0) throw new Error(`Edge at ${EDGES[i]} has an impossible color combination`);
      cc.ep[i] = j;
      cc.eo[i] = 1;
    }
    return cc;
  }

  toFacelets() {
    const f = Array(54);
    CENTERS.forEach((i, face) => (f[i] = FACES[face]));
    for (let i = 0; i < 8; i++)
      for (let n = 0; n < 3; n++) f[CORNER_FACELETS[i][(n + this.co[i]) % 3]] = CORNER_COLORS[this.cp[i]][n];
    for (let i = 0; i < 12; i++)
      for (let n = 0; n < 2; n++) f[EDGE_FACELETS[i][(n + this.eo[i]) % 2]] = EDGE_COLORS[this.ep[i]][n];
    return f.join('');
  }

  // A 2x2 has no centers, so the DBL corner defines the frame: its colors name
  // the D, B and L faces and their opposites name U, F and R.
  static fromFacelets2x2(facelets) {
    if (typeof facelets !== 'string' || facelets.length !== 24) throw new Error('A 2x2 has 24 stickers');
    for (const face of FACES) {
      const n = [...facelets].filter((c) => c === face).length;
      if (n !== 4) throw new Error(`Color ${face} appears ${n} times, expected 4`);
    }
    const [d, b, l] = CORNER_FACELETS[6].map((i) => facelets[to2x2(i)]);
    const relabel = { [d]: 'D', [OPPOSITE[d]]: 'U', [b]: 'B', [OPPOSITE[b]]: 'F', [l]: 'L', [OPPOSITE[l]]: 'R' };
    if (Object.keys(relabel).length !== 6) throw new Error('Corner at DBL has an impossible color combination');
    const expanded = [...new CubieCube().toFacelets()];
    for (const corner of CORNER_FACELETS) for (const i of corner) expanded[i] = relabel[facelets[to2x2(i)]];
    return CubieCube.fromFacelets(expanded.join(''));
  }

  toFacelets2x2() {
    const f = this.toFacelets();
    const out = Array(24);
    for (const corner of CORNER_FACELETS) for (const i of corner) out[to2x2(i)] = f[i];
    return out.join('');
  }

  // Returns null when the cube is reachable from solved, else the reason it is not.
  verify() {
    if (new Set(this.ep).size !== 12) return 'Some edge appears more than once';
    if (this.eo.reduce((a, b) => a + b, 0) % 2) return 'One edge is flipped';
    const corners = this.verifyCorners();
    if (corners) return corners;
    if (parity(this.cp) !== parity(this.ep)) return 'Two pieces are swapped (parity error)';
    return null;
  }

  // A 2x2 has no edges, so corner permutation parity is free there.
  verifyCorners() {
    if (new Set(this.cp).size !== 8) return 'Some corner appears more than once';
    if (this.co.reduce((a, b) => a + b, 0) % 3) return 'One corner is twisted';
    return null;
  }

  static random(random = Math.random) {
    const cp = shuffle(range(8), random);
    const ep = shuffle(range(12), random);
    if (parity(cp) !== parity(ep)) [ep[0], ep[1]] = [ep[1], ep[0]];
    const co = range(8).map(() => Math.floor(random() * 3));
    const eo = range(12).map(() => Math.floor(random() * 2));
    co[7] = (3 - (co.slice(0, 7).reduce((a, b) => a + b, 0) % 3)) % 3;
    eo[11] = eo.slice(0, 11).reduce((a, b) => a + b, 0) % 2;
    return new CubieCube(cp, co, ep, eo);
  }
}
