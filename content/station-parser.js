/**
 * content/station-parser.js
 * From/To on the home page. Confirmed by a live diagnostic report:
 * #dest_from and #dest_to are Angular text inputs with a typeahead dropdown.
 * IDs are tried first; label heuristics are only a fallback if the site
 * ever renames them.
 */
const RailwayStationParser = (() => {
  const IDS = { start: "dest_from", end: "dest_to" };
  const LABELS = {
    start: ["from station", "from", "origin"],
    end: ["to station", "to", "destination"],
  };

  function findControl(kind) {
    const byId = document.getElementById(IDS[kind]);
    if (byId && RailwayDom.isVisible(byId)) return byId;
    for (const label of LABELS[kind]) {
      const el = RailwayDom.findControlByLabelText(label);
      if (el && el.tagName === "INPUT") return el;
    }
    return null;
  }

  /** Types the name, clicks the matching suggestion, and remembers every
   *  suggestion the site showed (so the side panel's list learns). */
  let lastDebug = "";

  async function selectStation(kind, stationName) {
    lastDebug = "";
    const control = findControl(kind);
    if (!control) { lastDebug = "The station input was not found on the page."; return false; }
    if (!stationName) return false;
    const items = await RailwayDom.typeaheadSuggestions(control, stationName);
    if (!items.length) {
      const near = RailwayDom.nearbyTexts(control);
      lastDebug = `Field value now: "${control.value}". Texts seen near the field: ${near.length ? near.join(" | ") : "(none)"}`;
      return false;
    }
    RailwayStorage.addLearned("stations", items.map((i) => i.text));
    const norm = RailwayDom.normalizeText(stationName);
    const target =
      items.find((i) => RailwayDom.normalizeText(i.text) === norm) ||
      items.find((i) => RailwayDom.normalizeText(i.text).startsWith(norm)) ||
      items[0];
    RailwayDom.fireClick(target.element);
    await RailwayDom.sleep(250);
    return true;
  }

  return {
    findStartControl: () => findControl("start"),
    findEndControl: () => findControl("end"),
    selectStation,
    getLastDebug: () => lastDebug,
  };
})();
