export class AbortSignal {
  constructor() {
    this._aborted = false;
    this._listeners = [];
  }

  get aborted() {
    return this._aborted;
  }

  addEventListener(type, listener) {
    if (type === 'abort') {
      this._listeners.push(listener);

      // If already aborted, call the listener immediately
      if (this._aborted) {
        try {
          listener();
        } catch (e) {
          console.error('Error in abort listener:', e);
        }
      }
    }
  }

  removeEventListener(type, listener) {
    if (type === 'abort') {
      const index = this._listeners.indexOf(listener);
      if (index !== -1) {
        this._listeners.splice(index, 1);
      }
    }
  }

  // Internal method to trigger abort
  _abort() {
    if (this._aborted) return;

    this._aborted = true;

    // Call all listeners
    for (const listener of this._listeners) {
      try {
        listener();
      } catch (e) {
        console.error('Error in abort listener:', e);
      }
    }

    // Clear listeners after calling them
    this._listeners = [];
  }
}

export class AbortController {
  constructor() {
    this._signal = new AbortSignal();
  }

  get signal() {
    return this._signal;
  }

  abort() {
    this._signal._abort();
  }
}
