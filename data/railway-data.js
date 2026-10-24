/**
 * data/railway-data.js
 *
 * Seed suggestions for the side-panel autocomplete. These are HINTS only:
 *  - You can always type any value; nothing is rejected for not being here.
 *  - The extension also LEARNS from the live site (station names it sees in
 *    the site's own dropdown, train names it sees on the results page) and
 *    stores them in chrome.storage.local, so lists grow as you use it.
 *
 * Classes: the codes (SHOVAN, S_CHAIR, ...) were read from the live site's
 * class <select>. Labels for SHOVAN / S_CHAIR / SNIGDHA / F_CHAIR were seen
 * on screen; the other four labels are inferred (display only - the CODE is
 * what gets selected on the site).
 *
 * Trains: named intercity trains from a public list (both direction numbers).
 * Selection on the site is by train NUMBER, so small spelling differences in
 * the name don't matter. Use "Sync from site" in the panel to replace these
 * guesses with the site's exact names.
 *
 * Stations: ~200 main stations from a public list. Spellings may differ from
 * the site's (e.g. the site says "Dhaka"). Use "Sync from site" to fetch the
 * exact station names; once synced, the panel shows only those.
 */
const RailwayData = {
  classes: [
    { code: "SHOVAN", label: "Shovan" },
    { code: "S_CHAIR", label: "Shovan Chair" },
    { code: "SNIGDHA", label: "Snigdha" },
    { code: "F_CHAIR", label: "First Class Chair" },
    { code: "F_SEAT", label: "First Class Seat" },
    { code: "F_BERTH", label: "First Class Berth" },
    { code: "AC_S", label: "AC Seat" },
    { code: "AC_B", label: "AC Berth" },
  ],
  trains: [
    "SUBARNA EXPRESS (701)", "SUBARNA EXPRESS (702)",
    "MAHANAGAR GODHULI / PRABHATI EXPRESS (703)", "MAHANAGAR PROVATI / GODHULI EXPRESS (704)",
    "EKOTA EXPRESS (705)", "EKOTA EXPRESS (706)",
    "TISTA EXPRESS (707)", "TISTA EXPRESS (708)",
    "PARABAT EXPRESS (709)", "PARABAT EXPRESS (710)",
    "UPAKUL EXPRESS (711)", "UPAKUL EXPRESS (712)",
    "KARATOYA EXPRESS (713)", "KARATOYA EXPRESS (714)",
    "KAPOTAKSHA EXPRESS (715)", "KAPOTAKSHA EXPRESS (716)",
    "JAYANTIKA EXPRESS (717)", "JAYANTIKA EXPRESS (718)",
    "PAHARIKA EXPRESS (719)", "PAHARIKA EXPRESS (720)",
    "MAHANAGAR EXPRESS (721)", "MAHANAGAR EXPRESS (722)",
    "UDAYAN EXPRESS (723)", "UDAYAN EXPRESS (724)",
    "SUNDARBAN EXPRESS (725)", "SUNDARBAN EXPRESS (726)",
    "RUPSHA EXPRESS (727)", "RUPSHA EXPRESS (728)",
    "MEGHNA EXPRESS (729)", "MEGHNA EXPRESS (730)",
    "BARENDRA EXPRESS (731)", "BARENDRA EXPRESS (732)",
    "TITUMIR EXPRESS (733)", "TITUMIR EXPRESS (734)",
    "AGNIBINA EXPRESS (735)", "AGNIBINA EXPRESS (736)",
    "EGAROSINDUR PROVATI (737)", "EGAROSINDUR PROVATI (738)",
    "UPABAN EXPRESS (739)", "UPABAN EXPRESS (740)",
    "TURNA EXPRESS (741)", "TURNA EXPRESS (742)",
    "BRAHMAPUTRA EXPRESS (743)", "BRAHMAPUTRA EXPRESS (744)",
    "JAMUNA EXPRESS (745)", "JAMUNA EXPRESS (746)",
    "SIMANTA EXPRESS (747)", "SIMANTA EXPRESS (748)",
    "EGAROSINDUR GODHULI (749)", "EGAROSINDUR GODHULI (750)",
    "LALMONI EXPRESS (751)", "LALMONI EXPRESS (752)",
    "SILKCITY EXPRESS (753)", "SILKCITY EXPRESS (754)",
    "MADHUMATI EXPRESS (755)", "MADHUMATI EXPRESS (756)",
    "DRUTOJAN EXPRESS (757)", "DRUTOJAN EXPRESS (758)",
    "PADMA EXPRESS (759)", "PADMA EXPRESS (760)",
    "SAGARDARI EXPRESS (761)", "SAGARDARI EXPRESS (762)",
    "CHITRA EXPRESS (763)", "CHITRA EXPRESS (764)",
    "NILSAGAR EXPRESS (765)", "NILSAGAR EXPRESS (766)",
    "DOLONCHAPA EXPRESS (767)", "DOLONCHAPA EXPRESS (768)",
    "DHUMKETU EXPRESS (769)", "DHUMKETU EXPRESS (770)",
    "RANGPUR EXPRESS (771)", "RANGPUR EXPRESS (772)",
    "KALNI EXPRESS (773)", "KALNI EXPRESS (774)",
    "SIRAJGANJ EXPRESS (775)", "SIRAJGANJ EXPRESS (776)",
    "HAOR EXPRESS (777)", "HAOR EXPRESS (778)",
    "DHALARCHAR EXPRESS (779)", "DHALARCHAR EXPRESS (780)",
    "KISHOREGANJ EXPRESS (781)", "KISHOREGANJ EXPRESS (782)",
    "TUNGIPARA EXPRESS (783)", "TUNGIPARA EXPRESS (784)",
    "BIJOY EXPRESS (785)", "BIJOY EXPRESS (786)",
    "SHONAR BANGLA EXPRESS (787)", "SHONAR BANGLA EXPRESS (788)",
    "MOHANGANJ EXPRESS (789)", "MOHANGANJ EXPRESS (790)",
    "BANALATA EXPRESS (791)", "BANALATA EXPRESS (792)",
    "PANCHAGARH EXPRESS (793)", "PANCHAGARH EXPRESS (794)",
    "BENAPOLE EXPRESS (795)", "BENAPOLE EXPRESS (796)",
    "KURIGRAM EXPRESS (797)", "KURIGRAM EXPRESS (798)",
    "JAMALPUR EXPRESS (799)", "JAMALPUR EXPRESS (800)",
    "CHATTALA EXPRESS (801)", "CHATTALA EXPRESS (802)",
    "BANGLABANDHA EXPRESS (803)", "BANGLABANDHA EXPRESS (804)",
    "SHAIKAT EXPRESS (821)", "PROBAL EXPRESS (822)",
    "PROBAL EXPRESS (823)", "SHAIKAT EXPRESS (824)",
  ],
  stations: [
    "Dhaka", "Airport", "Tongi", "Joydebpur", "Kaliakoir", "Mouchak",
    "Sripur", "Bhairab Bazar", "Ashuganj", "Akhaura", "Brahmanbaria", "Narsingdi",
    "Ghorashal", "Kishoreganj", "Bajitpur", "Mymensingh", "Gafargaon", "Ishwarganj",
    "Gouripur", "Netrokona", "Mohanganj", "Jamalpur", "Islampur", "Dewanganj Bazar",
    "Bahadurabad Ghat", "Sarishabari", "Tarakandi", "Sherpur", "Tangail", "Ibrahimabad",
    "Mirzapur", "Chattogram", "Chittagong University", "Faujdarhat", "Kumira", "Sitakunda",
    "Mirsharai", "Feni", "Cumilla", "Laksam", "Noakhali", "Maijdi Court",
    "Chandpur", "Lalmai", "Mainamati", "Nangalkot", "Gunabati", "Shahrasti",
    "Eidgaon", "Chakaria", "Dohazari", "Ramu", "Cox's Bazar", "Sylhet",
    "Kulaura", "Srimangal", "Shamshernagar", "Moulvibazar", "Shaestagonj", "Fenchuganj",
    "Chhatak Bazar", "Bhanugach", "Maizgaon", "Shahjibazar", "Longla", "Tilagaon",
    "Afzalabad", "Khulna", "Daulatpur", "Phultala", "Jashore", "Benapole",
    "Darshana", "Chuadanga", "Alamdanga", "Kushtia", "Kushtia Court", "Poradah",
    "Bheramara", "Mongla", "Noapara", "Satkhira", "Jhenaidah", "Magura",
    "Meherpur", "Mujibnagar", "Kaliganj", "Kotchandpur", "Gopalganj", "Faridpur",
    "Rajbari", "Goalanda Ghat", "Bhanga", "Madhukhali", "Kashiani", "Muksudpur",
    "Bhatiapara Ghat", "Pachuria", "Kalukhali", "Jagati", "Mirpur", "Rajshahi",
    "Rajshahi Court", "Ishwardi", "Ishwardi Bypass", "Abdulpur", "Natore", "Chapai Nawabganj",
    "Rohanpur", "Ahsanganj", "Santahar", "Bogura", "Gabtali", "Sonatala",
    "Sirajganj Bazar", "Sirajganj Ghat", "Ullapara", "Pabna", "Rooppur", "Shitlai",
    "Atrai", "Raninagar", "Joypurhat", "Hili", "Birampur", "Phulbari",
    "Biral", "Dinajpur", "Parbatipur", "Setabganj", "Panchagarh", "Thakurgaon Road",
    "Thakurgaon", "Rangpur", "Kaunia", "Saidpur", "Nilphamari", "Domar",
    "Chilahati", "Lalmonirhat", "Burimari", "Patgram", "Mogalhat", "Kurigram",
    "Chilmari", "Ulipur", "Rajarhat", "Bonarpara", "Gaibandha", "Pirgacha",
    "Dhalarchar", "Naldanga",
  ],
};
