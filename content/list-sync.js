/**
 * content/list-sync.js
 *
 * One-time, user-started "Sync from site": collects the site's OWN station
 * and train names so the side panel's suggestions match the site exactly.
 *
 *  Stations (home page): types a letter into the From box like a person
 *    would, reads the suggestion list, moves on. If a prefix returns a full
 *    page of results (>= CAP_HINT) it is expanded with a second letter, since
 *    the site may cap how many it shows. Bounded by MAX_QUERIES, throttled,
 *    cancellable, and the box is cleared afterwards. Nothing is submitted.
 *
 *  Trains (Train Information page): opens the train picker, reads every
 *    "NAME (123)" it can see (scrolling the list), then sweeps a-z the same way.
 *
 * It only READS what the site itself offers. No booking, no other requests.
 */
const RailwayListSync = (() => {
  const CAP_HINT = 8;
  const MAX_QUERIES = 320;
  const PAUSE_MS = 450;
  const LETTERS = "abcdefghijklmnopqrstuvwxyz".split("");
  const TRAIN_RE = /\(\d{1,4}\)\s*$/;

  let cancelled = false;
  let running = false;
  const report = (o) => RailwayStorage.setSync(o);

  function clearInput(el) {
    const proto = window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (setter) setter.call(el, ""); else el.value = "";
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }

  /* ---------------- stations ---------------- */

  async function syncStations() {
    const control = RailwayStationParser.findStartControl();
    if (!control) return { ok: false, error: "Open the site's home page (the search form) first, then press Sync stations." };

    const found = new Set();
    const counts = new Map();          // prefix -> number of suggestions it returned
    let queries = 0;
    let maxCount = 0;

    async function lookup(prefix) {
      queries++;
      await report({ state: "running", message: `Stations: ${found.size} found (${queries} lookups)...` });
      const items = await RailwayDom.typeaheadSuggestions(control, prefix, { timeoutMs: prefix.length > 1 ? 1000 : 1600 });
      const names = items.map((i) => i.text.trim()).filter((t) => t && t.length <= 40 && t.toLowerCase() !== prefix);
      names.forEach((n) => found.add(n));
      counts.set(prefix, names.length);
      maxCount = Math.max(maxCount, names.length);
      if (queries % 10 === 0) await RailwayStorage.addLearned("stations", Array.from(found));
      await RailwayDom.sleep(PAUSE_MS);
      return names.length;
    }

    // Pass 1: every single letter.
    for (const l of LETTERS) {
      if (cancelled || queries >= MAX_QUERIES) break;
      await lookup(l);
    }

    // Expansion: only if results look CAPPED (several prefixes plateau at the
    // same maximum, and that maximum is small). If the site returns everything
    // it has (large counts), the single-letter pass was already complete.
    let frontier = LETTERS.filter((l) => counts.get(l) === maxCount);
    const looksCapped = maxCount >= CAP_HINT && maxCount < 30 && frontier.length >= 2;
    let depth = 1;
    while (looksCapped && frontier.length && depth < 3 && !cancelled && queries < MAX_QUERIES) {
      const next = [];
      for (const prefix of frontier) {
        for (const l of LETTERS) {
          if (cancelled || queries >= MAX_QUERIES) break;
          const p = prefix + l;
          const n = await lookup(p);
          if (n >= maxCount) next.push(p);
        }
      }
      frontier = next;
      depth++;
    }

    clearInput(control);
    await RailwayStorage.addLearned("stations", Array.from(found));
    if (cancelled) return { ok: false, stopped: true, count: found.size };
    const hitLimit = queries >= MAX_QUERIES && looksCapped;
    return { ok: true, count: found.size, note: hitLimit ? "Stopped at the lookup limit - run it again later to add more." : "" };
  }

  /* ---------------- trains ---------------- */

  function findTrainInput() {
    const inputs = Array.from(document.querySelectorAll("input[type='text'], input:not([type])")).filter(RailwayDom.isVisible);
    const hit = inputs.find((i) => /train/i.test([i.placeholder, i.name, i.id, i.getAttribute("aria-label")].filter(Boolean).join(" ")));
    if (hit) return hit;
    const byLabel = RailwayDom.findControlByLabelText("train name") || RailwayDom.findControlByLabelText("select train") || RailwayDom.findControlByLabelText("train");
    return byLabel && byLabel.tagName === "INPUT" ? byLabel : null;
  }

  function scrollableAncestorOfTrainItem() {
    const t = RailwayTrainParser.headingTokens()[0];
    for (let n = t && t.el; n && n !== document.body; n = n.parentElement) {
      if (n.scrollHeight > n.clientHeight + 8) {
        const oy = getComputedStyle(n).overflowY;
        if (oy === "auto" || oy === "scroll") return n;
      }
    }
    return null;
  }

  async function scrollCollect(found) {
    const box = scrollableAncestorOfTrainItem();
    if (!box) return;
    box.scrollTop = 0;
    for (let i = 0; i < 40 && !cancelled; i++) {
      RailwayTrainParser.collectAllTrainNames().forEach((n) => found.add(n));
      const before = box.scrollTop;
      box.scrollTop += Math.max(60, box.clientHeight * 0.8);
      await RailwayDom.sleep(120);
      if (box.scrollTop === before) break;
    }
    RailwayTrainParser.collectAllTrainNames().forEach((n) => found.add(n));
  }

  async function syncTrains() {
    const found = new Set(RailwayTrainParser.collectAllTrainNames());
    const control = findTrainInput();
    if (!control && found.size === 0) {
      return { ok: false, error: "Open the site's Train Information page (or a page that lists trains) first, then press Sync trains." };
    }

    if (control) {
      await report({ state: "running", message: "Trains: opening the train list..." });
      control.focus();
      control.dispatchEvent(new FocusEvent("focus"));
      control.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
      RailwayDom.fireClick(control);
      await RailwayDom.sleep(700);
      RailwayTrainParser.collectAllTrainNames().forEach((n) => found.add(n));
      await scrollCollect(found);

      // Sweep a-z like a person searching; keeps names the open list didn't show.
      let queries = 0;
      for (const letter of LETTERS) {
        if (cancelled || queries >= 40) break;
        queries++;
        await report({ state: "running", message: `Trains: ${found.size} found (${queries}/26 lookups)...` });
        await RailwayDom.typeaheadSuggestions(control, letter, { timeoutMs: 1200 });
        await RailwayDom.sleep(250);
        RailwayTrainParser.collectAllTrainNames().forEach((n) => found.add(n));
        await scrollCollect(found);
        if (queries % 8 === 0) await RailwayStorage.addLearned("trains", Array.from(found));
      }
      clearInput(control);
    }
    await RailwayStorage.addLearned("trains", Array.from(found));
    if (cancelled) return { ok: false, stopped: true, count: found.size };
    return { ok: true, count: found.size };
  }

  /* ---------------- entry ---------------- */

  async function start(kind) {
    if (running) return { ok: false, error: "A sync is already running." };
    running = true; cancelled = false;
    (async () => {
      try {
        await report({ state: "running", message: kind === "stations" ? "Stations: starting..." : "Trains: starting..." });
        const res = kind === "stations" ? await syncStations() : await syncTrains();
        if (res.stopped) await report({ state: "stopped", message: `Sync stopped (${res.count} ${kind} saved so far).` });
        else if (!res.ok) await report({ state: "error", message: res.error });
        else await report({ state: "done", message: `Synced ${res.count} ${kind} from the site.${res.note ? " " + res.note : ""}` });
      } catch (e) {
        await report({ state: "error", message: `Sync failed: ${e && e.message ? e.message : e}` });
      } finally { running = false; }
    })();
    return { ok: true, started: true };
  }

  return { start, cancel: () => { cancelled = true; }, isRunning: () => running };
})();
