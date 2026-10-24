/**
 * content/class-parser.js
 * Class on the home page. Confirmed: #choose_class is a real <select> whose
 * option text/value are the codes (AC_B, AC_S, SNIGDHA, F_BERTH, F_SEAT,
 * F_CHAIR, S_CHAIR, SHOVAN).
 */
const RailwayClassParser = (() => {
  function findSelect() {
    const byId = document.getElementById("choose_class");
    if (byId && byId.tagName === "SELECT") return byId;
    const el = RailwayDom.findControlByLabelText("class");
    return el && el.tagName === "SELECT" ? el : null;
  }

  async function selectClass(code) {
    const select = findSelect();
    if (!select || !code) return false;
    const want = RailwayDom.normalizeText(code);
    const option = Array.from(select.options).find(
      (o) => RailwayDom.normalizeText(o.value) === want || RailwayDom.normalizeText(o.textContent) === want
    );
    if (!option) return false;
    select.value = option.value;
    select.dispatchEvent(new Event("input", { bubbles: true }));
    select.dispatchEvent(new Event("change", { bubbles: true }));
    await RailwayDom.sleep(150);
    return select.value === option.value;
  }

  return { findSelect, selectClass };
})();
