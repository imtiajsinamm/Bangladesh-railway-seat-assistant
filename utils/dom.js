/**
 * utils/dom.js
 *
 * Generic, site-agnostic DOM helpers.
 * Nothing in this file should ever contain a Bangladesh-Railway-specific
 * selector, class name, or id. Site-specific knowledge belongs in
 * content/railway-adapter.js so it can be updated independently if the
 * site changes.
 */

const RailwayDom = (() => {
  // Flip to false to silence console logging. Logs are prefixed so they're
  // easy to filter in DevTools: type "[RSA]" into the console filter box.
  const DEBUG = true;
  function log(...args) {
    if (DEBUG) console.log("[RSA]", ...args);
  }

  /** Collapse whitespace and lowercase, for forgiving text comparisons. */
  function normalizeText(str) {
    return (str || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** True if an element currently occupies visible space. Used to avoid
   *  matching a field that exists in the DOM (e.g. behind an Angular
   *  *ngIf, not yet revealed) but isn't actually usable yet - which is
   *  exactly what caused an earlier bug where a hidden/not-yet-rendered
   *  section fell back to matching an unrelated visible element instead. */
  function isVisible(el) {
    if (!el || typeof el.getBoundingClientRect !== "function") return false;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;
    const style = window.getComputedStyle(el);
    return style.visibility !== "hidden" && style.display !== "none";
  }

  /** querySelectorAll that also descends into open shadow roots (some sites
   *  build inputs/dropdowns as web components). Closed shadow roots can't
   *  be reached by any script, including this one. */
  function queryAllDeep(selector, root = document) {
    const results = Array.from(root.querySelectorAll(selector));
    const all = root.querySelectorAll("*");
    for (const el of all) {
      if (el.shadowRoot) {
        results.push(...queryAllDeep(selector, el.shadowRoot));
      }
    }
    return results;
  }

  /** Compact, human-readable summary of an element for diagnostics/logging.
   *  Deliberately doesn't include full outerHTML of large containers. */
  function describeElement(el) {
    if (!el) return null;
    return {
      tag: el.tagName,
      id: el.id || undefined,
      name: el.getAttribute && el.getAttribute("name") || undefined,
      type: el.getAttribute && el.getAttribute("type") || undefined,
      role: el.getAttribute && el.getAttribute("role") || undefined,
      className: typeof el.className === "string" ? el.className : undefined,
      ariaLabel: el.getAttribute && el.getAttribute("aria-label") || undefined,
      placeholder: el.getAttribute && el.getAttribute("placeholder") || undefined,
      textPreview: (el.textContent || "").trim().slice(0, 60) || undefined,
      outerHTMLPreview: el.outerHTML ? el.outerHTML.slice(0, 200) : undefined,
    };
  }

  /**
   * Wait for a predicate to return a truthy value, re-checking on every
   * DOM mutation plus a fallback poll, up to `timeoutMs`. Resolves with
   * whatever the predicate returned, or null on timeout.
   *
   * This intentionally does NOT poll forever (see spec section 15).
   */
  function waitFor(predicate, { timeoutMs = 8000, pollMs = 250 } = {}) {
    return new Promise((resolve) => {
      const start = Date.now();
      let settled = false;

      const finish = (value) => {
        if (settled) return;
        settled = true;
        observer.disconnect();
        clearInterval(intervalId);
        resolve(value);
      };

      const check = () => {
        let result;
        try {
          result = predicate();
        } catch (e) {
          result = null;
        }
        if (result) {
          finish(result);
          return true;
        }
        if (Date.now() - start > timeoutMs) {
          finish(null);
          return true;
        }
        return false;
      };

      // Angular spinners mutate the DOM constantly; running an expensive
      // predicate on every mutation could freeze the page, so throttle.
      let scheduled = false;
      const observer = new MutationObserver(() => {
        if (scheduled) return;
        scheduled = true;
        setTimeout(() => {
          scheduled = false;
          if (!settled) check();
        }, 120);
      });
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
      });

      // Fallback poll in case relevant mutations don't fire (e.g. canvas/shadow DOM).
      const intervalId = setInterval(check, pollMs);

      // Check immediately in case it's already present.
      check();
    });
  }

  /** All elements whose visible text matches a given predicate. */
  function findElementsByText(matchFn, root = document) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    const matches = [];
    let node = walker.currentNode;
    while (node) {
      const ownText = getOwnText(node);
      if (ownText && matchFn(ownText, node)) {
        matches.push(node);
      }
      node = walker.nextNode();
    }
    return matches;
  }

  /** Text directly inside this element, excluding text from child elements
   *  (helps find the smallest element that "is" a label/seat rather than
   *  a large wrapping container). */
  function getOwnText(el) {
    let text = "";
    for (const child of el.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        text += child.textContent;
      }
    }
    return text.trim();
  }

  /** Find a form control associated with a visible label of the given text
   *  (by <label for>, aria-label, aria-labelledby, placeholder, or a
   *  nearby text node). This covers the common ways "From" / "To" /
   *  "Class" fields get labelled on modern SPA forms. */
  function findControlByLabelText(labelText, root = document) {
    const target = normalizeText(labelText);
    let fallbackInvisible = null;
    const acceptOrFallback = (el, how) => {
      if (isVisible(el)) {
        log(`findControlByLabelText("${labelText}") matched via ${how}`, describeElement(el));
        return el;
      }
      if (!fallbackInvisible) fallbackInvisible = el;
      return null;
    };

    // 1. <label for="id">
    for (const label of queryAllDeep("label", root)) {
      if (normalizeText(label.textContent).includes(target)) {
        const forId = label.getAttribute("for");
        if (forId) {
          const el = document.getElementById(forId);
          if (el) {
            const hit = acceptOrFallback(el, "<label for>");
            if (hit) return hit;
          }
        }
        const nested = label.querySelector("input, select, textarea, [role='combobox']");
        if (nested) {
          const hit = acceptOrFallback(nested, "nested control in <label>");
          if (hit) return hit;
        }
      }
    }

    // 2. aria-label / aria-labelledby directly on the control
    const candidates = queryAllDeep(
      "input, select, textarea, [role='combobox'], [role='listbox'], [role='button']",
      root
    );
    for (const el of candidates) {
      const ariaLabel = el.getAttribute("aria-label");
      if (ariaLabel && normalizeText(ariaLabel).includes(target)) {
        const hit = acceptOrFallback(el, "aria-label");
        if (hit) return hit;
      }

      const labelledBy = el.getAttribute("aria-labelledby");
      if (labelledBy) {
        const labelEl = document.getElementById(labelledBy);
        if (labelEl && normalizeText(labelEl.textContent).includes(target)) {
          const hit = acceptOrFallback(el, "aria-labelledby");
          if (hit) return hit;
        }
      }

      const placeholder = el.getAttribute("placeholder");
      if (placeholder && normalizeText(placeholder).includes(target)) {
        const hit = acceptOrFallback(el, "placeholder");
        if (hit) return hit;
      }

      const name = el.getAttribute("name");
      if (name && normalizeText(name).includes(target)) {
        const hit = acceptOrFallback(el, "name attribute");
        if (hit) return hit;
      }

      const dataAttrs = el.getAttributeNames().filter((n) => n.startsWith("data-"));
      for (const attr of dataAttrs) {
        if (normalizeText(el.getAttribute(attr)).includes(target)) {
          const hit = acceptOrFallback(el, attr);
          if (hit) return hit;
        }
      }
    }

    // 3. A text node near an input (sibling / parent proximity heuristic).
    // Deliberately last-resort and required to be visible immediately
    // (not just "fallback if nothing else visible"), since this is the
    // loosest heuristic and most prone to grabbing an unrelated control
    // when the intended field is hidden/not yet rendered.
    const textEls = findElementsByText((t) => normalizeText(t).includes(target), root);
    for (const el of textEls) {
      const container = el.closest("div, section, fieldset") || el.parentElement;
      if (!container) continue;
      const control = container.querySelector("input, select, textarea, [role='combobox']");
      if (control && isVisible(control)) {
        log(`findControlByLabelText("${labelText}") matched via nearby text node`, describeElement(control));
        return control;
      }
    }

    if (fallbackInvisible) {
      log(`findControlByLabelText("${labelText}") only found a HIDDEN match (not used):`, describeElement(fallbackInvisible));
    } else {
      log(`findControlByLabelText("${labelText}") found NOTHING`);
    }
    return null;
  }

  /** Reads visible <option> or list-item style text out of a <select>,
   *  or out of a custom combobox's opened listbox (role="listbox" /
   *  role="option"), whichever pattern the site uses. */
  function readOptionsFromControl(control) {
    if (!control) return [];
    if (control.tagName === "SELECT") {
      return Array.from(control.options)
        .map((o) => o.textContent.trim())
        .filter(Boolean);
    }
    // Custom combobox: look for an associated/expanded listbox.
    const listboxId = control.getAttribute("aria-controls") || control.getAttribute("aria-owns");
    let listbox = listboxId ? document.getElementById(listboxId) : null;
    if (!listbox) {
      listbox = document.querySelector("[role='listbox']");
    }
    if (!listbox) return [];
    return Array.from(listbox.querySelectorAll("[role='option'], li, div"))
      .map((o) => o.textContent.trim())
      .filter(Boolean);
  }

  /** Dispatch the events a React/Vue-controlled input typically needs to
   *  register a programmatic value change. Used for plain fields (e.g. a
   *  native <input type=date>) where nothing needs to react per-keystroke. */
  function setNativeInputValue(el, value) {
    const proto = el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (setter) {
      setter.call(el, value);
    } else {
      el.value = value;
    }
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  /** Simulates real character-by-character typing: focus, then for each
   *  character dispatch keydown -> set value -> input -> keyup, finishing
   *  with a change event. Some autocomplete widgets only wire up
   *  onKeyUp/onKeyDown handlers rather than onChange/onInput, so a single
   *  programmatic value-set (setNativeInputValue) never triggers their
   *  search - this covers both styles. */
  async function simulateTyping(el, text, { perCharDelayMs = 30 } = {}) {
    const proto = el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    const applyValue = (v) => {
      if (setter) setter.call(el, v);
      else el.value = v;
    };
    const keyInit = (ch) => {
      const upper = ch.length === 1 ? ch.toUpperCase() : ch;
      const code = ch.length === 1 && /[a-z]/i.test(ch) ? "Key" + upper : ch === " " ? "Space" : "";
      const keyCode = ch.length === 1 ? upper.charCodeAt(0) : 0;
      return { key: ch, code, keyCode, which: keyCode, bubbles: true, cancelable: true, composed: true };
    };

    // When the user is working in the side panel the PAGE window has no
    // system focus, so el.focus() alone may not fire focus events. Fire
    // them explicitly (and a click) so typeaheads that open on focus/click work.
    el.focus();
    el.dispatchEvent(new FocusEvent("focus", { bubbles: false }));
    el.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    applyValue("");
    el.dispatchEvent(new Event("input", { bubbles: true }));
    await sleep(perCharDelayMs);

    let current = "";
    for (const ch of text) {
      current += ch;
      el.dispatchEvent(new KeyboardEvent("keydown", keyInit(ch)));
      el.dispatchEvent(new KeyboardEvent("keypress", keyInit(ch)));
      applyValue(current);
      el.dispatchEvent(new InputEvent("input", { data: ch, inputType: "insertText", bubbles: true, composed: true }));
      el.dispatchEvent(new KeyboardEvent("keyup", keyInit(ch)));
      await sleep(perCharDelayMs);
    }
    // NOTE: deliberately no blur/change here - typeaheads close their
    // dropdown on blur, which would hide the suggestions we need to read.
  }

  function fireClick(el) {
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "instant" });
    el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    el.click();
  }

  /** Text usable for matching a suggestion-list row: either this element's
   *  own direct text, or (if it's a small leaf-like wrapper, e.g. the
   *  match gets wrapped in a <mark>/<span> for highlighting) its full
   *  textContent, but only when that's short and the element has few
   *  children - this avoids accidentally matching large page sections. */
  function leafText(el) {
    const own = getOwnText(el);
    if (own) return own;
    const full = el.textContent.trim();
    // <= 1 child only: a single-level wrapper around one label. With 2+
    // children (e.g. several sibling rows in a list), falling back to
    // combined textContent glues unrelated siblings together with no
    // separator - so this must stay narrow.
    if (el.children.length === 1 && full.length > 0 && full.length <= 80) {
      return full;
    }
    return "";
  }

  /**
   * Type `text` into `control` (as a real typeahead field expects) and
   * find whatever suggestion-list items appear as a result. Scoped so it
   * can't accidentally pick up unrelated page content:
   *   - candidates must be near `control` (below it, within ~400px, not
   *     an ancestor/descendant of it)
   *   - candidates are grouped by parent element, and only the largest
   *     sibling group is treated as "the list" (a real dropdown has
   *     several rows sharing one parent; a stray marketing sentence
   *     elsewhere on the page won't have that shape)
   *   - text is required to actually contain what was typed, since a
   *     typeahead's rows are filtered matches
   *
   * Returns [{ text, element }], deduplicated, in DOM order.
   */
  function findSuggestionItems(control, queryText) {
    const norm = normalizeText(queryText);
    if (!norm) return [];

    const rect = control.getBoundingClientRect();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
    const candidates = [];
    let node = walker.currentNode;
    while (node) {
      if (!control.contains(node) && !node.contains(control)) {
        const text = leafText(node);
        if (text && normalizeText(text).includes(norm)) {
          const r = node.getBoundingClientRect();
          const visible = r.width > 0 && r.height > 0;
          const positionedBelowish = r.top >= rect.top - 20 && r.top - rect.bottom < 400;
          if (visible && positionedBelowish) {
            candidates.push({ text, element: node });
          }
        }
      }
      node = walker.nextNode();
    }

    if (candidates.length === 0) {
      log(`findSuggestionItems: 0 elements on the page currently contain "${queryText}" near the field`);
      return [];
    }

    const groups = new Map();
    for (const c of candidates) {
      const key = c.element.parentElement;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(c);
    }
    let bestGroup = [];
    for (const group of groups.values()) {
      if (group.length > bestGroup.length) bestGroup = group;
    }
    log(`findSuggestionItems: ${candidates.length} raw candidate(s), ${groups.size} group(s), best group size ${bestGroup.length}`);

    const seen = new Set();
    const result = [];
    for (const c of bestGroup) {
      if (!seen.has(c.text)) {
        seen.add(c.text);
        result.push(c);
      }
    }
    return result;
  }

  /** Visible short texts near a field (below it, within ~500px). Used only
   *  for error reports, so a failure shows what the page actually rendered. */
  function nearbyTexts(control, limit = 14) {
    const rect = control.getBoundingClientRect();
    const out = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
    let node = walker.currentNode;
    while (node && out.length < limit) {
      if (!control.contains(node) && !node.contains(control) && !["SCRIPT", "STYLE", "OPTION"].includes(node.tagName)) {
        const t = leafText(node).replace(/\s+/g, " ").trim();
        if (t && t.length <= 60) {
          const r = node.getBoundingClientRect();
          if (r.width > 0 && r.height > 0 && r.top >= rect.top - 5 && r.top - rect.bottom < 500 && r.left < rect.right + 40 && r.right > rect.left - 40) {
            if (!out.includes(t)) out.push(t);
          }
        }
      }
      node = walker.nextNode();
    }
    return out;
  }

  /** Type into a typeahead control and return the suggestion items, without
   *  clicking anything. Retries once with a shorter prefix, because some
   *  typeaheads only query the server on the first few characters. */
  async function typeaheadSuggestions(control, text, { timeoutMs = 3500 } = {}) {
    if (!control || !text) return [];
    const attempts = [text];
    if (text.length > 4) attempts.push(text.slice(0, 3));
    for (const attempt of attempts) {
      log(`typeaheadSuggestions: typing "${attempt}" into`, describeElement(control));
      await simulateTyping(control, attempt);
      const items = await waitFor(() => {
        const found = findSuggestionItems(control, attempt);
        return found.length ? found : null;
      }, { timeoutMs, pollMs: 150 });
      log(`typeaheadSuggestions: found ${items ? items.length : 0} suggestion(s) for "${attempt}"`, items && items.map((i) => i.text));
      if (items && items.length) return items;
    }
    return [];
  }

  /** Type into a typeahead control and click the row that exactly matches
   *  `text` (case-insensitive). Returns true if a match was clicked. */
  async function selectTypeaheadOption(control, text, opts = {}) {
    const items = await typeaheadSuggestions(control, text, opts);
    if (items.length === 0) {
      log(`selectTypeaheadOption: no suggestions appeared for "${text}", cannot select`);
      return false;
    }
    const exact = items.find((i) => normalizeText(i.text) === normalizeText(text));
    const target = exact || items[0];
    log(`selectTypeaheadOption: clicking`, describeElement(target.element));
    fireClick(target.element);
    return true;
  }

  return {
    normalizeText,
    waitFor,
    findElementsByText,
    getOwnText,
    findControlByLabelText,
    readOptionsFromControl,
    setNativeInputValue,
    simulateTyping,
    fireClick,
    typeaheadSuggestions,
    selectTypeaheadOption,
    queryAllDeep,
    describeElement,
    isVisible,
    nearbyTexts,
    sleep,
    leafText,
    log,
  };
})();
