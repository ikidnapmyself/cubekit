import { CubieCube } from '@cubekit/engine';
import { permIndex, setPerm } from './coords.js';
import { MOVE_CUBIES, MOVE_NAMES } from './tables.js';

// 2x2 solver. The DBL corner is held fixed, so only U, R and F turn and the
// state is the permutation of the other seven corners (7! = 5040) times their
// orientation (3^6 = 729). A full breadth-first distance table over all
// 3,674,160 states makes every solution optimal in face turns (at most 11).
const N_PERM = 5040;
const N_TWIST = 729;
const MOVES = [0, 1, 2, 3, 4, 5, 6, 7, 8]; // U U2 U' R R2 R' F F2 F'
const FREE = [0, 1, 2, 3, 4, 5, 7];

function getPerm(c) {
  return permIndex(FREE.map((p) => (c.cp[p] === 7 ? 6 : c.cp[p])), 0, 7);
}

function setPermCoord(c, idx) {
  const values = Array(7);
  setPerm(values, 0, 7, 0, idx);
  FREE.forEach((p, i) => (c.cp[p] = values[i] === 6 ? 7 : values[i]));
  c.cp[6] = 6;
}

function getTwist(c) {
  let t = 0;
  for (let p = 0; p < 6; p++) t = 3 * t + c.co[p];
  return t;
}

function setTwist(c, t) {
  let sum = 0;
  for (let p = 5; p >= 0; p--) {
    c.co[p] = t % 3;
    sum += c.co[p];
    t = Math.floor(t / 3);
  }
  c.co[6] = 0;
  c.co[7] = (3 - (sum % 3)) % 3;
}

function moveTable(size, set, get) {
  const table = new Uint16Array(size * MOVES.length);
  const c = new CubieCube();
  for (let i = 0; i < size; i++) {
    set(c, i);
    for (const m of MOVES) table[i * MOVES.length + m] = get(c.multiply(MOVE_CUBIES[m]));
  }
  return table;
}

export function buildTwoByTwoTables() {
  const permMove = moveTable(N_PERM, setPermCoord, getPerm);
  const twistMove = moveTable(N_TWIST, setTwist, getTwist);
  const distance = new Int8Array(N_PERM * N_TWIST).fill(-1);
  distance[0] = 0;
  let frontier = [0];
  for (let depth = 0; frontier.length; depth++) {
    const next = [];
    for (const i of frontier) {
      const p = Math.floor(i / N_TWIST);
      const t = i - p * N_TWIST;
      for (const m of MOVES) {
        const j = permMove[p * MOVES.length + m] * N_TWIST + twistMove[t * MOVES.length + m];
        if (distance[j] === -1) {
          distance[j] = depth + 1;
          next.push(j);
        }
      }
    }
    frontier = next;
  }
  return { permMove, twistMove, distance };
}

export function solveTwoByTwo(cc, tables) {
  const { permMove, twistMove, distance } = tables;
  let p = getPerm(cc);
  let t = getTwist(cc);
  const solution = [];
  while (distance[p * N_TWIST + t] > 0) {
    const d = distance[p * N_TWIST + t];
    const m = MOVES.find(
      (m) => distance[permMove[p * MOVES.length + m] * N_TWIST + twistMove[t * MOVES.length + m]] === d - 1,
    );
    solution.push(MOVE_NAMES[m]);
    p = permMove[p * MOVES.length + m];
    t = twistMove[t * MOVES.length + m];
  }
  return solution.join(' ');
}
