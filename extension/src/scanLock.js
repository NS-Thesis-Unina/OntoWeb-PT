import browser from "webextension-polyfill";

const KEY = "ui_scan_lock";
const DEFAULT_TTL_MS = 1000 * 60 * 120;

const OWNERS = {
  TECHSTACK_ONETIME: "techstack_onetime",
  ANALYZER_ONETIME: "analyzer_onetime",
  ANALYZER_RUNTIME: "analyzer_runtime",
  INTERCEPTOR_RUNTIME: "interceptor_runtime",
};
export { OWNERS };

function now() { return Date.now(); }

async function _readRaw() {
  try {
    const obj = await browser.storage.session.get(KEY);
    return obj?.[KEY] ?? null;
  } catch { return null; }
}

async function _writeRaw(lock) {
  try {
    await browser.storage.session.set({ [KEY]: lock });
  } catch {}
}

async function _clearRaw() {
  try {
    await browser.storage.session.remove(KEY);
  } catch {}
}

function _isExpired(lock) {
  if (!lock) return true;
  const ttl = Number(lock.ttlMs ?? DEFAULT_TTL_MS);
  const started = Number(lock.startedAt ?? 0);
  if (!started || !ttl) return false;
  return (now() - started) > ttl;
}

export async function getLock() {
  const lock = await _readRaw();
  if (!lock) return null;
  if (_isExpired(lock)) {
    await _clearRaw();
    return null;
  }
  return lock;
}

export async function acquireLock(owner, label, ttlMs = DEFAULT_TTL_MS) {
  const current = await getLock();
  if (current && current.owner !== owner) {
    return { ok: false, lock: current, reason: "locked" };
  }
  if (!current) {
    const next = { owner, label, startedAt: now(), ttlMs };
    await _writeRaw(next);
    return { ok: true, lock: next };
  }
  return { ok: true, lock: current };
}

export async function releaseLock(owner) {
  const current = await getLock();
  if (!current) return { ok: true };
  if (current.owner !== owner) return { ok: false, reason: "not_owner", lock: current };
  await _clearRaw();
  return { ok: true };
}

export function subscribeLockChanges(callback) {
  const handler = (changes, areaName) => {
    if (areaName !== "session") return;
    if (Object.prototype.hasOwnProperty.call(changes, KEY)) {
      const newVal = changes[KEY]?.newValue ?? null;
      const oldVal = changes[KEY]?.oldValue ?? null;
      callback(newVal, oldVal);
    }
  };
  try { browser.storage.onChanged.addListener(handler); } catch {}
  return () => {
    try { browser.storage.onChanged.removeListener(handler); } catch {}
  };
}
