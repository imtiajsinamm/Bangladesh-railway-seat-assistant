# Bangladesh Railway Seat Assistant

A Manifest V3 Chrome extension with a **side panel** for the official e-Ticket
site (`https://eticket.railway.gov.bd/`). It fills the journey, opens your
train and class, and selects seats — then **stops** so you press
CONTINUE PURCHASE and do passenger info, OTP and payment yourself.

## Install
1. `chrome://extensions` → enable **Developer mode** → **Load unpacked** → pick this folder.
2. Open the e-Ticket site and log in yourself.
3. Click the extension icon: the side panel opens (it stays open while the site navigates).
4. Fill From / To / Date / Class / Train / seats → **Select Seats**. **Stop** cancels a run.

## The real flow it follows (from a screen recording of the site)
1. **Home form** – From `#dest_from`, To `#dest_to` (typeahead), Date `#doj` (read-only calendar),
   Class `#choose_class` (a `<select>` with codes `SHOVAN, S_CHAIR, SNIGDHA, F_CHAIR, F_SEAT, F_BERTH, AC_S, AC_B`),
   then **Search Trains** (disabled until the form is valid – the extension waits for it).
2. **Results page** – train cards ("PANCHAGARH EXPRESS (793)") each with class tiles and **BOOK NOW**.
   The extension finds your train by its number, your class tile inside that card, and clicks its BOOK NOW.
3. **Seat map** – "Select Coach" dropdown, seats like `UMA-3` (Available = white/green border,
   Booked = orange, Selected = blue, In Progress = green), a **Seat Details** panel, CONTINUE PURCHASE.
   The extension selects seats, then reads **Seat Details** (the site's own record) to report what is chosen.

It detects which page you are on, so you can also start from the results page or with the seat map already open.

**Date note:** `#doj` is read-only with no form binding of its own - the site only learns the date when a day
is clicked in its popup calendar. The extension therefore opens the calendar (it opens on *focus*), moves to the
right month with the arrows, and clicks the real day cell. Greyed-out days (past, or beyond the booking window)
are refused with a clear message instead of being faked.

## Seat rules
- **Preferred seats**: enter exactly as many ids as Number of Seats, in order (e.g. 4 seats -> `KHA-32, SCHA-21,
  UMA-3, DA-17`) - enforced before a run starts. Each is matched exactly first. If one is taken, the nearest
  available seat **in the same direction** (ascending first, e.g. KA-4 taken -> tries KA-5, then KA-6, ...) replaces
  it, staying in the same coach and within the Seat Number Range if one is given. Never selects more than requested.
- **Random**: picks an **adjacent block** of seats - within the Seat Number Range if given, otherwise anywhere,
  preferring the current coach. If a full block isn't available, it takes the largest adjacent group it can, then
  fills the rest as close to that group as possible, in the same coach before spilling into another.
- Max 4 seats (the site's limit). Every click is re-verified against a **freshly re-read** seat map immediately
  before clicking (not a batch of elements grabbed earlier), since some seat maps re-render their whole list after
  each click - reusing older element references would otherwise silently fail. Booked seats are never clicked.
- **Each run starts by clearing any seats left selected from an earlier run**, in every coach, before picking new
  ones. Without this, repeated runs only add clicks on top of whatever was already selected on the page, so totals
  silently grow across runs and the report ends up mixing old leftovers with the new pick. The "Selected"/"skipped"
  report always reflects only what the current run itself did - never a raw read of whatever the page happens to show.

## Suggestion lists (stations & trains)
- **Built-in guesses:** `data/railway-data.js` has ~150 main stations and ~108 named intercity trains (both
  direction numbers) from a public list. Spellings can differ from the site's (the site says "Dhaka"), and trains
  are matched on the site by their **number**, so small name differences don't matter.
- **Sync from site (recommended, once):** in the side panel press **Sync stations** on the site's *home page*,
  and **Sync trains** on the site's *Train Information* page. It reads the site's own suggestion lists the way a
  person would (types a letter, reads the dropdown, moves on; two letters only where the list looks capped),
  throttled, capped at 320 lookups, cancellable with **Stop**, and it submits nothing. It also clears the box afterwards.
- **Learned names win:** once ≥50 stations / ≥30 trains have been learned, the panel shows only the site's exact
  names. New names are also picked up automatically whenever the extension sees them (results page, station dropdowns).
- Anything you type is always accepted.

## Not done, by design
Passenger info, OTP, CAPTCHA, payment, CONTINUE PURCHASE, waiting/refreshing/retrying for seats,
private APIs, or sending any data anywhere. Everything runs locally; only `chrome.storage.local`
holds your form values, learned names and last status.

## Known limits / troubleshooting
- Seat availability is read from the seat's colour/attributes and every click is verified afterwards;
  if the site restyles its seats, availability detection may need a tweak in `content/seat-selector.js`.
- If a step fails, open that page and press **Diagnose Page** (Troubleshooting section), copy the report
  and send it back — it lists exactly which elements were/weren't recognised.
- Console logs are prefixed `[RSA]` (set `DEBUG = false` in `utils/dom.js` to silence).

## Files
```
manifest.json            side panel, minimal permissions (storage, sidePanel, site-only host)
popup/                   side-panel UI (html/css/js)
data/railway-data.js     seed classes/trains/stations
content/station-parser.js   From/To typeahead      content/class-parser.js   class <select>
content/train-parser.js     results page cards     content/seat-selector.js  seat map + coaches
content/list-sync.js        one-click name sync
content/railway-adapter.js  flow + hard stop       content/diagnostics.js    troubleshooting report
content/content.js          messages, run lifecycle, resume after a full page reload
utils/                   dom helpers, validation, storage
```
