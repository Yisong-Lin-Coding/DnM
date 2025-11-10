export class EventBus {
  constructor() {
    // listeners: { eventName: Map<listenerId, callback> }
    this.listeners = {};
    this._nextId = 1; // generate unique listener ids
  }

  // on(eventName, callback) -> returns listenerId
  // Registers callback for eventName and returns an id for later removal.
  on(eventName, callback) {
    if (!this.listeners[eventName]) this.listeners[eventName] = new Map();
    const id = this._nextId++;
    this.listeners[eventName].set(id, callback);
    return id;
  }

  // off(eventName, id) -> deregisters the listener by id
  // Removing by id is safer than removing by function reference.
  off(eventName, id) {
    const map = this.listeners[eventName];
    if (!map) return false;
    const existed = map.delete(id);
    if (map.size === 0) delete this.listeners[eventName];
    return existed;
  }

  // emit(eventName, payload) -> calls all listeners synchronously
  // We shallow-clone listener callbacks so they can remove themselves safely.
  emit(eventName, payload = {}) {
    const map = this.listeners[eventName];
    if (!map) return;
    // iterate on a copy of callbacks to allow on/off during iteration
    const callbacks = Array.from(map.values());
    for (const cb of callbacks) {
      try {
        cb(payload);
      } catch (err) {
        console.error(`Event handler for ${eventName} threw:`, err);
      }
    }
  }

  // once(eventName, cb) -> convenience method: registers a callback that will auto remove after first call
  once(eventName, cb) {
    const id = this.on(eventName, (payload) => {
      this.off(eventName, id);
      cb(payload);
    });
    return id;
  }
}

// create a global instance to import from anywhere
export const GameEvents = new EventBus();