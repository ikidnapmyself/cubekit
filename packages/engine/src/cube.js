import { FACES, assertSize } from './geometry.js';
import { permutation } from './moves.js';
import { parseAlgorithm } from './notation.js';
import { CubieCube } from './cubie.js';

const solvedFacelets = (size) => FACES.map((f) => f.repeat(size * size)).join('');

export const SOLVED = solvedFacelets(3);

function sizeOf(facelets) {
  const size = Math.round(Math.sqrt(facelets.length / 6));
  if (6 * size * size !== facelets.length) throw new Error(`${facelets.length} stickers is not a valid cube`);
  assertSize(size);
  return size;
}

// Immutable NxN cube. Stickers are stored as the letter of the face they belong
// to when solved, face by face in URFDLB order, each face row-major
// (for 3x3 this is Kociemba's U1..U9 R1..R9 F.. D.. L.. B..).
export class Cube {
  #facelets;
  #size;

  constructor(facelets = SOLVED) {
    if (typeof facelets !== 'string' || !/^[URFDLB]+$/.test(facelets))
      throw new Error('Facelets must be a string of URFDLB letters');
    this.#size = sizeOf(facelets);
    this.#facelets = facelets;
  }

  static solved(size = 3) {
    assertSize(size);
    return new Cube(solvedFacelets(size));
  }

  static fromString(facelets) {
    return new Cube(facelets.replace(/\s+/g, ''));
  }

  static fromAlgorithm(alg, size = 3) {
    return Cube.solved(size).move(alg);
  }

  // Uniformly random reachable state. Only 2x2 and 3x3 have a piece model.
  static random(random = Math.random, size = 3) {
    const cc = CubieCube.random(random);
    if (size === 3) return new Cube(cc.toFacelets());
    if (size === 2) return new Cube(cc.toFacelets2x2());
    throw new Error('Random states are only available for 2x2 and 3x3; use randomMoves for bigger cubes');
  }

  get size() {
    return this.#size;
  }

  get facelets() {
    return this.#facelets;
  }

  move(alg) {
    let state = [...this.#facelets];
    for (const { name, amount } of parseAlgorithm(alg)) {
      const perm = permutation(name, amount, this.#size);
      state = perm.map((i) => state[i]);
    }
    return new Cube(state.join(''));
  }

  face(name) {
    const f = FACES.indexOf(name);
    if (f < 0) throw new Error(`Unknown face "${name}"`);
    const area = this.#size * this.#size;
    return [...this.#facelets.slice(f * area, (f + 1) * area)];
  }

  sticker(index) {
    return this.#facelets[index];
  }

  withSticker(index, color) {
    const f = [...this.#facelets];
    f[index] = color;
    return new Cube(f.join(''));
  }

  // Solved in any whole-cube orientation.
  isSolved() {
    const area = this.#size * this.#size;
    for (let f = 0; f < 6; f++) {
      const face = this.#facelets.slice(f * area, (f + 1) * area);
      if (face !== face[0].repeat(area)) return false;
    }
    return true;
  }

  // 3x3: the full piece model. 2x2: corners only, oriented so DBL stays put.
  toCubie() {
    if (this.#size === 3) return CubieCube.fromFacelets(this.#facelets);
    if (this.#size === 2) return CubieCube.fromFacelets2x2(this.#facelets);
    throw new Error('Piece model is only available for 2x2 and 3x3');
  }

  // 2x2 and 3x3 are checked fully. Bigger cubes only get a color count, since
  // their centers and edge wings have no fixed reference to check against.
  validate() {
    try {
      const area = this.#size * this.#size;
      for (const face of FACES) {
        const n = [...this.#facelets].filter((c) => c === face).length;
        if (n !== area) throw new Error(`Color ${face} appears ${n} times, expected ${area}`);
      }
      if (this.#size > 3) return { valid: true, error: null };
      const cc = this.toCubie();
      const error = this.#size === 3 ? cc.verify() : cc.verifyCorners();
      return error ? { valid: false, error } : { valid: true, error: null };
    } catch (e) {
      return { valid: false, error: e.message };
    }
  }

  equals(other) {
    return other instanceof Cube && other.facelets === this.#facelets;
  }

  toString() {
    return this.#facelets;
  }
}
