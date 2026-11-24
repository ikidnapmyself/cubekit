import { Solver } from '@cubekit/solver';

const solver = new Solver();

const handlers = {
  init() {
    const start = performance.now();
    solver.init({ sizes: [3, 2] });
    return { ms: Math.round(performance.now() - start) };
  },
  solve({ facelets }) {
    return solver.solve(facelets, { improveForMs: 400 });
  },
  scramble({ size }) {
    return solver.randomScramble({ size });
  },
};

self.onmessage = ({ data: { id, type, payload } }) => {
  try {
    self.postMessage({ id, ok: true, result: handlers[type](payload) });
  } catch (error) {
    self.postMessage({ id, ok: false, error: error.message });
  }
};
