import { Cube, FACES, createMove, formatMove, parseAlgorithm, randomMoves } from '@cubekit/engine';
import { CubeView, COLORS } from './cube-view.js';
import { NetView } from './net-view.js';
import { SolverClient } from './solver-client.js';

const $ = (id) => document.getElementById(id);
const inverse = (move) => createMove(move.name, 4 - move.amount);
const SOLVABLE = new Set([2, 3]);

const app = {
  size: 3,
  cube: new Cube(),
  queue: [],
  busy: false,
  generation: 0,
  history: [],
  solution: null,
  scramble: '',
  editing: false,
  paint: 'U',
  solverReady: false,
  solving: false,
  speed: Number($('speed').value),
};

const view = new CubeView($('viewport'), {
  onTurn: (move) => userMoves([move]),
  onStickerClick: (index) => app.editing && paintSticker(index),
});
const net = new NetView($('net'), { onStickerClick: (index) => paintSticker(index) });
const solver = new SolverClient();

function sync() {
  view.setState(app.cube.facelets);
  net.setState(app.cube.facelets);
}

// Every turn goes through one queue so animations never overlap. Bumping
// `generation` cancels whatever is queued or mid-animation.
function enqueue(items) {
  for (const item of items) app.queue.push({ ...item, generation: app.generation });
  pump();
}

async function pump() {
  if (app.busy) return;
  app.busy = true;
  render();
  while (app.queue.length) {
    const item = app.queue.shift();
    if (item.generation !== app.generation) continue;
    const quarter = item.fast ? Math.min(70, app.speed) : app.speed;
    let applied = false;
    try {
      await view.animate(item.move, item.move.amount === 2 ? quarter * 1.5 : quarter, () => {
        if (item.generation !== app.generation) return;
        app.cube = app.cube.move([item.move]);
        applied = true;
        sync();
      });
    } catch (e) {
      console.error(e);
    }
    if (applied) item.after?.();
    render();
  }
  app.busy = false;
  render();
}

function cancelAll() {
  app.generation++;
  app.queue.length = 0;
  if (app.solution) app.solution.playing = false;
}

function userMoves(moves) {
  if (app.solution) {
    app.solution.playing = false;
    app.solution = null;
  }
  enqueue(moves.map((move) => ({ move, after: () => app.history.push(move) })));
}

function undo() {
  if (app.busy || !app.history.length) return;
  app.solution = null;
  const move = app.history.pop();
  enqueue([{ move: inverse(move) }]);
}

function setCube(cube) {
  cancelAll();
  app.cube = cube;
  app.history = [];
  app.solution = null;
  sync();
  render();
}

function setSize(size) {
  app.size = size;
  app.scramble = '';
  view.setSize(size);
  net.setSize(size);
  buildPad();
  setCube(Cube.solved(size));
}

// 2x2 and 3x3 get uniformly random states from the solver; bigger cubes get
// WCA-style random moves.
async function scramble() {
  try {
    const size = app.size;
    const alg = SOLVABLE.has(size) ? await solver.scramble(size) : randomMoves(size);
    if (size !== app.size) return;
    setCube(Cube.solved(size));
    app.scramble = alg;
    enqueue(parseAlgorithm(alg).map((move) => ({ move, fast: true })));
  } catch (e) {
    $('solver-status').textContent = e.message;
  }
}

async function solve() {
  if (!SOLVABLE.has(app.size)) return;
  const { valid, error } = app.cube.validate();
  if (!valid) {
    $('edit-error').textContent = error;
    return;
  }
  const facelets = app.cube.facelets;
  app.solving = true;
  render();
  try {
    const started = performance.now();
    const text = await solver.solve(facelets);
    if (app.cube.facelets !== facelets) return;
    app.solution = {
      moves: text ? parseAlgorithm(text) : [],
      index: 0,
      playing: false,
      start: facelets,
      ms: Math.round(performance.now() - started),
    };
  } catch (e) {
    $('edit-error').textContent = e.message;
  } finally {
    app.solving = false;
    render();
  }
}

function step(direction) {
  const s = app.solution;
  if (!s) return;
  if (direction > 0 && s.index >= s.moves.length) return;
  if (direction < 0 && s.index <= 0) return;
  const move = direction > 0 ? s.moves[s.index] : inverse(s.moves[s.index - 1]);
  enqueue([
    {
      move,
      after: () => {
        s.index += direction;
        if (direction > 0) app.history.push(move);
        else app.history.pop();
        if (s.playing) {
          if (s.index < s.moves.length) step(1);
          else s.playing = false;
        }
      },
    },
  ]);
}

function togglePlay() {
  const s = app.solution;
  if (!s) return;
  if (s.playing) {
    s.playing = false;
  } else if (s.index < s.moves.length) {
    s.playing = true;
    if (!app.busy) step(1);
  }
  render();
}

function jump(toEnd) {
  const s = app.solution;
  if (!s || app.busy) return;
  const done = s.moves.slice(0, s.index);
  const target = toEnd ? s.moves.length : 0;
  app.history.splice(app.history.length - done.length, done.length);
  if (toEnd) app.history.push(...s.moves);
  app.cube = new Cube(s.start).move(s.moves.slice(0, target));
  s.index = target;
  sync();
  render();
}

function paintSticker(index) {
  const area = app.size * app.size;
  if (!app.editing || (app.size % 2 && index % area === (area - 1) / 2)) return;
  setCube(app.cube.withSticker(index, app.paint));
}

function render() {
  const { cube, solution: s, busy } = app;
  const validity = cube.validate();
  const solved = cube.isSolved();

  $('status').textContent = solved ? 'Solved' : validity.valid ? 'Scrambled' : 'Invalid';
  $('status').dataset.state = solved ? 'solved' : validity.valid ? 'scrambled' : 'invalid';
  $('edit-error').textContent = app.editing && !validity.valid ? validity.error : '';
  $('scramble-text').textContent = app.scramble ? `Scramble: ${app.scramble}` : '';

  const solvable = SOLVABLE.has(app.size);
  $('scramble').disabled = (solvable && !app.solverReady) || app.solving;
  $('solve').disabled = !solvable || !app.solverReady || busy || app.solving || solved || !validity.valid;
  $('solve').textContent = app.solving ? 'Solving…' : 'Solve';
  $('solve').title = solvable ? '' : 'The solver handles 2x2 and 3x3 only';
  $('size').disabled = app.solving;
  $('undo').disabled = busy || !app.history.length;
  $('edit').disabled = busy;
  $('speed-out').textContent = `${app.speed} ms`;

  $('solution-box').hidden = !s;
  if (s) {
    $('solution-meta').textContent = s.moves.length
      ? `${s.moves.length} moves · ${s.ms} ms · ${s.index}/${s.moves.length}`
      : 'already solved';
    $('solution').replaceChildren(
      ...s.moves.map((move, i) => {
        const chip = document.createElement('span');
        chip.className = 'chip';
        if (i < s.index) chip.classList.add('done');
        if (i === s.index) chip.classList.add('current');
        chip.textContent = formatMove(move);
        return chip;
      }),
    );
    const atStart = s.index === 0;
    const atEnd = s.index === s.moves.length;
    $('sol-start').disabled = busy || atStart;
    $('sol-prev').disabled = busy || atStart;
    $('sol-next').disabled = busy || atEnd;
    $('sol-end').disabled = busy || atEnd;
    $('sol-play').disabled = atEnd && !s.playing;
    $('sol-play').textContent = s.playing ? 'Pause' : 'Play';
  }
}

// Faces always; wide turns from 4x4 up; middle slices on odd sizes. Any other
// slice is a drag away.
function buildPad() {
  const pad = $('pad');
  pad.replaceChildren();
  const names = ['U', 'D', 'R', 'L', 'F', 'B'];
  if (app.size >= 4) names.push('Uw', 'Dw', 'Rw', 'Lw', 'Fw', 'Bw');
  if (app.size % 2) names.push('M', 'E', 'S');
  names.push('x', 'y', 'z');
  for (const name of names) {
    for (const amount of [1, 3, 2]) {
      const move = createMove(name, amount);
      const button = document.createElement('button');
      button.textContent = formatMove(move);
      button.addEventListener('click', () => userMoves([move]));
      pad.append(button);
    }
  }
}

function buildPalette() {
  const palette = $('palette');
  for (const face of FACES) {
    const swatch = document.createElement('button');
    swatch.className = 'swatch';
    swatch.style.background = COLORS[face];
    swatch.title = face;
    swatch.addEventListener('click', () => {
      app.paint = face;
      for (const el of palette.children) el.classList.toggle('selected', el === swatch);
    });
    if (face === app.paint) swatch.classList.add('selected');
    palette.append(swatch);
  }
}

const KEYS = { u: 'U', r: 'R', f: 'F', d: 'D', l: 'L', b: 'B', m: 'M', e: 'E', s: 'S', x: 'x', y: 'y', z: 'z' };

document.addEventListener('keydown', (e) => {
  if (e.target.closest('input, textarea, select') || e.metaKey || e.ctrlKey || e.altKey) return;
  const name = KEYS[e.key.toLowerCase()];
  if (name && 'MES'.includes(name) && app.size % 2 === 0) return;
  if (name) {
    e.preventDefault();
    userMoves([createMove(name, e.shiftKey ? 3 : 1)]);
  } else if (e.key === 'Backspace') {
    e.preventDefault();
    undo();
  } else if (e.key === 'ArrowRight' && !app.busy) {
    step(1);
  } else if (e.key === 'ArrowLeft' && !app.busy) {
    step(-1);
  } else if (e.key === ' ' && app.solution) {
    e.preventDefault();
    togglePlay();
  }
});

$('scramble').addEventListener('click', scramble);
$('solve').addEventListener('click', solve);
$('undo').addEventListener('click', undo);
$('reset').addEventListener('click', () => {
  app.scramble = '';
  setCube(Cube.solved(app.size));
  view.resetView();
});
$('sol-start').addEventListener('click', () => jump(false));
$('sol-end').addEventListener('click', () => jump(true));
$('sol-prev').addEventListener('click', () => step(-1));
$('sol-next').addEventListener('click', () => step(1));
$('sol-play').addEventListener('click', togglePlay);
$('speed').addEventListener('input', (e) => {
  app.speed = Number(e.target.value);
  render();
});
$('alg-form').addEventListener('submit', (e) => {
  e.preventDefault();
  try {
    const moves = parseAlgorithm($('alg').value);
    app.cube.move(moves);
    $('alg-error').textContent = '';
    userMoves(moves);
  } catch (err) {
    $('alg-error').textContent = err.message;
  }
});
$('size').addEventListener('change', (e) => setSize(Number(e.target.value)));
$('edit').addEventListener('change', (e) => {
  app.editing = e.target.checked;
  $('palette').hidden = !app.editing;
  net.setEditable(app.editing);
  document.body.classList.toggle('editing', app.editing);
  if (app.editing) cancelAll();
  render();
});

solver.ready
  .then(({ ms }) => {
    app.solverReady = true;
    $('solver-status').textContent = `Solver ready · tables ${ms} ms`;
    render();
  })
  .catch((e) => ($('solver-status').textContent = `Solver failed: ${e.message}`));

buildPad();
buildPalette();
sync();
render();
