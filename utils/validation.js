/**
 * utils/validation.js - pure functions, no DOM / chrome.* APIs.
 */
const RailwayValidation = (() => {
  // The site's seat ids look like "UMA-3" / "SCHA-81": letters, dash, number.
  // Used only to RECOGNISE seat elements; a user's id is never decomposed.
  const SEAT_ID_PATTERN = /^[A-Za-z]+-\d+[A-Za-z]?$/;
  const MAX_SEATS = 4; // the site: "Maximum 4 seats can be booked at a time"

  function normalizeSeatId(raw) {
    return (raw || "").trim().toUpperCase();
  }
  function looksLikeSeatId(text) {
    return SEAT_ID_PATTERN.test((text || "").trim());
  }
  /** Numeric part used ONLY for the optional min/max range filter. */
  function seatNumber(seatId) {
    const m = /(\d+)[A-Za-z]?$/.exec(seatId || "");
    return m ? Number(m[1]) : null;
  }
  function parsePreferredSeatsInput(raw) {
    if (!raw) return [];
    return raw
      .split(/[\s,]+/)
      .map(normalizeSeatId)
      .filter(Boolean)
      .filter((id, i, a) => a.indexOf(id) === i);
  }

  function validateConfig(config) {
    const errors = [];
    if (!config.startStation) errors.push("Please select a start station.");
    if (!config.destinationStation) errors.push("Please select a destination station.");
    if (
      config.startStation && config.destinationStation &&
      config.startStation.trim().toLowerCase() === config.destinationStation.trim().toLowerCase()
    ) errors.push("Start and destination stations must be different.");
    if (!config.journeyDate) errors.push("Please select a journey date.");
    if (!config.className) errors.push("Please select a class.");
    if (!config.trainName) errors.push("Please select a train.");

    const n = Number(config.seatCount);
    if (!Number.isInteger(n) || n < 1) errors.push("Please select at least one seat.");
    else if (n > MAX_SEATS) errors.push(`The site allows at most ${MAX_SEATS} seats at a time.`);

    if (config.seatMode === "preferred") {
      const preferred = config.preferredSeats || [];
      if (!preferred.length) errors.push("Please enter at least one preferred seat identifier.");
      else if (Number.isInteger(n) && preferred.length !== n) {
        errors.push(`Enter exactly ${n} preferred seat id(s) to match Number of Seats (got ${preferred.length}).`);
      }
    }
    const min = config.rangeMin === "" || config.rangeMin == null ? null : Number(config.rangeMin);
    const max = config.rangeMax === "" || config.rangeMax == null ? null : Number(config.rangeMax);
    if (min != null && max != null && min > max) errors.push("Seat number range: Min must not exceed Max.");
    return { valid: errors.length === 0, errors };
  }

  return { SEAT_ID_PATTERN, MAX_SEATS, normalizeSeatId, looksLikeSeatId, seatNumber, parsePreferredSeatsInput, validateConfig };
})();
if (typeof module !== "undefined" && module.exports) module.exports = RailwayValidation;
