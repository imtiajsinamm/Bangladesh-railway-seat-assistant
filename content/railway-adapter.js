/**
 * content/railway-adapter.js
 *
 * Orchestrates the real flow seen in the demo video:
 *   home form -> "Search Trains" -> results page (train cards)
 *   -> BOOK NOW on the chosen class tile -> inline seat map -> select seats.
 * It detects which stage the page is already at, so it works when started
 * from the home page, the results page, or with the seat map already open.
 *
 * HARD STOP: after seats are selected this file returns. It never clicks
 * CONTINUE PURCHASE, passenger, OTP, CAPTCHA or payment controls.
 * Single pass only: no retry loops, no refreshing, no watching for seats.
 */
const RailwayAdapter = (() => {
  const SEARCH_LABELS = ["search trains", "search train", "search"];

  function findSearchButton() {
    const buttons = Array.from(document.querySelectorAll("button, [role='button'], input[type='submit']"));
    for (const label of SEARCH_LABELS) {
      const hit = buttons.find((b) => RailwayDom.normalizeText(b.textContent || b.value).includes(label));
      if (hit) return hit;
    }
    return null;
  }

  function findDateControl() {
    const byId = document.getElementById("doj");
    if (byId && RailwayDom.isVisible(byId)) return byId;
    return RailwayDom.findControlByLabelText("journey date") || RailwayDom.findControlByLabelText("date");
  }

  const pad = (n) => String(n).padStart(2, "0");
  const MONTHS = ["january","february","march","april","may","june","july","august","september","october","november","december"];
  const MONTH_RE = /(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})/i;
  const CAL_SELECTOR = ".ui-datepicker, .datepicker, .datepicker-dropdown, [class*='datepicker'], [class*='calendar'], [role='grid'], [role='dialog']";

  const cls = (el) => {
    const c = el && el.className;
    return typeof c === "string" ? c : c && c.baseVal !== undefined ? c.baseVal : "";
  };
  const hintText = (el) => [cls(el), el.getAttribute("title"), el.getAttribute("alt"), el.getAttribute("aria-label"), el.getAttribute("data-handler")].filter(Boolean).join(" ");

  /** The open popup calendar (smallest visible box showing "Month YYYY" + a day grid). */
  function findCalendar() {
    const boxes = Array.from(document.querySelectorAll(CAL_SELECTOR)).filter(
      (el) => RailwayDom.isVisible(el) && MONTH_RE.test(el.textContent) && el.querySelector("table, td")
    );
    boxes.sort((x, y) => x.textContent.length - y.textContent.length);
    return boxes[0] || null;
  }

  function shownMonth(cal) {
    const m = MONTH_RE.exec(cal.textContent);
    return m ? { month: MONTHS.indexOf(m[1].toLowerCase()), year: Number(m[2]) } : null;
  }

  /** The small calendar icon next to the date input, if the widget has one. */
  function findDateTrigger(control) {
    let scope = control.parentElement;
    for (let i = 0; i < 3 && scope; i++, scope = scope.parentElement) {
      const hit = Array.from(scope.querySelectorAll("img, i, svg, span, button, a, div")).find(
        (el) => el !== control && !el.contains(control) && !control.contains(el) &&
          RailwayDom.isVisible(el) && /calendar|date|trigger|picker/i.test(hintText(el))
      );
      if (hit) return hit;
    }
    return null;
  }

  /** Opens the calendar. This widget opens on FOCUS (a synthetic click does not
   *  focus the field), so fire focus events first, then click, then try the icon. */
  async function openCalendar(control) {
    control.focus();
    control.dispatchEvent(new FocusEvent("focus"));
    control.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    RailwayDom.fireClick(control);
    let cal = await RailwayDom.waitFor(findCalendar, { timeoutMs: 1500 });
    if (cal) return cal;
    const trigger = findDateTrigger(control);
    if (trigger) {
      RailwayDom.fireClick(trigger);
      cal = await RailwayDom.waitFor(findCalendar, { timeoutMs: 1500 });
    }
    return cal;
  }

  function findNavButton(cal, dir) {
    const re = dir === "next" ? /next/i : /prev/i;
    return Array.from(cal.querySelectorAll("a, button, span, i, th, div, td")).find(
      (el) => RailwayDom.isVisible(el) && re.test(hintText(el)) && !/disabled/i.test(hintText(el))
    ) || null;
  }

  async function gotoMonth(year, month0) {
    for (let i = 0; i < 14; i++) {
      const cal = findCalendar();
      if (!cal) return false;
      const shown = shownMonth(cal);
      if (!shown) return false;
      const diff = (year - shown.year) * 12 + (month0 - shown.month);
      if (diff === 0) return true;
      const btn = findNavButton(cal, diff > 0 ? "next" : "prev");
      if (!btn) return false;
      RailwayDom.fireClick(btn);
      await RailwayDom.sleep(250);
    }
    return false;
  }

  /** A clickable (not greyed-out / other-month) cell showing this day number. */
  function findDayCell(cal, year, month0, day) {
    const leaves = RailwayDom.findElementsByText((t) => t.trim() === day, cal).filter(RailwayDom.isVisible);
    const usable = leaves.filter((el) => {
      let n = el;
      for (let i = 0; i < 3 && n && n !== cal; i++, n = n.parentElement) {
        if (/disabled|unselectable|(^|\s)old(\s|$)|(^|\s)new(\s|$)|other-month/i.test(cls(n))) return false;
        if (n.tagName === "TD") break;
      }
      return true;
    });
    const exact = usable.find((el) => {
      const td = el.closest("td");
      return td && td.getAttribute("data-month") === String(month0) && td.getAttribute("data-year") === String(year);
    });
    return exact || usable[0] || null;
  }

  /**
   * #doj is read-only and has no form binding of its own: the site only learns
   * the date when a day is clicked in ITS calendar (its onSelect handler). So
   * typing/setting the value does nothing useful - we must operate the calendar.
   * Returns { ok, reason? }.
   */
  async function setJourneyDate(isoDate) {
    const control = findDateControl();
    if (!control) return { ok: false, reason: "the date field was not found on the page." };
    const [Y, M, D] = String(isoDate).split("-").map(Number);
    if (!Y || !M || !D) return { ok: false, reason: `"${isoDate}" is not a valid date.` };

    if (control.type === "date") {
      RailwayDom.setNativeInputValue(control, isoDate);
      return { ok: true };
    }

    const monthName = MONTHS[M - 1][0].toUpperCase() + MONTHS[M - 1].slice(1);
    const label = `${D} ${monthName} ${Y}`;
    const opened = await openCalendar(control);
    if (!opened) return { ok: false, reason: "the calendar would not open (tried focusing the field and its calendar icon)." };

    if (!(await gotoMonth(Y, M - 1))) {
      const shown = findCalendar() && shownMonth(findCalendar());
      return { ok: false, reason: `could not navigate the calendar to ${MONTHS[M - 1]} ${Y} (it shows ${shown ? MONTHS[shown.month] + " " + shown.year : "an unknown month"}; that month may be outside the booking window).` };
    }

    const cal = findCalendar();
    const cell = cal && findDayCell(cal, Y, M - 1, String(D));
    if (!cell) {
      return { ok: false, reason: `${label} is greyed out / not selectable in the calendar (the site allows booking only a limited number of days ahead).` };
    }

    RailwayDom.fireClick(cell);
    const expect = `${pad(D)}/${pad(M)}/${Y}`;
    await RailwayDom.waitFor(() => control.value === expect || !findCalendar(), { timeoutMs: 2000 });
    await RailwayDom.sleep(250);
    control.dispatchEvent(new Event("input", { bubbles: true }));
    control.dispatchEvent(new Event("change", { bubbles: true }));

    if (!control.value) return { ok: false, reason: `clicking ${label} in the calendar did not fill the date field.` };
    return { ok: true };
  }

  function detectStage() {
    if (RailwaySeatSelector.findSeatElements().length > 0) return "seats";
    if (RailwayTrainParser.headingTokens().length > 0) return "results";
    if (RailwayStationParser.findStartControl()) return "home";
    return null;
  }

  /**
   * ctl = { report(msg), cancelled(), markPending() }
   * Returns { ok, error? } or { ok:true, selected, unavailablePreferred, shortfall }.
   */
  async function run(config, ctl) {
    const say = (m) => ctl.report(m);
    const stop = () => ctl.cancelled();

    say("Checking the page...");
    let stage = await RailwayDom.waitFor(detectStage, { timeoutMs: 6000 });
    if (!stage) {
      return { ok: false, error: "Open the Bangladesh Railway search page (logged in), then try again." };
    }

    if (stage === "home" && ctl.resumed) {
      return { ok: false, error: "The page reloaded back to the search form. Press Select Seats again." };
    }

    if (stage === "home") {
      say("Filling From station...");
      if (!(await RailwayStationParser.selectStation("start", config.startStation)))
        return { ok: false, error: `Could not pick "${config.startStation}" as the From station (no matching suggestion appeared).\n${RailwayStationParser.getLastDebug()}` };
      if (stop()) return { ok: false, stopped: true };

      say("Filling To station...");
      if (!(await RailwayStationParser.selectStation("end", config.destinationStation)))
        return { ok: false, error: `Could not pick "${config.destinationStation}" as the To station (no matching suggestion appeared).\n${RailwayStationParser.getLastDebug()}` };
      if (stop()) return { ok: false, stopped: true };

      say("Setting the date...");
      const dateRes = await setJourneyDate(config.journeyDate);
      if (!dateRes.ok) return { ok: false, error: `Could not set the journey date: ${dateRes.reason}` };

      say("Choosing the class...");
      if (!(await RailwayClassParser.selectClass(config.className)))
        return { ok: false, error: `Could not select class "${config.className}" (not offered in the site's class list).` };
      if (stop()) return { ok: false, stopped: true };

      const btn = findSearchButton();
      if (!btn) return { ok: false, error: "Could not find the Search Trains button." };
      const enabled = await RailwayDom.waitFor(() => (!btn.disabled ? true : null), { timeoutMs: 4000 });
      if (!enabled)
        return { ok: false, error: `Search Trains stayed disabled - one field did not register on the page.\nOn the page now: From="${(RailwayStationParser.findStartControl() || {}).value || ""}", To="${(RailwayStationParser.findEndControl() || {}).value || ""}", Date="${(findDateControl() || {}).value || ""}", Class="${(RailwayClassParser.findSelect() || {}).value || ""}".` };

      say("Searching trains...");
      await ctl.markPending(); // survives a full page reload during search
      RailwayDom.fireClick(btn);
      stage = "results-wait";
    }

    if (stage === "results-wait" || stage === "results") {
      say("Waiting for the train list...");
      const ready = await RailwayDom.waitFor(() => RailwayTrainParser.headingTokens().length > 0, { timeoutMs: 30000 });
      if (!ready) return { ok: false, error: "The train list did not appear (site slow, session expired, or no trains for this search)." };
      await RailwayDom.sleep(400);
      RailwayStorage.addLearned("trains", RailwayTrainParser.collectTrainNames());
      if (stop()) return { ok: false, stopped: true };

      say(`Opening ${config.trainName} / ${config.className}...`);
      const found = RailwayTrainParser.findBookNow(config.trainName, config.className);
      if (!found.ok) return { ok: false, error: found.reason };
      RailwayDom.fireClick(found.el);
      stage = "seats-wait";
    }

    if (stage === "seats-wait") {
      say("Waiting for the seat map...");
      const ready = await RailwayDom.waitFor(() => RailwaySeatSelector.findSeatElements().length > 0, { timeoutMs: 12000 });
      if (!ready) return { ok: false, error: "The seat map did not open after BOOK NOW (no tickets available for that class?)." };
      await RailwayDom.sleep(400);
    }

    if (stop()) return { ok: false, stopped: true };
    say("Selecting seats...");
    const result = await RailwaySeatSelector.selectSeats({
      seatMode: config.seatMode,
      preferredSeats: config.preferredSeats || [],
      seatCount: Number(config.seatCount),
      rangeMin: config.rangeMin === "" || config.rangeMin == null ? null : Number(config.rangeMin),
      rangeMax: config.rangeMax === "" || config.rangeMax == null ? null : Number(config.rangeMax),
      isCancelled: stop,
      onProgress: say,
    });
    return { ok: true, ...result };   // STOP: CONTINUE PURCHASE is left to the user.
  }

  return { run, findSearchButton, findDateControl, detectStage, setJourneyDate };
})();
