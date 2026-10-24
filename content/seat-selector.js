/**
 * content/seat-selector.js
 *
 * Seat panel on the real site (from the demo video): "Select Coach"
 * dropdown (e.g. "UMA - 16 Seat(s)"), a legend (Available = white with green
 * border, Selected = blue, In Progress = green, Booked = orange), seat
 * buttons labelled like "UMA-3", a "Seat Details" table listing chosen seats,
 * and a CONTINUE PURCHASE button - which this extension NEVER clicks.
 *
 * Seat ids are opaque strings ("UMA-3"); the numeric part is used only for
 * the optional Min/Max range filter.
 */
const RailwaySeatSelector = (() => {
  const OCCUPIED_HINTS = ["booked", "sold", "occupied", "unavailable", "disabled", "reserved", "progress", "hold", "taken"];
  const SELECTED_HINTS = ["selected", "chosen"];

  /* ---------- locating things ---------- */

  function findLeafByText(text) {
    const target = RailwayDom.normalizeText(text);
    const hits = RailwayDom.findElementsByText((t) => RailwayDom.normalizeText(t) === target);
    return hits.find(RailwayDom.isVisible) || null;
  }

  /** The "Seat Details" card (lists chosen seats, has CONTINUE PURCHASE). */
  function findSeatDetailsPanel() {
    const heading = findLeafByText("seat details");
    if (!heading) return null;
    let node = heading;
    for (let i = 0; i < 8 && node.parentElement; i++) {
      node = node.parentElement;
      const hasContinue = RailwayDom.findElementsByText(
        (t) => RailwayDom.normalizeText(t).includes("continue purchase"), node
      ).length > 0;
      if (hasContinue) return node;
    }
    return heading.closest("div, section") || null;
  }

  function findSeatElements() {
    const panel = findSeatDetailsPanel();
    return RailwayDom.findElementsByText((t) => RailwayValidation.looksLikeSeatId(t))
      .filter((el) => RailwayDom.isVisible(el))
      .filter((el) => !(panel && panel.contains(el)))     // chosen-seat rows in Seat Details
      .filter((el) => !el.closest("table, thead, tbody, tr"));
  }

  /* ---------- classifying ---------- */

  function parseColor(str) {
    const m = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?/.exec(str || "");
    if (!m) return null;
    return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
  }

  function colorStatus(c) {
    if (!c || c.a < 0.2) return null;
    const { r, g, b } = c;
    if (r > 235 && g > 235 && b > 235) return "available";              // white
    if (r > 170 && g > 90 && g < 185 && b < 110) return "occupied";     // orange = booked
    if (b > 140 && r < 110 && g < 130) return "selected";               // blue = selected
    if (g > 120 && r < 150 && b < 100) return "occupied";               // solid green = in progress
    return null;
  }

  /** Effective background: the seat element or a wrapper that has the same text. */
  function seatBackground(el) {
    let node = el;
    const id = el.textContent.trim();
    for (let i = 0; i < 4 && node; i++) {
      const bg = parseColor(getComputedStyle(node).backgroundColor);
      if (bg && bg.a >= 0.2) return bg;
      const p = node.parentElement;
      if (!p || p.textContent.trim() !== id) break;
      node = p;
    }
    return null;
  }

  function snapshot(el) {
    const bg = seatBackground(el);
    const chain = [el, el.parentElement].filter(Boolean).map((n) => n.className + "|" + n.getAttribute("aria-pressed") + "|" + n.getAttribute("aria-selected"));
    return chain.join("~") + "#" + (bg ? `${bg.r},${bg.g},${bg.b}` : "none");
  }

  function classifySeat(el) {
    const seatId = RailwayValidation.normalizeSeatId(RailwayDom.getOwnText(el));
    const holder = el.closest("button, [role='button'], a") || el;
    const hints = RailwayDom.normalizeText([
      el.className, el.parentElement && el.parentElement.className,
      holder.className, el.getAttribute("aria-label"), el.getAttribute("title"), el.getAttribute("data-status"),
    ].filter((x) => typeof x === "string").join(" "));

    let status = "available";
    const style = getComputedStyle(holder);
    if (holder.disabled || holder.getAttribute("aria-disabled") === "true" || style.pointerEvents === "none") {
      status = "occupied";
    } else if (SELECTED_HINTS.some((h) => hints.includes(h))) {
      status = "selected";
    } else if (OCCUPIED_HINTS.some((h) => hints.includes(h))) {
      status = "occupied";
    } else {
      const byColor = colorStatus(seatBackground(el));
      if (byColor) status = byColor;
    }
    return { seatId, status, element: el };
  }

  function readSeatMap() {
    const seen = new Set();
    return findSeatElements().map(classifySeat).filter((s) => {
      if (!s.seatId || seen.has(s.seatId)) return false;
      seen.add(s.seatId);
      return true;
    });
  }

  /* ---------- coaches ---------- */

  function findCoachSelect() {
    const c = RailwayDom.findControlByLabelText("select coach");
    if (c && c.tagName === "SELECT") return c;
    return Array.from(document.querySelectorAll("select")).find(
      (s) => RailwayDom.isVisible(s) && /seat\(s\)/i.test(s.textContent)
    ) || null;
  }

  function coachOptions(select) {
    return Array.from(select.options).filter((o) => o.value !== "" && !/^\s*(select|choose)/i.test(o.textContent));
  }

  function signature() {
    return readSeatMap().map((s) => s.seatId).join(",");
  }

  async function switchCoach(select, option) {
    if (select.value === option.value) return;
    const before = signature();
    select.value = option.value;
    select.dispatchEvent(new Event("input", { bubbles: true }));
    select.dispatchEvent(new Event("change", { bubbles: true }));
    await RailwayDom.waitFor(() => signature() !== before && signature() !== "", { timeoutMs: 2500, pollMs: 120 });
    await RailwayDom.sleep(150);
  }

  /* ---------- selecting ---------- */

  /** Deselect anything left selected from an earlier run, in every coach.
   *  Without this, a fresh run only ADDS clicks on top of whatever is
   *  already sitting selected on the page - so totals silently grow across
   *  runs, and the final "Selected" report ends up mixing old leftovers
   *  with this run's actual picks. Bounded per coach so a misclassified
   *  seat can't cause an infinite loop. */
  async function clearExistingSelections({ coachSelect, order, onProgress, isCancelled }) {
    let clearedAny = false;
    for (const coach of order) {
      if (isCancelled()) break;
      if (coach) await switchCoach(coachSelect, coach);
      for (let i = 0; i < 20; i++) {
        const sel = readSeatMap().find((s) => s.status === "selected");
        if (!sel) break;
        clearedAny = true;
        RailwayDom.fireClick(sel.element);
        await RailwayDom.sleep(200);
      }
    }
    if (clearedAny) onProgress("Clearing seats left selected from a previous run...");
  }

  /** Click a seat and confirm the page reacted (state flipped to selected,
   *  or its visual state changed). Returns true when the seat is now chosen. */
  async function clickAndConfirm(entry) {
    const before = snapshot(entry.element);
    RailwayDom.fireClick(entry.element);
    await RailwayDom.sleep(220);
    const after = classifySeat(entry.element);
    if (after.status === "selected") return true;
    return snapshot(entry.element) !== before && after.status !== "occupied";
  }

  function readSeatDetailsIds() {
    const panel = findSeatDetailsPanel();
    if (!panel) return null;
    // Read cell by cell (own text), so adjacent cells never glue together.
    const ids = [];
    RailwayDom.findElementsByText((t) => t.split(/[\s,]+/).some(RailwayValidation.looksLikeSeatId), panel)
      .forEach((el) => RailwayDom.getOwnText(el).split(/[\s,]+/).filter(RailwayValidation.looksLikeSeatId)
        .forEach((id) => ids.push(RailwayValidation.normalizeSeatId(id))));
    return Array.from(new Set(ids));
  }

  function inRange(seatId, min, max) {
    if (min == null && max == null) return true;
    const n = RailwayValidation.seatNumber(seatId);
    if (n == null) return false;
    return (min == null || n >= min) && (max == null || n <= max);
  }

  function coachPrefixOf(seatId) {
    const m = /^([A-Za-z]+)-/.exec(seatId || "");
    return m ? m[1].toUpperCase() : null;
  }

  /** Consecutive-number runs within a sorted, unique array of numbers. */
  function contiguousRuns(numsSorted) {
    const runs = [];
    let cur = [];
    for (const n of numsSorted) {
      if (cur.length && n === cur[cur.length - 1] + 1) cur.push(n);
      else { if (cur.length) runs.push(cur); cur = [n]; }
    }
    if (cur.length) runs.push(cur);
    return runs;
  }

  /** The lowest-numbered run that fully covers `count` (trimmed to count), or
   *  else the single largest run available (better than several small ones). */
  function bestRun(runs, count) {
    const fit = runs.find((r) => r.length >= count);
    if (fit) return fit.slice(0, count);
    let best = [];
    for (const r of runs) if (r.length > best.length) best = r;
    return best;
  }

  /** Nearest available seat to `targetNum`, preferring the ascending
   *  direction (targetNum+1, +2, ...) and only falling back to descending
   *  if nothing is available above. Matches "same direction" replacement:
   *  e.g. KA-4 unavailable, KA-5 also unavailable -> KA-6, next -> KA-7. */
  function nearestInDirection(numbered, targetNum) {
    const above = numbered.filter((s) => s.num > targetNum).sort((a, b) => a.num - b.num);
    if (above.length) return above[0];
    const below = numbered.filter((s) => s.num < targetNum).sort((a, b) => b.num - a.num);
    return below[0] || null;
  }

  /** Greedily add `needed` seats from `pool`, each time picking whichever is
   *  numerically closest to the growing chosen group (so the fill-in stays
   *  next to the block rather than scattering), within the same coach. */
  function nearestFill(chosenNums, pool, needed) {
    const chosen = chosenNums.slice();
    const remaining = pool.slice();
    const picked = [];
    while (needed > 0 && remaining.length) {
      let bestIdx = 0, bestDist = Infinity;
      for (let i = 0; i < remaining.length; i++) {
        const d = Math.min(...chosen.map((c) => Math.abs(c - remaining[i])));
        if (d < bestDist || (d === bestDist && remaining[i] < remaining[bestIdx])) { bestDist = d; bestIdx = i; }
      }
      const val = remaining.splice(bestIdx, 1)[0];
      picked.push(val); chosen.push(val); needed--;
    }
    return picked;
  }

  function numbered(seats) {
    return seats
      .map((s) => ({ ...s, num: RailwayValidation.seatNumber(s.seatId) }))
      .filter((s) => s.num != null);
  }

  /**
   * Fills `needed` more seats (mutates via trySeat/onProgress), preferring an
   * adjacent block within the range, then filling any remainder as close to
   * that block as possible, in the same coach, before moving to another coach.
   * Returns the number still needed afterwards.
   */
  async function fillAdjacent(needed, ctx) {
    const { coachSelect, order, rangeMin, rangeMax, chosen, trySeat, onProgress, isCancelled } = ctx;
    for (const coach of order) {
      if (needed <= 0 || isCancelled()) break;
      if (coach) await switchCoach(coachSelect, coach);

      // Snapshot only to PLAN which ids to go for. The actual click always
      // re-reads the live map and re-locates the seat by id right before
      // clicking (see clickById below): some sites re-render their whole
      // seat list after every click, which would turn a batch of element
      // references collected up front into silently-stale, detached nodes.
      const avail = numbered(
        readSeatMap().filter((s) => s.status === "available" && !chosen.includes(s.seatId) && inRange(s.seatId, rangeMin, rangeMax))
      ).sort((a, b) => a.num - b.num);
      if (!avail.length) continue;

      const byNum = new Map(avail.map((s) => [s.num, s.seatId]));
      const groupIds = bestRun(contiguousRuns(avail.map((s) => s.num)), needed).map((n) => byNum.get(n));

      const clickById = async (id) => {
        const fresh = readSeatMap().find((s) => s.seatId === id && s.status === "available");
        if (!fresh) return false;
        onProgress(`Selecting ${id}`);
        return trySeat(fresh);
      };

      for (const id of groupIds) {
        if (needed <= 0 || isCancelled()) break;
        if (await clickById(id)) needed--;
      }
      if (needed <= 0) break;

      const groupNumsChosen = groupIds.filter((id) => chosen.includes(id)).map(RailwayValidation.seatNumber);
      const restNums = avail.map((s) => s.num).filter((n) => !chosen.includes(byNum.get(n)));
      const fillNums = groupNumsChosen.length ? nearestFill(groupNumsChosen, restNums, needed) : restNums.slice(0, needed);
      for (const n of fillNums) {
        if (needed <= 0 || isCancelled()) break;
        if (await clickById(byNum.get(n))) needed--;
      }
    }
    return needed;
  }

  /**
   * Preferred mode: each requested id is matched exactly where possible; an
   * unavailable one is replaced by the nearest available seat in the same
   * direction (ascending first), within the same coach and the optional
   * range. Random mode picks an adjacent block (within the range if given,
   * otherwise anywhere), filling any remainder as close to it as possible.
   * Never selects more than `seatCount`. Selects only - never continues
   * the purchase.
   */
  async function selectSeats({ seatMode, preferredSeats = [], seatCount, rangeMin = null, rangeMax = null, isCancelled = () => false, onProgress = () => {} }) {
    const coachSelect = findCoachSelect();
    const coaches = coachSelect ? coachOptions(coachSelect) : [];
    const startIdx = Math.max(0, coaches.findIndex((o) => o.value === (coachSelect && coachSelect.value)));
    const order = coaches.length ? [...coaches.slice(startIdx), ...coaches.slice(0, startIdx)] : [null];

    const chosen = [];
    const trySeat = async (entry) => (await clickAndConfirm(entry)) && (chosen.push(entry.seatId), true);
    const ctx = { coachSelect, order, rangeMin, rangeMax, chosen, trySeat, onProgress, isCancelled };

    await clearExistingSelections({ coachSelect, order, onProgress, isCancelled });
    if (isCancelled()) return { selected: [], unavailablePreferred: [], shortfall: seatCount };

    const resolvedPreferred = new Set();   // wanted ids we found a seat for (exact or replacement)

    if (seatMode === "preferred") {
      const targets = preferredSeats.slice(0, seatCount);   // never more than requested
      for (const wanted of targets) {
        if (isCancelled() || chosen.length >= seatCount) break;
        const prefix = coachPrefixOf(wanted);
        const targetNum = RailwayValidation.seatNumber(wanted);

        for (const coach of order) {
          if (isCancelled()) break;
          if (coach) await switchCoach(coachSelect, coach);
          const map = readSeatMap();
          if (prefix && !map.some((s) => coachPrefixOf(s.seatId) === prefix)) continue; // wrong coach

          const exact = map.find((s) => s.seatId === wanted);
          if (exact && exact.status === "available") {
            onProgress(`Selecting ${wanted}`);
            if (await trySeat(exact)) resolvedPreferred.add(wanted);
            break;
          }
          if (exact && exact.status === "selected") { chosen.push(wanted); resolvedPreferred.add(wanted); break; }

          // Occupied, or not present in this coach at this exact number:
          // replace with the nearest available seat in the same direction.
          if (targetNum != null) {
            const avail = numbered(
              map.filter((s) => s.status === "available" && !chosen.includes(s.seatId) && inRange(s.seatId, rangeMin, rangeMax))
            );
            const repl = nearestInDirection(avail, targetNum);
            if (repl) {
              onProgress(`Selecting ${repl.seatId} (replacing ${wanted})`);
              if (await trySeat(repl)) resolvedPreferred.add(wanted);
            }
          }
          if (exact || prefix) break; // this was (or should have been) the right coach; don't search further ones
        }
      }
    }

    const stillNeeded = seatCount - chosen.length;
    if (stillNeeded > 0 && !isCancelled()) await fillAdjacent(stillNeeded, ctx);

    // Report only what THIS run did. `chosen` (this run's own confirmed
    // clicks) is authoritative; the Seat Details panel is read only as a
    // fallback for the rare case a click succeeded on the page but our own
    // confirmation check missed it - never used to pad or override our count,
    // since it can otherwise mix in seats left over from elsewhere.
    const confirmed = readSeatDetailsIds() || [];
    const selected = (chosen.length ? chosen : confirmed.filter((id) => preferredSeats.includes(id))).slice(0, seatCount);
    const unavailablePreferred = preferredSeats.filter((id) => !resolvedPreferred.has(id) && !selected.includes(id));
    return { selected, unavailablePreferred, shortfall: Math.max(0, seatCount - selected.length) };
  }

  return { readSeatMap, selectSeats, findSeatElements, classifySeat, findCoachSelect, findSeatDetailsPanel, readSeatDetailsIds };
})();
