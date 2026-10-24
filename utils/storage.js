/**
 * utils/storage.js
 * chrome.storage.local wrapper: non-sensitive preferences, learned
 * suggestion lists, and run status. Never stores passwords/OTP/payment data.
 */
const RailwayStorage = (() => {
  const KEY = "railwaySeatAssistantConfig";
  const LEARNED_KEY = "railwayLearnedLists";
  const STATUS_KEY = "runStatus";
  const PENDING_KEY = "pendingRun";
  const SYNC_KEY = "syncStatus";

  const DEFAULT_CONFIG = {
    startStation: "",
    destinationStation: "",
    journeyDate: "",
    className: "",
    trainName: "",
    seatCount: 1,
    seatMode: "preferred", // "preferred" | "random"
    preferredSeats: [],
    rangeMin: "",
    rangeMax: "",
  };

  const get = (k) => new Promise((r) => chrome.storage.local.get([k], (res) => r(res[k])));
  const set = (o) => new Promise((r) => chrome.storage.local.set(o, () => r()));
  const remove = (k) => new Promise((r) => chrome.storage.local.remove(k, () => r()));

  async function getConfig() {
    return { ...DEFAULT_CONFIG, ...((await get(KEY)) || {}) };
  }
  async function setConfig(partial) {
    const next = { ...(await getConfig()), ...partial };
    await set({ [KEY]: next });
    return next;
  }
  async function resetConfig() {
    await set({ [KEY]: DEFAULT_CONFIG });
    return DEFAULT_CONFIG;
  }

  async function getLearned() {
    return { stations: [], trains: [], ...((await get(LEARNED_KEY)) || {}) };
  }
  /** kind: "stations" | "trains". Merges names, keeps the list bounded. */
  async function addLearned(kind, names) {
    const clean = (names || []).map((n) => (n || "").trim()).filter((n) => n && n.length <= 90);
    if (!clean.length) return;
    const learned = await getLearned();
    const merged = Array.from(new Set([...(learned[kind] || []), ...clean])).slice(0, 1500);
    await set({ [LEARNED_KEY]: { ...learned, [kind]: merged } });
  }

  return {
    getConfig, setConfig, resetConfig, DEFAULT_CONFIG,
    getLearned, addLearned,
    setStatus: (status) => set({ [STATUS_KEY]: { ...status, ts: Date.now() } }),
    getStatus: () => get(STATUS_KEY),
    setPending: (p) => set({ [PENDING_KEY]: { ...p, ts: Date.now() } }),
    getPending: () => get(PENDING_KEY),
    clearPending: () => remove(PENDING_KEY),
    setSync: (status) => set({ [SYNC_KEY]: { ...status, ts: Date.now() } }),
    getSync: () => get(SYNC_KEY),
    STATUS_KEY,
    SYNC_KEY,
  };
})();
