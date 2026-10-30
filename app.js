/* Babe Organizer – läuft komplett im Browser, Daten liegen im localStorage. */
(() => {
  'use strict';

  // ---------- Schema (identisch zum Userscript) ----------
  const FIELDS = [
    'Name', 'AKA', 'Profile URL', 'Main Image URL',
    'Image 2 URL', 'Image 3 URL', 'Image 4 URL', 'User Upload Image URLs', 'Gallery Links', 'Scraped At',
    'Global Rating', 'Votes', 'User Rating', 'Rank', 'Highest Rank', 'Peakdays',
    'Born', 'Exact Birthdate', 'Died', 'Years active', 'Active', 'Active till', 'Birthplace',
    'Nationality', 'Ethnicity', 'Professions', 'Profession Category', 'Sexuality', 'Hair color',
    'Eye color', 'Height', 'Weight', 'Body type', 'Measurements', 'Bra/Cup',
    'Boobs', 'Tattoos', 'Piercings',
    'Website', 'Instagram', 'X / Twitter', 'TikTok', 'YouTube', 'Twitch',
    'IMDb', 'OnlyFans 1', 'OnlyFans 2', 'Fansly', 'Boobpedia Link'
  ];
  // Eigene Felder (werden vom Import nie überschrieben, außer der Import bringt selbst Werte mit)
  const OWN_FIELDS = ['Favorite', 'In Ranker', 'My Rating', 'Tags', 'Notes', 'Own Images', 'Cover'];
  const NO_CSV = new Set(['Own Images', 'Cover']); // lokale Bilder gibt es nur im Browser
  const ALL_FIELDS = [...FIELDS, ...OWN_FIELDS];

  const GROUPS = [
    { title: 'Allgemein', fields: ['Name', 'AKA', 'Born', 'Exact Birthdate', 'Died', 'Birthplace', 'Nationality', 'Ethnicity', 'Professions', 'Profession Category', 'Sexuality', 'Years active', 'Active', 'Active till'] },
    { title: 'Aussehen', fields: ['Hair color', 'Eye color', 'Height', 'Weight', 'Body type', 'Measurements', 'Bra/Cup', 'Boobs', 'Tattoos', 'Piercings'] },
    { title: 'Eigene Angaben', fields: ['Favorite', 'In Ranker', 'My Rating', 'Tags', 'Notes'] },
    { title: 'Babepedia', fields: ['Profile URL', 'Global Rating', 'Votes', 'User Rating', 'Rank', 'Highest Rank', 'Peakdays', 'Scraped At'] },
    { title: 'Bilder', fields: ['Own Images', 'Main Image URL', 'Image 2 URL', 'Image 3 URL', 'Image 4 URL', 'User Upload Image URLs', 'Gallery Links'] },
    { title: 'Links', fields: ['Website', 'Instagram', 'X / Twitter', 'TikTok', 'YouTube', 'Twitch', 'IMDb', 'OnlyFans 1', 'OnlyFans 2', 'Fansly', 'Boobpedia Link'] }
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
    } catch (e) {
      toast('Speichern fehlgeschlagen: ' + (e && e.message || e) + ' – bitte Backup exportieren!', 'err');
      throw e;
    }
  }
  // Für Klick-Aktionen: Fehler wird schon per Toast gemeldet
  const saveQuiet = () => save().catch(() => {});
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
  // Cover: nimmt das erste Bild; lädt es nicht (oder ist es winzig), wird automatisch das nächste probiert
  const coverTag = (e, cls = '') => {
    const list = images(e);
    const alt = v(e, 'Name');
    if (!list.length) return `<div class="placeholder">${esc(initials(alt))}</div>`;
    return `<img src="${esc(R(list[0]))}" alt="${esc(alt)}" class="${cls}" loading="lazy" referrerpolicy="no-referrer" data-fallback="${esc(initials(alt))}" data-alts="${esc(list.slice(1, 8).map(R).join('\n'))}">`;
  };
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
    }
  }, true);
  document.addEventListener('error', (ev) => {
    const img = ev.target;
    if (img.tagName === 'IMG' && nextAlt(img)) return;
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
  async function importItems(items) {
    let added = 0, updated = 0, skipped = 0;
    const index = new Map(entries.map(e => [keyOf(e), e]));
    const now = Date.now();
    for (const raw of items) {
      if (!raw || typeof raw !== 'object') { skipped++; continue; }
      const item = {};
      for (const f of ALL_FIELDS) if (raw[f] !== undefined && raw[f] !== null) item[f] = String(raw[f]).trim();
      if (!item.Name) { skipped++; continue; }
      const k = keyOf(item);
      const existing = index.get(k);
      if (existing) {
        for (const f of ALL_FIELDS) if (item[f]) existing[f] = item[f];
        existing._updated = now;
        derive(existing);
        updated++;
      } else {
        const e = { _id: raw._id || uid(), _created: raw._created || now, _updated: now };
        for (const f of ALL_FIELDS) e[f] = item[f] || '';
        if (!e.Favorite) e.Favorite = 'false';
        derive(e);
        entries.push(e);
        index.set(k, e);
        added++;
      }
    }
    refreshFilters();
    render();
    await save();
    return { added, updated, skipped };
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
    toast(`Import: ${r.added} neu, ${r.updated} aktualisiert${r.skipped ? `, ${r.skipped} übersprungen` : ''}.`, 'ok');
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
        toast(`Von Babepedia übernommen: ${r.added} neu, ${r.updated} aktualisiert.`, 'ok');
      }).catch(() => toast('Übernahme fehlgeschlagen – die Profile bleiben im Userscript gespeichert.', 'err'));
    }
  });

  // ---------- Filter & Sortierung ----------
  const FILTERS = { 'f-nationality': 'Nationality', 'f-hair': 'Hair color', 'f-eyes': 'Eye color', 'f-body': 'Body type' };

  function refreshFilters() {
    refreshCatFilter();
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

  function filtered() {
    const q = $('#q').value.trim().toLowerCase();
    const terms = q ? q.split(/\s+/) : [];
    const fv = Object.fromEntries(Object.entries(FILTERS).map(([id, f]) => [f, $('#' + id).value]));
    const act = $('#f-active').value;
    const fav = $('#f-fav').checked;
    const rf = $('#f-rating').value;
    const cf = $('#f-cat').value;
    const rk = $('#f-ranker').value;

    let list = entries.filter(e => {
      if (fav && !isTrue(e.Favorite)) return false;
      if (cf && !catList(e).includes(cf)) return false;
      if (rk && String(isTrue(e['In Ranker'])) !== rk) return false;
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

    const by = {
      name: (a, b) => v(a, 'Name').localeCompare(v(b, 'Name'), 'de'),
      created: (a, b) => (b._created || 0) - (a._created || 0),
      updated: (a, b) => (b._updated || 0) - (a._updated || 0),
      global: (a, b) => (num(b['Global Rating']) ?? -1) - (num(a['Global Rating']) ?? -1),
      mine: (a, b) => (num(b['My Rating']) ?? -1) - (num(a['My Rating']) ?? -1),
      rank: (a, b) => (num(a.Rank) ?? 1e9) - (num(b.Rank) ?? 1e9),
      young: (a, b) => (age(a) ?? 999) - (age(b) ?? 999),
      old: (a, b) => (age(b) ?? -1) - (age(a) ?? -1),
      height: (a, b) => (num(b.Height) ?? -1) - (num(a.Height) ?? -1),
      site: (a, b) => (num(b['User Rating']) ?? -1) - (num(a['User Rating']) ?? -1),
      diff: (a, b) => { const ad = (x) => { const d = ratingDiff(x).d; return d === undefined ? -1 : Math.abs(d); }; return ad(b) - ad(a); }
    }[ui.sort] || ((a, b) => 0);
    return list.sort((a, b) => by(a, b) || v(a, 'Name').localeCompare(v(b, 'Name'), 'de'));
  }

  // ---------- Darstellung ----------
  function metaLine(e) {
    const a = age(e);
    return [natDisplay(e), a !== null ? `${a} J.` : '', v(e, 'Height') ? v(e, 'Height') + ' cm' : ''].filter(Boolean).join(' · ');
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

    if (ui.view === 'table') {
      main.innerHTML = `<div class="table-wrap"><table><thead><tr>
        <th></th><th>Name</th><th>Nationality</th><th>Profession Category</th><th>Alter</th><th>Height</th><th>Hair color</th><th>Measurements</th><th>Global Rating</th><th>Rank</th><th>User Rating</th><th>My Rating</th><th>Δ</th><th>🏆</th><th>★</th>
        </tr></thead><tbody>${list.map(e => `<tr data-id="${esc(e._id)}">
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
        </tr>`).join('')}</tbody></table></div>`;
      return;
    }

    main.innerHTML = `<div class="grid">${list.map(e => `
      <article class="card" data-id="${esc(e._id)}">
        <button class="fav-btn ${isTrue(e.Favorite) ? 'on' : ''}" data-fav="${esc(e._id)}" title="Favorit">${isTrue(e.Favorite) ? '♥' : '♡'}</button>
        <div class="img">${coverTag(e)}
          <div class="badges">
            ${v(e, 'Global Rating') ? `<span class="badge rating">★ ${esc(v(e, 'Global Rating'))}</span>` : ''}
            ${v(e, 'Rank') ? `<span class="badge">#${esc(v(e, 'Rank'))}</span>` : ''}
            ${ratingBadge(e)}
            ${isTrue(e['In Ranker']) ? '<span class="badge ranker" title="Im Image-Ranker">🏆</span>' : ''}
          </div>
        </div>
        <div class="body">
          <div class="name">${esc(v(e, 'Name'))}</div>
          <div class="meta">${esc(metaLine(e)) || '&nbsp;'}</div>
        </div>
      </article>`).join('')}</div>`;
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
  const byId = (id) => entries.find(e => e._id === id);

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
    saveQuiet(); render(); showDetail(id);
  }

  function showDetail(id) {
    const e = byId(id); if (!e) return;
    const imgs = images(e);
    const skip = new Set(['Name', 'AKA', 'Exact Birthdate', 'Favorite', 'Tags', 'Notes', 'Profile URL']);
    const sec = (title, fields) => {
      const rows = fields.filter(f => !skip.has(f)).map(f => [f, fmtValue(e, f)]).filter(([, x]) => x !== '');
      if (!rows.length) return '';
      return `<div class="sec"><h3>${title}</h3><dl class="kv">${rows.map(([f, x]) => `<div><dt>${esc(f)}</dt><dd>${esc(x)}</dd></div>`).join('')}</dl></div>`;
    };
    const links = ['Profile URL', ...LINK_FIELDS].filter(f => /^https?:\/\//i.test(v(e, f)));
    const galleries = splitList(e['Gallery Links']).filter(u => /^https?:\/\//i.test(u));
    const tags = splitList(e.Tags);

    openModal(`
      <div class="modal-head">
        <h2>${esc(v(e, 'Name'))}</h2>
        <div class="actions">
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
            ${isTrue(e['In Ranker']) ? '<span class="chip ranker">🏆 im Ranker</span>' : ''}
            ${catList(e).map(c => `<button class="chip cat" data-cat="${esc(c)}" title="Alle aus diesem Bereich anzeigen">${esc(c)}</button>`).join('')}
            ${tags.map(t => `<button class="chip tag" data-tag="${esc(t)}">#${esc(t)}</button>`).join('')}
          </div>
          ${ratingBox(e)}
          ${v(e, 'Notes') ? `<div class="sec"><h3>Notizen</h3><div class="notes">${esc(v(e, 'Notes'))}</div></div>` : ''}
          ${sec('Allgemein', GROUPS[0].fields)}
          ${sec('Aussehen', GROUPS[1].fields)}
          ${sec('Babepedia', GROUPS[3].fields)}
          ${imgs.length ? `<div class="sec"><h3>Bilder (${imgs.length})</h3><div class="img-grid">${imgs.map((u, i) => `<div class="img-cell"><img src="${esc(R(u))}" alt="" loading="lazy" referrerpolicy="no-referrer" data-full="${esc(u)}" data-fallback="✕">${isLocal(u) ? '<span class="img-own" title="Eigenes Bild">📁</span>' : ''}<button class="img-cover-btn ${i === 0 ? 'on' : ''}" data-set-cover="${esc(u)}" data-id="${esc(e._id)}" title="${i === 0 ? 'Aktuelles Cover' : 'Als Cover verwenden'}">★</button></div>`).join('')}</div></div>` : ''}
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
      const type = /URL|Link|Website|Instagram|Twitter|TikTok|YouTube|Twitch|IMDb|OnlyFans|Fansly/.test(f) ? 'url' : 'text';
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
    saveQuiet(); render();
    if (!overlay.hidden && $('.detail', modal)) showDetail(id);
  }

  // ---------- Aktionen ----------
  function action(name, el) {
    switch (name) {
      case 'new': showForm(); break;
      case 'edit': showForm(el.dataset.id); break;
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
  ['#q', '#f-nationality', '#f-hair', '#f-eyes', '#f-body', '#f-active', '#f-fav', '#f-rating', '#f-cat', '#f-ranker'].forEach(s => $(s).addEventListener('input', render));
  $('#sort').addEventListener('change', (ev) => { ui.sort = ev.target.value; saveUI(); render(); });
  $$('.seg button').forEach(b => b.addEventListener('click', () => { ui.view = b.dataset.view; saveUI(); render(); }));
  $('#btn-reset').addEventListener('click', () => {
    $('#q').value = ''; Object.keys(FILTERS).forEach(id => $('#' + id).value = '');
    $('#f-active').value = ''; $('#f-rating').value = ''; $('#f-cat').value = ''; $('#f-ranker').value = ''; $('#f-fav').checked = false; render();
  });

  // Daten per Drag & Drop importieren
  document.addEventListener('dragover', (ev) => ev.preventDefault());
  document.addEventListener('drop', (ev) => {
    ev.preventDefault();
    const f = ev.dataTransfer.files[0];
    if (f && /^image\//.test(f.type)) { toast('Bilder bitte im Bearbeiten-Formular bei „Eigene Bilder“ ablegen.'); return; }
    if (f) handleFile(f);
  });

  // Änderungen aus anderen Tabs übernehmen
  if (channel) channel.onmessage = async () => { entries = await load(); await loadLocalImages().catch(() => {}); refreshFilters(); render(); };

  (async () => {
    $('#main').innerHTML = '<div class="empty"><p>Lade Daten…</p></div>';
    try {
      entries = await load();
      await loadLocalImages().catch(() => {});
    } catch (e) {
      $('#main').innerHTML = `<div class="empty"><h2>Speicher nicht verfügbar</h2><p>${esc(e && e.message || e)}</p></div>`;
      return;
    }
    // Browser bitten, die Daten nicht automatisch zu löschen
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch {}
    ready = true;
    refreshFilters();
    render();
    // Userscript informieren, dass das Tool bereit ist
    window.postMessage({ type: 'BP_TOOL_READY' }, location.origin);
  })();
})();
