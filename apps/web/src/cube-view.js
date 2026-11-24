import { stickers, stickerAt, moveDefinition, createMove, cross, dot } from '@cubekit/engine';

export const COLORS = {
  U: '#f4f4f4',
  R: '#d32f2f',
  F: '#1fa34a',
  D: '#ffd43b',
  L: '#ff7b1a',
  B: '#1e63d6',
};

const FACE_TRANSFORMS = [
  { normal: [0, 0, 1], css: 'translateZ(calc(var(--s) / 2))' },
  { normal: [0, 0, -1], css: 'rotateY(180deg) translateZ(calc(var(--s) / 2))' },
  { normal: [1, 0, 0], css: 'rotateY(90deg) translateZ(calc(var(--s) / 2))' },
  { normal: [-1, 0, 0], css: 'rotateY(-90deg) translateZ(calc(var(--s) / 2))' },
  { normal: [0, 1, 0], css: 'rotateX(90deg) translateZ(calc(var(--s) / 2))' },
  { normal: [0, -1, 0], css: 'rotateX(-90deg) translateZ(calc(var(--s) / 2))' },
];

const AXES = [
  [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
];
// Per axis: the face on the positive side, the face on the negative side, the middle slice.
const AXIS_MOVES = [['R', 'L', 'M'], ['U', 'D', 'E'], ['F', 'B', 'S']];
const DRAG_THRESHOLD = 10;

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const rad = (deg) => (deg * Math.PI) / 180;

// The engine works in doubled, right-handed y-up coordinates; CSS is y-down.
const baseTransform = ([x, y, z]) =>
  `translate3d(calc(${x / 2} * var(--s)), calc(${-y / 2} * var(--s)), calc(${z / 2} * var(--s)))`;

// Cubies never move: a turn animates the layer, then the stickers are recolored
// from the new engine state and the transforms snap back.
export class CubeView {
  #root;
  #cube;
  #cubies = [];
  #stickers = new Map();
  #rotX = -28;
  #rotY = -38;
  #drag = null;
  size = 3;

  constructor(container, { onTurn = () => {}, onStickerClick = () => {} } = {}) {
    this.onTurn = onTurn;
    this.onStickerClick = onStickerClick;
    this.#root = container;
    this.#root.classList.add('cube-viewport');
    this.#cube = document.createElement('div');
    this.#cube.className = 'cube';
    this.#root.append(this.#cube);
    this.setSize(3);
    this.#applyView();
    this.#bindPointer();
  }

  // Rebuilds the cubies for an NxN. Only the outer shell exists; interior
  // faces stay black so a turning layer looks solid.
  setSize(size) {
    this.size = size;
    this.#root.style.setProperty('--n', size);
    this.#cube.replaceChildren();
    this.#cubies = [];
    this.#stickers.clear();
    const m = size - 1;
    for (let x = -m; x <= m; x += 2)
      for (let y = -m; y <= m; y += 2)
        for (let z = -m; z <= m; z += 2) {
          if (Math.max(Math.abs(x), Math.abs(y), Math.abs(z)) !== m) continue;
          const position = [x, y, z];
          const el = document.createElement('div');
          el.className = 'cubie';
          el.style.transform = baseTransform(position);
          for (const { normal, css } of FACE_TRANSFORMS) {
            const face = document.createElement('div');
            face.className = 'face';
            face.style.transform = css;
            const index = stickerAt(position, normal, size);
            if (index !== undefined) {
              const sticker = document.createElement('div');
              sticker.className = 'sticker';
              sticker.dataset.sticker = index;
              face.append(sticker);
              this.#stickers.set(index, sticker);
            }
            el.append(face);
          }
          this.#cube.append(el);
          this.#cubies.push({ el, position });
        }
  }

  setState(facelets) {
    for (const [index, el] of this.#stickers) el.style.background = COLORS[facelets[index]];
  }

  animate(move, duration, commit) {
    const { axis, layers } = moveDefinition(move.name, this.size);
    const quarters = move.amount === 3 ? -1 : move.amount;
    const target = 90 * quarters;
    const layer = this.#cubies.filter((c) => layers.includes(dot(c.position, axis)));
    const rotate = (angle) => `rotate3d(${axis[0]}, ${-axis[1]}, ${axis[2]}, ${angle}deg)`;

    return new Promise((resolve) => {
      const start = performance.now();
      const frame = (now) => {
        const p = duration > 0 ? Math.min(1, (now - start) / duration) : 1;
        if (p < 1) {
          const angle = target * ease(p);
          for (const c of layer) c.el.style.transform = `${rotate(angle)} ${baseTransform(c.position)}`;
          requestAnimationFrame(frame);
          return;
        }
        commit();
        for (const c of layer) c.el.style.transform = baseTransform(c.position);
        resolve();
      };
      requestAnimationFrame(frame);
    });
  }

  resetView() {
    this.#rotX = -28;
    this.#rotY = -38;
    this.#applyView();
  }

  #applyView() {
    this.#cube.style.transform = `rotateX(${this.#rotX}deg) rotateY(${this.#rotY}deg)`;
  }

  // Screen-space direction of an engine-space vector under the current view.
  #project([x, y, z]) {
    const [cx, cy, cz] = [x, -y, z];
    const b = rad(this.#rotY);
    const a = rad(this.#rotX);
    const x1 = Math.cos(b) * cx + Math.sin(b) * cz;
    const z1 = -Math.sin(b) * cx + Math.cos(b) * cz;
    const y2 = Math.cos(a) * cy - Math.sin(a) * z1;
    return [x1, y2];
  }

  #moveForDrag(stickerIndex, dx, dy) {
    const { normal, position } = stickers(this.size)[stickerIndex];
    let best = null;
    for (const dir of AXES) {
      if (dot(dir, normal) !== 0) continue;
      const [px, py] = this.#project(dir);
      const len = Math.hypot(px, py);
      if (len < 0.2) continue;
      const score = (dx * px + dy * py) / len;
      if (!best || score > best.score) best = { score, dir };
    }
    if (!best) return null;
    // Dragging along `dir` on a face with outward `normal` turns positively about normal x dir.
    const spin = cross(normal, best.dir);
    const axisIndex = spin.findIndex((v) => v !== 0);
    const coordinate = position[axisIndex];
    const [positive, negative, middle] = AXIS_MOVES[axisIndex];
    let name = middle;
    if (coordinate !== 0) {
      const depth = (this.size - 1 - Math.abs(coordinate)) / 2 + 1;
      const face = coordinate > 0 ? positive : negative;
      name = depth === 1 ? face : `${depth}${face}`;
    }
    return createMove(name, dot(moveDefinition(name, this.size).axis, spin) === 1 ? 3 : 1);
  }

  #bindPointer() {
    const root = this.#root;
    root.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      const sticker = e.target.closest('[data-sticker]');
      this.#drag = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        lastX: e.clientX,
        lastY: e.clientY,
        sticker: sticker ? Number(sticker.dataset.sticker) : null,
        moved: false,
      };
      root.setPointerCapture(e.pointerId);
    });
    root.addEventListener('pointermove', (e) => {
      const d = this.#drag;
      if (!d || d.id !== e.pointerId) return;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      if (d.sticker === null) {
        this.#rotY += (e.clientX - d.lastX) * 0.5;
        this.#rotX = Math.max(-89, Math.min(89, this.#rotX - (e.clientY - d.lastY) * 0.5));
        this.#applyView();
        d.moved = true;
      } else if (!d.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
        d.moved = true;
        const move = this.#moveForDrag(d.sticker, dx, dy);
        if (move) this.onTurn(move);
      }
      d.lastX = e.clientX;
      d.lastY = e.clientY;
    });
    const end = (e) => {
      const d = this.#drag;
      if (!d || d.id !== e.pointerId) return;
      if (!d.moved && d.sticker !== null && e.type === 'pointerup') this.onStickerClick(d.sticker);
      this.#drag = null;
    };
    root.addEventListener('pointerup', end);
    root.addEventListener('pointercancel', end);
  }
}
