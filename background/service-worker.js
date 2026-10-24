/**
 * background/service-worker.js
 * Only job: make the toolbar icon open the side panel (like the reference
 * tool). No polling, no alarms, no background automation.
 */
chrome.runtime.onInstalled.addListener(() => {
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
  }
});
