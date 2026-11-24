export const FACES = Object.freeze(['U', 'R', 'F', 'D', 'L', 'B']);
export const MIN_SIZE = 2;
export const MAX_SIZE = 12;

// Right-handed coordinates: +x = R, +y = U, +z = F. Coordinates are doubled so
// every size uses integers: an N-cube spans -(N-1) .. N-1 in steps of 2.
// Each face is read row-major in the standard Kociemba orientation (U seen from
// above with B on top, D seen from below with F on top, side faces with U on top).
const FRAMES = {
  U: { normal: [0, 1, 0], position: (r, c, m) => [2 * c - m, m, 2 * r - m] },
  R: { normal: [1, 0, 0], position: (r, c, m) => [m, m - 2 * r, m - 2 * c] },
  F: { normal: [0, 0, 1], position: (r, c, m) => [2 * c - m, m - 2 * r, m] },
  D: { normal: [0, -1, 0], position: (r, c, m) => [2 * c - m, -m, m - 2 * r] },
  L: { normal: [-1, 0, 0], position: (r, c, m) => [-m, m - 2 * r, 2 * c - m] },
  B: { normal: [0, 0, -1], position: (r, c, m) => [m - 2 * c, m - 2 * r, -m] },
};

export function assertSize(size) {
  if (!Number.isInteger(size) || size < MIN_SIZE || size > MAX_SIZE)
    throw new Error(`Cube size must be an integer from ${MIN_SIZE} to ${MAX_SIZE}`);
}

const key = (position, normal) => `${position}|${normal}`;
const geometryCache = new Map();

function geometry(size) {
  let g = geometryCache.get(size);
  if (g) return g;
  assertSize(size);
  const m = size - 1;
  const area = size * size;
  const stickers = Object.freeze(
    FACES.flatMap((face, f) =>
      Array.from({ length: area }, (_, i) => {
        const row = Math.floor(i / size);
        const col = i % size;
        return Object.freeze({
          index: f * area + i,
          face,
          row,
          col,
          position: Object.freeze(FRAMES[face].position(row, col, m)),
          normal: Object.freeze([...FRAMES[face].normal]),
        });
      }),
    ),
  );
  const lookup = new Map(stickers.map((s) => [key(s.position, s.normal), s.index]));
  geometryCache.set(size, (g = { stickers, lookup }));
  return g;
}

export const stickers = (size = 3) => geometry(size).stickers;

export const STICKERS = stickers(3);

export function stickerAt(position, normal, size = 3) {
  return geometry(size).lookup.get(key(position, normal));
}

export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

// Clockwise quarter turn as seen looking down the axis toward the origin,
// i.e. -90 degrees about `axis` (Rodrigues with cos = 0, sin = -1).
export function rotateClockwise(v, axis) {
  const c = cross(axis, v);
  const d = dot(axis, v);
  return [d * axis[0] - c[0] + 0, d * axis[1] - c[1] + 0, d * axis[2] - c[2] + 0];
}
