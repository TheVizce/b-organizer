/* Babe Organizer – läuft komplett im Browser, Daten liegen im localStorage. */
(() => {
  'use strict';

  // ---------- Schema (identisch zum Userscript) ----------
  const FIELDS = [
    'Name', 'AKA', 'Profile URL', 'Archive URL', 'Babe ID', 'Main Image URL',
    'Image 2 URL', 'Image 3 URL', 'Image 4 URL', 'User Upload Image URLs', 'Gallery Links', 'Scraped At',
    'Global Rating', 'Votes', 'User Rating', 'Rank', 'Highest Rank', 'Peakdays',
    'Born', 'Exact Birthdate', 'Died', 'Years active', 'Active', 'Active till', 'Birthplace',
    'Nationality', 'Ethnicity', 'Professions', 'Profession Category', 'Sexuality', 'Hair color',
    'Eye color', 'Height', 'Weight', 'Body type', 'Measurements', 'Bra/Cup',
    'Boobs', 'Tattoos', 'Piercings',
    'Website', 'Instagram', 'X / Twitter', 'TikTok', 'YouTube', 'Twitch',
    'IMDb', 'OnlyFans 1', 'OnlyFans 2', 'Fansly', 'Thronly', 'Boobpedia Link'
  ];
  // Eigene Felder (werden vom Import nie überschrieben, außer der Import bringt selbst Werte mit)
  const OWN_FIELDS = ['Favorite', 'In Ranker', 'My Rating', 'Tags', 'Notes', 'Own Images', 'Cover'];
  const NO_CSV = new Set(['Own Images', 'Cover']); // lokale Bilder gibt es nur im Browser
  const ALL_FIELDS = [...FIELDS, ...OWN_FIELDS];

  const GROUPS = [
    { title: 'Allgemein', fields: ['Name', 'AKA', 'Born', 'Exact Birthdate', 'Died', 'Birthplace', 'Nationality', 'Ethnicity', 'Professions', 'Profession Category', 'Sexuality', 'Years active', 'Active', 'Active till'] },
    { title: 'Aussehen', fields: ['Hair color', 'Eye color', 'Height', 'Weight', 'Body type', 'Measurements', 'Bra/Cup', 'Boobs', 'Tattoos', 'Piercings'] },
    { title: 'Eigene Angaben', fields: ['Favorite', 'In Ranker', 'My Rating', 'Tags', 'Notes'] },
    { title: 'Babepedia', fields: ['Profile URL', 'Archive URL', 'Babe ID', 'Global Rating', 'Votes', 'User Rating', 'Rank', 'Highest Rank', 'Peakdays', 'Scraped At'] },
    { title: 'Bilder', fields: ['Own Images', 'Main Image URL', 'Image 2 URL', 'Image 3 URL', 'Image 4 URL', 'User Upload Image URLs', 'Gallery Links'] },
    { title: 'Links', fields: ['Website', 'Instagram', 'X / Twitter', 'TikTok', 'YouTube', 'Twitch', 'IMDb', 'OnlyFans 1', 'OnlyFans 2', 'Fansly', 'Thronly', 'Boobpedia Link'] }
  ];
  const LINK_FIELDS = GROUPS[5].fields;

  const TYPES = {
    'Born': 'date', 'Died': 'date', 'Scraped At': 'date',
    'Exact Birthdate': 'bool', 'Active': 'bool', 'Favorite': 'bool', 'In Ranker': 'bool',
    'Tattoos': ['n/a', 'Ja', 'Nein'], 'Piercings': ['n/a', 'Ja', 'Nein'],
    'Boobs': ['', 'Real/Natural', 'Fake/Enhanced', 'Real (Removed implants)', 'Unknown'],
    'Height': 'num', 'Weight': 'num', 'Global Rating': 'num', 'Votes': 'num', 'User Rating': 'num',
    'Rank': 'num', 'Highest Rank': 'num', 'Peakdays': 'num', 'Years active': 'num', 'Active till': 'num',
    'My Rating': 'num',
    'User Upload Image URLs': 'area', 'Gallery Links': 'area', 'Notes': 'area'
  };
  const HINTS = {
    'Height': 'in cm', 'Weight': 'in kg', 'Measurements': 'Brust-Taille-Hüfte, z. B. 86-61-89', 'Bra/Cup': 'nur Cup, z. B. D',
    'Tags': 'kommagetrennt', 'My Rating': '1–10, Vergleich mit „User Rating“', 'User Rating': 'deine Bewertung auf Babepedia', 'Years active': 'Startjahr', 'Active till': 'Endjahr, falls inaktiv',
    'User Upload Image URLs': 'kommagetrennt', 'Gallery Links': 'kommagetrennt',
    'Exact Birthdate': 'aus = nur Jahr bekannt', 'In Ranker': 'wird beim Ranker-Abgleich automatisch gesetzt', 'Professions': 'kommagetrennt, wie auf Babepedia'
  };
  const IMAGE_FIELDS = ['Main Image URL', 'Image 2 URL', 'Image 3 URL', 'Image 4 URL', 'User Upload Image URLs'];
  const previewHTML = (val) => splitList(val).filter(u => /^https?:\/\//i.test(u))
    .map(u => `<img src="${esc(u)}" alt="" loading="lazy" referrerpolicy="no-referrer" data-full="${esc(u)}" data-fallback="✕">`).join('');
  const UNITS = { 'Height': ' cm', 'Weight': ' kg', 'Measurements': ' cm' };

  // Alle Nationality-Werte von Babepedia (Advanced Search) + übliche Schreibvarianten -> Ländercode
  const NATIONALITY_CODES = {
      'afghan': 'AF', 'albanian': 'AL', 'algerian': 'DZ', 'american': 'US', 'american samoan': 'AS',
      'andorran': 'AD', 'angolan': 'AO', 'anguillian': 'AI', 'antarctic': 'AQ', 'antiguan': 'AG', 'argentine': 'AR',
      'argentinian': 'AR', 'armenian': 'AM', 'aruban': 'AW', 'australian': 'AU', 'austrian': 'AT',
      'azerbaijani': 'AZ', 'azeri': 'AZ', 'bahamian': 'BS', 'bahraini': 'BH', 'bajan': 'BB', 'bangladeshi': 'BD',
      'barbadian': 'BB', 'belarusian': 'BY', 'belgian': 'BE', 'belizean': 'BZ', 'beninese': 'BJ', 'bermudian': 'BM',
      'bhutanese': 'BT', 'bolivian': 'BO', 'bosnian': 'BA', 'botswanan': 'BW', 'bouvet islander': 'BV',
      'brazilian': 'BR', 'british': 'GB', 'british virgin islander': 'VG', 'bruneian': 'BN', 'bulgarian': 'BG',
      'burkinabe': 'BF', 'burmese': 'MM', 'burundian': 'BI', 'cambodian': 'KH', 'cameroonian': 'CM',
      'canadian': 'CA', 'cape verdean': 'CV', 'caymanian': 'KY', 'central african': 'CF', 'chadian': 'TD',
      'chilean': 'CL', 'chinese': 'CN', 'christmas islander': 'CX', 'cocos islander': 'CC', 'colombian': 'CO',
      'comorian': 'KM', 'congolese': 'CD', 'cook islander': 'CK', 'costa rican': 'CR', 'croatian': 'HR',
      'cuban': 'CU', 'curacaoan': 'CW', 'cypriot': 'CY', 'czech': 'CZ', 'czechoslovak': 'CZ', 'danish': 'DK',
      'djiboutian': 'DJ', 'dominican': 'DO', 'dominican dominica': 'DM', 'dutch': 'NL', 'dutch antillean': 'CW',
      'east timorese': 'TL', 'ecuadorian': 'EC', 'egyptian': 'EG', 'emirati': 'AE', 'english': 'GB-ENG',
      'equatorial guinean': 'GQ', 'eritrean': 'ER', 'estonian': 'EE', 'ethiopian': 'ET', 'falkland islander': 'FK',
      'faroese': 'FO', 'fijian': 'FJ', 'filipina': 'PH', 'filipino': 'PH', 'finnish': 'FI', 'french': 'FR',
      'french guianese': 'GF', 'french polynesian': 'PF', 'gabonese': 'GA', 'gambian': 'GM', 'georgian': 'GE',
      'german': 'DE', 'ghanaian': 'GH', 'gibraltarian': 'GI', 'greek': 'GR', 'greenlandic': 'GL', 'grenadian': 'GD',
      'guadeloupean': 'GP', 'guamanian': 'GU', 'guatemalan': 'GT', 'guernsey': 'GG', 'guinea-bissauan': 'GW',
      'guinean': 'GN', 'guyanese': 'GY', 'haitian': 'HT', 'heard islander': 'HM', 'honduran': 'HN',
      'hong konger': 'HK', 'hongkonger': 'HK', 'hungarian': 'HU', 'i-kiribati': 'KI', 'icelandic': 'IS',
      'indian': 'IN', 'indonesian': 'ID', 'iranian': 'IR', 'iraqi': 'IQ', 'irish': 'IE', 'israeli': 'IL',
      'italian': 'IT', 'ivorian': 'CI', 'ivory coast': 'CI', 'jamaican': 'JM', 'japanese': 'JP', 'jersey': 'JE',
      'jordanian': 'JO', 'kazakh': 'KZ', 'kazakhstani': 'KZ', 'kenyan': 'KE', 'kittitian': 'KN', 'kiwi': 'NZ',
      'korean': 'KR', 'kosovar': 'XK', 'kuwaiti': 'KW', 'kyrgyz': 'KG', 'kyrgyzstani': 'KG', 'lao': 'LA',
      'laotian': 'LA', 'latvian': 'LV', 'lebanese': 'LB', 'liberian': 'LR', 'libyan': 'LY', 'liechtensteiner': 'LI',
      'lithuanian': 'LT', 'luxembourger': 'LU', 'luxembourgish': 'LU', 'macanese': 'MO', 'macedonian': 'MK',
      'mahoran': 'YT', 'malagasy': 'MG', 'malawian': 'MW', 'malaysian': 'MY', 'maldivian': 'MV', 'malian': 'ML',
      'maltese': 'MT', 'manx': 'IM', 'marshallese': 'MH', 'martiniquais': 'MQ', 'mauritanian': 'MR',
      'mauritian': 'MU', 'mexican': 'MX', 'micronesian': 'FM', 'moldovan': 'MD', 'monacan': 'MC',
      'monegasque': 'MC', 'mongolian': 'MN', 'montenegrin': 'ME', 'montserratian': 'MS', 'moroccan': 'MA',
      'mosotho': 'LS', 'motswana': 'BW', 'mozambican': 'MZ', 'namibian': 'NA', 'nauruan': 'NR', 'nepalese': 'NP',
      'nepali': 'NP', 'new caledonian': 'NC', 'new zealand': 'NZ', 'new zealander': 'NZ', 'ni-vanuatu': 'VU',
      'nicaraguan': 'NI', 'nigerian': 'NG', 'nigerien': 'NE', 'niuean': 'NU', 'norfolk islander': 'NF',
      'north korean': 'KP', 'north macedonian': 'MK', 'northern irish': 'GB', 'northern mariana islander': 'MP',
      'norwegian': 'NO', 'omani': 'OM', 'pakistani': 'PK', 'palauan': 'PW', 'palestinian': 'PS', 'panamanian': 'PA',
      'papua new guinean': 'PG', 'paraguayan': 'PY', 'persian': 'IR', 'peruvian': 'PE', 'pitcairn islander': 'PN',
      'polish': 'PL', 'portuguese': 'PT', 'puerto rican': 'PR', 'qatari': 'QA', 'reunionese': 'RE',
      'romanian': 'RO', 'russian': 'RU', 'rwandan': 'RW', 'sahrawi': 'EH', 'saint helenian': 'SH',
      'saint lucian': 'LC', 'saint vincentian': 'VC', 'saint-pierrais': 'PM', 'salvadoran': 'SV',
      'salvadorian': 'SV', 'sammarinese': 'SM', 'samoan': 'WS', 'sao tomean': 'ST', 'saudi': 'SA',
      'saudi arabian': 'SA', 'scottish': 'GB-SCT', 'senegalese': 'SN', 'serbian': 'RS', 'seychellois': 'SC',
      'sierra leonean': 'SL', 'singaporean': 'SG', 'slovak': 'SK', 'slovakian': 'SK', 'slovene': 'SI',
      'slovenian': 'SI', 'solomon islander': 'SB', 'somali': 'SO', 'south african': 'ZA', 'south georgian': 'GS',
      'south korean': 'KR', 'south sudanese': 'SS', 'soviet': 'RU', 'spanish': 'ES', 'sri lankan': 'LK',
      'sudanese': 'SD', 'surinamese': 'SR', 'svalbard': 'SJ', 'swazi': 'SZ', 'swedish': 'SE', 'swiss': 'CH',
      'syrian': 'SY', 'taiwanese': 'TW', 'tajik': 'TJ', 'tajikistani': 'TJ', 'tanzanian': 'TZ', 'thai': 'TH',
      'tobagonian': 'TT', 'togolese': 'TG', 'tokelauan': 'TK', 'tongan': 'TO', 'trinidadian': 'TT',
      'tunisian': 'TN', 'turkish': 'TR', 'turkmen': 'TM', 'turks and caicos islander': 'TC', 'tuvaluan': 'TV',
      'u.s. virgin islander': 'VI', 'ugandan': 'UG', 'ukrainian': 'UA', 'uruguayan': 'UY', 'uzbek': 'UZ',
      'uzbekistani': 'UZ', 'vatican': 'VA', 'venezuelan': 'VE', 'vietnamese': 'VN', 'wallisian': 'WF',
      'welsh': 'GB-WLS', 'yemeni': 'YE', 'yugoslav': 'RS', 'zambian': 'ZM', 'zimbabwean': 'ZW'
  };

  function flagFor(name) {
      const code = NATIONALITY_CODES[String(name || '').toLowerCase().trim()];
      if (!code) return '';
      if (code.startsWith('GB-')) {
          const sub = { 'GB-ENG': 'eng', 'GB-SCT': 'sct', 'GB-WLS': 'wls' }[code];
          return '\u{1F3F4}' + [...('gb' + sub)].map(c => String.fromCodePoint(0xE0000 + c.charCodeAt(0))).join('') + '\u{E007F}';
      }
      return [...code].map(c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)).join('');
  }

  // Nationalität: Flaggen/Klammern entfernen und in einzelne Namen zerlegen
  const natNames = (e) => String(e.Nationality || '')
    .split(/[,/&]+|\s+and\s+/i)
    .map(x => x.replace(/[()]/g, '').replace(/^[^A-Za-zÀ-ž]+/, '').trim())
    .filter(Boolean);
  const withFlag = (n) => { const f = flagFor(n); return f ? `${f} ${n}` : n; };
  const natDisplay = (e) => natNames(e).map(withFlag).join(', ');

  // ---- Profession Category: fasst die Professions zu Bereichen zusammen ----
  // Reihenfolge = Sortierung der Bereiche. Eine Person kann in mehreren Bereichen landen.
  const PROFESSION_CATEGORIES = [
      ['Modeling', ['Adult Model', 'Beauty pageant contestant', 'Centerfold', 'Fetish Model', 'Fitness Model', 'Glamour Model', 'Gravure Idol', 'Model', 'Playboy Model', 'Plus Size Model', 'Race Queen', 'Ring Girl', 'Supermodel']],
      ['Acting & Performing', ['Actress', 'Ballet Dancer', 'Burlesque Dancer', 'Comedian', 'Cultural / Specialty Dancer', 'Music Video / Commercial Dancer', 'Showgirl', 'Stuntwoman', 'Voice Actress']],
      ['Digital Content', ['ASMR Star', 'Blogger', 'Camgirl', 'Content Creator (Non-Adult)', 'Cosplayer', 'Digital Creator', 'Gamer', 'Influencer', 'Podcaster', 'TikTok Star', 'YouTuber']],
      ['Adult Industry', ['AV Idol', 'Dominatrix', 'Escort', 'Exotic Dancer', 'Hotwife', 'MILF Porn Star', 'Porn Star', 'Stripper']],
      ['TV & Media', ['Celebrity', 'Director', 'Journalist', 'Presenter', 'Producer', 'Radio Host', 'Reality TV Star', 'Sports reporter', 'TV Host', 'Weather Girl']],
      ['Music', ['Musician', 'Musician: Country Singer', 'Musician: DJ', 'Musician: J-pop Idol', 'Musician: K-pop Idol', 'Musician: Rapper', 'Musician: Singer']],
      ['Athletics & Sports', ['Bodybuilder', 'Cheerleader', 'Fitness Trainer', 'Golf Instructor', 'Horseriding Instructor', 'Sportswoman']],
      ['Science / Health / Education', ['Cybersecurity expert', 'Dentist', 'Doctor - Physician', 'Nurse', 'Professor', 'Programmer', 'Science Communicator', 'Sex Therapist', 'Teacher']],
      ['Business / Law / Politics', ['Activist', 'Barrister', 'Business Woman', 'Lawyer', 'Military Personnel', 'Political Commentator', 'Politician', 'Realtor', 'Royalty']],
      ['Creative & Design', ['Artist', 'Author', 'Fashion Designer', 'Graphic Designer', 'Photographer', 'Writer']],
      ['Service & Hospitality', ['Barista', 'Bartender', 'Beautician', 'Flight Attendant', 'Hooters Girl', 'Nail Designer']],
      ['Sonstige', ['Housewife', 'Paranormal Investigator', 'Student', 'Trucker']]
  ];
  // Für Werte, die (noch) nicht in der Liste stehen: Regeln nach Wortbestandteilen
  const PROFESSION_RULES = [
      [/sportswoman|athlete|player|boxer|fighter|skater|racer|gymnast|swimmer|surfer|skier|wrestler|cyclist|runner/i, 'Athletics & Sports'],
      [/musician|singer|rapper|\bdj\b|pop idol|band/i, 'Music'],
      [/scientist|engineer|doctor|physician|biologist|researcher/i, 'Science / Health / Education'],
      [/porn|adult (film|actress)|onlyfans/i, 'Adult Industry'],
      [/model/i, 'Modeling'],
      [/dancer|actress|performer/i, 'Acting & Performing'],
      [/host|reporter|presenter|anchor/i, 'TV & Media'],
      [/creator|streamer|youtuber|instagram|tiktok/i, 'Digital Content'],
      [/designer|artist|painter/i, 'Creative & Design']
  ];
  const PROFESSION_INDEX = new Map();
  PROFESSION_CATEGORIES.forEach(([cat, list]) => list.forEach(p => PROFESSION_INDEX.set(normProfession(p), cat)));

  function normProfession(p) {
      return String(p || '').toLowerCase().replace(/\(former\)/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  }
  function professionCategory(p) {
      const n = normProfession(p);
      if (!n) return '';
      if (PROFESSION_INDEX.has(n)) return PROFESSION_INDEX.get(n);
      if (/^sportswoman/.test(n)) return 'Athletics & Sports';
      if (/^musician/.test(n)) return 'Music';
      if (/^scientist/.test(n)) return 'Science / Health / Education';
      for (const [re, cat] of PROFESSION_RULES) if (re.test(p)) return cat;
      return 'Sonstige';
  }
  // "Actress, Model, Sportswoman: Surfer" -> "Modeling, Acting & Performing, Athletics & Sports"
  function professionCategories(professions) {
      const parts = String(professions || '').split(/,(?![^(]*\))/).map(s => s.trim()).filter(Boolean);
      const cats = new Set(parts.map(professionCategory).filter(Boolean));
      const order = PROFESSION_CATEGORIES.map(c => c[0]);
      return [...cats].sort((a, b) => order.indexOf(a) - order.indexOf(b)).join(', ');
  }

  const catList = (e) => String(e['Profession Category'] || '').split(',').map(x => x.trim()).filter(Boolean);
  // ---- Measurements: werden immer in cm gespeichert (Format Brust-Taille-Hüfte) ----
  const INCH = 2.54;
  function parseMeas(str) {
    const m = String(str || '').replace(',', '.').match(/(\d+(?:\.\d+)?)\s*[-–—\/x]\s*(\d+(?:\.\d+)?)\s*[-–—\/x]\s*(\d+(?:\.\d+)?)/i);
    return m ? [m[1], m[2], m[3]].map(Number) : null;
  }
  // Wandelt eine Eingabe in "xx-xx-xx" (cm, gerundet) um; unit = 'cm' | 'in'
  function measToCm(str, unit) {
    const p = parseMeas(str);
    if (!p) return String(str || '').trim();
    const f = unit === 'in' ? INCH : 1;
    return p.map(x => Math.round(x * f)).join('-');
  }
  const measInches = (cmStr) => { const p = parseMeas(cmStr); return p ? p.map(x => Math.round(x / INCH)).join('-') : ''; };
  // Alte Werte in Inch erkennen: eine Brustweite unter 60 gibt es in cm praktisch nicht
  const looksLikeInches = (str) => { const p = parseMeas(str); return !!p && p[0] < 60 && p[2] < 70; };

  // Abgeleitete Felder immer aus den Rohdaten neu berechnen
  function derive(e) {
    if (!e._id) e._id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    e['Profession Category'] = professionCategories(e.Professions);
    if (looksLikeInches(e.Measurements)) e.Measurements = measToCm(e.Measurements, 'in');
    return e;
  }

  // Bewertungsvergleich: My Rating (Tool) vs. User Rating (Babepedia)
  function ratingDiff(e) {
    const mine = num(e['My Rating']), site = num(e['User Rating']);
    if (mine === null && site === null) return { state: 'none' };
    if (mine === null) return { state: 'site-only', site };
    if (site === null) return { state: 'mine-only', mine };
    const d = Math.round((mine - site) * 10) / 10;
    return { state: d === 0 ? 'same' : 'diff', mine, site, d };
  }
  const fmtDiff = (d) => (d > 0 ? '+' : '') + String(d).replace('.', ',');

  const STORE_KEY = 'bp-organizer-v1';
  const UI_KEY = 'bp-organizer-ui';

  // ---------- Zustand ----------
  // Daten liegen in IndexedDB (viel mehr Platz als localStorage, das sich alle *.github.io-Seiten
  // eines Kontos teilen). Der localStorage wird nur noch für kleine UI-Einstellungen genutzt.
  let entries = [];
  let ready = false;
  let SYNC = null;   // GitHub-Sync, siehe initSync()
  const ui = Object.assign({ view: 'grid', sort: 'name' }, safeJSON(localStorage.getItem(UI_KEY), {}));

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  function safeJSON(s, fallback) { try { return s ? JSON.parse(s) : fallback; } catch { return fallback; } }
  // ---------- IndexedDB ----------
  const DB_NAME = 'bp-organizer', DB_STORE = 'kv';
  let dbPromise = null;
  function db() {
    if (!dbPromise) dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(DB_STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }
  async function idbGet(key) {
    const d = await db();
    return new Promise((resolve, reject) => {
      const r = d.transaction(DB_STORE, 'readonly').objectStore(DB_STORE).get(key);
      r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
    });
  }
  async function idbSet(key, value) {
    const d = await db();
    return new Promise((resolve, reject) => {
      const tx = d.transaction(DB_STORE, 'readwrite');
      tx.objectStore(DB_STORE).put(value, key);
      tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error || new Error('Speichern abgebrochen'));
    });
  }

  async function idbDel(key) {
    const d = await db();
    return new Promise((resolve, reject) => {
      const tx = d.transaction(DB_STORE, 'readwrite');
      tx.objectStore(DB_STORE).delete(key);
      tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
    });
  }

  // ---------- Eigene Bilder (lokal in IndexedDB, Schlüssel "img:<id>", Verweis im Eintrag "local:<id>") ----------
  const localUrls = new Map(); // id -> Object-URL
  const LOCAL = 'local:';
  const isLocal = (u) => String(u || '').startsWith(LOCAL);
  const localId = (u) => String(u).slice(LOCAL.length);
  // Liefert eine anzeigbare Adresse ('' wenn ein lokales Bild fehlt)
  const R = (u) => isLocal(u) ? (localUrls.get(localId(u)) || '') : u;

  async function loadLocalImages() {
    const d = await db();
    const range = IDBKeyRange.bound('img:', 'img:\uffff');
    const [keys, vals] = await Promise.all(['getAllKeys', 'getAll'].map(m => new Promise((res, rej) => {
      const r = d.transaction(DB_STORE, 'readonly').objectStore(DB_STORE)[m](range);
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    })));
    keys.forEach((k, i) => {
      const id = String(k).slice(4);
      if (!localUrls.has(id) && vals[i] instanceof Blob) localUrls.set(id, URL.createObjectURL(vals[i]));
    });
  }
  // Verkleinert ein Bild auf max. 1600 px und speichert es als JPEG
  async function processImage(file) {
    let bmp;
    try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
    catch { throw new Error(`„${file.name}“: Bildformat wird nicht unterstützt`); }
    const sc = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('Umwandlung fehlgeschlagen')), 'image/jpeg', 0.85));
  }
  async function storeLocalImage(file) {
    const blob = await processImage(file);
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    await idbSet('img:' + id, blob);
    localUrls.set(id, URL.createObjectURL(blob));
    return LOCAL + id;
  }
  async function deleteLocalImages(refs) {
    for (const r of refs) {
      if (!isLocal(r)) continue;
      const id = localId(r);
      try { await idbDel('img:' + id); } catch {}
      const u = localUrls.get(id); if (u) URL.revokeObjectURL(u);
      localUrls.delete(id);
    }
  }
  const blobToDataUrl = (b) => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => rej(fr.error); fr.readAsDataURL(b); });

  async function load() {
    let d = await idbGet('entries');
    if (!Array.isArray(d)) {
      // Umzug aus dem alten localStorage (Version bis 13.6)
      const old = safeJSON(localStorage.getItem(STORE_KEY), null);
      d = Array.isArray(old) ? old : [];
      if (d.length) {
        await idbSet('entries', d);
        toast(`${d.length} Einträge in den neuen Speicher übernommen.`, 'ok');
      }
    }
    // Alten localStorage-Eintrag entfernen -> Platz für die anderen GitHub-Pages-Tools
    if (localStorage.getItem(STORE_KEY) !== null && Array.isArray(await idbGet('entries'))) {
      try { localStorage.removeItem(STORE_KEY); } catch {}
    }
    return d.map(derive);
  }

  const channel = 'BroadcastChannel' in window ? new BroadcastChannel('bp-organizer') : null;
  // Speichert; wirft bei Fehler, damit z. B. die Übernahme vom Userscript nicht bestätigt wird
  async function save() {
    try {
      await idbSet('entries', entries);
      if (channel) channel.postMessage('changed');
      if (SYNC) SYNC.changed();
    } catch (e) {
      toast('Speichern fehlgeschlagen: ' + (e && e.message || e) + ' – bitte Backup exportieren!', 'err');
      throw e;
    }
  }
  // Für Klick-Aktionen: bündelt schnelle Änderungen zu einem Schreibvorgang; Fehler wird per Toast gemeldet
  let saveTimer = null, savePending = null;
  function saveQuiet() {
    clearTimeout(saveTimer);
    if (!savePending) savePending = new Promise(res => { saveQuiet._res = res; });
    saveTimer = setTimeout(() => { const r = saveQuiet._res; savePending = null; save().catch(() => {}).finally(r); }, 250);
    return savePending;
  }
  // Ausstehendes Speichern sofort ausführen, bevor die Seite verlassen wird
  addEventListener('pagehide', () => { if (savePending) { clearTimeout(saveTimer); save().catch(() => {}); } });
  document.addEventListener('visibilitychange', () => { if (document.hidden && savePending) { clearTimeout(saveTimer); const r = saveQuiet._res; savePending = null; save().catch(() => {}).finally(r); } });
  function saveUI() { try { localStorage.setItem(UI_KEY, JSON.stringify(ui)); } catch {} }

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const v = (e, f) => (e[f] ?? '').toString().trim();
  const isTrue = (x) => String(x).toLowerCase() === 'true';
  const num = (x) => { const n = parseFloat(String(x).replace(',', '.')); return isNaN(n) ? null : n; };
  const splitList = (s) => String(s || '').split(/[,\n]+/).map(t => t.trim()).filter(Boolean);

  // Datum: gespeichert als TTMMJJJJ (wie im Userscript)
  function ddToIso(s) { s = String(s || ''); return /^\d{8}$/.test(s) ? `${s.slice(4)}-${s.slice(2, 4)}-${s.slice(0, 2)}` : ''; }
  function isoToDd(s) { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? m[3] + m[2] + m[1] : ''; }
  function fmtDate(s, exact = true) {
    s = String(s || '');
    if (!/^\d{8}$/.test(s)) return s;
    return exact ? `${s.slice(0, 2)}.${s.slice(2, 4)}.${s.slice(4)}` : s.slice(4);
  }
  function age(e) {
    const iso = ddToIso(v(e, 'Born'));
    if (!iso) return null;
    const b = new Date(iso);
    const end = ddToIso(v(e, 'Died')) ? new Date(ddToIso(v(e, 'Died'))) : new Date();
    let a = end.getFullYear() - b.getFullYear();
    if (isTrue(e['Exact Birthdate'])) {
      const m = end.getMonth() - b.getMonth();
      if (m < 0 || (m === 0 && end.getDate() < b.getDate())) a--;
    }
    return a;
  }
  // Babepedia-Platzhalter (kein echtes Foto) erkennen: Babepedia-Bilder liegen sonst unter /pics/ bzw. /user-uploads/
  function isPlaceholder(u) {
    u = String(u || '').trim();
    if (isLocal(u)) return !R(u);
    if (!/^https?:\/\//i.test(u)) return true;
    if (/no[_-]?(pic|image|photo)|placeholder|silhouette|default[_-]?(pic|image)/i.test(u)) return true;
    if (/babepedia\.com/i.test(u) && !/\/(pics|user-uploads|user-uploads-thumbs|galleries|galleries-thumbs)\//i.test(u)) return true;
    return false;
  }
  // Reihenfolge: Hauptbild, Bild 2–4, dann User Uploads. Das erste ladbare Bild wird zum Cover.
  function images(e) {
    const list = ['Main Image URL', 'Image 2 URL', 'Image 3 URL', 'Image 4 URL'].map(f => v(e, f)).filter(Boolean);
    splitList(e['User Upload Image URLs']).forEach(u => list.push(u));
    splitList(e['Own Images']).forEach(u => list.push(u));
    const cover = v(e, 'Cover');
    if (cover && list.includes(cover)) list.unshift(cover);
    return [...new Set(list)].filter(u => !isPlaceholder(u));
  }
  const initials = (n) => (n || '?').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  // Babepedia liefert zu jedem Bild ein kleines Vorschaubild – für Karten, Tabelle und Raster reicht das
  function thumbUrl(u) {
    if (!/babepedia\.com/i.test(u)) return u;
    if (/\/pics\//i.test(u) && !/_thumb\d*\.(jpe?g)$/i.test(u)) return u.replace(/\.(jpe?g)$/i, '_thumb3.$1');
    if (/\/user-uploads\//i.test(u)) return u.replace('/user-uploads/', '/user-uploads-thumbs/').replace(/\.(jpe?g)$/i, '_thumb.$1');
    return u;
  }
  // Cover: nimmt das erste Bild (als Vorschaubild); lädt es nicht (oder ist es winzig),
  // wird erst das große Bild und dann das nächste probiert
  function coverTries(e) {
    const tries = [];
    images(e).slice(0, 6).forEach(u => { const full = R(u); if (!full) return; const th = thumbUrl(full); tries.push(th); if (th !== full) tries.push(full); });
    return tries;
  }
  const coverTag = (e, cls = '') => {
    const tries = coverTries(e);
    const alt = v(e, 'Name');
    if (!tries.length) return `<div class="placeholder">${esc(initials(alt))}</div>`;
    return `<img src="${esc(tries[0])}" alt="${esc(alt)}" class="${cls}" loading="lazy" decoding="async" referrerpolicy="no-referrer" data-eid="${esc(e._id)}" data-fallback="${esc(initials(alt))}" data-alts="${esc(tries.slice(1).join('\n'))}">`;
  };

  // ---------- Bildprüfung: lädt bei einem Eintrag überhaupt ein Bild? ----------
  // Ergebnis bleibt lokal in der eigenen IndexedDB (Schlüssel 'imgcheck'); ändern sich die Bilder, wird neu geprüft.
  const imgCheck = new Map(); // _id -> { s: 'ok' | 'none', sig, at }
  const hashStr = (str) => { let h = 0; for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0; return h.toString(36); };
  const imgSig = (e) => hashStr(coverTries(e).join('|'));
  function imgState(e) {
    if (!coverTries(e).length) return 'none';
    const c = imgCheck.get(e._id);
    return c && c.sig === imgSig(e) ? c.s : 'unknown';
  }
  let imgSaveTimer = null;
  function saveImgCheck(now) {
    clearTimeout(imgSaveTimer);
    const run = () => idbSet('imgcheck', Object.fromEntries(imgCheck)).catch(() => {});
    if (now) return run();
    imgSaveTimer = setTimeout(run, 2000);
  }
  function recordImg(id, s) {
    const e = entries.find(x => x._id === id); if (!e) return;
    const prev = imgCheck.get(id), sig = imgSig(e);
    if (prev && prev.s === s && prev.sig === sig) return;
    imgCheck.set(id, { s, sig, at: Date.now() });
    saveImgCheck();
  }
  async function loadImgCheck() {
    const d = await idbGet('imgcheck').catch(() => null);
    if (d && typeof d === 'object') for (const [k, x] of Object.entries(d)) imgCheck.set(k, x);
  }
  const imgTag = (src, alt, cls = '') => src
    ? `<img src="${esc(src)}" alt="${esc(alt)}" class="${cls}" loading="lazy" referrerpolicy="no-referrer" data-fallback="${esc(initials(alt))}">`
    : `<div class="placeholder">${esc(initials(alt))}</div>`;

  // Kaputte Bilder: nächstes Ersatzbild probieren, sonst Initialen
  function nextAlt(img) {
    const alts = (img.dataset.alts || '').split('\n').filter(Boolean);
    if (!alts.length) return false;
    img.dataset.alts = alts.slice(1).join('\n');
    img.src = alts[0];
    return true;
  }
  // Sehr kleine Bilder (Platzhalter-Grafiken) wie Fehler behandeln
  document.addEventListener('load', (ev) => {
    const img = ev.target;
    if (img.tagName === 'IMG' && img.dataset.alts !== undefined && img.naturalWidth > 0 && img.naturalWidth < 40) {
      if (!nextAlt(img)) img.dispatchEvent(new Event('error'));
      return;
    }
    if (img.tagName === 'IMG' && img.dataset.eid && img.naturalWidth >= 40) recordImg(img.dataset.eid, 'ok');
  }, true);
  document.addEventListener('error', (ev) => {
    const img = ev.target;
    if (img.tagName === 'IMG' && nextAlt(img)) return;
    if (img.tagName === 'IMG' && img.dataset.eid && !img.dataset.failed) recordImg(img.dataset.eid, 'none');
    if (img.tagName === 'IMG' && img.dataset.fallback !== undefined && !img.dataset.failed) {
      img.dataset.failed = '1';
      const ph = document.createElement('div');
      ph.className = 'placeholder';
      ph.textContent = img.dataset.fallback;
      img.replaceWith(ph);
    }
  }, true);

  // ---------- Import / Zusammenführen ----------
  const normUrl = (u) => { try { u = decodeURIComponent(String(u || '')); } catch {} return u.toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/[?#].*$/, '').replace(/\/$/, '').replace(/[\s_]+/g, '_'); };

  // Setzt "In Ranker" für alle Einträge anhand der kompletten Ranker-Liste von Babepedia
  async function applyRanker(urls) {
    const set = new Set(urls.map(normUrl));
    const matched = new Set();
    let on = 0, changed = 0;
    const now = Date.now();
    for (const e of entries) {
      const k = normUrl(e['Profile URL']);
      const inR = !!k && set.has(k);
      if (inR) { on++; matched.add(k); }
      const val = inR ? 'true' : 'false';
      if (e['In Ranker'] !== val) { e['In Ranker'] = val; e._updated = now; changed++; }
    }
    const missing = urls.filter(u => !matched.has(normUrl(u)));
    refreshFilters(); render();
    await save();
    return { on, changed, missing };
  }

  function keyOf(e) {
    const url = v(e, 'Profile URL').toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/[?#].*$/, '').replace(/\/$/, '');
    return url ? 'url:' + url : 'name:' + v(e, 'Name').toLowerCase();
  }
  // ---- Umbenannte Babepedia-Profile erkennen ----
  // Babepedia vergibt eine feste Babe ID; beim Umbenennen ändert sich nur die URL, der alte Name landet im AKA.
  const plain = (x) => String(x || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  const slugOf = (u) => { const m = normUrl(u).match(/\/babe\/([^/]+)/); return m ? plain(m[1]) : ''; };
  // Grundform einer Profiladresse: Klammerzusatz weg ("Ariadna_Majewska_(Ari_Maj)" -> "ariadnamajewska")
  const baseSlugOf = (u) => { const m = normUrl(u).match(/\/babe\/([^/]+)/); return m ? plain(m[1].replace(/\([^)]*\)/g, '')) : ''; };
  // Tippfehler-Abstand (Vertauschen zweier Buchstaben zählt als 1): "bhattaria" ~ "bhattarai"
  function typoDist(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let p2 = null, p1 = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i]; let best = i;
      for (let j = 1; j <= b.length; j++) {
        let d = Math.min(p1[j] + 1, cur[j - 1] + 1, p1[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (p2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d = Math.min(d, p2[j - 2] + 1);
        cur.push(d); if (d < best) best = d;
      }
      if (best > max) return max + 1;
      p2 = p1; p1 = cur;
    }
    return p1[b.length];
  }
  const typoMax = (n) => n >= 10 ? 2 : n >= 6 ? 1 : 0;
  function buildRenameIndex() {
    const bySlug = new Map(), byBabeId = new Map(), byPrefix = new Map();
    const add = (k, e) => { if (k) { const l = bySlug.get(k) || bySlug.set(k, []).get(k); if (!l.includes(e)) l.push(e); } };
    for (const e of entries) {
      add(slugOf(e['Profile URL']), e);
      add(baseSlugOf(e['Profile URL']), e);
      const b = baseSlugOf(e['Profile URL']);
      if (b.length >= 6) { const k = b.slice(0, 3); (byPrefix.get(k) || byPrefix.set(k, []).get(k)).push([b, e]); }
      const id = v(e, 'Babe ID'); if (id) (byBabeId.get(id) || byBabeId.set(id, []).get(id)).push(e);
    }
    return { bySlug, byBabeId, byPrefix };
  }
  function renameCandidates(item, exclude, ix) {
    const id = v(item, 'Babe ID');
    const ownUrl = normUrl(item['Profile URL']);
    const found = new Set(id ? (ix.byBabeId.get(id) || []) : []);
    // alter Name kann im AKA stehen oder sich nur in der Schreibweise unterscheiden (Buttercupcosplays -> Buttercup_Cosplays)
    const names = new Set([slugOf(item['Profile URL']), baseSlugOf(item['Profile URL']), v(item, 'Name'), ...String(item.AKA || '').split(/\s+-\s+|,/)].map(plain).filter(x => x.length >= 4));
    for (const n of names) {
      for (const e of ix.bySlug.get(n) || []) {
        if (normUrl(e['Profile URL']) === ownUrl) continue; // dieselbe Adresse = normaler Treffer
        if (id && v(e, 'Babe ID') && v(e, 'Babe ID') !== id) continue; // beide haben IDs, aber verschiedene
        found.add(e);
      }
    }
    // Tippfehler in der alten Adresse (Grace_Bhattaria -> Grace_Bhattarai): ähnliche Schreibweise mit gleichem Anfang
    const base = baseSlugOf(item['Profile URL']), mx = typoMax(base.length);
    if (mx) for (const [b, e] of ix.byPrefix.get(base.slice(0, 3)) || []) {
      if (found.has(e) || b === base || normUrl(e['Profile URL']) === ownUrl) continue;
      if (id && v(e, 'Babe ID') && v(e, 'Babe ID') !== id) continue;
      const bi = v(item, 'Born'), be = v(e, 'Born');
      if (bi && be && bi !== be) continue;   // anderes Geburtsdatum = andere Person, nicht erst bei Babepedia fragen
      if (typoDist(base, b, mx) <= mx) found.add(e);
    }
    found.delete(exclude);
    return [...found].slice(0, 6);   // jeder Kandidat wird bei Babepedia geprüft – nicht zu viele
  }
  // Übernimmt eigene Angaben aus dem Duplikat, wo der behaltene Eintrag noch nichts hat
  function mergeOwn(keep, dup) {
    for (const f of OWN_FIELDS) {
      const a = v(keep, f), b = v(dup, f);
      if (!b || b === 'false') continue;
      if (f === 'Own Images') keep[f] = [...new Set([...splitList(a), ...splitList(b)])].join(', ');
      else if (f === 'Notes' && a && a !== b) keep[f] = a + '\n\n' + b;
      else if (!a || a === 'false') keep[f] = b;
    }
  }

  // Fragt das Tampermonkey-Skript, wohin eine Babepedia-Adresse heute führt (Weiterleitung + Babe ID).
  // Liefert null, wenn das Skript nicht da ist oder nicht antwortet.
  let resolverOk = null;
  function scriptPing() {
    if (resolverOk !== null) return Promise.resolve(resolverOk);
    return new Promise(res => {
      const t = setTimeout(() => { window.removeEventListener('message', on); resolverOk = false; res(false); }, 1500);
      function on(ev) { if (ev.origin === location.origin && ev.data && ev.data.type === 'BP_RESOLVE_ACK') { clearTimeout(t); window.removeEventListener('message', on); resolverOk = true; res(true); } }
      window.addEventListener('message', on);
      window.postMessage({ type: 'BP_RESOLVE_PING' }, location.origin);
    });
  }
  // Babepedia schonen: jede Adresse nur einmal pro Sitzung abrufen, mind. 2,5 s Abstand,
  // und bei einer Sperre (429 / Cloudflare 1015, 403) 30 Minuten gar nicht mehr fragen.
  const resolveCache = new Map();
  let resolveNext = 0, resolveBlockedUntil = 0;
  const resolveBlocked = () => Date.now() < resolveBlockedUntil;
  async function resolveProfile(url) {
    const key = normUrl(url);
    if (resolveCache.has(key)) return resolveCache.get(key);
    if (resolveBlocked()) return null;
    const wait = resolveNext - Date.now();
    resolveNext = Math.max(Date.now(), resolveNext) + 2500;
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    if (resolveBlocked()) return null;
    const r = await resolveRaw(url);
    if (r && (r.status === 429 || r.status === 403 || r.status === 503)) {
      resolveBlockedUntil = Date.now() + 30 * 60e3;
      toast('Babepedia blockt gerade Anfragen (zu viele Zugriffe). Prüfungen pausieren 30 Minuten.', 'err');
      return null;
    }
    if (r && r.ok) resolveCache.set(key, r);
    return r;
  }
  async function resolveRaw(url) {
    if (!(await scriptPing())) return null;
    const id = 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    return new Promise(res => {
      const t = setTimeout(() => { window.removeEventListener('message', on); res(null); }, 20000);
      function on(ev) { if (ev.origin === location.origin && ev.data && ev.data.type === 'BP_RESOLVE_RESULT' && ev.data.id === id) { clearTimeout(t); window.removeEventListener('message', on); res(ev.data); } }
      window.addEventListener('message', on);
      window.postMessage({ type: 'BP_RESOLVE', id, url }, location.origin);
    });
  }
  // Ist „old“ wirklich dasselbe Babepedia-Profil wie „item“? Nur mit Beleg: gleiche Babe ID
  // oder die alte Adresse leitet heute auf die neue weiter.
  async function sameProfile(old, item) {
    const a = v(old, 'Babe ID'), b = v(item, 'Babe ID');
    if (a && b) return a === b;
    const r = await resolveProfile(old['Profile URL']);
    if (!r || !r.ok) return false;
    if (b && r.babeId) return r.babeId === b;
    return normUrl(r.finalUrl) === normUrl(item['Profile URL']);
  }

  // ---- Vorhandene Doppel-Einträge finden (umbenannte Profile, die zweimal im Tool stehen) ----
  async function findDuplicates() {
    if (!(await scriptPing())) { toast('Dafür muss das Tampermonkey-Skript aktiv sein (es prüft die Weiterleitungen bei Babepedia).', 'err'); return; }
    const ix = buildRenameIndex();
    const pairs = [], seen = new Set();
    for (const e of entries) {
      if (!/\/babe\//.test(normUrl(e['Profile URL']))) continue;
      for (const c of renameCandidates(e, e, ix)) {
        const key = [e._id, c._id].sort().join('|');
        if (seen.has(key)) continue;
        seen.add(key); pairs.push([e, c]);
      }
    }
    if (!pairs.length) { toast('Keine verdächtigen Doppel-Einträge gefunden.', 'ok'); return; }
    openModal(`<div class="modal-head"><h2>Doppel-Einträge suchen</h2><div class="actions"><button class="x" data-action="close">×</button></div></div>
      <div class="help"><p id="dup-status">Prüfe ${pairs.length} verdächtige Paare bei Babepedia…</p><div id="dup-list"></div></div>`);
    const list = $('#dup-list'), found = [];
    for (let i = 0; i < pairs.length; i++) {
      const [a, b] = pairs[i];
      const st = $('#dup-status'); if (!st) return;   // Fenster geschlossen
      st.textContent = `Prüfe bei Babepedia… ${i + 1} / ${pairs.length}`;
      const ia = v(a, 'Babe ID'), ib = v(b, 'Babe ID');
      let ra = null, rb = null, same = false;
      if (ia && ib) same = ia === ib;   // beide IDs bekannt: kein Abruf nötig
      else {
        // erst eine Adresse abrufen – leitet sie auf die andere weiter, reicht das
        ra = await resolveProfile(a['Profile URL']);
        if (ra && ra.ok && normUrl(ra.finalUrl) === normUrl(b['Profile URL'])) same = true;
        else if (ra && ra.ok && ra.babeId && ib) same = ra.babeId === ib;
        else if (ra && ra.ok) {
          rb = await resolveProfile(b['Profile URL']);
          same = !!(rb && rb.ok) && (normUrl(ra.finalUrl) === normUrl(rb.finalUrl) || (!!ra.babeId && ra.babeId === rb.babeId));
        }
      }
      if (resolveBlocked()) { st.textContent = `Babepedia blockt gerade Anfragen – abgebrochen bei ${i + 1} / ${pairs.length}. Später erneut versuchen (bereits geprüfte Adressen werden nicht noch einmal abgerufen, solange das Tool offen bleibt).`; break; }
      if (!same) continue;
      // ohne Abruf (beide IDs bekannt): der zuletzt aktualisierte Eintrag hat die aktuelle Adresse
      ra = ra || { finalUrl: ((b._updated || 0) > (a._updated || 0) ? b : a)['Profile URL'], babeId: ia }; rb = rb || { babeId: ib };
      // Behalten: der Eintrag mit Ranker-Verknüpfung, sonst der ältere. Daten kommen vom Eintrag mit der aktuellen Adresse.
      const cur = normUrl(a['Profile URL']) === normUrl(ra.finalUrl) ? a : b;
      const keep = (a._ranker && !b._ranker) ? a : (b._ranker && !a._ranker) ? b : ((a._created || 0) <= (b._created || 0) ? a : b);
      const drop = keep === a ? b : a;
      found.push({ keep, drop, cur, babeId: ra.babeId || rb.babeId || '' });
      const idx = found.length - 1;
      list.insertAdjacentHTML('beforeend', `<div class="dup-row" data-dup="${idx}">
        <div><b>${esc(keep.Name)}</b> <span class="muted">${esc(keep['Profile URL'].split('/babe/')[1] || '')}</span><br>
        <b>${esc(drop.Name)}</b> <span class="muted">${esc(drop['Profile URL'].split('/babe/')[1] || '')}</span>
        ${a._ranker && b._ranker ? '<br><span class="warn">Beide sind im Image Ranker verknüpft – bitte dort prüfen.</span>' : ''}</div>
        <button class="btn small" data-dup-merge="${idx}">Zusammenführen</button></div>`);
    }
    const st = $('#dup-status'); if (!st) return;
    if (!resolveBlocked()) st.innerHTML = found.length
      ? `${found.length} Doppel-Eintr${found.length === 1 ? 'ag' : 'äge'} von Babepedia bestätigt. Beim Zusammenführen bleibt der obere Eintrag (ID, Notizen, Bewertungen, Ranker-Verknüpfung) und bekommt die aktuellen Babepedia-Daten; der untere wird entfernt.`
      : 'Keine bestätigten Doppel-Einträge (die verdächtigen Paare sind laut Babepedia verschiedene Profile).';
    list.addEventListener('click', async (ev) => {
      const btn = ev.target.closest('[data-dup-merge]'); if (!btn) return;
      const f = found[+btn.dataset.dupMerge]; if (!f || f.done) return;
      const { keep, drop, cur } = f;
      if (cur !== keep) for (const k of FIELDS) if (v(cur, k)) keep[k] = cur[k];   // aktuelle Babepedia-Daten übernehmen
      if (f.babeId && !v(keep, 'Babe ID')) keep['Babe ID'] = f.babeId;
      mergeOwn(keep, drop);
      keep._updated = Date.now(); derive(keep);
      entries = entries.filter(x => x !== drop);
      f.done = true;
      btn.closest('.dup-row').classList.add('done'); btn.replaceWith(Object.assign(document.createElement('span'), { className: 'ok', textContent: '✓ zusammengeführt' }));
      refreshFilters(); render(); await save().catch(() => {});
    });
  }

  async function importItems(items) {
    let added = 0, updated = 0, skipped = 0, merged = 0, renamed = 0;
    const index = new Map(entries.map(e => [keyOf(e), e]));
    const byId = new Map(entries.map(e => [e._id, e]));
    let ix = null;
    const now = Date.now();
    for (const raw of items) {
      if (!raw || typeof raw !== 'object') { skipped++; continue; }
      const item = {};
      for (const f of ALL_FIELDS) if (raw[f] !== undefined && raw[f] !== null) item[f] = String(raw[f]).trim();
      if (!item.Name) { skipped++; continue; }
      const k = keyOf(item);
      let existing = (raw._id && byId.get(raw._id)) || index.get(k);
      // Umbenanntes Profil? Nur für frisch geholte Babepedia-Profile (Backups bringen ihre _id mit).
      // Kandidaten (alter Name im AKA, andere Schreibweise, gleiche Babe ID) werden nur übernommen,
      // wenn Babepedia es belegt: gleiche Babe ID oder Weiterleitung der alten Adresse auf die neue.
      if (!raw._id && /\/babe\//.test(normUrl(item['Profile URL']))) {
        if (!ix) ix = buildRenameIndex();
        const cands = renameCandidates(item, existing, ix);
        let old = null;
        for (const c of cands) { if (await sameProfile(c, item)) { old = c; break; } }
        if (old) {
          const msg = `„${old.Name}“ und „${existing && existing.Name}“ sind dasselbe Babepedia-Profil (umbenannt, von Babepedia bestätigt).\n\nZusammenführen? Der ältere Eintrag „${old.Name}“ bleibt erhalten (mit Notizen, Bewertungen, Ranker-Verknüpfung) und bekommt die neuen Daten; „${existing && existing.Name}“ wird entfernt.`;
          if (!existing || confirm(msg)) {
            if (!existing) renamed++;
            if (existing && existing !== old) {
              mergeOwn(old, existing);
              entries = entries.filter(x => x !== existing);
              index.delete(keyOf(existing)); byId.delete(existing._id);
              merged++;
            }
            index.delete(keyOf(old));
            existing = old;
            ix = null; // Index neu aufbauen, falls im selben Import noch mehr kommt
          }
        }
      }
      if (existing) {
        for (const f of ALL_FIELDS) if (item[f]) existing[f] = item[f];
        existing._updated = now;
        derive(existing);
        index.set(keyOf(existing), existing);
        updated++;
      } else {
        const e = { _id: raw._id || uid(), _created: raw._created || now, _updated: now };
        for (const f of ALL_FIELDS) e[f] = item[f] || '';
        if (!e.Favorite) e.Favorite = 'false';
        derive(e);
        entries.push(e);
        index.set(k, e); byId.set(e._id, e);
        added++;
      }
    }
    refreshFilters();
    render();
    await save();
    return { added, updated, skipped, merged, renamed };
  }

  function parseCSV(text) {
    text = text.replace(/^﻿/, '');
    const rows = []; let row = [], cell = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); rows.push(row); row = []; cell = '';
      } else cell += c;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    const head = (rows.shift() || []).map(h => h.trim());
    return rows.filter(r => r.some(c => c.trim() !== '')).map(r => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
  }
  function toCSV(list) {
    const q = (x) => `"${String(x ?? '').replace(/"/g, '""')}"`;
    const cols = ALL_FIELDS.filter(f => !NO_CSV.has(f));
    return [cols.map(q).join(','), ...list.map(e => cols.map(f => q(e[f])).join(','))].join('\n');
  }
  function download(name, content, type) {
    const blob = new Blob([content], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function stamp() { const d = new Date(); return d.toISOString().slice(0, 10); }

  async function handleFile(file) {
    const text = await file.text();
    let items;
    try {
      if (/\.json$/i.test(file.name) || /^\s*[\[{]/.test(text)) {
        const data = JSON.parse(text);
        items = Array.isArray(data) ? data : (data.entries || []);
        if (data && data.images && typeof data.images === 'object') {
          let n = 0;
          for (const [id, dataUrl] of Object.entries(data.images)) {
            try {
              const blob = await (await fetch(dataUrl)).blob();
              await idbSet('img:' + id, blob);
              if (!localUrls.has(id)) localUrls.set(id, URL.createObjectURL(blob));
              n++;
            } catch {}
          }
          if (n) toast(`${n} eigene Bilder aus dem Backup übernommen.`, 'ok');
        }
      } else {
        items = parseCSV(text);
      }
    } catch (err) {
      toast('Datei konnte nicht gelesen werden: ' + err.message, 'err');
      return;
    }
    if (!items.length) { toast('Keine Einträge in der Datei gefunden.', 'err'); return; }
    let r;
    try { r = await importItems(items); } catch { return; }
    toast(`Import: ${r.added} neu, ${r.updated} aktualisiert${r.renamed ? `, ${r.renamed} umbenannt` : ''}${r.merged ? `, ${r.merged} zusammengeführt` : ''}${r.skipped ? `, ${r.skipped} übersprungen` : ''}.`, 'ok');
  }

  // ---------- Brücke zum Userscript ----------
  let bridgeQueue = Promise.resolve();
  window.addEventListener('message', (ev) => {
    if (ev.origin !== location.origin) return;
    const d = ev.data;
    if (!d || typeof d !== 'object') return;
    if (d.type === 'BP_PING' && ready) window.postMessage({ type: 'BP_TOOL_READY' }, location.origin);
    if (d.type === 'BP_RANKER' && Array.isArray(d.urls) && ready) {
      // Läuft nach einem evtl. gleichzeitig übertragenen Batch-Import (Kette), damit neue Einträge mitzählen
      bridgeQueue = bridgeQueue.then(() => applyRanker(d.urls)).then(r => {
        window.postMessage({ type: 'BP_RANKER_ACK', id: d.id }, location.origin);
        showRankerResult(r, d.urls.length, d.expected);
      }).catch(() => toast('Ranker-Abgleich konnte nicht gespeichert werden.', 'err'));
    }
    if (d.type === 'BP_SYNC' && Array.isArray(d.items) && ready) {
      // Bestätigung (ACK) erst nach erfolgreichem Speichern – sonst bleibt der Batch im Userscript erhalten
      bridgeQueue = bridgeQueue.then(() => importItems(d.items)).then(r => {
        window.postMessage({ type: 'BP_SYNC_ACK', id: d.id, ...r }, location.origin);
        toast(`Von Babepedia übernommen: ${r.added} neu, ${r.updated} aktualisiert${r.renamed ? `, ${r.renamed} umbenannt` : ''}${r.merged ? `, ${r.merged} zusammengeführt` : ''}.`, 'ok');
      }).catch(() => toast('Übernahme fehlgeschlagen – die Profile bleiben im Userscript gespeichert.', 'err'));
    }
  });

  // ---------- Filter & Sortierung ----------
  const FILTERS = { 'f-nationality': 'Nationality', 'f-hair': 'Hair color', 'f-eyes': 'Eye color', 'f-body': 'Body type' };

  function refreshFilters() {
    refreshCatFilter();
    renderExtraFilters();
    for (const [id, field] of Object.entries(FILTERS)) {
      const sel = $('#' + id);
      const cur = sel.value;
      const vals = new Set();
      entries.forEach(e => {
        const raw = v(e, field);
        if (!raw) return;
        (field === 'Nationality' ? natNames(e) : [raw]).forEach(x => x.trim() && vals.add(x.trim()));
      });
      const first = sel.options[0].outerHTML;
      sel.innerHTML = first + [...vals].sort((a, b) => a.localeCompare(b, 'de'))
        .map(x => `<option value="${esc(x)}">${esc(field === 'Nationality' ? withFlag(x) : x)}</option>`).join('');
      sel.value = vals.has(cur) ? cur : '';
    }
  }

  function refreshCatFilter() {
    const sel = $('#f-cat'), cur = sel.value;
    const present = new Set(entries.flatMap(catList));
    const cats = PROFESSION_CATEGORIES.map(c => c[0]).filter(c => present.has(c));
    sel.innerHTML = sel.options[0].outerHTML + cats.map(c => `<option>${esc(c)}</option>`).join('');
    sel.value = present.has(cur) ? cur : '';
  }

  const collator = new Intl.Collator('de');
  // Felder, die auch der Image Ranker nutzt – Filter „Fehlende Werte“
  const CORE_FIELDS = [['Professions', 'Profession'], ['Nationality', 'Nationality'], ['Hair color', 'Hair Color'], ['Born', 'Born'], ['Bra/Cup', 'Bra/Cup'], ['__img', 'Bild']];
  const isMissing = (e, f) => {
    if (f === '__img') return imgState(e) === 'none';
    const x = v(e, f).toLowerCase(); return !x || x === 'n/a' || x === '-' || x === 'unknown';
  };
  const filterNeedsImages = (mf) => mf && (mf === 'any' || mf === 'none' || /__img$/.test(mf));
  const missingCore = (e) => CORE_FIELDS.filter(([f]) => isMissing(e, f)).map(([, label]) => label);

  let scanning = null;
  async function scanImages(all = false) {
    if (scanning) return;
    const todo = entries.filter(e => coverTries(e).length && (all || imgState(e) === 'unknown'));
    if (!todo.length) { if (all) toast('Keine Einträge mit Bildern.'); return; }
    const bar = document.createElement('div');
    bar.className = 'scanbar';
    bar.innerHTML = `<span class="scan-txt"></span><button class="btn small">Abbrechen</button>`;
    document.body.appendChild(bar);
    const txt = $('.scan-txt', bar);
    scanning = { cancel: false };
    $('button', bar).addEventListener('click', () => { scanning.cancel = true; });
    let done = 0, bad = 0, idx = 0;
    const upd = () => { txt.textContent = `Bilder prüfen: ${done} / ${todo.length}${bad ? ` · ${bad} ohne ladbares Bild` : ''}`; };
    upd();
    const tryLoad = (u) => new Promise(res => {
      const im = new Image(); im.referrerPolicy = 'no-referrer'; im.decoding = 'async';
      const t = setTimeout(() => { im.src = ''; res(false); }, 12000);
      im.onload = () => { clearTimeout(t); res(im.naturalWidth >= 40); };
      im.onerror = () => { clearTimeout(t); res(false); };
      im.src = u;
    });
    async function check(e) {
      for (const u of coverTries(e)) {
        if (scanning.cancel) return;
        if (await tryLoad(u)) { recordImg(e._id, 'ok'); return; }
      }
      recordImg(e._id, 'none'); bad++;
    }
    await Promise.all(Array.from({ length: 6 }, async () => {
      while (!scanning.cancel && idx < todo.length) { await check(todo[idx++]); done++; upd(); }
    }));
    const cancelled = scanning.cancel;
    scanning = null; bar.remove();
    await saveImgCheck(true);
    render();
    toast(cancelled ? `Bildprüfung abgebrochen (${done} geprüft).` : `Bildprüfung fertig: ${bad} von ${todo.length} ohne ladbares Bild.`, cancelled ? '' : 'ok');
  }

  function filtered() {
    const q = $('#q').value.trim().toLowerCase();
    const terms = q ? q.split(/\s+/) : [];
    const fv = Object.fromEntries(Object.entries(FILTERS).map(([id, f]) => [f, $('#' + id).value]));
    const act = $('#f-active').value;
    const fav = $('#f-fav').checked;
    const rf = $('#f-rating').value;
    const cf = $('#f-cat').value;
    const rk = $('#f-ranker').value;
    const mf = $('#f-missing').value;

    const xf = Object.entries(xfVals).filter(([, x]) => x);
    let list = entries.filter(e => {
      if (fav && !isTrue(e.Favorite)) return false;
      for (const [f, want] of xf) {
        const vals = fieldValues(e, f);
        if (want === '__empty' ? vals.length : !vals.includes(want)) return false;
      }
      if (cf && !catList(e).includes(cf)) return false;
      if (mf) {
        const miss = CORE_FIELDS.filter(([f]) => isMissing(e, f)).map(([f]) => f);
        if (mf === 'any') { if (!miss.length) return false; }
        else if (mf === 'none') { if (miss.length) return false; }
        else if (mf.startsWith('only:')) { if (miss.length !== 1 || miss[0] !== mf.slice(5)) return false; }
        else if (!miss.includes(mf)) return false;
      }
      if (rk === 'tool' || rk === 'notool') { if (!!e._ranker !== (rk === 'tool')) return false; }
      else if (rk && String(isTrue(e['In Ranker'])) !== rk) return false;
      if (rf) {
        const st = ratingDiff(e).state;
        if (rf === 'diff' && st !== 'diff') return false;
        if (rf === 'same' && st !== 'same') return false;
        if (rf === 'missing' && !(st === 'site-only' || st === 'mine-only')) return false;
        if (rf === 'site-only' && st !== 'site-only') return false;
        if (rf === 'mine-only' && st !== 'mine-only') return false;
        if (rf === 'none' && st !== 'none') return false;
      }
      if (act && String(v(e, 'Active') || 'false') !== act) return false;
      for (const [f, val] of Object.entries(fv)) {
        if (!val) continue;
        if (f === 'Nationality' ? !natNames(e).includes(val) : v(e, f) !== val) return false;
      }
      if (terms.length) {
        const hay = [e.Name, e.AKA, e.Tags, e.Notes, e.Birthplace, e.Professions, e['Profession Category'], e.Nationality].join(' ').toLowerCase();
        if (!terms.every(t => hay.includes(t))) return false;
      }
      return true;
    });

    // Sortierschlüssel einmal pro Eintrag berechnen (statt bei jedem Vergleich)
    const key = {
      name: () => 0,
      created: (e) => -(e._created || 0),
      updated: (e) => -(e._updated || 0),
      global: (e) => -(num(e['Global Rating']) ?? -1),
      mine: (e) => -(num(e['My Rating']) ?? -1),
      rank: (e) => num(e.Rank) ?? 1e9,
      young: (e) => age(e) ?? 999,
      old: (e) => -(age(e) ?? -1),
      height: (e) => -(num(e.Height) ?? -1),
      ranker: (e) => e._ranker ? -(e._ranker.score + 1) : 1,
      site: (e) => -(num(e['User Rating']) ?? -1),
      diff: (e) => { const d = ratingDiff(e).d; return d === undefined ? 1 : -Math.abs(d); }
    }[ui.sort] || (() => 0);
    return list.map(e => ({ e, k: key(e), n: v(e, 'Name') }))
      .sort((a, b) => (a.k - b.k) || collator.compare(a.n, b.n))
      .map(x => x.e);
  }

  // ---------- Darstellung ----------
  // ---------- Ansicht anpassen: Kachel-Inhalte und Filter ----------
  // Einstellungen liegen in ui (localStorage 'bp-organizer-ui', klein, pro Gerät)
  const DERIVED = ['Alter', 'Geburtsjahr'];
  const CARD_FIELD_CHOICES = ['Nationality', 'Alter', 'Geburtsjahr', 'Height', 'Weight', 'Measurements', 'Bra/Cup', 'Boobs', 'Hair color', 'Eye color', 'Body type',
    'Ethnicity', 'Professions', 'Profession Category', 'Birthplace', 'Born', 'Years active', 'Tattoos', 'Piercings', 'Sexuality', 'AKA', 'Tags',
    'Global Rating', 'Votes', 'User Rating', 'My Rating', 'Rank', 'Highest Rank', 'Babe ID'];
  const CARD_BADGES = [['global', '★ Global Rating'], ['rank', '# Rank'], ['rating', '♥ Meine Bewertung'], ['ranker', '🏆 Ranker']];
  const BUILTIN_FILTERS = [['f-nationality', 'Nationalität'], ['f-cat', 'Bereich'], ['f-hair', 'Haarfarbe'], ['f-eyes', 'Augenfarbe'], ['f-body', 'Figur'],
    ['f-active', 'Aktiv'], ['f-rating', 'Bewertung'], ['f-ranker', 'Ranker'], ['f-missing', 'Fehlende Werte'], ['f-fav', 'nur Favoriten']];
  const EXTRA_FILTER_CHOICES = ['Ethnicity', 'Sexuality', 'Professions', 'Birthplace', 'Geburtsjahr', 'Alter', 'Height', 'Bra/Cup', 'Boobs', 'Tattoos', 'Piercings',
    'Measurements', 'Weight', 'Years active', 'Tags', 'My Rating', 'User Rating', 'Exact Birthdate', 'Favorite'];
  const MULTI_FIELDS = new Set(['Professions', 'Tags', 'AKA']);
  if (!Array.isArray(ui.cardFields)) ui.cardFields = ['Nationality', 'Alter', 'Height'];
  if (!Array.isArray(ui.cardBadges)) ui.cardBadges = CARD_BADGES.map(b => b[0]);
  if (!ui.hiddenFilters || typeof ui.hiddenFilters !== 'object') ui.hiddenFilters = {};
  if (!Array.isArray(ui.extraFilters)) ui.extraFilters = [];
  const xfVals = {};   // aktuelle Auswahl der Zusatzfilter (nicht gespeichert)

  function fieldValues(e, f) {
    if (f === 'Alter') { const a = age(e); return a == null ? [] : [String(a)]; }
    if (f === 'Geburtsjahr') { const m = String(v(e, 'Born')).match(/(\d{4})$/); return m ? [m[1]] : []; }
    if (f === 'Nationality') return natNames(e);
    const raw = v(e, f);
    if (!raw || raw.toLowerCase() === 'n/a') return [];
    if (MULTI_FIELDS.has(f)) return splitList(raw);
    if (f === 'Profession Category') return catList(e);
    if (TYPES[f] === 'bool') return [isTrue(raw) ? 'Ja' : 'Nein'];
    return [raw];
  }
  function cardValue(e, f) {
    if (f === 'Alter') { const a = age(e); return a == null ? '' : `${a} J.`; }
    if (f === 'Geburtsjahr') return fieldValues(e, f)[0] || '';
    if (f === 'Born') return fmtDate(v(e, 'Born'), isTrue(e['Exact Birthdate']));
    if (f === 'Nationality') return natDisplay(e);
    if (f === 'Global Rating' || f === 'User Rating' || f === 'My Rating') return v(e, f) ? `${f.replace(' Rating', '')} ${v(e, f)}` : '';
    if (f === 'Rank' || f === 'Highest Rank') return v(e, f) ? `${f === 'Rank' ? '#' : 'max #'}${v(e, f)}` : '';
    if (f === 'Tattoos' || f === 'Piercings') { const x = v(e, f); return x && x !== 'n/a' ? `${f}: ${x}` : ''; }
    const val = v(e, f);
    if (!val || val === 'n/a') return '';
    if (TYPES[f] === 'bool') return isTrue(val) ? f : '';
    if (f === 'Bra/Cup') return 'Cup ' + val;
    if (f === 'Babe ID') return 'ID ' + val;
    return val + (UNITS[f] || '');
  }
  function metaLine(e) {
    return ui.cardFields.map(f => cardValue(e, f)).filter(Boolean).join(' · ');
  }

  function applyFilterVisibility() {
    for (const [id] of BUILTIN_FILTERS) {
      const el = $('#' + id); if (!el) continue;
      const box = id === 'f-fav' ? el.closest('label') : el;
      const hide = !!ui.hiddenFilters[id];
      box.hidden = hide;
      if (hide) { if (el.type === 'checkbox') el.checked = false; else el.value = ''; }
    }
  }
  function renderExtraFilters() {
    const box = $('#xf'); if (!box) return;
    for (const k of Object.keys(xfVals)) if (!ui.extraFilters.includes(k)) delete xfVals[k];
    box.innerHTML = ui.extraFilters.map(f => {
      const counts = new Map(); let empty = 0;
      for (const e of entries) { const vals = fieldValues(e, f); if (!vals.length) empty++; vals.forEach(x => counts.set(x, (counts.get(x) || 0) + 1)); }
      const isNum = ['Alter', 'Geburtsjahr', 'Height', 'Weight', 'My Rating', 'User Rating'].includes(f);
      const keys = [...counts.keys()].sort((a, b) => isNum ? (num(a) - num(b)) : a.localeCompare(b, 'de'));
      const cur = xfVals[f] || '';
      return `<select data-xf="${esc(f)}" title="${esc(f)}"><option value="">${esc(f)}: alle</option>${empty ? `<option value="__empty" ${cur === '__empty' ? 'selected' : ''}>${esc(f)}: (leer) – ${empty}</option>` : ''}${keys.map(k => `<option value="${esc(k)}" ${cur === k ? 'selected' : ''}>${esc(k)} (${counts.get(k)})</option>`).join('')}</select>`;
    }).join('');
  }

  function showViewSettings() {
    const chk = (name, val, on, label) => `<label class="chk"><input type="checkbox" name="${name}" value="${esc(val)}" ${on ? 'checked' : ''}> ${esc(label)}</label>`;
    openModal(`
      <div class="modal-head"><h2>Ansicht anpassen</h2><div class="actions"><button class="x" data-action="close" aria-label="Schließen">×</button></div></div>
      <form class="help view-cfg" id="view-cfg">
        <h3>Angaben auf den Kacheln</h3>
        <p class="muted">Erscheinen unter dem Namen in der gewählten Reihenfolge (Reihenfolge = Klick-Reihenfolge; zuerst gewählt steht vorne).</p>
        <div class="cfg-grid" id="cfg-card">${CARD_FIELD_CHOICES.map(f => chk('card', f, ui.cardFields.includes(f), f)).join('')}</div>
        <p class="muted" id="cfg-order"></p>
        <h3>Abzeichen auf dem Bild</h3>
        <div class="cfg-grid">${CARD_BADGES.map(([k, l]) => chk('badge', k, ui.cardBadges.includes(k), l)).join('')}</div>
        <h3>Filter in der Leiste</h3>
        <div class="cfg-grid">${BUILTIN_FILTERS.map(([id, l]) => chk('filter', id, !ui.hiddenFilters[id], l)).join('')}</div>
        <h3>Zusätzliche Filter</h3>
        <p class="muted">Auswahl mit allen vorkommenden Werten (und „leer“).</p>
        <div class="cfg-grid">${EXTRA_FILTER_CHOICES.map(f => chk('extra', f, ui.extraFilters.includes(f), f)).join('')}</div>
      </form>
      <div class="form-foot">
        <button class="btn ghost" id="cfg-default">Standard</button>
        <button class="btn" data-action="close">Abbrechen</button>
        <button class="btn primary" id="cfg-save">Übernehmen</button>
      </div>`);
    const form = $('#view-cfg');
    let order = ui.cardFields.slice();
    const showOrder = () => { $('#cfg-order').textContent = order.length ? 'Reihenfolge: ' + order.join(' · ') : 'Keine Angaben ausgewählt.'; };
    showOrder();
    form.addEventListener('change', (ev) => {
      if (ev.target.name === 'card') {
        const f = ev.target.value;
        order = ev.target.checked ? [...order.filter(x => x !== f), f] : order.filter(x => x !== f);
        showOrder();
      }
    });
    $('#cfg-default').addEventListener('click', () => {
      ui.cardFields = ['Nationality', 'Alter', 'Height']; ui.cardBadges = CARD_BADGES.map(b => b[0]); ui.hiddenFilters = {}; ui.extraFilters = [];
      saveUI(); closeModal(true); applyFilterVisibility(); renderExtraFilters(); render();
    });
    $('#cfg-save').addEventListener('click', () => {
      const vals = (n) => [...form.querySelectorAll(`input[name="${n}"]:checked`)].map(i => i.value);
      ui.cardFields = order;
      ui.cardBadges = vals('badge');
      const shown = new Set(vals('filter'));
      ui.hiddenFilters = Object.fromEntries(BUILTIN_FILTERS.filter(([id]) => !shown.has(id)).map(([id]) => [id, true]));
      ui.extraFilters = vals('extra');
      saveUI(); closeModal(true); applyFilterVisibility(); renderExtraFilters(); render();
      toast('Ansicht gespeichert (gilt für dieses Gerät).', 'ok');
    });
  }

  function ratingBadge(e) {
    const r = ratingDiff(e);
    if (r.state === 'same') return `<span class="badge mine" title="Meine Bewertung = Babepedia">♥ ${esc(v(e, 'My Rating'))} ✓</span>`;
    if (r.state === 'diff') return `<span class="badge diff" title="Meine Bewertung ${r.mine} / Babepedia ${r.site}">♥ ${r.mine} ≠ ${r.site}</span>`;
    if (r.state === 'mine-only') return `<span class="badge mine" title="Auf Babepedia noch nicht bewertet">♥ ${r.mine}</span>`;
    if (r.state === 'site-only') return `<span class="badge site" title="Nur auf Babepedia bewertet">BP ${r.site}</span>`;
    return '';
  }

  function diffCell(e) {
    const r = ratingDiff(e);
    if (r.state === 'same') return '<span class="ok">=</span>';
    if (r.state === 'diff') return `<span class="warn">${fmtDiff(r.d)}</span>`;
    return '';
  }

  function render() {
    const list = filtered();
    $('#count').textContent = list.length === entries.length ? `${entries.length} Einträge` : `${list.length} von ${entries.length}`;
    $$('.seg button').forEach(b => b.classList.toggle('on', b.dataset.view === ui.view));
    $('#sort').value = ui.sort;
    const main = $('#main');

    if (!entries.length) {
      main.innerHTML = `<div class="empty"><h2>Noch keine Einträge</h2>
        <p>Füge Profile über das Babepedia-Skript hinzu, importiere eine CSV-Datei deines alten Skripts<br>oder lege selbst einen Eintrag an.</p>
        <button class="btn primary" data-action="new">＋ Neuer Eintrag</button>
        <button class="btn" data-action="import-file">Datei importieren</button>
        <button class="btn ghost" data-action="help">Anleitung</button></div>`;
      return;
    }
    if (!list.length) { main.innerHTML = `<div class="empty"><h2>Keine Treffer</h2><p>Passe Suche oder Filter an.</p></div>`; return; }

    shown = list; shownCount = 0;
    if (ui.view === 'table') {
      main.innerHTML = `<div class="table-wrap"><table><thead><tr>
        <th></th><th>Name</th><th>Nationality</th><th>Profession Category</th><th>Alter</th><th>Height</th><th>Hair color</th><th>Measurements</th><th>Global Rating</th><th>Rank</th><th>User Rating</th><th>My Rating</th><th>Δ</th><th>🏆</th><th>★</th>
        </tr></thead><tbody></tbody></table></div><div class="more" id="more"></div>`;
    } else {
      main.innerHTML = `<div class="grid"></div><div class="more" id="more"></div>`;
    }
    renderMore();
    moreObserver.observe($('#more'));
  }

  function rowHTML(e) {
    return `<tr data-id="${esc(e._id)}">
          <td class="thumb">${coverTag(e)}</td>
          <td><strong>${esc(v(e, 'Name'))}</strong></td>
          <td>${esc(natDisplay(e))}</td>
          <td>${esc(v(e, 'Profession Category'))}</td>
          <td class="num">${age(e) ?? ''}</td>
          <td class="num">${esc(v(e, 'Height'))}</td>
          <td>${esc(v(e, 'Hair color'))}</td>
          <td>${esc(v(e, 'Measurements'))}</td>
          <td class="num">${esc(v(e, 'Global Rating'))}</td>
          <td class="num">${esc(v(e, 'Rank'))}</td>
          <td class="num">${esc(v(e, 'User Rating'))}</td>
          <td class="num">${esc(v(e, 'My Rating'))}</td>
          <td class="num">${diffCell(e)}</td>
          <td>${isTrue(e['In Ranker']) ? '🏆' : ''}</td>
          <td>${isTrue(e.Favorite) ? '<span style="color:var(--accent)">♥</span>' : ''}</td>
        </tr>`;
  }
  function cardHTML(e) {
    return `
      <article class="card" data-id="${esc(e._id)}">
        <button class="fav-btn ${isTrue(e.Favorite) ? 'on' : ''}" data-fav="${esc(e._id)}" title="Favorit">${isTrue(e.Favorite) ? '♥' : '♡'}</button>
        <div class="img">${coverTag(e)}
          <div class="badges">
            ${ui.cardBadges.includes('global') && v(e, 'Global Rating') ? `<span class="badge rating">★ ${esc(v(e, 'Global Rating'))}</span>` : ''}
            ${ui.cardBadges.includes('rank') && v(e, 'Rank') ? `<span class="badge">#${esc(v(e, 'Rank'))}</span>` : ''}
            ${ui.cardBadges.includes('rating') ? ratingBadge(e) : ''}
            ${!ui.cardBadges.includes('ranker') ? '' : e._ranker ? rankerBadge(e) : (isTrue(e['In Ranker']) ? '<span class="badge ranker" title="In der Babepedia-Liste „Ranker“">🏆</span>' : '')}
          </div>
        </div>
        <div class="body">
          <div class="name">${esc(v(e, 'Name'))}</div>
          <div class="meta">${esc(metaLine(e)) || '&nbsp;'}</div>
        </div>
      </article>`;
  }
  // Nur so viele Karten erzeugen, wie sichtbar sind; weitere beim Scrollen nachladen
  let shown = [], shownCount = 0;
  const STEP = 60;
  function renderMore() {
    const box = ui.view === 'table' ? $('#main tbody') : $('#main .grid');
    if (!box || shownCount >= shown.length) return;
    const next = shown.slice(shownCount, shownCount + STEP);
    box.insertAdjacentHTML('beforeend', next.map(ui.view === 'table' ? rowHTML : cardHTML).join(''));
    shownCount += next.length;
    const more = $('#more');
    if (more) more.textContent = shownCount < shown.length ? `${shownCount} von ${shown.length} angezeigt – weiter scrollen` : '';
  }
  const moreObserver = new IntersectionObserver((items) => {
    if (items.some(i => i.isIntersecting)) {
      renderMore();
      // Falls der Bildschirm noch nicht voll ist: direkt weiter auffüllen
      const more = $('#more');
      if (more && shownCount < shown.length && more.getBoundingClientRect().top < innerHeight + 1500) requestAnimationFrame(renderMore);
    }
  }, { rootMargin: '1500px 0px' });

  // Einzelnen Eintrag in der Liste aktualisieren, ohne alles neu aufzubauen (Scrollposition bleibt)
  function refreshItem(id) {
    const e = byId(id); if (!e) return;
    const el = $(`#main [data-id="${CSS.escape(id)}"]`);
    if (el) el.outerHTML = ui.view === 'table' ? rowHTML(e) : cardHTML(e);
  }

  // ---------- Modal ----------
  const overlay = $('#overlay'), modal = $('#modal');
  let dirty = false;
  function openModal(html) {
    discardFormUploads(); modal.innerHTML = html; overlay.hidden = false; document.body.style.overflow = 'hidden'; overlay.scrollTop = 0; dirty = false; }
  function closeModal(force) {
    if (!force && dirty && !confirm('Ungespeicherte Änderungen verwerfen?')) return;
    discardFormUploads();
    overlay.hidden = true; modal.innerHTML = ''; document.body.style.overflow = ''; dirty = false;
  }
  const byId = (id) => entries.find(e => e._id === id); // bei ~4000 Einträgen schnell genug

  function fmtValue(e, f) {
    const val = v(e, f);
    if (!val) return '';
    if (f === 'Born') return fmtDate(val, isTrue(e['Exact Birthdate'])) + (age(e) !== null && !v(e, 'Died') ? ` (${age(e)} Jahre)` : '');
    if (f === 'Died') return fmtDate(val, true) + (age(e) !== null ? ` (mit ${age(e)})` : '');
    if (f === 'Nationality') return natDisplay(e);
    if (TYPES[f] === 'date') return fmtDate(val, true);
    if (TYPES[f] === 'bool') return isTrue(val) ? 'Ja' : 'Nein';
    return val + (UNITS[f] || '');
  }

  function linkLabel(f, url) {
    if (f === 'Profile URL') return 'Babepedia';
    if (f === 'Archive URL') return '🏛️ Internet Archive';
    if (f === 'Boobpedia Link') return 'Boobpedia';
    return f.replace(/ URL$/, '');
  }

  function ratingBox(e) {
    const r = ratingDiff(e);
    const mine = num(e['My Rating']);
    const btns = Array.from({ length: 10 }, (_, i) => i + 1).map(n =>
      `<button class="rate-btn ${mine !== null && n <= mine ? 'on' : ''} ${num(e['User Rating']) === n ? 'site' : ''}" data-rate="${n}" data-id="${esc(e._id)}" title="${n}/10">${n}</button>`).join('');
    let cmp;
    if (r.state === 'same') cmp = `<span class="ok">✓ stimmt mit Babepedia überein (${r.site})</span>`;
    else if (r.state === 'diff') cmp = `<span class="warn">Babepedia: ${r.site} · Abweichung ${fmtDiff(r.d)}</span>`;
    else if (r.state === 'mine-only') cmp = `<span class="muted">Auf Babepedia noch nicht bewertet</span>`;
    else if (r.state === 'site-only') cmp = `<span class="muted">Babepedia: ${r.site} – hier noch nicht bewertet</span>`;
    else cmp = `<span class="muted">Noch nicht bewertet</span>`;
    const take = r.state === 'site-only' || r.state === 'diff'
      ? `<button class="btn small" data-rate="${r.site}" data-id="${esc(e._id)}">Babepedia-Wert übernehmen</button>` : '';
    return `<div class="sec rating-box"><h3>Meine Bewertung</h3>
      <div class="rate-row">${btns}${mine !== null ? `<button class="rate-clear" data-rate="" data-id="${esc(e._id)}" title="Bewertung entfernen">✕</button>` : ''}</div>
      <div class="rate-cmp">${cmp} ${take}</div></div>`;
  }

  function setRating(id, val) {
    const e = byId(id); if (!e) return;
    e['My Rating'] = val === '' ? '' : String(val);
    e._updated = Date.now();
    saveQuiet(); refreshItem(id); showDetail(id);
  }

  function showDetail(id) {
    const e = byId(id); if (!e) return;
    const imgs = images(e);
    const skip = new Set(['Name', 'AKA', 'Exact Birthdate', 'Favorite', 'Tags', 'Notes', 'Profile URL', 'Archive URL']);
    const sec = (title, fields) => {
      const rows = fields.filter(f => !skip.has(f)).map(f => [f, fmtValue(e, f)]).filter(([, x]) => x !== '');
      if (!rows.length) return '';
      return `<div class="sec"><h3>${title}</h3><dl class="kv">${rows.map(([f, x]) => `<div><dt>${esc(f)}</dt><dd>${esc(x)}</dd></div>`).join('')}</dl></div>`;
    };
    const links = ['Profile URL', 'Archive URL', ...LINK_FIELDS].filter(f => /^https?:\/\//i.test(v(e, f)));
    const galleries = splitList(e['Gallery Links']).filter(u => /^https?:\/\//i.test(u));
    const tags = splitList(e.Tags);

    openModal(`
      <div class="modal-head">
        <h2>${esc(v(e, 'Name'))}</h2>
        <div class="actions">
          <button class="btn small" data-action="to-ranker" data-id="${esc(e._id)}" title="An Image Ranker senden">🏆 An Ranker</button>
          <button class="btn small" data-action="edit" data-id="${esc(e._id)}">Bearbeiten</button>
          <button class="btn small danger" data-action="delete" data-id="${esc(e._id)}">Löschen</button>
          <button class="x" data-action="close" aria-label="Schließen">×</button>
        </div>
      </div>
      <div class="detail">
        <div class="gallery">
          <div class="main">${coverTag(e)}</div>
        </div>
        <div>
          <h1 class="d-title">${esc(v(e, 'Name'))}</h1>
          ${v(e, 'AKA') ? `<div class="d-aka">auch: ${esc(v(e, 'AKA'))}</div>` : ''}
          <div class="chips">
            <button class="chip accent" data-fav="${esc(e._id)}" style="cursor:pointer">${isTrue(e.Favorite) ? '♥ Favorit' : '♡ Als Favorit'}</button>
            ${v(e, 'Global Rating') ? `<span class="chip">★ ${esc(v(e, 'Global Rating'))}${v(e, 'Votes') ? ` (${esc(v(e, 'Votes'))} Votes)` : ''}</span>` : ''}
            ${v(e, 'Rank') ? `<span class="chip">Rank #${esc(v(e, 'Rank'))}</span>` : ''}
            ${v(e, 'Active') ? `<span class="chip">${isTrue(e.Active) ? 'aktiv' : 'inaktiv'}</span>` : ''}
            ${e._ranker ? `<a class="chip ranker" href="/Image-Ranker/#bo=${encodeURIComponent(e._id)}" target="_blank" rel="noopener" title="Im Image Ranker öffnen">🏆 ${esc(e._ranker.tier)} · Score ${e._ranker.score} · Platz ${e._ranker.rank}/${e._ranker.total} (${esc(e._ranker.tab)})</a>` : ''}
            ${isTrue(e['In Ranker']) ? '<span class="chip ranker" title="In der Babepedia-Liste „Ranker“">🏆 Babepedia-Liste</span>' : ''}
            ${missingCore(e).length ? `<span class="chip missing" title="Diese Werte fehlen (werden auch vom Image Ranker genutzt)">⚠ fehlt: ${esc(missingCore(e).join(', '))}</span>` : ''}
            ${v(e, 'Archive URL') ? `<a class="chip" href="${esc(v(e, 'Archive URL'))}" target="_blank" rel="noopener noreferrer" title="Aus dem Internet Archive übernommen">🏛️ aus dem Archiv</a>` : ''}
            ${catList(e).map(c => `<button class="chip cat" data-cat="${esc(c)}" title="Alle aus diesem Bereich anzeigen">${esc(c)}</button>`).join('')}
            ${tags.map(t => `<button class="chip tag" data-tag="${esc(t)}">#${esc(t)}</button>`).join('')}
          </div>
          ${ratingBox(e)}
          ${v(e, 'Notes') ? `<div class="sec"><h3>Notizen</h3><div class="notes">${esc(v(e, 'Notes'))}</div></div>` : ''}
          ${sec('Allgemein', GROUPS[0].fields)}
          ${sec('Aussehen', GROUPS[1].fields)}
          ${sec('Babepedia', GROUPS[3].fields)}
          ${imgs.length ? `<div class="sec"><h3>Bilder (${imgs.length})</h3><div class="img-grid">${imgs.map((u, i) => `<div class="img-cell"><img src="${esc(thumbUrl(R(u)))}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" data-full="${esc(u)}" data-fallback="✕"${thumbUrl(R(u)) !== R(u) ? ` data-alts="${esc(R(u))}"` : ''}>${isLocal(u) ? '<span class="img-own" title="Eigenes Bild">📁</span>' : ''}<button class="img-cover-btn ${i === 0 ? 'on' : ''}" data-set-cover="${esc(u)}" data-id="${esc(e._id)}" title="${i === 0 ? 'Aktuelles Cover' : 'Als Cover verwenden'}">★</button></div>`).join('')}</div></div>` : ''}
          ${links.length ? `<div class="sec"><h3>Links</h3><div class="links">${links.map(f => `<a href="${esc(v(e, f))}" target="_blank" rel="noopener noreferrer">${esc(linkLabel(f))}</a>`).join('')}</div></div>` : ''}
          ${galleries.length ? `<div class="sec"><h3>Galerien (${galleries.length})</h3><div class="links">${galleries.map((u, i) => `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">Galerie ${i + 1}</a>`).join('')}</div></div>` : ''}
        </div>
      </div>`);
  }

  function ownItemsHTML(refs, cover) {
    return refs.map(r => `<div class="own-item ${r === cover ? 'is-cover' : ''}" data-ref="${esc(r)}">
      <img src="${esc(R(r))}" alt="" data-full="${esc(r)}">
      <button type="button" class="own-btn" data-own-cover title="${r === cover ? 'Ist Cover' : 'Als Cover'}">★</button>
      <button type="button" class="own-btn del" data-own-del title="Entfernen">✕</button></div>`).join('');
  }

  function fieldInput(f, e) {
    if (f === 'Cover') return '';
    if (f === 'Own Images') {
      const refs = splitList(v(e, 'Own Images'));
      return `<div class="field wide own-field"><label>Eigene Bilder</label>
        <div class="own-drop" data-own-drop>Bilder hierher ziehen oder <button type="button" class="btn small" data-own-pick>Dateien auswählen…</button></div>
        <input type="file" accept="image/*" multiple hidden data-own-file>
        <input type="hidden" name="Own Images" value="${esc(refs.join(', '))}">
        <input type="hidden" name="Cover" value="${esc(v(e, 'Cover'))}">
        <div class="own-list" data-own-list>${ownItemsHTML(refs, v(e, 'Cover'))}</div>
        <span class="hint">Werden verkleinert nur in diesem Browser gespeichert (nicht im Repo). Im JSON-Backup sind sie enthalten.</span></div>`;
    }
    if (f === 'Profession Category') {
      return `<div class="field"><label>${esc(f)}</label><input type="text" value="${esc(v(e, f))}" readonly tabindex="-1" class="ro" data-derived="cat"><span class="hint">wird automatisch aus Professions gebildet</span></div>`;
    }
    if (f === 'Measurements') {
      const id = 'fld-' + ALL_FIELDS.indexOf(f), val = v(e, f), inch = measInches(val);
      return `<div class="field"><label for="${id}">Measurements</label>
        <div class="unit-row"><input type="text" name="Measurements" id="${id}" value="${esc(val)}" placeholder="xx-xx-xx" inputmode="decimal" autocomplete="off">
        <select name="Measurements-unit" aria-label="Einheit"><option value="cm">cm</option><option value="in">inch</option></select></div>
        <span class="hint" data-meas-hint>${esc(HINTS[f])}${inch ? ` · ≈ ${inch} in` : ''}</span></div>`;
    }
    const t = TYPES[f];
    const id = 'fld-' + ALL_FIELDS.indexOf(f);
    const val = v(e, f);
    const name = `name="${esc(f)}" id="${id}"`;
    const hint = HINTS[f] ? `<span class="hint">${esc(HINTS[f])}</span>` : '';
    if (t === 'bool') {
      return `<div class="field check"><input type="checkbox" ${name} ${isTrue(val) ? 'checked' : ''}><label for="${id}">${esc(f)}</label>${hint}</div>`;
    }
    let input;
    if (Array.isArray(t)) {
      const opts = t.includes(val) ? t : [...t, val];
      input = `<select ${name}>${opts.map(o => `<option value="${esc(o)}" ${o === val ? 'selected' : ''}>${esc(o || '–')}</option>`).join('')}</select>`;
    } else if (t === 'date') {
      input = `<input type="date" ${name} value="${esc(ddToIso(val))}">`;
    } else if (t === 'num') {
      input = `<input type="number" ${f === 'My Rating' ? 'min="1" max="10" step="1"' : 'step="any"'} ${name} value="${esc(val)}">`;
    } else if (t === 'area') {
      input = `<textarea ${name}>${esc(val)}</textarea>`;
    } else {
      const type = /URL|Link|Website|Instagram|Twitter|TikTok|YouTube|Twitch|IMDb|OnlyFans|Fansly|Thronly/.test(f) ? 'url' : 'text';
      input = `<input type="${type}" ${name} value="${esc(val)}" ${f === 'Name' ? 'required' : ''}>`;
    }
    const wide = t === 'area' || f === 'Notes' ? ' wide' : '';
    if (IMAGE_FIELDS.includes(f)) {
      return `<div class="field${wide}"><label for="${id}">${esc(f)}</label>${input}${hint}<div class="img-prev" data-prev-for="${esc(f)}">${previewHTML(val)}</div></div>`;
    }
    return `<div class="field${wide}"><label for="${id}">${esc(f)}${f === 'Name' ? ' *' : ''}</label>${input}${hint}</div>`;
  }

  function showForm(id) {
    const isNew = !id;
    const e = isNew ? { Tattoos: 'n/a', Piercings: 'n/a', 'Exact Birthdate': 'true', Favorite: 'false' } : byId(id);
    if (!e) return;
    const order = [GROUPS[2], GROUPS[0], GROUPS[1], GROUPS[4], GROUPS[5], GROUPS[3]];
    openModal(`
      <div class="modal-head">
        <h2>${isNew ? 'Neuer Eintrag' : esc(v(e, 'Name')) + ' bearbeiten'}</h2>
        <div class="actions"><button class="x" data-action="close" aria-label="Schließen">×</button></div>
      </div>
      <form class="form" id="entry-form" data-id="${esc(id || '')}" novalidate>
        ${order.map(g => `<fieldset><legend>${g.title}</legend><div class="fields">${g.fields.map(f => fieldInput(f, e)).join('')}</div></fieldset>`).join('')}
      </form>
      <div class="form-foot">
        <button class="btn" data-action="${isNew ? 'close' : 'cancel-edit'}" data-id="${esc(id || '')}">Abbrechen</button>
        <button class="btn primary" data-action="save">${isNew ? 'Anlegen' : 'Speichern'}</button>
      </div>`);
    const form = $('#entry-form');
    form.addEventListener('change', (ev) => { if (ev.target.name === 'Measurements-unit') form.dispatchEvent(new Event('input', { bubbles: true })); });
    form.addEventListener('input', (ev) => {
      dirty = true;
      if (ev.target === form || ev.target.name === 'Measurements') {
        const inp = form.elements.namedItem('Measurements'), unit = form.elements.namedItem('Measurements-unit').value;
        const hintEl = $('[data-meas-hint]', form), p = parseMeas(inp.value);
        if (!inp.value.trim()) hintEl.textContent = HINTS.Measurements;
        else if (!p) hintEl.textContent = 'Format: xx-xx-xx';
        else if (unit === 'in') hintEl.textContent = `wird gespeichert als ${measToCm(inp.value, 'in')} cm`;
        else hintEl.textContent = `≈ ${measInches(measToCm(inp.value, 'cm'))} in`;
      }
      if (ev.target.name === 'Professions') { const ro = $('[data-derived="cat"]', form); if (ro) ro.value = professionCategories(ev.target.value); }
      const box = $(`[data-prev-for="${CSS.escape(ev.target.name || '')}"]`, form);
      if (box) box.innerHTML = previewHTML(ev.target.value);
    });
    form.addEventListener('submit', (ev) => { ev.preventDefault(); saveForm(); });
    bindOwnImages(form);
    $('[name="Name"]', form).focus();
  }

  // Im Formular neu hochgeladene Bilder; werden verworfen, wenn nicht gespeichert wird
  let formUploads = new Set();
  function discardFormUploads() {
    if (!formUploads.size) return;
    const refs = [...formUploads]; formUploads = new Set();
    deleteLocalImages(refs);
  }
  function bindOwnImages(form) {
    const list = $('[data-own-list]', form), hidden = form.elements.namedItem('Own Images'), coverIn = form.elements.namedItem('Cover');
    const fileIn = $('[data-own-file]', form), drop = $('[data-own-drop]', form);
    const refs = () => splitList(hidden.value);
    const redraw = (arr) => { hidden.value = arr.join(', '); list.innerHTML = ownItemsHTML(arr, coverIn.value); dirty = true; };
    async function add(files) {
      const imgsIn = [...files].filter(f => /^image\//.test(f.type) || /\.(jpe?g|png|webp|gif|bmp|avif)$/i.test(f.name));
      if (!imgsIn.length) { toast('Keine Bilddateien gefunden.', 'err'); return; }
      drop.classList.add('busy'); drop.dataset.label = `Speichere ${imgsIn.length} Bild(er)…`;
      const arr = refs();
      for (const f of imgsIn) {
        try { const r = await storeLocalImage(f); formUploads.add(r); arr.push(r); redraw(arr); }
        catch (err) { toast(err.message || String(err), 'err'); }
      }
      drop.classList.remove('busy');
    }
    $('[data-own-pick]', form).addEventListener('click', () => fileIn.click());
    fileIn.addEventListener('change', () => { add(fileIn.files); fileIn.value = ''; });
    ['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, (ev) => { ev.preventDefault(); ev.stopPropagation(); drop.classList.add('over'); }));
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', (ev) => { ev.preventDefault(); ev.stopPropagation(); drop.classList.remove('over'); add(ev.dataTransfer.files); });
    list.addEventListener('click', (ev) => {
      const item = ev.target.closest('.own-item'); if (!item) return;
      const r = item.dataset.ref;
      if (ev.target.closest('[data-own-del]')) {
        if (coverIn.value === r) coverIn.value = '';
        redraw(refs().filter(x => x !== r));
      } else if (ev.target.closest('[data-own-cover]')) {
        coverIn.value = coverIn.value === r ? '' : r;
        redraw(refs());
      }
    });
  }

  function saveForm() {
    const form = $('#entry-form');
    const id = form.dataset.id;
    const data = {};
    for (const f of ALL_FIELDS) {
      const el = form.elements.namedItem(f);
      if (!el) continue;
      if (TYPES[f] === 'bool') data[f] = el.checked ? 'true' : 'false';
      else if (TYPES[f] === 'date') data[f] = isoToDd(el.value);
      else data[f] = el.value.trim();
    }
    if (data.Measurements) data.Measurements = measToCm(data.Measurements, form.elements.namedItem('Measurements-unit').value);
    data['Profession Category'] = professionCategories(data.Professions);
    if (!data.Name) { toast('Bitte einen Namen eingeben.', 'err'); $('[name="Name"]', form).focus(); return; }

    const dupe = entries.find(x => x._id !== id && keyOf(x) === keyOf(data));
    if (dupe && !confirm(`Es gibt bereits einen Eintrag „${dupe.Name}“ mit derselben Profil-URL bzw. demselben Namen. Trotzdem speichern?`)) return;

    const now = Date.now();
    const kept = new Set(splitList(data['Own Images']));
    const before = id ? splitList(v(byId(id), 'Own Images')) : [];
    const removed = [...before, ...formUploads].filter(r => !kept.has(r));
    formUploads = new Set();
    if (removed.length) deleteLocalImages(removed);
    if (id) {
      const e = byId(id);
      Object.assign(e, data, { _updated: now });
    } else {
      entries.push({ _id: uid(), _created: now, _updated: now, ...data });
    }
    saveQuiet(); refreshFilters(); render();
    dirty = false;
    const target = id || entries[entries.length - 1]._id;
    showDetail(target);
    toast(id ? 'Gespeichert.' : 'Eintrag angelegt.', 'ok');
  }

  function showHelp() {
    openModal(`
      <div class="modal-head"><h2>Anleitung</h2><div class="actions"><button class="x" data-action="close">×</button></div></div>
      <div class="help">
        <h3>Profile von Babepedia übernehmen</h3>
        <ol>
          <li>Installiere das Userscript <code>babepedia-organizer.user.js</code> in Tampermonkey.</li>
          <li>Auf einer Profilseite auf <strong>➕ Add</strong> klicken, auf einer Listenseite auf <strong>🚀 Auto Fetch All</strong>.</li>
          <li>Dieses Tool öffnen (Button <strong>🗂️ Tool öffnen</strong>) – gesammelte Profile werden automatisch übernommen.</li>
        </ol>
        <p>Bereits vorhandene Einträge werden anhand der Profil-URL erkannt und aktualisiert. Deine eigenen Felder (Favorite, My Rating, Tags, Notes) bleiben dabei erhalten.</p>
        <h3>Ohne Userscript</h3>
        <p>Über <em>Daten → Importieren</em> kannst du die CSV-Datei deines alten Skripts oder ein JSON-Backup einlesen.</p>
        <h3>Wo liegen die Daten?</h3>
        <p>Nur in diesem Browser (IndexedDB). Mach regelmäßig ein Backup über <em>Daten → Backup exportieren</em> – damit kannst du auch auf ein anderes Gerät umziehen.</p>
        <p id="storage-info" class="muted"></p>
        <h3>Bilder</h3>
        <p>Bilder werden nur verlinkt, nicht gespeichert. Wenn ein Bild nicht lädt, erscheinen die Initialen. Du kannst jederzeit eigene Bild-URLs eintragen.</p>
      </div>`);
    if (navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then(({ usage, quota }) => {
        const mb = (x) => (x / 1048576).toLocaleString('de-DE', { maximumFractionDigits: 1 }) + ' MB';
        const el = $('#storage-info');
        if (el) el.textContent = `Belegt: ${mb(usage || 0)} von ${mb(quota || 0)} verfügbarem Speicher (${entries.length} Einträge).`;
      }).catch(() => {});
    }
  }

  function showRankerResult(r, total, expected) {
    const names = r.missing.map(u => { try { return decodeURIComponent(u.split('/babe/')[1] || u).replace(/_/g, ' '); } catch { return u; } });
    openModal(`
      <div class="modal-head"><h2>🏆 Ranker-Abgleich</h2><div class="actions"><button class="x" data-action="close">×</button></div></div>
      <div class="help">
        <p><strong>${r.on}</strong> Einträge sind im Ranker (${total} Profile in der Ranker-Liste${expected && expected !== total ? `, laut Babepedia ${expected}` : ''}).
        ${r.changed} Einträge wurden geändert.</p>
        ${names.length ? `<h3>${names.length} Profile aus der Ranker-Liste fehlen im Tool</h3>
          <p class="muted">Diese Profile sind im Ranker, aber (noch) nicht im Tool erfasst – z. B. über die Profilseite mit ➕ Add holen.</p>
          <ul>${names.map(n => `<li>${esc(n)}</li>`).join('')}</ul>` : '<p class="ok">✓ Alle Profile der Ranker-Liste sind im Tool vorhanden.</p>'}
      </div>`);
  }

  function lightbox(src) {
    const lb = document.createElement('div');
    lb.className = 'lightbox';
    lb.innerHTML = `<img src="${esc(src)}" alt="" referrerpolicy="no-referrer">`;
    lb.addEventListener('click', () => lb.remove());
    document.body.appendChild(lb);
  }

  function toast(msg, kind = '') {
    const t = document.createElement('div');
    t.className = 'toast ' + kind;
    t.textContent = msg;
    $('#toasts').appendChild(t);
    setTimeout(() => t.remove(), 4200);
  }

  function toggleFav(id) {
    const e = byId(id); if (!e) return;
    e.Favorite = isTrue(e.Favorite) ? 'false' : 'true';
    e._updated = Date.now();
    saveQuiet();
    if ($('#f-fav').checked) render(); else refreshItem(id);
    if (!overlay.hidden && $('.detail', modal)) showDetail(id);
  }

  // ---------- Aktionen ----------
  function action(name, el) {
    switch (name) {
      case 'new': showForm(); break;
      case 'edit': showForm(el.dataset.id); break;
      case 'to-ranker': openRankerSend([byId(el.dataset.id)]); break;
      case 'cancel-edit': if (!dirty || confirm('Ungespeicherte Änderungen verwerfen?')) { dirty = false; showDetail(el.dataset.id); } break;
      case 'save': saveForm(); break;
      case 'close': closeModal(); break;
      case 'delete': {
        const e = byId(el.dataset.id);
        if (e && confirm(`„${e.Name}“ wirklich löschen?`)) {
          entries = entries.filter(x => x._id !== e._id);
          deleteLocalImages(splitList(e['Own Images']));
          saveQuiet(); refreshFilters(); closeModal(true); render();
          toast('Eintrag gelöscht.');
        }
        break;
      }
      case 'import-file': $('#file-input').click(); break;
      case 'export-json':
        (async () => {
          const images = {};
          for (const r of entries.flatMap(e => splitList(e['Own Images']))) {
            const id = localId(r);
            const blob = await idbGet('img:' + id).catch(() => null);
            if (blob instanceof Blob) images[id] = await blobToDataUrl(blob);
          }
          download(`babe-organizer-backup-${stamp()}.json`, JSON.stringify({ app: 'bp-organizer', version: 2, exported: new Date().toISOString(), entries, images }, null, 1), 'application/json');
          const n = Object.keys(images).length;
          if (n) toast(`Backup mit ${n} eigenen Bildern erstellt.`, 'ok');
        })().catch(err => toast('Backup fehlgeschlagen: ' + (err.message || err), 'err'));
        break;
      case 'scan-images': scanImages(true); break;
      case 'find-dups': findDuplicates(); break;
      case 'export-csv':
        if (!entries.length) { toast('Keine Einträge zum Exportieren.', 'err'); break; }
        download(`babe-organizer-${entries.length}-profile.csv`, '﻿' + toCSV(entries), 'text/csv;charset=utf-8');
        break;
      case 'help': showHelp(); break;
      case 'clear-all':
        if (entries.length && confirm(`Alle ${entries.length} Einträge löschen? Mach vorher am besten ein Backup.`) && confirm('Wirklich sicher? Das lässt sich nicht rückgängig machen.')) {
          entries = []; saveQuiet(); refreshFilters(); render(); toast('Alle Einträge gelöscht.');
        }
        break;
    }
  }

  document.addEventListener('click', (ev) => {
    const t = ev.target;
    const menu = $('#menu');
    if (t.closest('#btn-menu')) { menu.hidden = !menu.hidden; return; }
    if (!t.closest('#menu')) menu.hidden = true;

    const rate = t.closest('[data-rate]');
    if (rate) { setRating(rate.dataset.id, rate.dataset.rate); return; }
    const fav = t.closest('[data-fav]');
    if (fav) { ev.stopPropagation(); toggleFav(fav.dataset.fav); return; }
    const act = t.closest('[data-action]');
    if (act) { menu.hidden = true; action(act.dataset.action, act); return; }
    const thumb = t.closest('[data-thumb]');
    if (thumb) {
      const main = $('.gallery .main', modal);
      main.innerHTML = `<img src="${esc(thumb.dataset.thumb)}" alt="" referrerpolicy="no-referrer">`;
      $$('.gallery .thumbs img', modal).forEach(i => i.classList.toggle('on', i === thumb));
      return;
    }
    if (t.closest('.gallery .main img')) { lightbox(t.src); return; }
    const setCover = t.closest('[data-set-cover]');
    if (setCover) {
      const e = byId(setCover.dataset.id);
      if (e) { e.Cover = setCover.dataset.setCover; e._updated = Date.now(); saveQuiet(); render(); showDetail(e._id); }
      return;
    }
    const full = t.closest('img[data-full]');
    if (full && !t.closest('.own-list')) { lightbox(R(full.dataset.full) || full.src); return; }
    if (full) { lightbox(full.src); return; }
    const catBtn = t.closest('[data-cat]');
    if (catBtn) { closeModal(true); $('#f-cat').value = catBtn.dataset.cat; render(); return; }
    const tag = t.closest('[data-tag]');
    if (tag) { closeModal(true); $('#q').value = tag.dataset.tag; render(); return; }
    const card = t.closest('[data-id].card, tr[data-id]');
    if (card) { showDetail(card.dataset.id); return; }
    if (t === overlay) closeModal();
  });

  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') {
      const lb = $('.lightbox'); if (lb) { lb.remove(); return; }
      if (!overlay.hidden) closeModal();
    }
    if ((ev.ctrlKey || ev.metaKey) && ev.key === 's' && $('#entry-form')) { ev.preventDefault(); saveForm(); }
  });

  $('#btn-new').addEventListener('click', () => showForm());
  $('#file-input').addEventListener('change', (ev) => {
    const f = ev.target.files[0];
    if (f) handleFile(f);
    ev.target.value = '';
  });
  let searchTimer = null;
  $('#q').addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(render, 180); });
  ['#f-nationality', '#f-hair', '#f-eyes', '#f-body', '#f-active', '#f-fav', '#f-rating', '#f-cat', '#f-ranker', '#f-missing'].forEach(s => $(s).addEventListener('input', render));
  // Bild-Filter: ungeprüfte Einträge im Hintergrund prüfen, Liste danach aktualisieren
  $('#f-missing').addEventListener('input', (ev) => { if (filterNeedsImages(ev.target.value)) scanImages(false); });
  $('#sort').addEventListener('change', (ev) => { ui.sort = ev.target.value; saveUI(); render(); });
  $$('.seg button').forEach(b => b.addEventListener('click', () => { ui.view = b.dataset.view; saveUI(); render(); }));
  $('#btn-to-ranker').addEventListener('click', () => openRankerSend(filtered()));
  $('#xf').addEventListener('input', (ev) => { const sel = ev.target.closest('[data-xf]'); if (!sel) return; xfVals[sel.dataset.xf] = sel.value; render(); });
  $('#btn-view-cfg').addEventListener('click', showViewSettings);
  applyFilterVisibility();
  $('#btn-reset').addEventListener('click', () => {
    $('#q').value = ''; Object.keys(FILTERS).forEach(id => $('#' + id).value = '');
    $('#f-active').value = ''; $('#f-rating').value = ''; $('#f-cat').value = ''; $('#f-ranker').value = ''; $('#f-missing').value = ''; $('#f-fav').checked = false;
    for (const k of Object.keys(xfVals)) delete xfVals[k];
    renderExtraFilters(); render();
  });

  // Daten per Drag & Drop importieren
  document.addEventListener('dragover', (ev) => ev.preventDefault());
  document.addEventListener('drop', (ev) => {
    ev.preventDefault();
    const f = ev.dataTransfer.files[0];
    if (f && /^image\//.test(f.type)) { toast('Bilder bitte im Bearbeiten-Formular bei „Eigene Bilder“ ablegen.'); return; }
    if (f) handleFile(f);
  });

  // GitHub-Sync: gleicht mit tool-daten/b-organizer/ ab (32 Teildateien), sobald auf der Startseite eingerichtet.
  // Eigene hochgeladene Bilder bleiben lokal, nur die Einträge werden abgeglichen.
  function initSync() {
    if (!window.ToolSync) return;
    SYNC = ToolSync.create({
      tool: 'b-organizer',
      collections: { entries: { type: 'array', id: '_id' } },
      shards: 32,
      stampDelay: 1500,
      get: () => ({ entries }),
      apply: async (d) => {
        entries = (d.entries || []).filter(e => e && typeof e === 'object').map(derive);
        try { await save(); } catch { return false; }
        refreshFilters(); render();
        return true;
      }
    });
    SYNC.start();
  }

  // ===================== IMAGE RANKER: Einträge senden + Ranker-Stand anzeigen =====================
  // Übergabe über die gemeinsame IndexedDB "tool-transfer" (Store "jobs"): der Babe Organizer legt einen Auftrag ab,
  // der Image Ranker arbeitet ihn mit seiner eigenen Logik ab (ranker-inbox.js). Kein Tool schreibt in die Datenbank des anderen.
  // Rückweg: der Babe Organizer liest den Ranker read-only und merkt sich Tier/Score im eigenen Feld "_ranker" (wird mit synchronisiert).
  const RK_UI_KEY = 'bp-organizer-ranker';            // gemerkte Auswahl pro Ranker-Reiter (klein)
  const RK_TIERS = [[97, 'S+'], [93, 'S'], [90, 'S-'], [87, 'A+'], [83, 'A'], [80, 'A-'], [75, 'B+'], [70, 'B'], [65, 'B-'], [55, 'C+'], [45, 'C'], [35, 'C-'], [25, 'D+'], [15, 'D'], [5, 'D-'], [0, 'F']];
  const RK_COLORS = { S: '#ff4d4d', A: '#ffa500', B: '#e6c800', C: '#00cc00', D: '#3399ff', F: '#9933ff' };
  const transferChannel = 'BroadcastChannel' in window ? new BroadcastChannel('tool-transfer') : null;
  const isMobileDevice = () => /iPhone|iPad|Android/.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));

  function transferDb() {
    return new Promise((res, rej) => {
      const r = indexedDB.open('tool-transfer', 1);
      r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains('jobs')) r.result.createObjectStore('jobs', { keyPath: 'id' }); };
      r.onsuccess = () => { const d = r.result; d.onversionchange = () => d.close(); res(d); };
      r.onerror = () => rej(r.error || new Error('Übergabe-Speicher nicht verfügbar'));
    });
  }
  function rkPrefs() { try { return JSON.parse(localStorage.getItem(RK_UI_KEY) || '{}') || {}; } catch { return {}; } }
  function rkSavePrefs(p) { try { localStorage.setItem(RK_UI_KEY, JSON.stringify(p)); } catch (e) { toast('Auswahl konnte nicht gemerkt werden (Speicher voll?)', 'err'); } }
  function rankerTabs() {
    let t = null; try { t = JSON.parse(localStorage.getItem('ranker.tabs') || 'null'); } catch {}
    return Array.isArray(t) && t.length ? t : ['Standard'];
  }
  const rkTier = (score) => (RK_TIERS.find(([m]) => score >= m) || RK_TIERS[RK_TIERS.length - 1])[1];
  const rkColor = (tier) => RK_COLORS[tier[0]] || '#888';
  const rankerBadge = (e, cls = 'badge') => e._ranker ? `<span class="${cls} rk-tier" style="--rk:${rkColor(e._ranker.tier)}" title="Image Ranker: ${esc(e._ranker.tab)} · Platz ${e._ranker.rank} von ${e._ranker.total} · Score ${e._ranker.score}">${esc(e._ranker.tier)} · ${e._ranker.score}</span>` : '';

  // Felder, die als Ranker-Eigenschaften in Frage kommen, mit vorgeschlagenem Typ
  const RK_MULTI = new Set(['Professions', 'Profession Category', 'Tags', 'AKA']);
  const RK_FIELDS = [...GROUPS[0].fields, ...GROUPS[1].fields, 'My Rating', 'Favorite', 'Tags', 'Global Rating', 'User Rating', 'Alter']
    .filter((f, i, a) => a.indexOf(f) === i && !['Name', 'Exact Birthdate'].includes(f))
    .flatMap(f => f === 'Born' ? ['Born', 'Geburtsjahr'] : [f]);      // „Geburtsjahr“ = nur die Jahreszahl aus Born
  const RK_NUMBERS = new Set(['Alter', 'Geburtsjahr']);
  const rkType = (f) => RK_MULTI.has(f) ? 'multi' : (RK_NUMBERS.has(f) || TYPES[f] === 'num') ? 'number' : 'exact';
  function rkValues(e, f, type) {
    if (f === 'Alter') { const a = age(e); return a == null ? [] : [String(a)]; }
    if (f === 'Geburtsjahr') { const m = String(v(e, 'Born')).match(/(\d{4})$/); return m ? [m[1]] : []; }
    const raw = v(e, f);
    if (!raw) return [];
    if (type === 'multi') return splitList(raw);
    if (type === 'number') { const n = num(raw); return n == null ? [] : [String(n)]; }
    if (TYPES[f] === 'bool') return [isTrue(raw) ? 'Ja' : 'Nein'];
    return [raw];
  }

  // Babepedia-Bilder über das Userscript holen (der Browser selbst darf sie nicht herunterladen)
  let fetchReady = null;
  function userscriptCanFetch() {
    if (fetchReady) return fetchReady;
    fetchReady = new Promise(res => {
      const t = setTimeout(() => { window.removeEventListener('message', on); res(false); }, 1500);
      function on(ev) { if (ev.origin === location.origin && ev.data && ev.data.type === 'BP_FETCH_ACK') { clearTimeout(t); window.removeEventListener('message', on); res(true); } }
      window.addEventListener('message', on);
      window.postMessage({ type: 'BP_FETCH_PING' }, location.origin);
    }).then(ok => { if (!ok) fetchReady = null; return ok; });
    return fetchReady;
  }
  let fetchSeq = 0;
  function fetchViaUserscript(url) {
    return new Promise(res => {
      const id = 'f' + (++fetchSeq) + '-' + Date.now();
      const t = setTimeout(() => { window.removeEventListener('message', on); res(null); }, 30000);
      function on(ev) {
        const d = ev.data;
        if (ev.origin !== location.origin || !d || d.type !== 'BP_FETCH_RESULT' || d.id !== id) return;
        clearTimeout(t); window.removeEventListener('message', on);
        res(d.buf && d.buf.byteLength > 500 ? new Blob([d.buf], { type: d.mime || 'image/jpeg' }) : null);
      }
      window.addEventListener('message', on);
      window.postMessage({ type: 'BP_FETCH_IMAGE', id, url }, location.origin);
    });
  }
  async function imageForTransfer(ref, canFetch) {
    if (isLocal(ref)) { const b = await idbGet('img:' + localId(ref)).catch(() => null); return b instanceof Blob ? { blob: b } : null; }
    if (!/^https?:\/\//i.test(ref)) return null;
    if (canFetch && /babepedia\.com|archive\.org/i.test(ref)) { const b = await fetchViaUserscript(ref); if (b) return { blob: b, url: ref }; }
    try { const r = await fetch(ref, { mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer' }); if (r.ok) { const b = await r.blob(); if (/^image\//.test(b.type)) return { blob: b, url: ref }; } } catch {}
    return { url: ref };   // als Link anlegen
  }

  // Holt für den Ranker ein Bild, das wirklich lädt: zuerst das gewählte, dann die übrigen Bilder des Eintrags
  // (jeweils groß), zuletzt die Vorschaubilder. Ohne Userscript bleibt nur ein Link auf das gewählte Bild.
  async function bestImageForTransfer(e, startIdx, canFetch) {
    const list = images(e);
    if (!list.length) return null;
    const order = [startIdx, ...list.keys()].filter((x, i, a) => x != null && x < list.length && a.indexOf(x) === i);
    let first = null;
    for (const i of order) {
      const img = await imageForTransfer(list[i], canFetch);
      if (img && img.blob) { recordImg(e._id, 'ok'); return img; }
      if (!first) first = img;
    }
    if (canFetch) {
      for (const i of order) {
        const full = R(list[i]), th = thumbUrl(full);
        if (th === full) continue;
        const img = await imageForTransfer(th, canFetch);
        if (img && img.blob) { recordImg(e._id, 'ok'); return img; }
      }
      recordImg(e._id, 'none');
      return { url: (first && first.url) || '', dead: true };   // nichts lädt
    }
    return first;   // Userscript nicht aktiv: nur als Link
  }

  // ---------- Dialog „An Image Ranker senden“ (Schritt 1: Auswahl, Schritt 2: Abgleich prüfen) ----------
  const rkNormUrl = (u) => { let s = String(u || '').trim(); try { s = decodeURIComponent(s); } catch {} return s.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[?#].*$/, '').replace(/\/+$/, '').replace(/[\s_]+/g, '_'); };
  const rkNormName = (n) => String(n || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

  // Bilder eines Ranker-Reiters lesen (nur lesend; ohne Bilddateien)
  function rankerOpenRO() {
    return new Promise(async res => {
      if (typeof indexedDB.databases === 'function') { const l = await indexedDB.databases().catch(() => []); if (!l.some(x => x.name === 'ImageRankerDB')) return res(null); }
      const r = indexedDB.open('ImageRankerDB');
      r.onupgradeneeded = () => { try { r.transaction.abort(); } catch {} };
      r.onerror = r.onblocked = () => res(null);
      r.onsuccess = () => { const d = r.result; d.onversionchange = () => d.close(); res(d.objectStoreNames.contains('images') ? d : (d.close(), null)); };
    });
  }
  async function rankerTabImages(tab) {
    const d = await rankerOpenRO(); if (!d) return [];
    return new Promise(res => {
      const out = [], c = d.transaction('images').objectStore('images').openCursor();
      c.onsuccess = () => { const k = c.result; if (!k) { d.close(); return res(out); } const i = k.value; if (i.tab === tab) out.push({ id: i.id, name: i.name || '', boId: i.boId || null, links: (i.links || []).map(l => l && l.url).filter(Boolean), elo: i.elo }); k.continue(); };
      c.onerror = () => { d.close(); res(out); };
    });
  }
  const thumbCache = new Map();
  async function rankerThumbs(ids) {
    const need = ids.filter(id => !thumbCache.has(id));
    if (need.length) {
      const d = await rankerOpenRO();
      if (d && d.objectStoreNames.contains('thumbs')) await new Promise(res => {
        const t = d.transaction('thumbs'), s = t.objectStore('thumbs');
        need.forEach(id => { const g = s.get(id); g.onsuccess = () => { const b = g.result && g.result.blob; thumbCache.set(id, b instanceof Blob ? URL.createObjectURL(b) : ''); }; });
        t.oncomplete = t.onerror = () => res();
      });
      if (d) d.close();
      need.forEach(id => { if (!thumbCache.has(id)) thumbCache.set(id, ''); });
    }
    return ids.map(id => thumbCache.get(id));
  }

  // Abgleich: pro Eintrag ein Vorschlag
  function matchEntries(list, rImgs) {
    const byLink = new Map(), byName = new Map(), byBo = new Map();
    for (const i of rImgs) {
      if (i.boId) byBo.set(i.boId, i);
      for (const l of i.links) { const k = rkNormUrl(l); if (!/babepedia\.com\/babe\//.test(k)) continue; if (!byLink.has(k)) byLink.set(k, []); byLink.get(k).push(i); }
      const n = rkNormName(i.name); if (n) { if (!byName.has(n)) byName.set(n, []); byName.get(n).push(i); }
    }
    const free = (arr, e) => (arr || []).filter(i => !i.boId || i.boId === e._id);
    return list.map(e => {
      const linked = byBo.get(e._id);
      if (linked) return { e, kind: 'linked', target: linked.id, cands: [linked] };
      const l = free(byLink.get(rkNormUrl(v(e, 'Profile URL'))), e);
      if (l.length === 1) return { e, kind: 'auto', target: l[0].id, cands: l };
      const names = [v(e, 'Name'), ...splitList(v(e, 'AKA'))].map(rkNormName).filter(Boolean);
      const n = [...new Set(names.flatMap(x => free(byName.get(x), e)))];
      const cands = l.length > 1 ? l : n;
      if (cands.length) return { e, kind: 'check', target: null, cands,   // unklar: nie ohne Klick verknüpfen
        why: l.length > 1 ? `${l.length} Bilder mit diesem Profil-Link` : 'gleicher Name' };
      return { e, kind: 'none', target: null, cands: [] };
    });
  }

  function openRankerSend(list) {
    list = list.filter(Boolean);
    if (!list.length) { toast('Keine Einträge ausgewählt.'); return; }
    const tabs = rankerTabs(), prefs = rkPrefs();
    let tab = prefs._lastTab && tabs.includes(prefs._lastTab) ? prefs._lastTab : tabs[0];
    const pick = new Map(list.map(e => [e._id, 0]));   // gewähltes Bild je Eintrag (Index in images(e))
    const single = list.length === 1;
    const fieldsHTML = (t) => {
      const sel = (prefs[t] && prefs[t].fields) || {};
      return RK_FIELDS.map(f => {
        const s = sel[f], type = (s && s.type) || rkType(f);
        return `<div class="rk-f"><label class="chk"><input type="checkbox" data-rk-f="${esc(f)}" ${s ? 'checked' : ''}> ${esc(f)}</label>
          <input type="text" data-rk-name="${esc(f)}" value="${esc((s && s.name) || f)}" title="Name der Eigenschaft im Ranker">
          <select data-rk-type="${esc(f)}">${['exact', 'multi', 'number'].map(x => `<option value="${x}" ${x === type ? 'selected' : ''}>${{ exact: 'exakt', multi: 'mehrfach', number: 'Zahl' }[x]}</option>`).join('')}</select></div>`;
      }).join('');
    };
    const imgsHTML = () => single
      ? `<div class="rk-imgs">${images(list[0]).map((u, i) => `<button type="button" class="rk-img ${pick.get(list[0]._id) === i ? 'on' : ''}" data-rk-pick="${i}"><img src="${esc(thumbUrl(R(u)))}" alt="" loading="lazy" referrerpolicy="no-referrer"></button>`).join('') || '<p class="muted">Dieser Eintrag hat keine Bilder.</p>'}</div>`
      : `<p class="muted">Pro Eintrag wird das Titelbild gesendet (nur bei neu angelegten Bildern). Antippen wechselt zum nächsten Bild.</p><div class="rk-list">${list.slice(0, 300).map(e => {
          const im = images(e), i = pick.get(e._id), u = im[i];
          return `<button type="button" class="rk-row" data-rk-cycle="${esc(e._id)}" title="${im.length > 1 ? 'Nächstes Bild' : ''}">${u ? `<img src="${esc(thumbUrl(R(u)))}" alt="" loading="lazy" referrerpolicy="no-referrer">` : '<span class="placeholder">–</span>'}<span>${esc(v(e, 'Name'))}${im.length > 1 ? ` <small class="muted">${i + 1}/${im.length}</small>` : ''}</span></button>`; }).join('')}${list.length > 300 ? `<p class="muted">… und ${list.length - 300} weitere</p>` : ''}</div>`;

    openModal(`
      <div class="modal-head"><h2>🏆 An Image Ranker senden</h2><div class="actions"><button class="x" data-action="close" aria-label="Schließen">×</button></div></div>
      <div class="rk-dialog" id="rk-step1">
        <p class="muted">${single ? esc(v(list[0], 'Name')) : `${list.length} Einträge`} · Im nächsten Schritt siehst du, welche Einträge schon im Ranker sind, bevor etwas passiert.</p>
        <h3>Reiter im Ranker</h3>
        <div class="rk-tabrow"><select id="rk-tab">${tabs.map(t => `<option ${t === tab ? 'selected' : ''}>${esc(t)}</option>`).join('')}<option value="__new">＋ Neuer Reiter…</option></select>
          <input type="text" id="rk-newtab" placeholder="Name des neuen Reiters" hidden></div>
        <label class="chk rk-linkonly"><input type="checkbox" id="rk-linkonly" ${prefs._linkOnly ? 'checked' : ''}> <b>Nur verknüpfen</b> – keine neuen Bilder anlegen</label>
        <h3>Bild <span class="muted" style="text-transform:none;letter-spacing:0">(für neu angelegte Bilder)</span></h3>
        <div id="rk-imgbox">${imgsHTML()}</div>
        <h3>Eigenschaften übernehmen</h3>
        <p class="muted">Werden im Ranker als Eigenschaften dieses Reiters angelegt bzw. aktualisiert. Die Auswahl wird pro Reiter gemerkt.</p>
        <div class="rk-fields" id="rk-fields">${fieldsHTML(tab)}</div>
        <div class="rk-foot"><span class="muted" id="rk-msg"></span><button class="btn primary" id="rk-next">Weiter: Abgleich prüfen</button></div>
      </div>
      <div class="rk-dialog" id="rk-step2" hidden></div>`);

    const readFields = () => {
      const out = {};
      $$('#rk-fields [data-rk-f]').forEach(c => { if (c.checked) { const f = c.dataset.rkF; out[f] = { name: ($(`[data-rk-name="${CSS.escape(f)}"]`).value || f).trim(), type: $(`[data-rk-type="${CSS.escape(f)}"]`).value }; } });
      return out;
    };
    const curTab = () => $('#rk-tab').value === '__new' ? $('#rk-newtab').value.trim() : $('#rk-tab').value;
    $('#rk-tab').addEventListener('change', () => {
      const nw = $('#rk-tab').value === '__new';
      $('#rk-newtab').hidden = !nw; if (nw) $('#rk-newtab').focus();
      prefs[tab] = Object.assign({}, prefs[tab], { fields: readFields() });
      tab = nw ? '' : $('#rk-tab').value;
      if (!nw) $('#rk-fields').innerHTML = fieldsHTML(tab);
    });
    $('#rk-imgbox').addEventListener('click', (ev) => {
      const p = ev.target.closest('[data-rk-pick]'), c = ev.target.closest('[data-rk-cycle]');
      if (p) pick.set(list[0]._id, Number(p.dataset.rkPick));
      else if (c) { const e = byId(c.dataset.rkCycle), n = images(e).length; if (n > 1) pick.set(e._id, (pick.get(e._id) + 1) % n); }
      else return;
      $('#rk-imgbox').innerHTML = imgsHTML();
    });

    $('#rk-next').addEventListener('click', async () => {
      const t = curTab();
      if (!t) { $('#rk-msg').textContent = 'Bitte einen Reiter wählen oder benennen.'; return; }
      const fields = readFields(), linkOnly = $('#rk-linkonly').checked;
      prefs[t] = Object.assign({}, prefs[t], { fields }); prefs._lastTab = t; prefs._linkOnly = linkOnly; rkSavePrefs(prefs);
      $('#rk-next').disabled = true; $('#rk-msg').textContent = 'Lese den Ranker…';
      const rImgs = await rankerTabImages(t);
      const rows = matchEntries(list, rImgs);
      // Entscheidung je Eintrag: 'link' (target), 'new', 'skip'
      rows.forEach(r => { r.dec = r.target ? 'link' : (r.kind === 'none' && !linkOnly ? 'new' : 'skip'); });
      $('#rk-step1').hidden = true;
      renderStep2(t, fields, linkOnly, rows, rImgs);
    });

    async function renderStep2(t, fields, linkOnly, rows, rImgs) {
      const box = $('#rk-step2'); box.hidden = false;
      const g = (k) => rows.filter(r => r.kind === k);
      const thumbsFor = async (ids) => { const urls = await rankerThumbs(ids); return new Map(ids.map((id, i) => [id, urls[i]])); };
      const candIds = [...new Set(rows.flatMap(r => r.cands.map(c => c.id)))];
      const th = await thumbsFor(candIds);
      const imgOf = (id) => th.get(id) ? `<img src="${th.get(id)}" alt="">` : '<span class="placeholder">?</span>';
      const nameOf = (id) => (rImgs.find(i => i.id === id) || {}).name || ('#' + id);
      const entryCell = (e) => { const u = images(e)[pick.get(e._id)]; return `<div class="rk-ent">${u ? `<img src="${esc(thumbUrl(R(u)))}" alt="" referrerpolicy="no-referrer" loading="lazy">` : '<span class="placeholder">–</span>'}<span>${esc(v(e, 'Name'))}</span></div>`; };
      const rowHTML = (r) => {
        const opts = r.cands.map(c => `<button type="button" class="rk-cand ${r.dec === 'link' && r.target === c.id ? 'on' : ''}" data-rk-row="${esc(r.e._id)}" data-rk-target="${c.id}" title="${esc(c.name)}">${imgOf(c.id)}<span>${esc(c.name)}</span></button>`).join('');
        return `<div class="rk-rev" data-rk-rowbox="${esc(r.e._id)}">${entryCell(r.e)}<span class="rk-arrow">→</span>
          <div class="rk-cands">${opts}
            ${r.dec === 'link' && !r.cands.some(c => c.id === r.target) ? `<button type="button" class="rk-cand on" data-rk-row="${esc(r.e._id)}" data-rk-target="${r.target}">${imgOf(r.target)}<span>${esc(nameOf(r.target))}</span></button>` : ''}
            <button type="button" class="btn small" data-rk-search="${esc(r.e._id)}">🔍 Bild suchen…</button>
            ${linkOnly ? '' : `<button type="button" class="btn small ${r.dec === 'new' ? 'on' : ''}" data-rk-new="${esc(r.e._id)}">＋ Neu anlegen</button>`}
            <button type="button" class="btn small ${r.dec === 'skip' ? 'on' : ''}" data-rk-skip="${esc(r.e._id)}">Überspringen</button>
            ${r.why ? `<span class="muted small">${esc(r.why)}</span>` : ''}
          </div></div>`;
      };
      const sec = (title, arr, open, desc) => arr.length ? `<details class="rk-sec" ${open ? 'open' : ''}><summary><b>${title}</b> (${arr.length})</summary>${desc ? `<p class="muted">${desc}</p>` : ''}${arr.map(rowHTML).join('')}</details>` : '';
      const counts = () => { const c = { link: 0, new: 0, skip: 0 }; rows.forEach(r => c[r.dec]++); return c; };
      const draw = () => {
        const c = counts();
        box.innerHTML = `
          <p class="muted">Reiter „${esc(t)}“ · ${rImgs.length} Bilder im Ranker${linkOnly ? ' · <b>Nur verknüpfen</b>' : ''}. Verknüpfte Einträge behalten Bild, Elo und Duelle im Ranker; nur Eigenschaften und Link werden aktualisiert.</p>
          ${sec('⚠ Bitte prüfen', g('check'), true, 'Nur der Name passt oder mehrere Bilder haben denselben Profil-Link. Ohne Klick werden sie übersprungen – richtiges Bild antippen, um zu verknüpfen.')}
          ${sec('Kein Treffer', g('none'), true, linkOnly ? 'Kein passendes Bild gefunden. Von Hand suchen oder überspringen.' : 'Kein passendes Bild gefunden. Werden neu angelegt, außer du wählst ein Bild oder überspringst.')}
          ${sec('✓ Automatisch über den Profil-Link', g('auto'), false)}
          ${sec('✓ Bereits verknüpft', g('linked'), false)}
          <div class="rk-foot"><button class="btn ghost" id="rk-back">← Zurück</button><span class="muted" id="rk-msg2">${c.link} verknüpfen · ${c.new} neu · ${c.skip} überspringen</span>
            <button class="btn primary" id="rk-send" ${c.link + c.new ? '' : 'disabled'}>Ausführen</button></div>`;
      };
      draw();
      box.onclick = async (ev) => {
        const el = ev.target.closest('[data-rk-target],[data-rk-new],[data-rk-skip],[data-rk-search],#rk-back,#rk-send,[data-rk-hit]');
        if (!el) return;
        const rowOf = (id) => rows.find(r => r.e._id === id);
        if (el.id === 'rk-back') { box.hidden = true; $('#rk-step1').hidden = false; $('#rk-next').disabled = false; $('#rk-msg').textContent = ''; return; }
        if (el.id === 'rk-send') return execute(t, fields, linkOnly, rows);
        if (el.dataset.rkTarget) { const r = rowOf(el.dataset.rkRow); r.dec = 'link'; r.target = Number(el.dataset.rkTarget); }
        else if (el.dataset.rkNew) { const r = rowOf(el.dataset.rkNew); r.dec = 'new'; r.target = null; }
        else if (el.dataset.rkSkip) { const r = rowOf(el.dataset.rkSkip); r.dec = 'skip'; r.target = null; }
        else if (el.dataset.rkSearch) { return openSearch(rowOf(el.dataset.rkSearch)); }
        const open = [...box.querySelectorAll('details')].map(d => d.open);
        draw(); [...box.querySelectorAll('details')].forEach((d, i) => { if (open[i] !== undefined) d.open = open[i]; });
      };
      // Von Hand ein Ranker-Bild suchen (nach Name), mit Vorschaubildern
      async function openSearch(r) {
        const used = new Set(rows.filter(x => x !== r && x.dec === 'link').map(x => x.target));
        const pool = rImgs.filter(i => (!i.boId || i.boId === r.e._id) && !used.has(i.id));
        const holder = box.querySelector(`[data-rk-rowbox="${CSS.escape(r.e._id)}"]`);
        let q = v(r.e, 'Name').split(/\s+/)[0] || '';
        const paint = async () => {
          const nq = rkNormName(q);
          const hits = pool.filter(i => !nq || rkNormName(i.name).includes(nq)).slice(0, 24);
          const tm = await thumbsFor(hits.map(i => i.id));
          const res = holder.querySelector('.rk-hits');
          if (res) res.innerHTML = hits.map(i => `<button type="button" class="rk-cand" data-rk-row="${esc(r.e._id)}" data-rk-target="${i.id}">${tm.get(i.id) ? `<img src="${tm.get(i.id)}" alt="">` : '<span class="placeholder">?</span>'}<span>${esc(i.name)}</span></button>`).join('') || '<span class="muted">Nichts gefunden.</span>';
        };
        holder.insertAdjacentHTML('beforeend', `<div class="rk-search"><input type="search" placeholder="Name im Ranker suchen…" value="${esc(q)}"><div class="rk-hits"></div></div>`);
        const inp = holder.querySelector('.rk-search input');
        inp.addEventListener('input', () => { q = inp.value; paint(); });
        inp.focus(); paint();
      }
    }

    async function execute(t, fields, linkOnly, rows) {
      const send = rows.filter(r => r.dec === 'link' || (r.dec === 'new' && !linkOnly));
      const dupTargets = send.filter(r => r.dec === 'link').map(r => r.target).filter((x, i, a) => a.indexOf(x) !== i);
      if (dupTargets.length) { $('#rk-msg2').textContent = 'Ein Ranker-Bild ist mehreren Einträgen zugeordnet – bitte korrigieren.'; return; }
      const nNew = send.filter(r => r.dec === 'new').length;
      if (nNew > 200 && !confirm(`${nNew} neue Bilder anlegen? Die Bilder werden einzeln geholt, das kann einige Minuten dauern.`)) return;
      $('#rk-send').disabled = true;
      const canFetch = nNew ? await userscriptCanFetch() : false;
      const items = []; let links = 0, noImg = 0; const dead = [];
      for (let k = 0; k < send.length; k++) {
        const r = send[k], e = r.e;
        $('#rk-msg2').textContent = `Bereite vor… ${k + 1} / ${send.length}`;
        const props = Object.entries(fields).map(([f, s]) => ({ name: s.name || f, type: s.type, values: rkValues(e, f, s.type) }));
        const base = { boId: e._id, name: v(e, 'Name'), profileUrl: v(e, 'Profile URL'), props };
        if (r.dec === 'link') { items.push(Object.assign(base, { linkTo: r.target, create: false })); continue; }
        const img = await bestImageForTransfer(e, pick.get(e._id), canFetch);
        if (!img || img.dead) { noImg++; dead.push(items.length); } else if (!img.blob) links++;
        items.push(Object.assign(base, { create: true, blob: img && img.blob || null, url: img && !img.dead && img.url || '' }));
      }
      // Einträge, bei denen kein einziges Bild lädt: nachfragen statt stillschweigend ohne Bild anlegen
      if (dead.length) {
        const names = dead.map(i => items[i].name);
        const keep = confirm(`${dead.length} Eintr${dead.length === 1 ? 'ag hat' : 'äge haben'} kein Bild, das lädt:\n\n${names.slice(0, 15).join('\n')}${names.length > 15 ? `\n… und ${names.length - 15} weitere` : ''}\n\n[OK] = trotzdem ohne Bild im Ranker anlegen\n[Abbrechen] = diese weglassen (der Rest wird gesendet)`);
        if (!keep) {
          const drop = new Set(dead);
          for (let i = items.length - 1; i >= 0; i--) if (drop.has(i)) items.splice(i, 1);
          noImg = 0;
          if (!items.length) { $('#rk-send').disabled = false; $('#rk-msg2').textContent = 'Nichts mehr zu senden. Hinterlege zuerst ein Bild (z. B. „Eigene Bilder“ im Bearbeiten-Formular).'; return; }
        }
      }
      try {
        const d = await transferDb();
        await new Promise((res, rej) => { const tx = d.transaction('jobs', 'readwrite'); tx.objectStore('jobs').put({ id: 'bo-' + Date.now(), from: 'b-organizer', createdAt: Date.now(), tab: t, items }); tx.oncomplete = res; tx.onerror = tx.onabort = () => rej(tx.error); });
        d.close();
      } catch (err) { $('#rk-send').disabled = false; $('#rk-msg2').textContent = 'Übergabe fehlgeschlagen: ' + (err && err.message || err); return; }
      if (transferChannel) transferChannel.postMessage({ type: 'job' });
      closeModal(true);
      const sentNew = items.filter(x => x.create).length, nl = items.length - sentNew;
      const hints = [links ? `${links} nur als Link${canFetch ? '' : ' (Userscript nicht aktiv)'}` : '', noImg ? `${noImg} ohne Bild` : ''].filter(Boolean).join(', ');
      toast(`An „${t}“ übergeben: ${nl} verknüpfen, ${sentNew} neu${hints ? ' – ' + hints : ''}. Der Image Ranker übernimmt sie beim nächsten Öffnen.`, 'ok');
      rkOfferOpen();
    }
  }
  function rkOfferOpen() {
    const box = document.createElement('div');
    box.className = 'toast ok rk-open';
    box.innerHTML = '🏆 <a href="/Image-Ranker/" target="_blank" rel="noopener">Image Ranker öffnen</a>';
    $('#toasts').appendChild(box);
    setTimeout(() => box.remove(), 9000);
  }

  // ---------- Ranker-Stand lesen (read-only) und im Eintrag merken ----------
  async function readRankerStatus() {
    // Nur auf Geräten, auf denen der Image Ranker synchronisiert wird (nicht am Handy) – sonst würde ein
    // veralteter Ranker-Stand die Angaben aller Geräte überschreiben.
    let mobOk = false; try { mobOk = localStorage.getItem('ranker.syncOnMobile') === '1'; } catch {}
    if (isMobileDevice() && !mobOk) return;
    if (typeof indexedDB.databases !== 'function') return;
    const list = await indexedDB.databases().catch(() => []);
    if (!list.some(x => x.name === 'ImageRankerDB')) return;
    const imgs = await new Promise(res => {
      const r = indexedDB.open('ImageRankerDB');
      r.onupgradeneeded = () => { try { r.transaction.abort(); } catch {} };
      r.onerror = r.onblocked = () => res(null);
      r.onsuccess = () => {
        const d = r.result; d.onversionchange = () => d.close();
        if (!d.objectStoreNames.contains('images')) { d.close(); return res(null); }
        const out = [];
        const c = d.transaction('images').objectStore('images').openCursor();
        c.onsuccess = () => { const k = c.result; if (!k) { d.close(); return res(out); } const im = k.value; out.push({ id: im.id, tab: im.tab, elo: im.elo, boId: im.boId }); k.continue(); };
        c.onerror = () => { d.close(); res(null); };
      };
    });
    if (!imgs || !imgs.length) return;
    const byTab = new Map();
    imgs.forEach(i => { if (!byTab.has(i.tab)) byTab.set(i.tab, []); byTab.get(i.tab).push(i); });
    const status = new Map();
    for (const [t, arr] of byTab) {
      arr.sort((a, b) => b.elo - a.elo);
      const max = arr[0].elo, min = arr[arr.length - 1].elo;
      arr.forEach((i, k) => {
        if (!i.boId) return;
        const score = max === min ? 100 : Math.max(0, Math.min(100, Math.round((i.elo - min) / (max - min) * 100)));
        const s = { tab: t, imageId: i.id, rank: k + 1, total: arr.length, score, tier: max === min ? 'S' : rkTier(score) };
        const prev = status.get(i.boId);
        if (!prev || s.score > prev.score) status.set(i.boId, s);   // in mehreren Reitern: den besten zeigen
      });
    }
    let changed = 0;
    for (const e of entries) {
      const s = status.get(e._id) || null;
      const old = e._ranker || null;
      const same = (!s && !old) || (s && old && s.tab === old.tab && s.tier === old.tier && s.score === old.score && s.imageId === old.imageId);
      if (same) continue;
      if (s) e._ranker = s; else delete e._ranker;
      changed++;
    }
    if (changed) { saveQuiet(); refreshFilters(); render(); }
  }
  if (transferChannel) transferChannel.onmessage = (ev) => { if (ev.data && ev.data.type === 'done' && ready) readRankerStatus().catch(() => {}); };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && ready) readRankerStatus().catch(() => {}); });

  // Direktlink /b-organizer/#e=<id> (z. B. aus dem Image Ranker) öffnet den Eintrag
  function openFromHash() {
    const m = location.hash.match(/^#e=(.+)$/);
    if (!m || !ready) return;
    const id = decodeURIComponent(m[1]);
    history.replaceState(null, '', location.pathname + location.search);
    if (byId(id)) showDetail(id); else toast('Dieser Eintrag ist im Babe Organizer nicht (mehr) vorhanden.', 'err');
  }
  window.addEventListener('hashchange', openFromHash);

  // Änderungen aus anderen Tabs übernehmen
  if (channel) channel.onmessage = async () => { entries = await load(); await loadLocalImages().catch(() => {}); refreshFilters(); render(); };

  (async () => {
    $('#main').innerHTML = '<div class="empty"><p>Lade Daten…</p></div>';
    try {
      entries = await load();
      await loadLocalImages().catch(() => {});
      await loadImgCheck();
    } catch (e) {
      $('#main').innerHTML = `<div class="empty"><h2>Speicher nicht verfügbar</h2><p>${esc(e && e.message || e)}</p></div>`;
      return;
    }
    // Browser bitten, die Daten nicht automatisch zu löschen
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch {}
    ready = true;
    refreshFilters();
    render();
    initSync();
    readRankerStatus().catch(() => {});
    openFromHash();
    // Userscript informieren, dass das Tool bereit ist
    window.postMessage({ type: 'BP_TOOL_READY' }, location.origin);
  })();
})();
