import { Cube, CubieCube, invertAlgorithm } from '@cubekit/engine';
import * as C from './coords.js';
import { buildTables, MOVE_CUBIES, MOVE_NAMES, N_MOVES, PHASE2_MOVES } from './tables.js';
import { buildTwoByTwoTables, solveTwoByTwo } from './two.js';

export const SOLVABLE_SIZES = Object.freeze([2, 3]);

export class SolverTimeoutError extends Error {
  constructor(ms) {
    super(`No solution found within ${ms} ms`);
    this.name = 'SolverTimeoutError';
  }
}

const isPhase2Move = (m) => {
  const face = Math.floor(m / 3);
  return face === 0 || face === 3 || m % 3 === 1;
};

// Skip turning the same face twice in a row, and fix the order of opposite faces.
const redundant = (face, prevFace) => face === prevFace || face === prevFace - 3;

function toCube(input) {
  if (input instanceof Cube) return input;
  if (typeof input === 'string') return Cube.fromString(input);
  throw new TypeError('Expected a Cube, CubieCube or facelet string');
}

// 3x3: Kociemba's two-phase algorithm. Phase 1 reaches the subgroup
// <U, D, R2, F2, L2, B2> using orientation and slice coordinates, phase 2 solves
// within it using permutation coordinates.
// 2x2: optimal, from a full distance table (see two.js).
// Each size's tables are built once, on first use.
export class Solver {
  #tables = null;
  #twoTables = null;

  get ready() {
    return this.#tables !== null;
  }

  init({ sizes = [3] } = {}) {
    if (sizes.includes(3)) this.#tables ??= buildTables();
    if (sizes.includes(2)) this.#twoTables ??= buildTwoByTwoTables();
    return this;
  }

  // Finds a solution of at most `maxLength` moves, then, if `improveForMs` > 0,
  // keeps searching for strictly shorter ones until that budget runs out.
  // A 2x2 always gets an optimal solution, so the options only apply to 3x3.
  solve(input, { maxLength = 21, timeoutMs = 10_000, improveForMs = 0 } = {}) {
    if (!(input instanceof CubieCube)) {
      const full = toCube(input);
      if (full.size === 2) return this.#solveTwoByTwo(full);
      if (full.size !== 3) throw new Error(`No solver for ${full.size}x${full.size} yet; only 2x2 and 3x3`);
      input = full.toCubie();
    }
    const cube = input;
    const error = cube.verify();
    if (error) throw new Error(`Unsolvable cube: ${error}`);
    if (cube.isSolved()) return '';
    this.init();

    let best = this.#search(cube, maxLength, Date.now() + timeoutMs, timeoutMs);
    if (best === null) throw new Error(`No solution of at most ${maxLength} moves exists`);
    const improveUntil = Date.now() + improveForMs;
    while (improveForMs > 0 && best.length > 1) {
      try {
        const shorter = this.#search(cube, best.length - 1, improveUntil, improveForMs);
        if (shorter === null) break;
        best = shorter;
      } catch (e) {
        if (e instanceof SolverTimeoutError) break;
        throw e;
      }
    }
    return best.join(' ');
  }

  #solveTwoByTwo(cube) {
    const cc = cube.toCubie();
    const error = cc.verifyCorners();
    if (error) throw new Error(`Unsolvable cube: ${error}`);
    this.init({ sizes: [2] });
    return solveTwoByTwo(cc, this.#twoTables);
  }

  #search(cube, maxLength, deadline, timeoutMs) {
    const t = this.#tables;
    const moves1 = new Int8Array(32);
    const moves2 = new Int8Array(32);
    let length2 = 0;
    let nodes = 0;

    const tick = () => {
      if ((++nodes & 0xffff) === 0 && Date.now() > deadline) throw new SolverTimeoutError(timeoutMs);
    };
    const h1 = (twist, flip, slice) =>
      Math.max(t.twistSlicePrune[twist * C.N_SLICE + slice], t.flipSlicePrune[flip * C.N_SLICE + slice]);
    const h2 = (cp, ep, sp) =>
      Math.max(t.cornerSlicePrune[cp * C.N_SLICE_PERM + sp], t.edgeSlicePrune[ep * C.N_SLICE_PERM + sp]);

    const phase2 = (cp, ep, sp, depth, togo, prevFace) => {
      if (togo === 0) return cp === 0 && ep === 0 && sp === 0;
      tick();
      for (const m of PHASE2_MOVES) {
        const face = Math.floor(m / 3);
        if (redundant(face, prevFace)) continue;
        const ncp = t.cornerPermMove[cp * N_MOVES + m];
        const nep = t.edge8PermMove[ep * N_MOVES + m];
        const nsp = t.slicePermMove[sp * N_MOVES + m];
        if (h2(ncp, nep, nsp) >= togo) continue;
        moves2[depth] = m;
        if (phase2(ncp, nep, nsp, depth + 1, togo - 1, face)) return true;
      }
      return false;
    };

    const startPhase2 = (length1) => {
      let c = cube;
      for (let i = 0; i < length1; i++) c = c.multiply(MOVE_CUBIES[moves1[i]]);
      const cp = C.getCornerPerm(c);
      const ep = C.getEdge8Perm(c);
      const sp = C.getSlicePerm(c);
      const prevFace = length1 > 0 ? Math.floor(moves1[length1 - 1] / 3) : -1;
      for (let depth = h2(cp, ep, sp); depth <= maxLength - length1; depth++) {
        if (phase2(cp, ep, sp, 0, depth, prevFace)) {
          length2 = depth;
          return true;
        }
      }
      return false;
    };

    const phase1 = (twist, flip, slice, depth, togo) => {
      if (togo === 0) {
        // A phase-1 path ending in a phase-2 move was already tried one move shorter.
        if (depth > 0 && isPhase2Move(moves1[depth - 1])) return false;
        return startPhase2(depth);
      }
      tick();
      const prevFace = depth > 0 ? Math.floor(moves1[depth - 1] / 3) : -1;
      for (let m = 0; m < N_MOVES; m++) {
        if (redundant(Math.floor(m / 3), prevFace)) continue;
        const nt = t.twistMove[twist * N_MOVES + m];
        const nf = t.flipMove[flip * N_MOVES + m];
        const ns = t.sliceMove[slice * N_MOVES + m];
        if (h1(nt, nf, ns) >= togo) continue;
        moves1[depth] = m;
        if (phase1(nt, nf, ns, depth + 1, togo - 1)) return true;
      }
      return false;
    };

    const twist = C.getTwist(cube);
    const flip = C.getFlip(cube);
    const slice = C.getSlice(cube);
    for (let length1 = h1(twist, flip, slice); length1 <= maxLength; length1++) {
      if (phase1(twist, flip, slice, 0, length1)) {
        return [...moves1.slice(0, length1), ...moves2.slice(0, length2)].map((m) => MOVE_NAMES[m]);
      }
    }
    return null;
  }

  // A scramble for a uniformly random reachable state (the WCA approach).
  randomScramble({ size = 3, random = Math.random, ...options } = {}) {
    return invertAlgorithm(this.solve(Cube.random(random, size), options));
  }
}

let shared;
const sharedSolver = () => (shared ??= new Solver());

export const solve = (input, options) => sharedSolver().solve(input, options);
export const randomScramble = (options) => sharedSolver().randomScramble(options);
export const initSolver = (options) => sharedSolver().init(options);
