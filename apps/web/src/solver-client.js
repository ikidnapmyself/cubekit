// Runs the solver off the main thread so building its tables never freezes the UI.
export class SolverClient {
  #worker = new Worker(new URL('./solver.worker.js', import.meta.url), { type: 'module' });
  #pending = new Map();
  #nextId = 1;

  constructor() {
    this.#worker.onmessage = ({ data: { id, ok, result, error } }) => {
      const pending = this.#pending.get(id);
      this.#pending.delete(id);
      if (ok) pending.resolve(result);
      else pending.reject(new Error(error));
    };
    this.ready = this.#call('init');
  }

  #call(type, payload) {
    const id = this.#nextId++;
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject });
      this.#worker.postMessage({ id, type, payload });
    });
  }

  solve(facelets) {
    return this.#call('solve', { facelets });
  }

  scramble(size) {
    return this.#call('scramble', { size });
  }
}
