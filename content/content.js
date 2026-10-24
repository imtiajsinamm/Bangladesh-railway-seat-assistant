/**
 * content/content.js - message router + run lifecycle.
 * Progress/results are written to chrome.storage.local (key "runStatus") so
 * the side panel shows them even if the site fully reloads mid-run.
 */
let activeRun = null; // { id, cancelled }

const setStatus = (s) => RailwayStorage.setStatus(s);

async function startRun(config, opts = {}) {
  if (activeRun) return { ok: false, error: "A run is already in progress. Press Stop first." };
  const run = { id: Date.now(), cancelled: false };
  activeRun = run;
  const ctl = {
    report: (message) => setStatus({ state: "running", message }),
    cancelled: () => run.cancelled,
    resumed: !!opts.resumed,
    markPending: () => RailwayStorage.setPending({ config }),
  };
  (async () => {
    try {
      await setStatus({ state: "running", message: "Starting..." });
      const res = await RailwayAdapter.run(config, ctl);
      if (res.stopped || run.cancelled) await setStatus({ state: "stopped", message: "Stopped." });
      else if (!res.ok) await setStatus({ state: "error", message: res.error });
      else await setStatus({ state: "done", selected: res.selected, unavailablePreferred: res.unavailablePreferred, shortfall: res.shortfall });
    } catch (e) {
      await setStatus({ state: "error", message: `Unexpected error: ${e && e.message ? e.message : e}` });
    } finally {
      await RailwayStorage.clearPending();
      activeRun = null;
    }
  })();
  return { ok: true, started: true };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    switch (message.type) {
      case "PING": return { ok: true };
      case "START_RUN": return startRun(message.config);
      case "SYNC_STATIONS": return RailwayListSync.start("stations");
      case "SYNC_TRAINS": return RailwayListSync.start("trains");
      case "STOP":
        RailwayListSync.cancel();
        if (activeRun) activeRun.cancelled = true;
        await RailwayStorage.clearPending();
        await setStatus({ state: "stopped", message: "Stopped." });
        return { ok: true };
      case "DIAGNOSE": return { ok: true, report: RailwayDiagnostics.run() };
      default: return { ok: false, error: `Unknown message type: ${message.type}` };
    }
  })().then(sendResponse).catch((e) => sendResponse({ ok: false, error: String(e && e.message ? e.message : e) }));
  return true;
});

// If the site did a FULL page reload while a run was in progress (e.g. after
// Search Trains), continue from wherever the page now is - once, and only if
// the pending marker is fresh.
(async () => {
  const pending = await RailwayStorage.getPending();
  if (pending && pending.config && Date.now() - pending.ts < 3 * 60 * 1000 && !activeRun) {
    await RailwayStorage.clearPending();
    startRun(pending.config, { resumed: true });
  }
})();
