/**
 * content/train-parser.js
 *
 * Results page (seen in the demo video): a vertical list of train cards.
 * Each card has a heading like "PANCHAGARH EXPRESS (793)", then class tiles
 * (code such as S_CHAIR, price, available count, "BOOK NOW").
 *
 * Instead of guessing CSS classes, this walks the page ONCE in document
 * order and records three kinds of visible leaf text:
 *    heading  - text ending in "(digits)", e.g. "EKOTA EXPRESS (705)"
 *    class    - text that is/starts with a class code, e.g. "S_CHAIR"
 *    booknow  - text "BOOK NOW"
 * A card is "everything after its heading until the next heading", and a
 * tile's BOOK NOW is the first BOOK NOW after its class code. This works
 * regardless of how the site nests its markup.
 */
const RailwayTrainParser = (() => {
  // Exactly one parenthesized number: rejects two names accidentally glued
  // together (defense in depth alongside the tightened leafText in dom.js).
  const HEADING_RE = /^[^()]*\(\d{1,4}\)\s*$/;
  const CLASS_CODE_RE = /^[A-Z][A-Z_]{1,9}$/;

  function trainNumber(name) {
    const m = /\((\d+)\)\s*$/.exec(name || "");
    return m ? m[1] : null;
  }

  /** All meaningful visible leaves, in document order. */
  function scanTokens() {
    const tokens = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
    let node = walker.currentNode;
    while (node) {
      const tag = node.tagName;
      if (tag !== "SCRIPT" && tag !== "STYLE" && tag !== "OPTION" && tag !== "SELECT") {
        const raw = RailwayDom.leafText(node);
        const text = raw.replace(/\s+/g, " ").trim();
        if (text && text.length <= 90) {
          let kind = null;
          if (RailwayDom.normalizeText(text) === "book now") kind = "booknow";
          else if (HEADING_RE.test(text) && /[A-Za-z]/.test(text)) kind = "heading";
          else {
            const word = text.split(/\s+/)[0];
            if (CLASS_CODE_RE.test(word) && (word.includes("_") || word === "SHOVAN" || word === "SNIGDHA")) kind = "class";
          }
          if (kind && RailwayDom.isVisible(node)) tokens.push({ kind, el: node, text });
        }
      }
      node = walker.nextNode();
    }
    // A wrapper and its child often carry the same text; keep the deepest one.
    return tokens.filter((t, i) => {
      const n = tokens[i + 1];
      return !(n && n.kind === t.kind && n.text === t.text && t.el.contains(n.el));
    });
  }

  function headingTokens(tokens = scanTokens()) {
    return tokens.filter((t) => t.kind === "heading");
  }

  /** Distinct train names currently shown (for the learned list). */
  function collectTrainNames() {
    const names = headingTokens().map((t) => t.text);
    return Array.from(new Set(names));
  }

  /** Every visible "NAME (123)" text on the page, plus <option>s shaped like it. */
  function collectAllTrainNames() {
    const names = new Set(collectTrainNames());
    document.querySelectorAll("option").forEach((o) => {
      const t = o.textContent.replace(/\s+/g, " ").trim();
      if (HEADING_RE.test(t) && /[A-Za-z]/.test(t) && t.length <= 90) names.add(t);
    });
    return Array.from(names);
  }

  function matchesTrain(headingText, wanted) {
    const num = trainNumber(wanted);
    if (num) return headingText.includes(`(${num})`);
    return RailwayDom.normalizeText(headingText) === RailwayDom.normalizeText(wanted);
  }

  /**
   * Finds the BOOK NOW element for (train, class). Returns
   * { ok, el?, reason? } so the caller can give a precise error.
   */
  function findBookNow(trainName, classCode) {
    const tokens = scanTokens();
    const headings = tokens.filter((t) => t.kind === "heading");
    const start = tokens.findIndex((t) => t.kind === "heading" && matchesTrain(t.text, trainName));
    if (start === -1) {
      return { ok: false, reason: `Train "${trainName}" is not on the results page (shown: ${headings.map((h) => h.text).join(" | ") || "none"}).` };
    }
    let end = tokens.length;
    for (let i = start + 1; i < tokens.length; i++) {
      if (tokens[i].kind === "heading") { end = i; break; }
    }
    const want = RailwayDom.normalizeText(classCode);
    const region = tokens.slice(start + 1, end);
    const classIdx = region.findIndex(
      (t) => t.kind === "class" && RailwayDom.normalizeText(t.text.split(/\s+/)[0]) === want
    );
    if (classIdx === -1) {
      const offered = region.filter((t) => t.kind === "class").map((t) => t.text.split(/\s+/)[0]);
      return { ok: false, reason: `Class ${classCode} is not offered for this train (offered: ${offered.join(", ") || "none"}).` };
    }
    const book = region.slice(classIdx + 1).find((t) => t.kind === "booknow");
    if (!book) return { ok: false, reason: `No BOOK NOW button found for ${classCode}.` };
    const clickable = book.el.closest("button, a, [role='button']") || book.el;
    if (clickable.disabled || clickable.getAttribute("aria-disabled") === "true") {
      return { ok: false, reason: `BOOK NOW for ${classCode} is disabled (likely no tickets available).` };
    }
    return { ok: true, el: clickable };
  }

  return { scanTokens, headingTokens, collectTrainNames, collectAllTrainNames, findBookNow, trainNumber };
})();
