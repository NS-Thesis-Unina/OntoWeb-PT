// src/ui/scanLock.js
import browser from "webextension-polyfill";

/**
 * Lock UI condiviso per impedire la concorrenza delle scansioni.
 * Conservato in storage.session, così è visibile a tutte le viste dell'estensione.
 *
 * Struttura:
 * {
 *   owner: "techstack_onetime" | "analyzer_onetime" | "analyzer_runtime" | "interceptor_runtime",
 *   label: string,           // testo user-facing
 *   startedAt: number,       // ms epoch
 *   ttlMs?: number           // opzionale; se scaduto viene auto-rimosso
 * }
 */

const KEY = "ui_scan_lock";
const DEFAULT_TTL_MS = 1000 * 60 * 120; // 2 ore di sicurezza

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
  if (!started || !ttl) return false; // se non c'è ttl, non scade
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

/**
 * Prova ad acquisire il lock.
 * @param {string} owner
 * @param {string} label   testo breve da mostrare all’utente (es. “Analyzer Runtime”)
 * @param {number} ttlMs   opzionale (default 2h)
 * @returns {{ok: boolean, lock?: object, reason?: string}}
 */
export async function acquireLock(owner, label, ttlMs = DEFAULT_TTL_MS) {
  const current = await getLock();
  if (current && current.owner !== owner) {
    return { ok: false, lock: current, reason: "locked" };
  }
  // Se il lock è già nostro, proseguiamo; altrimenti creiamolo
  if (!current) {
    const next = { owner, label, startedAt: now(), ttlMs };
    await _writeRaw(next);
    return { ok: true, lock: next };
  }
  return { ok: true, lock: current };
}

/**
 * Rilascia il lock se appartiene all'owner.
 * Possiamo aggiungere un `force=true` per forzare (lo evito per sicurezza).
 */
export async function releaseLock(owner) {
  const current = await getLock();
  if (!current) return { ok: true };
  if (current.owner !== owner) return { ok: false, reason: "not_owner", lock: current };
  await _clearRaw();
  return { ok: true };
}

/**
 * Sottoscrizione ai cambiamenti del lock (per sincronizzare pulsanti/disclaimer tra viste).
 */
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
