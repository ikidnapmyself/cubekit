// Coordinates for the two-phase algorithm. Each maps one aspect of a CubieCube
// to an integer and back; the solved cube always maps to 0.

export const N_TWIST = 2187; // 3^7 corner orientations
export const N_FLIP = 2048; // 2^11 edge orientations
export const N_SLICE = 495; // C(12,4) positions of the four E-slice edges
export const N_CORNER_PERM = 40320; // 8!
export const N_EDGE8_PERM = 40320; // 8! U/D edges, phase 2 only
export const N_SLICE_PERM = 24; // 4! E-slice edges, phase 2 only

const CNK = Array.from({ length: 13 }, (_, n) =>
  Array.from({ length: 13 }, (_, k) => {
    if (k > n) return 0;
    let r = 1;
    for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1);
    return r;
  }),
);

export function getTwist(c) {
  let t = 0;
  for (let i = 0; i < 7; i++) t = 3 * t + c.co[i];
  return t;
}

export function setTwist(c, t) {
  let sum = 0;
  for (let i = 6; i >= 0; i--) {
    c.co[i] = t % 3;
    sum += c.co[i];
    t = Math.floor(t / 3);
  }
  c.co[7] = (3 - (sum % 3)) % 3;
}

export function getFlip(c) {
  let f = 0;
  for (let i = 0; i < 11; i++) f = 2 * f + c.eo[i];
  return f;
}

export function setFlip(c, f) {
  let sum = 0;
  for (let i = 10; i >= 0; i--) {
    c.eo[i] = f & 1;
    sum += c.eo[i];
    f >>= 1;
  }
  c.eo[11] = sum & 1;
}

// Which four of the twelve edge positions hold the E-slice edges (FR FL BL BR = 8..11).
export function getSlice(c) {
  let a = 0;
  let x = 0;
  for (let j = 11; j >= 0; j--) {
    if (c.ep[j] >= 8) a += CNK[11 - j][++x];
  }
  return a;
}

export function setSlice(c, idx) {
  c.ep.fill(-1);
  let x = 4;
  for (let j = 0; j < 12 && x > 0; j++) {
    if (idx >= CNK[11 - j][x]) {
      c.ep[j] = 12 - x;
      idx -= CNK[11 - j][x--];
    }
  }
  let other = 0;
  for (let j = 0; j < 12; j++) if (c.ep[j] === -1) c.ep[j] = other++;
}

// Lehmer code of arr[offset .. offset+n) whose values are base .. base+n-1.
export function permIndex(arr, offset, n) {
  let idx = 0;
  for (let i = 0; i < n; i++) {
    let smaller = 0;
    for (let j = i + 1; j < n; j++) if (arr[offset + j] < arr[offset + i]) smaller++;
    idx = idx * (n - i) + smaller;
  }
  return idx;
}

export function setPerm(arr, offset, n, base, idx) {
  const digits = Array(n);
  for (let i = n - 1; i >= 0; i--) {
    digits[i] = idx % (n - i);
    idx = Math.floor(idx / (n - i));
  }
  const pool = Array.from({ length: n }, (_, i) => base + i);
  for (let i = 0; i < n; i++) arr[offset + i] = pool.splice(digits[i], 1)[0];
}

export const getCornerPerm = (c) => permIndex(c.cp, 0, 8);
export const setCornerPerm = (c, idx) => setPerm(c.cp, 0, 8, 0, idx);

export const getEdge8Perm = (c) => permIndex(c.ep, 0, 8);
export function setEdge8Perm(c, idx) {
  setPerm(c.ep, 0, 8, 0, idx);
  for (let i = 8; i < 12; i++) c.ep[i] = i;
}

export const getSlicePerm = (c) => permIndex(c.ep, 8, 4);
export function setSlicePerm(c, idx) {
  for (let i = 0; i < 8; i++) c.ep[i] = i;
  setPerm(c.ep, 8, 4, 8, idx);
}
