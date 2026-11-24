import { canonicalMoveName } from './moves.js';

const WIDE_ALIASES = { u: 'Uw', r: 'Rw', f: 'Fw', d: 'Dw', l: 'Lw', b: 'Bw' };
const TOKEN = /(\d*[URFDLB]w|\d*[URFDLB]|[MESxyzurfdlb])(2'|'2|2|3|'|)/y;
const SUFFIX = ['', '', '2', "'"];

export function createMove(name, amount = 1) {
  const canonical = canonicalMoveName(WIDE_ALIASES[name] ?? name);
  if (!canonical) throw new Error(`Unknown move "${name}"`);
  amount = ((amount % 4) + 4) % 4;
  if (amount === 0) throw new Error('A move must turn by a non-zero amount');
  return Object.freeze({ name: canonical, amount });
}

function amountOf(suffix) {
  if (suffix === '') return 1;
  if (suffix === "'" || suffix === '3') return 3;
  return 2;
}

export function parseAlgorithm(input) {
  if (Array.isArray(input)) return input.map((m) => createMove(m.name, m.amount));
  const text = String(input).replace(/[(),]/g, ' ');
  const moves = [];
  let i = 0;
  while (i < text.length) {
    if (/\s/.test(text[i])) {
      i++;
      continue;
    }
    TOKEN.lastIndex = i;
    const match = TOKEN.exec(text);
    if (!match) throw new SyntaxError(`Unexpected "${text[i]}" at position ${i} in "${input}"`);
    moves.push(createMove(match[1], amountOf(match[2])));
    i = TOKEN.lastIndex;
  }
  return moves;
}

export const parseMove = (token) => {
  const moves = parseAlgorithm(token);
  if (moves.length !== 1) throw new SyntaxError(`Expected a single move, got "${token}"`);
  return moves[0];
};

export const formatMove = (move) => move.name + SUFFIX[move.amount];

export const formatAlgorithm = (alg) => parseAlgorithm(alg).map(formatMove).join(' ');

export function invertAlgorithm(alg) {
  return formatAlgorithm(
    parseAlgorithm(alg)
      .reverse()
      .map((m) => createMove(m.name, 4 - m.amount)),
  );
}

export function simplifyAlgorithm(alg) {
  const stack = [];
  for (const move of parseAlgorithm(alg)) {
    const top = stack.at(-1);
    if (top?.name === move.name) {
      stack.pop();
      const amount = (top.amount + move.amount) % 4;
      if (amount) stack.push(createMove(move.name, amount));
    } else {
      stack.push(move);
    }
  }
  return formatAlgorithm(stack);
}

const SCRAMBLE_LENGTH = { 2: 11, 3: 25, 4: 40, 5: 60, 6: 80, 7: 100 };

// Random-move scramble in WCA big-cube style (R, Rw, 3Rw ...). Moves on the
// same axis are never the same layer set twice in a row.
export function randomMoves(size = 3, length = SCRAMBLE_LENGTH[size] ?? 20 * size - 40, random = Math.random) {
  const axisOf = { U: 0, D: 0, R: 1, L: 1, F: 2, B: 2 };
  const maxDepth = Math.max(1, Math.floor(size / 2));
  const faces = size === 2 ? ['U', 'R', 'F'] : ['U', 'D', 'R', 'L', 'F', 'B'];
  const moves = [];
  let axis = -1;
  let usedOnAxis = new Set();
  while (moves.length < length) {
    const face = faces[Math.floor(random() * faces.length)];
    const depth = 1 + Math.floor(random() * maxDepth);
    const name = depth === 1 ? face : depth === 2 ? `${face}w` : `${depth}${face}w`;
    if (axisOf[face] === axis && usedOnAxis.has(name)) continue;
    if (axisOf[face] !== axis) {
      axis = axisOf[face];
      usedOnAxis = new Set();
    }
    usedOnAxis.add(name);
    moves.push(createMove(name, 1 + Math.floor(random() * 3)));
  }
  return formatAlgorithm(moves);
}
