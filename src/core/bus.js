/* Tiny pub/sub used for cross-component requests (e.g. "open the course editor"). */
const Bus = (() => {
  const handlers = new Map();
  return {
    on(event, fn) {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event).add(fn);
      return () => handlers.get(event).delete(fn);
    },
    emit(event, payload) {
      (handlers.get(event) || []).forEach((fn) => fn(payload));
    },
  };
})();
