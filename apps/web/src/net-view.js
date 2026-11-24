import { FACES } from '@cubekit/engine';
import { COLORS } from './cube-view.js';

// Unfolded cross: U above F, then L F R B in a row, D below F. Offsets in faces.
const OFFSETS = { U: [0, 1], L: [1, 0], F: [1, 1], R: [1, 2], B: [1, 3], D: [2, 1] };

export class NetView {
  #stickers = [];
  #root;
  #onStickerClick;

  constructor(container, { onStickerClick = () => {} } = {}) {
    this.#root = container;
    this.#root.classList.add('net');
    this.#onStickerClick = onStickerClick;
    this.setSize(3);
  }

  setSize(size) {
    const area = size * size;
    const middle = size % 2 ? (area - 1) / 2 : -1;
    this.#root.style.setProperty('--n', size);
    this.#root.style.gridTemplateColumns = `repeat(${4 * size}, 1fr)`;
    this.#root.replaceChildren();
    this.#stickers = [];
    FACES.forEach((face, f) => {
      const [faceRow, faceCol] = OFFSETS[face];
      for (let i = 0; i < area; i++) {
        const el = document.createElement('button');
        el.type = 'button';
        el.className = 'net-sticker';
        el.style.gridRow = String(faceRow * size + Math.floor(i / size) + 1);
        el.style.gridColumn = String(faceCol * size + (i % size) + 1);
        el.title = `${face}${i + 1}`;
        if (i === middle) {
          el.classList.add('center');
          el.textContent = size <= 5 ? face : '';
          el.disabled = true;
        } else {
          el.addEventListener('click', () => this.#onStickerClick(f * area + i));
        }
        this.#root.append(el);
        this.#stickers.push(el);
      }
    });
  }

  setState(facelets) {
    this.#stickers.forEach((el, i) => (el.style.background = COLORS[facelets[i]]));
  }

  setEditable(editable) {
    this.#root.classList.toggle('editable', editable);
  }
}
