import { useSyncExternalStore } from "react";

/* One shared set of Healthray login tokens, saved once in this browser and used by every page. */
const KEY = "hrAuth";
const EMPTY = { auth: "", dev: "", acc: "" };

export const cleanTok = (v) => (v || "").trim().replace(/^["']+|["']+$/g, "").replace(/^Bearer\s+/i, "");
export const hasTokens = (t) => !!(t && (t.auth || t.dev || t.acc));

function load() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "null");
    if (v) return { ...EMPTY, ...v };
  } catch {}
  // one-time migration from the old per-page storage
  try {
    const r = JSON.parse(localStorage.getItem("sendReq") || "null");
    if (r) {
      const t = { auth: r["x-auth-token"] || "", dev: r["x-device-token"] || "", acc: r["x-healthray-access-token"] || "" };
      if (hasTokens(t)) return t;
    }
  } catch {}
  try {
    const t = localStorage.getItem("labOrdersToken");
    if (t) return { ...EMPTY, acc: t };
  } catch {}
  return EMPTY;
}

let state = { tokens: load(), editing: false };
const subs = new Set();
const emit = () => subs.forEach((f) => f());
const subscribe = (f) => { subs.add(f); return () => subs.delete(f); };

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) { state = { ...state, tokens: load() }; emit(); }
  });
}

export const getState = () => state;
export const useAuth = () => useSyncExternalStore(subscribe, getState);

export function saveTokens(t) {
  const tokens = { auth: cleanTok(t.auth), dev: cleanTok(t.dev), acc: cleanTok(t.acc) };
  try { localStorage.setItem(KEY, JSON.stringify(tokens)); } catch {}
  state = { tokens, editing: false };
  emit();
}
export function clearTokens() {
  try { localStorage.removeItem(KEY); localStorage.removeItem("sendReq"); localStorage.removeItem("labOrdersToken"); } catch {}
  state = { tokens: EMPTY, editing: true };
  emit();
}
export function setEditing(b) { state = { ...state, editing: b }; emit(); }
/* pages call this when tokens are missing/expired: opens the sidebar panel in edit mode */
export const requestAuth = () => setEditing(true);

/* headers sent to the Healthray proxy functions */
export function authHeaders(t = state.tokens) {
  const h = {};
  if (t.auth) h["x-auth-token"] = t.auth;
  if (t.dev) h["x-device-token"] = t.dev;
  if (t.acc) { h["x-healthray-access-token"] = t.acc; h.authorization = "Bearer " + t.acc; }
  return h;
}

/* understands "name\nvalue", "name: value" and cURL -H 'name: value' pastes */
export function parseBlock(text) {
  const map = { "x-auth-token": "auth", "x-device-token": "dev", "x-healthray-access-token": "acc" };
  const out = {};
  const re = /(x-auth-token|x-device-token|x-healthray-access-token)["']?\s*[:=]?\s*\n?\s*([^\s'"\\]+)/gi;
  let m;
  while ((m = re.exec(text || ""))) {
    if (!map[m[2].toLowerCase()]) out[map[m[1].toLowerCase()]] = cleanTok(m[2]);
  }
  return out;
}
