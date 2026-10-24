/**
 * content/diagnostics.js - reports what the extension can see on the
 * current page (home form, results page, or seat map), for troubleshooting.
 */
const RailwayDiagnostics = (() => {
  const d = (el) => (el ? RailwayDom.describeElement(el) : null);

  function run() {
    const tokens = RailwayTrainParser.scanTokens();
    const seats = RailwaySeatSelector.readSeatMap();
    const coach = RailwaySeatSelector.findCoachSelect();
    return {
      url: location.href,
      title: document.title,
      stage: RailwayAdapter.detectStage(),
      homeForm: {
        from: d(RailwayStationParser.findStartControl()),
        to: d(RailwayStationParser.findEndControl()),
        class: d(RailwayClassParser.findSelect()),
        date: d(RailwayAdapter.findDateControl()),
        searchButton: d(RailwayAdapter.findSearchButton()),
      },
      resultsPage: {
        trainHeadings: tokens.filter((t) => t.kind === "heading").map((t) => t.text),
        classTokens: tokens.filter((t) => t.kind === "class").length,
        bookNowTokens: tokens.filter((t) => t.kind === "booknow").length,
      },
      seatMap: {
        seatCount: seats.length,
        counts: seats.reduce((a, s) => ((a[s.status] = (a[s.status] || 0) + 1), a), {}),
        sample: seats.slice(0, 8).map((s) => ({
          id: s.seatId, status: s.status,
          html: s.element.outerHTML.slice(0, 160),
          bg: getComputedStyle(s.element).backgroundColor,
        })),
        coachSelect: d(coach),
        seatDetailsPanelFound: !!RailwaySeatSelector.findSeatDetailsPanel(),
      },
    };
  }
  return { run };
})();
