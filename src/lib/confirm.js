/* In-app replacement for window.confirm(): `await ask("Message?", { ok: "Send", danger: true })` -> true / false */
let current = null;
const subs = new Set();
const emit = () => subs.forEach((f) => f());

export const subscribeConfirm = (f) => { subs.add(f); return () => subs.delete(f); };
export const getConfirm = () => current;

export function ask(message, opts = {}) {
  return new Promise((resolve) => {
    if (current) current.resolve(false);
    current = { message, ok: opts.ok || "OK", danger: !!opts.danger, resolve: (v) => { current = null; emit(); resolve(v); } };
    emit();
  });
}
