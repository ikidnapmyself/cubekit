import { Cube, CubieCube, FACE_MOVES } from '@cubekit/engine';
import * as C from './coords.js';

// Move m = 3 * face + power, faces in URFDLB order, power 0/1/2 = quarter/half/inverse.
export const N_MOVES = 18;
export const MOVE_NAMES = FACE_MOVES.flatMap((f) => [f, `${f}2`, `${f}'`]);
export const PHASE2_MOVES = [0, 1, 2, 4, 7, 9, 10, 11, 13, 16]; // U* R2 F2 D* L2 B2

export const MOVE_CUBIES = FACE_MOVES.flatMap((face) => {
  const quarter = new Cube().move(face).toCubie();
  const powers = [quarter];
  for (let k = 1; k < 3; k++) powers.push(powers[k - 1].multiply(quarter));
  return powers;
});

const ALL_MOVES = [...Array(N_MOVES).keys()];

function moveTable(size, set, get, moves = ALL_MOVES) {
  const table = new Uint16Array(size * N_MOVES);
  const c = new CubieCube();
  for (let i = 0; i < size; i++) {
    set(c, i);
    for (const m of moves) table[i * N_MOVES + m] = get(c.multiply(MOVE_CUBIES[m]));
  }
  return table;
}

// Breadth-first distance to solved over the product of two coordinates.
function pruneTable(n1, n2, move1, move2, moves) {
  const n = n1 * n2;
  const table = new Int8Array(n).fill(-1);
  table[0] = 0;
  let filled = 1;
  for (let depth = 0; filled < n; depth++) {
    const before = filled;
    for (let i = 0; i < n; i++) {
      if (table[i] !== depth) continue;
      const a = Math.floor(i / n2);
      const b = i - a * n2;
      for (const m of moves) {
        const j = move1[a * N_MOVES + m] * n2 + move2[b * N_MOVES + m];
        if (table[j] === -1) {
          table[j] = depth + 1;
          filled++;
        }
      }
    }
    if (filled === before) throw new Error('Pruning table has unreachable entries');
  }
  return table;
}

export function buildTables() {
  const twistMove = moveTable(C.N_TWIST, C.setTwist, C.getTwist);
  const flipMove = moveTable(C.N_FLIP, C.setFlip, C.getFlip);
  const sliceMove = moveTable(C.N_SLICE, C.setSlice, C.getSlice);
  const cornerPermMove = moveTable(C.N_CORNER_PERM, C.setCornerPerm, C.getCornerPerm, PHASE2_MOVES);
  const edge8PermMove = moveTable(C.N_EDGE8_PERM, C.setEdge8Perm, C.getEdge8Perm, PHASE2_MOVES);
  const slicePermMove = moveTable(C.N_SLICE_PERM, C.setSlicePerm, C.getSlicePerm, PHASE2_MOVES);

  return {
    twistMove,
    flipMove,
    sliceMove,
    cornerPermMove,
    edge8PermMove,
    slicePermMove,
    twistSlicePrune: pruneTable(C.N_TWIST, C.N_SLICE, twistMove, sliceMove, ALL_MOVES),
    flipSlicePrune: pruneTable(C.N_FLIP, C.N_SLICE, flipMove, sliceMove, ALL_MOVES),
    cornerSlicePrune: pruneTable(C.N_CORNER_PERM, C.N_SLICE_PERM, cornerPermMove, slicePermMove, PHASE2_MOVES),
    edgeSlicePrune: pruneTable(C.N_EDGE8_PERM, C.N_SLICE_PERM, edge8PermMove, slicePermMove, PHASE2_MOVES),
  };
}
