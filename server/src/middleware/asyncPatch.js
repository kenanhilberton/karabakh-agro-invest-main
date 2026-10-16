import { Router } from 'express';

// Express 4 does not await async route handlers: a rejected promise inside an
// `async (req, res) => {}` handler becomes an unhandled rejection, which under
// Node >= 15 terminates the process. To make the whole API crash-safe without
// touching every route file, we wrap HTTP verb handlers so that sync throws and
// rejected promises are forwarded to Express' error middleware via next(err).
function wrap(fn) {
  return function wrappedHandler(req, res, next) {
    try {
      const out = fn(req, res, next);
      if (out && typeof out.then === 'function') out.catch(next);
    } catch (err) {
      next(err);
    }
  };
}

const VERBS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'all'];

let patched = false;

export function patchRouter() {
  if (patched) return;
  patched = true;
  for (const verb of VERBS) {
    const original = Router.prototype[verb];
    if (typeof original !== 'function') continue;
    Router.prototype[verb] = function patchedVerb(...args) {
      const safe = args.map((h) =>
        typeof h === 'function' && h.length < 4 && !h.handle ? wrap(h) : h
      );
      return original.apply(this, safe);
    };
  }
}

patchRouter();
