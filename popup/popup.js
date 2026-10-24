/**
 * popup/popup.js - side panel logic.
 * Suggestions come from the bundled seed list plus names learned from the
 * live site (stored in chrome.storage.local). Free text is always allowed.
 */
const SITE_PREFIX = "https://eticket.railway.gov.bd/";
const $ = (id) => document.getElementById(id);
const form = $("journeyForm");

/* ---------- tab / messaging ---------- */

async function getRailwayTab() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tab && tab.url && tab.url.startsWith(SITE_PREFIX) ? tab : null;
}

async function send(message) {
  const tab = await getRailwayTab();
  if (!tab) throw new Error("Open eticket.railway.gov.bd in the active tab first.");
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tab.id, message, (res) => {
      if (chrome.runtime.lastError) {
        reject(new Error("Could not reach the page. Reload the railway tab and try again."));
        return;
      }
      resolve(res);
    });
  });
}

async function refreshSiteState() {
  const tab = await getRailwayTab();
  $("siteWarning").hidden = !!tab;
  $("startBtn").disabled = !tab;
}

/* ---------- status ---------- */

function renderStatus(s) {
  const el = $("status");
  if (!s) { el.className = "status"; el.textContent = "Ready to start"; return; }
  el.className = "status";
  if (s.state === "running") {
    el.classList.add("running");
    el.textContent = s.message || "Working...";
  } else if (s.state === "done") {
    el.classList.add("done");
    const lines = [];
    lines.push(s.selected && s.selected.length ? `Seat selection completed.\n\nSelected: ${s.selected.join(", ")}` : "No seats could be selected.");
    if (s.unavailablePreferred && s.unavailablePreferred.length) lines.push(`Unavailable (skipped): ${s.unavailablePreferred.join(", ")}`);
    if (s.shortfall > 0) lines.push(`Could not find ${s.shortfall} more available seat(s).`);
    lines.push("Please review the page and press CONTINUE PURCHASE yourself.");
    el.textContent = lines.join("\n\n");
  } else if (s.state === "error") {
    el.classList.add("error");
    el.textContent = s.message || "Something went wrong.";
  } else {
    el.textContent = s.message || "Stopped.";
  }
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes[RailwayStorage.STATUS_KEY]) {
    renderStatus(changes[RailwayStorage.STATUS_KEY].newValue);
  }
});

/* ---------- autocomplete ---------- */

let learned = { stations: [], trains: [] };

const LEARNED_ONLY_MIN = { stations: 50, trains: 30 };
const trainNum = (n) => { const m = /\((\d+)\)\s*$/.exec(n); return m ? m[1] : null; };

/** Names to suggest. Once enough names were learned from the site, only those
 *  are shown (they match the site exactly); otherwise seeds fill the gaps. */
function poolFor(kind) {
  const learnedList = learned[kind] || [];
  if (learnedList.length >= (LEARNED_ONLY_MIN[kind] || Infinity)) return learnedList;
  if (kind === "trains") {
    const byNum = new Map();
    (RailwayData.trains || []).forEach((n) => byNum.set(trainNum(n) || n, n));
    learnedList.forEach((n) => byNum.set(trainNum(n) || n, n));   // exact site names replace seeds
    return Array.from(byNum.values());
  }
  return Array.from(new Set([...(RailwayData[kind] || []), ...learnedList]));
}

function optionsFor(kind, query) {
  const q = query.trim().toLowerCase();
  if (kind === "classes") {
    return RailwayData.classes
      .filter((c) => !q || c.code.toLowerCase().includes(q) || c.label.toLowerCase().includes(q))
      .map((c) => ({ value: c.code, label: c.label, code: c.code }));
  }
  return poolFor(kind)
    .filter((n) => !q || n.toLowerCase().includes(q))
    .sort((a, b) => (a.toLowerCase().startsWith(q) ? 0 : 1) - (b.toLowerCase().startsWith(q) ? 0 : 1) || a.localeCompare(b))
    .slice(0, 60)
    .map((n) => ({ value: n, label: n }));
}

function renderListCounts() {
  const s = (learned.stations || []).length, t = (learned.trains || []).length;
  const stationsTxt = s >= LEARNED_ONLY_MIN.stations ? `${s} stations from the site` : `${poolFor("stations").length} stations (built-in guesses${s ? ` + ${s} from the site` : ""})`;
  const trainsTxt = t >= LEARNED_ONLY_MIN.trains ? `${t} trains from the site` : `${poolFor("trains").length} trains (built-in guesses${t ? ` + ${t} from the site` : ""})`;
  $("listCounts").textContent = `${stationsTxt}; ${trainsTxt}.`;
}

function renderSync(s) {
  const el = $("syncStatus");
  if (!s || Date.now() - s.ts > 10 * 60 * 1000) { el.hidden = true; return; }
  el.hidden = false;
  el.className = "sync-status " + (s.state || "");
  el.textContent = s.message || "";
}

function wireAutocomplete(box) {
  const input = box.querySelector("input");
  const list = box.querySelector(".ac-list");
  const kind = box.dataset.kind;
  let items = [];
  let active = -1;

  const hide = () => { list.hidden = true; active = -1; };
  const choose = (i) => { if (items[i]) { input.value = items[i].value; hide(); persist(); } };
  const highlight = () => list.querySelectorAll(".ac-item").forEach((e, i) => e.classList.toggle("active", i === active));

  function show() {
    items = optionsFor(kind, input.value);
    list.innerHTML = "";
    if (!items.length) { hide(); return; }
    items.forEach((o, i) => {
      const d = document.createElement("div");
      d.className = "ac-item";
      const b = document.createElement("b");
      b.textContent = o.label;
      d.appendChild(b);
      if (o.code) { const c = document.createElement("span"); c.className = "code"; c.textContent = `(${o.code})`; d.appendChild(c); }
      d.addEventListener("mousedown", (e) => { e.preventDefault(); choose(i); });
      list.appendChild(d);
    });
    list.hidden = false;
  }

  input.addEventListener("input", show);
  input.addEventListener("focus", show);
  input.addEventListener("blur", () => setTimeout(hide, 120));
  input.addEventListener("keydown", (e) => {
    if (list.hidden) return;
    if (e.key === "ArrowDown") { active = Math.min(items.length - 1, active + 1); highlight(); e.preventDefault(); }
    else if (e.key === "ArrowUp") { active = Math.max(0, active - 1); highlight(); e.preventDefault(); }
    else if (e.key === "Enter" && active >= 0) { choose(active); e.preventDefault(); }
    else if (e.key === "Escape") hide();
  });
}

/* ---------- form state ---------- */

const seatMode = () => document.querySelector("input[name=seatMode]:checked").value;
function syncMode() { $("preferredWrap").style.display = seatMode() === "preferred" ? "" : "none"; }

function readConfig() {
  return {
    startStation: $("startStation").value.trim(),
    destinationStation: $("endStation").value.trim(),
    journeyDate: $("journeyDate").value,
    className: $("className").value.trim(),
    trainName: $("trainName").value.trim(),
    seatCount: Number($("seatCount").value) || 0,
    seatMode: seatMode(),
    preferredSeats: RailwayValidation.parsePreferredSeatsInput($("preferredSeats").value),
    rangeMin: $("rangeMin").value,
    rangeMax: $("rangeMax").value,
  };
}

function writeConfig(c) {
  $("startStation").value = c.startStation || "";
  $("endStation").value = c.destinationStation || "";
  $("journeyDate").value = c.journeyDate || "";
  $("className").value = c.className || "";
  $("trainName").value = c.trainName || "";
  $("seatCount").value = c.seatCount || 1;
  document.querySelector(`input[name=seatMode][value=${c.seatMode || "preferred"}]`).checked = true;
  $("preferredSeats").value = (c.preferredSeats || []).join(", ");
  $("rangeMin").value = c.rangeMin || "";
  $("rangeMax").value = c.rangeMax || "";
  syncMode();
}

const persist = () => RailwayStorage.setConfig(readConfig());

/* ---------- init & events ---------- */

async function init() {
  learned = await RailwayStorage.getLearned();
  writeConfig(await RailwayStorage.getConfig());
  document.querySelectorAll(".ac").forEach(wireAutocomplete);
  await refreshSiteState();
  renderListCounts();
  renderSync(await RailwayStorage.getSync());

  const last = await RailwayStorage.getStatus();
  if (last && Date.now() - last.ts < 10 * 60 * 1000) renderStatus(last);

  chrome.tabs.onActivated.addListener(refreshSiteState);
  chrome.tabs.onUpdated.addListener((id, info) => { if (info.url || info.status === "complete") refreshSiteState(); });
  chrome.storage.onChanged.addListener(async (ch) => {
    if (ch.railwayLearnedLists) { learned = await RailwayStorage.getLearned(); renderListCounts(); }
    if (ch[RailwayStorage.SYNC_KEY]) renderSync(ch[RailwayStorage.SYNC_KEY].newValue);
  });
}

form.addEventListener("input", persist);
document.querySelectorAll("input[name=seatMode]").forEach((r) => r.addEventListener("change", syncMode));

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const config = readConfig();
  const { valid, errors } = RailwayValidation.validateConfig(config);
  if (!valid) { renderStatus({ state: "error", message: errors.join("\n") }); return; }
  await persist();
  renderStatus({ state: "running", message: "Starting process..." });
  try {
    const res = await send({ type: "START_RUN", config });
    if (!res || !res.ok) renderStatus({ state: "error", message: (res && res.error) || "Could not start." });
  } catch (err) {
    renderStatus({ state: "error", message: err.message });
  }
});

$("stopBtn").addEventListener("click", async () => {
  try { await send({ type: "STOP" }); } catch (e) { renderStatus({ state: "stopped", message: "Stopped." }); }
});

async function startSync(type, label) {
  renderSync({ state: "running", message: `${label}: starting...`, ts: Date.now() });
  try {
    const res = await send({ type });
    if (!res || !res.ok) renderSync({ state: "error", message: (res && res.error) || "Could not start the sync.", ts: Date.now() });
  } catch (e) { renderSync({ state: "error", message: e.message, ts: Date.now() }); }
}
$("syncStationsBtn").addEventListener("click", () => startSync("SYNC_STATIONS", "Stations"));
$("syncTrainsBtn").addEventListener("click", () => startSync("SYNC_TRAINS", "Trains"));

$("resetBtn").addEventListener("click", async () => {
  writeConfig(await RailwayStorage.resetConfig());
  renderStatus(null);
});

$("diagnoseBtn").addEventListener("click", async () => {
  const out = $("diagOut");
  out.hidden = false;
  try {
    const res = await send({ type: "DIAGNOSE" });
    out.value = res && res.ok ? JSON.stringify(res.report, null, 2) : `Diagnose failed: ${(res && res.error) || "unknown"}`;
    $("copyBtn").hidden = !(res && res.ok);
  } catch (e) { out.value = `Error: ${e.message}`; }
});
$("copyBtn").addEventListener("click", () => navigator.clipboard.writeText($("diagOut").value).catch(() => {}));

init();
