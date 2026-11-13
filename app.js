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
  const OWN_FIELDS = ['Favorite', 'In Ranker', 'My Rating', 'Tags', 'Notes', 'Own Images', 'Cover',
    'Face Score', 'Body Score', 'Hot Score', 'Cute Score', 'Sympathy Score', 'Score', 'My Rating (old)', 'Profile Deleted', 'Deleted Since', 'Cover Checked'];
  const NO_CSV = new Set(['Own Images', 'Cover']); // lokale Bilder gibt es nur im Browser
  const ALL_FIELDS = [...FIELDS, ...OWN_FIELDS];

  const GROUPS = [
    { title: 'Allgemein', fields: ['Name', 'AKA', 'Born', 'Exact Birthdate', 'Died', 'Birthplace', 'Nationality', 'Ethnicity', 'Professions', 'Profession Category', 'Sexuality', 'Years active', 'Active', 'Active till'] },
    { title: 'Aussehen', fields: ['Hair color', 'Eye color', 'Height', 'Weight', 'Body type', 'Measurements', 'Bra/Cup', 'Boobs', 'Tattoos', 'Piercings'] },
    { title: 'Eigene Angaben', fields: ['Favorite', 'Face Score', 'Body Score', 'Hot Score', 'Cute Score', 'Sympathy Score', 'Score', 'My Rating (old)', 'Tags', 'Notes', 'Cover Checked'] },   // "In Ranker" bleibt in den Daten, wird aber nicht mehr angezeigt
    { title: 'Babepedia', fields: ['Profile URL', 'Profile Deleted', 'Deleted Since', 'Archive URL', 'Babe ID', 'Global Rating', 'Votes', 'User Rating', 'Rank', 'Highest Rank', 'Peakdays', 'Scraped At'] },
    { title: 'Bilder', fields: ['Own Images', 'Main Image URL', 'Image 2 URL', 'Image 3 URL', 'Image 4 URL', 'User Upload Image URLs', 'Gallery Links'] },
    { title: 'Links', fields: ['Website', 'Instagram', 'X / Twitter', 'TikTok', 'YouTube', 'Twitch', 'IMDb', 'OnlyFans 1', 'OnlyFans 2', 'Fansly', 'Thronly', 'Boobpedia Link'] }
  ];
  const LINK_FIELDS = GROUPS[5].fields;

  const TYPES = {
    'Born': 'date', 'Died': 'date', 'Scraped At': 'date',
    'Exact Birthdate': 'bool', 'Active': 'bool', 'Favorite': 'bool', 'In Ranker': 'bool', 'Profile Deleted': 'bool', 'Deleted Since': 'date', 'Cover Checked': 'bool',
    'Tattoos': ['n/a', 'Ja', 'Nein'], 'Piercings': ['n/a', 'Ja', 'Nein'],
    'Boobs': ['', 'Real/Natural', 'Fake/Enhanced', 'Real (Removed implants)', 'Unknown'],
    'Height': 'num', 'Weight': 'num', 'Global Rating': 'num', 'Votes': 'num', 'User Rating': 'num',
    'Rank': 'num', 'Highest Rank': 'num', 'Peakdays': 'num', 'Years active': 'num', 'Active till': 'num',
    'My Rating': 'num', 'My Rating (old)': 'num', 'Score': 'num',
    'Face Score': 'score', 'Body Score': 'score', 'Hot Score': 'score', 'Cute Score': 'score', 'Sympathy Score': 'score',
    'User Upload Image URLs': 'area', 'Gallery Links': 'area', 'Notes': 'area'
  };
  const HINTS = {
    'Height': 'in cm', 'Weight': 'in kg', 'Measurements': 'Brust-Taille-Hüfte, z. B. 86-61-89', 'Bra/Cup': 'nur Cup, z. B. D',
    'Tags': 'kommagetrennt', 'My Rating': '1–10, wird aus den Kategorien berechnet, sobald Gesicht, Body und Hot/Cute bewertet sind', 'Score': 'berechnet (1–10 mit Nachkomma)', 'My Rating (old)': 'Bewertung vor dem Kategorie-System', 'Face Score': '1–5, inkl. Haare', 'Body Score': '1–5', 'Hot Score': '1–5', 'Cute Score': '1–5', 'Sympathy Score': '1–5, 2,5 = unbekannt/wirkt durchschnittlich (Leitfaden in der Detailansicht)', 'User Rating': 'deine Bewertung auf Babepedia', 'Years active': 'Startjahr', 'Active till': 'Endjahr, falls inaktiv',
    'User Upload Image URLs': 'kommagetrennt', 'Gallery Links': 'kommagetrennt',
    'Exact Birthdate': 'aus = nur Jahr bekannt', 'Professions': 'kommagetrennt, wie auf Babepedia'
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
      'sudanese': 'SD', 'surinamese': 'SR', 'surinamer': 'SR', 'svalbard': 'SJ', 'swazi': 'SZ', 'swedish': 'SE', 'swiss': 'CH',
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
  // Namen, die selbst „and“ enthalten, vor dem Zerlegen schützen
  const NAT_KEEP = [[/turks\s*(?:and|&)\s*caicos\s*islanders?/gi, 'Turks and Caicos Islander']];
  const natNames = (e) => NAT_KEEP.reduce((t, [re, name]) => t.replace(re, name.replace(/ and /g, '\u0001')), String(e.Nationality || ''))
    .split(/[,/&]+|\s+and\s+/i)
    .map(x => x.replace(/\u0001/g, ' and '))
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
      ['Science / Health / Education', ['Cybersecurity expert', 'Dentist', 'Doctor - Physician', 'Nurse', 'Professor', 'Programmer', 'Science Communicator', 'Sex Therapist', 'Teacher', 'Veterinarian']],
      ['Business / Law / Politics', ['Activist', 'Barrister', 'Business Woman', 'Lawyer', 'Military Personnel', 'Political Commentator', 'Politician', 'Realtor', 'Royalty']],
      ['Creative & Design', ['Artist', 'Author', 'Fashion Designer', 'Graphic Designer', 'Photographer', 'Writer']],
      ['Service & Hospitality', ['Barista', 'Bartender', 'Beautician', 'Flight Attendant', 'Hairdresser', 'Hooters Girl', 'Nail Designer']],
      ['Sonstige', ['Housewife', 'Paranormal Investigator', 'Student', 'Trucker']]
  ];
  // Für Werte, die (noch) nicht in der Liste stehen: Regeln nach Wortbestandteilen
  const PROFESSION_RULES = [
      [/sportswoman|athlete|player|boxer|fighter|skater|racer|gymnast|swimmer|surfer|skier|wrestler|cyclist|runner/i, 'Athletics & Sports'],
      [/musician|singer|rapper|\bdj\b|pop idol|band/i, 'Music'],
      [/scientist|engineer|doctor|physician|biologist|researcher|veterinar|pharmacist|psycholog|paramedic|midwife/i, 'Science / Health / Education'],
      [/porn|adult (film|actress)|onlyfans/i, 'Adult Industry'],
      [/hairdresser|hair ?stylist|barber|waitress|stewardess/i, 'Service & Hospitality'],
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
  // Nationalitäten zusammenlegen (gilt für vorhandene Einträge beim Laden und für alles, was neu reinkommt)
  // Babepedia nutzt British teils synonym zu den Landesteilen → alles als British (Irish bleibt Irish)
  const NAT_MERGE = { english: ['🇬🇧', 'British'], scottish: ['🇬🇧', 'British'], welsh: ['🇬🇧', 'British'], 'northern irish': ['🇬🇧', 'British'] };
  let deriveChanged = false;
  function mergeNationality(e) {
    const raw = String(e.Nationality || '');
    if (!raw || !Object.keys(NAT_MERGE).some(k => raw.toLowerCase().includes(k))) return;
    const seen = new Set(), out = [];
    for (const part of raw.split(/\s*,\s*/)) {
      const name = part.replace(/^[^A-Za-z]+/, '').trim();
      const m = NAT_MERGE[name.toLowerCase().replace(/^british\s+/, '')];   // auch „British Welsh“
      const hasFlag = part.trim() !== name;
      const tok = m ? (hasFlag ? `${m[0]} ${m[1]}` : m[1]) : part.trim();
      const key = (m ? m[1] : name).toLowerCase();
      if (!tok || seen.has(key)) continue;
      seen.add(key); out.push(tok);
    }
    const next = out.join(', ');
    if (next !== raw) { e.Nationality = next; deriveChanged = true; }
  }
  // Babepedia-Zusätze entfernen: „?–68.6–81.3 cm (B–W–H) · WHR 0.84“ → „?-69-81“, „F (32F US / 70H JP)“ → „F“
  function cleanMeasurements(x) {
    const t = String(x || '').trim();
    const m = t.replace(/,/g, '.').match(/^(\d+(?:\.\d+)?|\?)\s*[-–—]\s*(\d+(?:\.\d+)?|\?)\s*[-–—]\s*(\d+(?:\.\d+)?|\?)\s*(cm|in(?:ch(?:es)?)?|["″])?/i);
    if (!m || ![1, 2, 3].some(i => m[i] === '?')) return t;   // ohne „?“ kümmert sich measToCm/Zoll-Umrechnung
    const inch = /^(in|inch|inches|"|″)$/i.test(m[4] || '');
    if ([1, 2, 3].every(i => m[i] === '?')) return '';   // gar keine Angabe
    return [m[1], m[2], m[3]].map(v => v === '?' ? '?' : String(Math.round(parseFloat(v) * (inch ? INCH : 1)))).join('-');
  }
  function cleanCup(x) {
    const t = String(x || '').trim();
    const m = t.match(/^([A-Z]{1,3})\s*\(/);          // „F (32F US / 70H JP)“, „D (old cup size: B)“
    return m ? m[1] : t;
  }
  // Datum einer Archiv-Kopie (web.archive.org/web/YYYYMMDD…/) als DDMMYYYY
  const archiveDate = (u) => { const m = String(u || '').match(/web\.archive\.org\/web\/(\d{4})(\d{2})(\d{2})/i); return m ? m[3] + m[2] + m[1] : ''; };
  function cleanValues(e) {
    // „Rank 0“ ist ein Fehler auf Babepedia – lieber leer als 0
    for (const f of ['Rank', 'Highest Rank']) if (String(e[f] || '').trim() === '0') { e[f] = ''; deriveChanged = true; }
    for (const [f, fn] of [['Measurements', cleanMeasurements], ['Bra/Cup', cleanCup]]) {
      if (!e[f]) continue;
      const nx = fn(e[f]);
      if (nx !== e[f]) { e[f] = nx; deriveChanged = true; }
    }
  }
  // ---------- Bewertung nach Kategorien ----------
  // Gesamt = (2·Gesicht + 2·Body + max(Hot, Cute) + 0,1·min(Hot, Cute) + 1,5·Sympathie) / 6,5   (je 1–5)
  // 10er-Wert über scoreToTen (3 = typisch = 7 wie bisher auf Babepedia, ab 4,5 = 10, 1 = 1)
  const SCORE_CATS = [
    { f: 'Face Score', label: 'Gesicht', short: 'GES', hint: 'inkl. Haare', half: true, key: 'G' },
    { f: 'Body Score', label: 'Body', short: 'BOD', half: true, key: 'B' },
    { f: 'Hot Score', label: 'Hot', short: 'HOT', half: true, key: 'H' },
    { f: 'Cute Score', label: 'Cute', short: 'CUT', half: true, key: 'C' },
    { f: 'Sympathy Score', label: 'Sympathie', short: 'SYM', vals: [1, 2, 2.5, 3, 4, 5], key: 'S' }
  ];
  const SCORE_W = { face: 2, body: 2, hotcute: 1, minor: 0.1, sym: 1.5, div: 6.5, symDefault: 2.5 };
  // Leitfaden (nur Beschriftung): Bekannte nutzen 1–5, bei Unbekannten bewegt der Eindruck nur zwischen 2 und 3
  const SYMPATHY_LABELS = { 5: 'Bekannt: sehr sympathisch', 4: 'Bekannt: eher sympathisch', 3: 'Bekannt: durchschnittlich sympathisch · Unbekannt: wirkt eher sympathisch',
    2.5: 'Unbekannt: wirkt durchschnittlich sympathisch', 2: 'Bekannt: eher unsympathisch · Unbekannt: wirkt eher unsympathisch', 1: 'Bekannt: sehr unsympathisch' };
  const SCORE_ANCHORS = '1 = schwach für meine Liste · 3 = typisch · 5 = gehört zu den Besten';
  // Gesamt (1–5) → 10er-Skala. Oberhalb von 3 (= typisch = 7) zählt jeder Punkt doppelt, darunter dreifach,
  // damit die Enden erreichbar sind: 4,5 → 10 · 4 → 9 · 3,5 → 8 · 3 → 7 · 2,5 → 5,5 · 2 → 4 · 1,5 → 2,5 · 1 → 1
  const scoreToTen = (t) => Math.max(1, Math.min(10, t >= 3 ? 7 + (t - 3) * 2 : 7 - (3 - t) * 3));
  function scoreOf(e) {
    const g = (f) => { const n = num(e[f]); return n == null || n < 1 || n > 5 ? null : n; };
    const F = g('Face Score'), B = g('Body Score'); let H = g('Hot Score'), C = g('Cute Score');
    if (F == null || B == null || (H == null && C == null)) return null;
    if (H == null) H = C; if (C == null) C = H;
    const S = g('Sympathy Score') ?? SCORE_W.symDefault;
    const total = (SCORE_W.face * F + SCORE_W.body * B + SCORE_W.hotcute * Math.max(H, C) + SCORE_W.minor * Math.min(H, C) + SCORE_W.sym * S) / SCORE_W.div;
    return { total, ten: scoreToTen(total), symAssumed: g('Sympathy Score') == null };
  }
  function applyScore(e) {
    const s = scoreOf(e);
    if (!s) {
      if (e.Score) e.Score = '';
      // direkte Bewertung gibt es nicht mehr: alten Wert aufheben
      if (v(e, 'My Rating')) { if (!v(e, 'My Rating (old)')) e['My Rating (old)'] = v(e, 'My Rating'); e['My Rating'] = ''; deriveChanged = true; }
      return;
    }
    const ten = (Math.round(s.ten * 10) / 10).toFixed(1);
    const first = !v(e, 'Score');
    e.Score = ten;
    const r = String(Math.round(s.ten));
    if (v(e, 'My Rating') !== r) {
      // alte Bewertung beim ersten Berechnen aufheben
      if (first && v(e, 'My Rating') && !v(e, 'My Rating (old)')) e['My Rating (old)'] = v(e, 'My Rating');
      e['My Rating'] = r;
    }
  }
  const hasScore = (e) => !!v(e, 'Score');
  // Profil-Status: ok · gone-archive (gelöscht, Archiv vorhanden) · gone (gelöscht, kein Archiv)
  // Ein Eintrag aus dem Internet Archive heißt immer: das Babepedia-Profil gab es und es ist gelöscht.
  function profileStatus(e) {
    // von Hand angelegt, nie auf Babepedia (z. B. Personen, die Babepedia nicht aufnimmt)
    if (!/babepedia\.com\/babe\//i.test(v(e, 'Profile URL')) && !v(e, 'Archive URL') && !isTrue(e['Profile Deleted'])) return 'none';
    if (!isTrue(e['Profile Deleted'])) return 'ok';
    return v(e, 'Archive URL') ? 'gone-archive' : 'gone';
  }
  const STATUS_LABEL = { none: 'kein Babepedia-Profil', ok: 'Profil vorhanden', 'gone-archive': 'auf Babepedia gelöscht – Archiv vorhanden', gone: 'auf Babepedia gelöscht – kein Archiv' };
  // Ältere Archiv-Einträge hatten die Archiv-Adresse als Profil-Adresse → Original-Adresse herausziehen, Status setzen
  function normalizeArchiveEntry(e) {
    const u = v(e, 'Profile URL');
    const m = u.match(/^https?:\/\/web\.archive\.org\/web\/[^/]+\/(https?:\/\/(?:www\.)?babepedia\.com\/babe\/.+)$/i);
    if (!m) return;
    if (!v(e, 'Archive URL')) e['Archive URL'] = u;
    e['Profile URL'] = m[1].replace(/^http:/, 'https:');
    e['Profile Deleted'] = 'true';
    deriveChanged = true;
  }
  const fmtScoreVal = (x) => x == null || x === '' ? '–' : String(x).replace('.5', '½').replace('.', ',');

  function derive(e) {
    if (!e._id) e._id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    applyScore(e);
    mergeNationality(e);
    cleanValues(e);
    normalizeArchiveEntry(e);
    e['Profession Category'] = professionCategories(e.Professions);
    if (looksLikeInches(e.Measurements)) e.Measurements = measToCm(e.Measurements, 'in');
    return e;
  }

  // Bewertungsvergleich: My Rating (Tool) vs. User Rating (Babepedia)
  // Bei gelöschten Profilen ist die alte Babepedia-Note bedeutungslos (nicht mehr änderbar, oft nur Platzhalter) → ignorieren
  const siteRating = (e) => isTrue(e['Profile Deleted']) ? null : num(e['User Rating']);
  function ratingDiff(e) {
    if (isTrue(e['Profile Deleted'])) return { state: 'gone' };
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
  let duels = [];   // Kategorie-Abgleich: { id, cat, a, b, va, vb, r: 'a'|'b'|'=', ts } – eigene Liste, wird mit synchronisiert
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
        // verschiedene Babe IDs schließen nichts aus: Babepedia legt Profile auch zusammen (alte Adresse leitet dann um)
        found.add(e);
      }
    }
    // Tippfehler in der alten Adresse (Grace_Bhattaria -> Grace_Bhattarai): ähnliche Schreibweise mit gleichem Anfang
    const base = baseSlugOf(item['Profile URL']), mx = typoMax(base.length);
    if (mx) for (const [b, e] of ix.byPrefix.get(base.slice(0, 3)) || []) {
      if (found.has(e) || b === base || normUrl(e['Profile URL']) === ownUrl) continue;
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
    if (a && b && a === b) return true;
    const r = await resolveProfile(old['Profile URL']);
    if (!r || !r.ok) return false;
    if (normUrl(r.finalUrl) === normUrl(item['Profile URL'])) return true;   // alte Adresse leitet hierher
    return !!(b && r.babeId && r.babeId === b);
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
      if (ia && ib && ia === ib) same = true;   // gleiche ID: kein Abruf nötig
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

  // ---- Von Hand zusammenführen (für Fälle, die Babepedia nicht belegt oder die Suche nicht findet) ----
  function showMerge(id) {
    const a = byId(id); if (!a) return;
    openModal(`
      <div class="modal-head"><h2>Zusammenführen</h2><div class="actions"><button class="x" data-action="close" aria-label="Schließen">×</button></div></div>
      <div class="help merge">
        <p>Mit welchem Eintrag ist <b>${esc(v(a, 'Name'))}</b> dasselbe Profil?</p>
        <input type="search" id="mg-q" placeholder="Name, AKA oder Teil der Babepedia-Adresse …" autocomplete="off">
        <div id="mg-list" class="mg-list"></div>
        <div id="mg-pick"></div>
      </div>`);
    const q = $('#mg-q'), list = $('#mg-list');
    const show = () => {
      const t = plain(q.value);
      const hits = t.length < 2 ? [] : entries.filter(x => x !== a && [v(x, 'Name'), v(x, 'AKA'), v(x, 'Profile URL')].some(s => plain(s).includes(t))).slice(0, 30);
      list.innerHTML = hits.map(x => `<button class="mg-item" data-mg="${esc(x._id)}">${coverTag(x)}<span><b>${esc(v(x, 'Name'))}</b><br><span class="muted">${esc((v(x, 'Profile URL').split('/babe/')[1] || v(x, 'Profile URL')))}${v(x, 'Babe ID') ? ' · ID ' + esc(v(x, 'Babe ID')) : ''}${x._ranker ? ' · 🏆 im Ranker' : ''}${hasScore(x) ? ' · ♥ ' + esc(v(x, 'Score')) : ''}</span></span></button>`).join('') || (t.length >= 2 ? '<p class="muted">Kein Treffer.</p>' : '');
    };
    q.addEventListener('input', show); q.focus();
    list.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-mg]'); if (!b) return;
      const other = byId(b.dataset.mg); if (!other) return;
      list.innerHTML = ''; q.hidden = true;
      const pair = [a, other];
      const defKeep = (other._ranker && !a._ranker) ? other : (a._ranker && !other._ranker) ? a : ((a._created || 0) <= (other._created || 0) ? a : other);
      const defData = ((num(v(a, 'Babe ID')) || 0) >= (num(v(other, 'Babe ID')) || 0)) ? a : other;   // höhere Babe ID = neueres Profil
      const opt = (name, x, def, extra) => `<label class="chk mg-opt"><input type="radio" name="${name}" value="${esc(x._id)}" ${x === def ? 'checked' : ''}> <span><b>${esc(v(x, 'Name'))}</b> <span class="muted">${esc(extra(x))}</span></span></label>`;
      $('#mg-pick').innerHTML = `
        <h3>Welcher Eintrag bleibt?</h3>
        <p class="muted">Er behält seine ID (und damit die Image-Ranker-Verknüpfung), Favorit, Kategorien und Notizen. Fehlende eigene Angaben kommen vom anderen, Notizen werden zusammengefügt. Der andere Eintrag wird gelöscht.</p>
        ${pair.map(x => opt('keep', x, defKeep, (y) => [y._ranker ? '🏆 im Ranker' : '', hasScore(y) ? '♥ ' + v(y, 'Score') : '', 'angelegt ' + new Date(y._created || 0).toLocaleDateString('de-DE')].filter(Boolean).join(' · '))).join('')}
        <h3>Babepedia-Adresse und -Daten von</h3>
        <p class="muted">Meist die aktuelle Adresse, auf die die alte weiterleitet.</p>
        ${pair.map(x => opt('data', x, defData, (y) => (v(y, 'Profile URL').split('/babe/')[1] || v(y, 'Profile URL')) + (v(y, 'Babe ID') ? ' · ID ' + v(y, 'Babe ID') : ''))).join('')}
        <p class="warn mg-warn" ${a._ranker && other._ranker ? '' : 'hidden'}>Beide sind im Image Ranker verknüpft – die Verknüpfung des gelöschten Eintrags geht verloren. Im Ranker danach prüfen.</p>
        <div class="form-foot"><button class="btn" data-action="close">Abbrechen</button><button class="btn primary" id="mg-go">Zusammenführen</button></div>`;
      $('#mg-go').addEventListener('click', async () => {
        const keep = byId($('#mg-pick input[name="keep"]:checked').value);
        const src = byId($('#mg-pick input[name="data"]:checked').value);
        const drop = keep === a ? other : a;
        if (drop._ranker && !keep._ranker && !confirm('Der Eintrag, der gelöscht wird, ist im Image Ranker verknüpft – diese Verknüpfung geht verloren. Trotzdem?')) return;
        if (src !== keep) for (const k of FIELDS) keep[k] = src[k] ?? '';   // Babepedia-Daten komplett vom gewählten Eintrag
        mergeOwn(keep, drop);
        keep['Profile Deleted'] = isTrue(src['Profile Deleted']) ? 'true' : ''; keep['Deleted Since'] = src['Deleted Since'] || '';
        keep._updated = Date.now(); derive(keep);
        entries = entries.filter(x => x !== drop);
        refreshFilters(); render();
        try { await save(); } catch (err) { toast('Speichern fehlgeschlagen: ' + (err && err.message || err), 'err'); return; }
        closeModal(true); showDetail(keep._id);
        toast(`Zusammengeführt – „${v(drop, 'Name')}“ ist jetzt Teil von „${v(keep, 'Name')}“.`, 'ok');
      });
    });
  }

  // ---------- Aktualisierungen prüfen ----------
  // Bei frisch geholten Babepedia-Profilen (ohne _id, also nicht aus einem Backup) werden Änderungen an
  // bekannten Einträgen nicht direkt geschrieben, sondern als „offen“ gemerkt (IndexedDB-Schlüssel
  // 'pending-updates' in bp-organizer, nur auf diesem Gerät) und können einzeln übernommen oder abgelehnt werden.
  const VOLATILE = ['Rank', 'Highest Rank', 'Votes', 'Global Rating', 'Peakdays', 'Scraped At'];
  // Diese Felder werden ohne Nachfrage gefüllt, wenn sie bisher leer waren (Kennung, keine inhaltliche Änderung)
  const FILL_IF_EMPTY = ['Babe ID'];
  const autoField = (e, f, val) => (ui.autoVolatile && VOLATILE.includes(f)) || (FILL_IF_EMPTY.includes(f) && !normVal(e[f]) && normVal(val));   // ändern sich ständig – auf Wunsch automatisch
  if (ui.reviewUpdates === undefined) ui.reviewUpdates = true;
  if (ui.autoVolatile === undefined) ui.autoVolatile = true;
  let pendingUpdates = [];   // [{ id, at, item: { Feld: neuer Wert } }]
  // Abgelehnte Werte merken ('rejected-updates': { id: { Feld: Wert } }), damit sie beim nächsten Holen nicht wieder auftauchen
  let rejectedUpdates = {};
  const updImgSig = (o) => IMAGE_FIELDS.map(f => normVal(o[f])).join('\n');
  async function loadPending() {
    try { pendingUpdates = (await idbGet('pending-updates')) || []; } catch { pendingUpdates = []; }
    try { rejectedUpdates = (await idbGet('rejected-updates')) || {}; } catch { rejectedUpdates = {}; }
    // Schon offene Änderungen: automatisch zu übernehmende Felder (z. B. Scraped At) jetzt eintragen
    if (pendingUpdates.length) {
      let changed = false, touched = false;
      for (const p of pendingUpdates) {
        const e = byId(p.id);
        for (const f of Object.keys(p.item)) if (e && autoField(e, f, p.item[f])) {
          if (e && normVal(e[f]) !== normVal(p.item[f])) { e[f] = p.item[f]; e._updated = Date.now(); touched = true; }
          delete p.item[f]; changed = true;
        }
      }
      if (changed) {
        pendingUpdates = pendingUpdates.filter(p => byId(p.id) && pendingDiff(p).length);
        try { await idbSet('pending-updates', pendingUpdates); if (touched) setTimeout(() => save().catch(() => {}), 1500); } catch {}
      }
    }
    updatePendingBtn();
  }
  async function savePendingUpdates() {
    try { await idbSet('pending-updates', pendingUpdates); await idbSet('rejected-updates', rejectedUpdates); }
    catch (err) { toast('Offene Aktualisierungen konnten nicht gespeichert werden: ' + (err && err.message || err), 'err'); throw err; }
    updatePendingBtn();
  }
  function updatePendingBtn() {
    const b = $('#btn-pending'); if (!b) return;
    const n = pendingUpdates.filter(p => byId(p.id) && pendingDiff(p).length).length;
    b.hidden = !n; b.style.display = n ? '' : 'none'; b.querySelector('.n').textContent = n;
  }
  const normVal = (x) => String(x ?? '').trim();
  // Unterschiede zwischen gespeichertem Eintrag und offenem Stand; Bildfelder als eine Gruppe
  function pendingDiff(p) {
    const e = byId(p.id); if (!e) return [];
    const out = [];
    let imgChanged = false;
    for (const [f, val] of Object.entries(p.item)) {
      if (normVal(val) === normVal(e[f])) continue;
      if (IMAGE_FIELDS.includes(f)) { imgChanged = true; continue; }
      out.push({ f, old: normVal(e[f]), neu: normVal(val) });
    }
    if (imgChanged) {
      const after = Object.assign({}, e); for (const f of IMAGE_FIELDS) if (p.item[f] !== undefined) after[f] = p.item[f];
      const a = images(e), b = images(after);
      const added = b.filter(u => !a.includes(u)), removed = a.filter(u => !b.includes(u));
      if (added.length || removed.length || v(after, 'Main Image URL') !== v(e, 'Main Image URL'))
        out.push({ f: '__images', added, removed, old: v(e, 'Main Image URL'), neu: v(after, 'Main Image URL') });
    }
    return out;
  }
  function applyPending(p, fields) {
    const e = byId(p.id); if (!e) return false;
    let n = 0;
    for (const f of fields) {
      const list = f === '__images' ? IMAGE_FIELDS : [f];
      for (const g of list) if (p.item[g] !== undefined && normVal(p.item[g]) !== normVal(e[g])) { e[g] = p.item[g]; n++; }
    }
    if (n) { e._updated = Date.now(); derive(e); }
    return n > 0;
  }
  function addPending(e, item) {
    // Neuen Stand so berechnen, wie er nach dem Übernehmen gespeichert würde (Zoll → cm usw.)
    const after = Object.assign({}, e);
    for (const f of ALL_FIELDS) if (item[f]) after[f] = item[f];
    derive(after);
    const vals = {};
    for (const f of ALL_FIELDS) if (item[f] || (after[f] !== e[f] && f === 'Profession Category')) vals[f] = after[f];
    // ständig wechselnde Werte gleich übernehmen
    for (const f of Object.keys(vals)) if (autoField(e, f, vals[f])) { if (normVal(e[f]) !== normVal(vals[f])) { e[f] = vals[f]; e._updated = Date.now(); } delete vals[f]; }
    const rej = rejectedUpdates[e._id];
    if (rej) {
      for (const f of Object.keys(vals)) if (!IMAGE_FIELDS.includes(f) && rej[f] !== undefined && normVal(rej[f]) === normVal(vals[f])) delete vals[f];
      if (rej.__images !== undefined && IMAGE_FIELDS.some(f => vals[f] !== undefined) && rej.__images === updImgSig(Object.assign({}, e, vals))) IMAGE_FIELDS.forEach(f => delete vals[f]);
    }
    const p = { id: e._id, at: Date.now(), name: v(e, 'Name'), item: vals };
    if (!pendingDiff(p).length) return false;
    const old = pendingUpdates.find(x => x.id === e._id);
    if (old) { Object.assign(old.item, vals); old.at = p.at; } else pendingUpdates.push(p);
    return true;
  }

  function showPending() {
    const list = pendingUpdates.filter(p => byId(p.id)).map(p => ({ p, d: pendingDiff(p) })).filter(x => x.d.length);
    if (!list.length) { pendingUpdates = []; savePendingUpdates().catch(() => {}); toast('Keine offenen Aktualisierungen.'); return; }
    const LBL = { '__images': 'Bilder' };
    const short = (x) => x.length > 80 ? esc(x.slice(0, 80)) + '…' : esc(x);
    const thumbs = (urls, cls) => urls.slice(0, 8).map(u => `<img class="${cls}" src="${esc(thumbUrl(R(u)))}" alt="" loading="lazy" referrerpolicy="no-referrer">`).join('') + (urls.length > 8 ? ` +${urls.length - 8}` : '');
    const row = (c, i) => c.f === '__images'
      ? `<label class="pu-row"><input type="checkbox" data-f="__images" checked><span class="pu-f">Bilder</span>
          <span class="pu-img">${c.added.length ? `<span class="pu-new">+${c.added.length}</span> ${thumbs(c.added, 'add')}` : ''}${c.removed.length ? ` <span class="pu-old">−${c.removed.length}</span> ${thumbs(c.removed, 'rem')}` : ''}${!c.added.length && !c.removed.length ? 'anderes Titelbild' : ''}</span></label>`
      : `<label class="pu-row"><input type="checkbox" data-f="${esc(c.f)}" checked><span class="pu-f">${esc(LBL[c.f] || c.f)}</span>
          <span class="pu-v">${c.old ? `<s class="pu-old">${short(c.old)}</s> → ` : '<span class="muted">(leer)</span> → '}<span class="pu-new">${short(c.neu)}</span></span></label>`;
    openModal(`
      <div class="modal-head"><h2>Aktualisierungen prüfen</h2><div class="actions"><button class="x" data-action="close" aria-label="Schließen">×</button></div></div>
      <div class="help pu">
        <p class="muted">Diese Änderungen kamen beim Holen bekannter Profile von Babepedia. Häkchen = Feld übernehmen. Abgelehnte Werte werden gemerkt und beim nächsten Holen nicht wieder angeboten (erst wenn Babepedia etwas anderes liefert). Was du nicht entscheidest, bleibt hier offen.</p>
        <div class="pu-bar">
          <span id="pu-count"></span>
          <button class="btn primary small" id="pu-all">Alle übernehmen</button>
          <button class="btn small" id="pu-none">Alle ablehnen</button>
        </div>
        <label class="chk"><input type="checkbox" id="pu-auto" ${ui.autoVolatile ? 'checked' : ''}> Rank, Votes, Global Rating, Peakdays und Scraped At automatisch übernehmen</label>
        <label class="chk"><input type="checkbox" id="pu-off" ${ui.reviewUpdates ? '' : 'checked'}> Künftig nicht mehr fragen – alle Änderungen direkt übernehmen</label>
        <div class="pu-list">${list.map(({ p, d }) => { const e = byId(p.id); return `
          <section class="pu-card" data-pu="${esc(p.id)}">
            <div class="pu-head">
              <div class="pu-thumb">${coverTag(e)}</div>
              <div class="pu-title"><button class="linklike" data-pu-open="${esc(p.id)}">${esc(v(e, 'Name'))}</button><span class="muted">${d.length} Änderung${d.length === 1 ? '' : 'en'} · ${new Date(p.at).toLocaleDateString('de-DE')}</span></div>
              <div class="pu-acts"><button class="btn small primary" data-pu-ok>Übernehmen</button><button class="btn small" data-pu-no>Ablehnen</button></div>
            </div>
            ${d.map(row).join('')}
          </section>`; }).join('')}</div>
      </div>`);
    const box = $('.pu', modal);
    const count = () => { const n = $$('.pu-card', box).length; $('#pu-count').textContent = `${n} Eintr${n === 1 ? 'ag' : 'äge'}`; if (!n) { closeModal(true); toast('Alle Aktualisierungen erledigt.', 'ok'); } };
    count();
    let dirty = false;
    const finish = async () => {
      updatePendingBtn();
      try { await savePendingUpdates(); if (dirty) { refreshFilters(); render(); await save(); dirty = false; } } catch {}
    };
    const decide = (card, accept) => {
      const id = card.dataset.pu, p = pendingUpdates.find(x => x.id === id);
      if (p) {
        const all = $$('input[data-f]', card).map(i => i.dataset.f);
        const fields = accept ? $$('input[data-f]:checked', card).map(i => i.dataset.f) : [];
        // nicht übernommene Werte als abgelehnt merken
        const rej = rejectedUpdates[id] || {};
        for (const f of all) if (!fields.includes(f)) {
          if (f === '__images') rej.__images = updImgSig(Object.assign({}, byId(id), p.item));
          else rej[f] = p.item[f];
        }
        if (Object.keys(rej).length) rejectedUpdates[id] = rej;
        if (accept && applyPending(p, fields)) { dirty = true; refreshItem(id); }
      }
      pendingUpdates = pendingUpdates.filter(x => x.id !== id);
      card.remove();
    };
    box.addEventListener('click', async (ev) => {
      const t = ev.target;
      const card = t.closest('.pu-card');
      if (t.closest('[data-pu-ok]')) { decide(card, true); await finish(); count(); }
      else if (t.closest('[data-pu-no]')) { decide(card, false); await finish(); count(); }
      else if (t.closest('[data-pu-open]')) { const id = t.closest('[data-pu-open]').dataset.puOpen; showDetail(id); }
    });
    $('#pu-all').addEventListener('click', async () => { if (!confirm('Alle angezeigten Änderungen (mit Häkchen) übernehmen?')) return; $$('.pu-card', box).forEach(c => decide(c, true)); await finish(); count(); });
    $('#pu-none').addEventListener('click', async () => { if (!confirm('Alle offenen Änderungen ablehnen? Die Einträge bleiben, wie sie sind.')) return; $$('.pu-card', box).forEach(c => decide(c, false)); await finish(); count(); });
    $('#pu-auto').addEventListener('change', (ev) => { ui.autoVolatile = ev.target.checked; saveUI(); });
    $('#pu-off').addEventListener('change', (ev) => { ui.reviewUpdates = !ev.target.checked; saveUI(); });
  }

  // Nur ein Tab übernimmt gleichzeitig (mehrere Tool-Tabs bekommen denselben Batch vom Skript)
  let entriesGen = 0;   // wird hochgezählt, wenn „entries“ von außen ersetzt wird (Cloud-Sync, anderer Tab)
  function withImportLock(fn) {
    return navigator.locks && navigator.locks.request ? navigator.locks.request('bp-organizer-import', fn) : fn();
  }
  async function importItems(items) {
    // Wird „entries“ während der Übernahme ersetzt (Sync aus der Cloud, anderer Tab hat gespeichert),
    // dürfen die Ergebnisse nicht verloren gehen: am Ende in den aktuellen Stand einarbeiten.
    const gen0 = entriesGen, touched = new Set(), dropped = new Set();
    let added = 0, updated = 0, skipped = 0, merged = 0, renamed = 0, pending = 0, gone = 0;
    const pendingBefore = JSON.stringify(pendingUpdates);
    if (items.length > 100) toast(`Übernehme ${items.length} Profile … bitte das Tool geöffnet lassen, bis die Bestätigung kommt.`);
    const index = new Map(entries.map(e => [keyOf(e), e]));
    const byId = new Map(entries.map(e => [e._id, e]));
    let ix = null;
    const now = Date.now();
    for (let raw of items) {
      if (!raw || typeof raw !== 'object') { skipped++; continue; }
      if (raw.__gone) {
        // Meldung vom Skript: Profil gibt es auf Babepedia nicht mehr
        const ex = index.get(keyOf(raw));
        if (ex) { touched.add(ex); if (!isTrue(ex['Profile Deleted'])) { ex['Profile Deleted'] = 'true'; ex['Deleted Since'] = v(raw, 'Scraped At'); ex._updated = Date.now(); gone++; } ex['Scraped At'] = v(raw, 'Scraped At') || ex['Scraped At']; }
        else skipped++;
        continue;
      }
      const item = {};
      for (const f of ALL_FIELDS) if (raw[f] !== undefined && raw[f] !== null) item[f] = String(raw[f]).trim();
      if (!item.Name) { skipped++; continue; }
      const k = keyOf(item);
      let existing = (raw._id && byId.get(raw._id)) || index.get(k);
      // Umbenanntes Profil? Nur für frisch geholte Babepedia-Profile (Backups bringen ihre _id mit).
      // Kandidaten (alter Name im AKA, andere Schreibweise, gleiche Babe ID) werden nur übernommen,
      // wenn Babepedia es belegt: gleiche Babe ID oder Weiterleitung der alten Adresse auf die neue.
      if (!raw._id && /\/babe\//.test(normUrl(item['Profile URL']))) {
        let old = null;
        // Das Skript hat beim Holen eine Weiterleitung gesehen (alte Adresse → diese) – das ist Beleg genug
        if (raw.__fromUrl) { const o = index.get(keyOf({ 'Profile URL': raw.__fromUrl })); if (o && o !== existing) old = o; }
        // Namens-Kandidaten nur für NEUE Profile prüfen. Bei bekannten Adressen würde das für jedes Profil
        // Abrufe bei Babepedia auslösen (2,5 s Abstand) und große Übernahmen stundenlang aufhalten –
        // dafür gibt es „Doppel-Einträge suchen“ und die Weiterleitungs-Meldung des Skripts.
        if (!old && !existing) {
          if (!ix) ix = buildRenameIndex();
          const cands = renameCandidates(item, existing, ix);
          for (const c of cands) { if (await sameProfile(c, item)) { old = c; break; } }
        }
        if (old) {
          const msg = `„${old.Name}“ und „${existing && existing.Name}“ sind dasselbe Babepedia-Profil (umbenannt, von Babepedia bestätigt).\n\nZusammenführen? Der ältere Eintrag „${old.Name}“ bleibt erhalten (mit Notizen, Bewertungen, Ranker-Verknüpfung) und bekommt die neuen Daten; „${existing && existing.Name}“ wird entfernt.`;
          if (!existing || confirm(msg)) {
            if (!existing) renamed++;
            if (existing && existing !== old) {
              mergeOwn(old, existing);
              entries = entries.filter(x => x !== existing); dropped.add(existing._id);
              index.delete(keyOf(existing)); byId.delete(existing._id);
              merged++;
            }
            index.delete(keyOf(old));
            existing = old;
            ix = null; // Index neu aufbauen, falls im selben Import noch mehr kommt
            raw = Object.assign({}, raw, { __direct: true });   // bestätigte Umbenennung: direkt übernehmen
          }
        }
      }
      if (existing) touched.add(existing);
      // aus dem Internet Archive geholt (Skript-Markierung oder Archiv-Adresse bei Babepedia-Übernahme)
      const fromArchive = !raw._id && (!!raw.__archive || !!v(raw, 'Archive URL'));
      if (fromArchive) {
        // aus dem Internet Archive geholt: Original-Profil ist gelöscht – direkt übernehmen, nicht zur Prüfung
        raw = Object.assign({}, raw, { __direct: true });
        const ad = archiveDate(v(raw, 'Archive URL'));
        if (ad) item['Scraped At'] = ad;   // Stand = Datum der Archiv-Kopie
        if (existing && !isTrue(existing['Profile Deleted'])) { existing['Profile Deleted'] = 'true'; existing._updated = now; }
      }
      if (existing && !raw._id && !fromArchive && isTrue(existing['Profile Deleted'])) { existing['Profile Deleted'] = ''; existing['Deleted Since'] = ''; existing._updated = Date.now(); }
      if (existing && !raw._id && !raw.__direct && ui.reviewUpdates) {
        // bekanntes Profil von Babepedia: Änderungen zur Prüfung vormerken
        if (addPending(existing, item)) pending++;
        index.set(keyOf(existing), existing);
        updated++;
      } else if (existing) {
        for (const f of ALL_FIELDS) if (item[f]) existing[f] = item[f];
        existing._updated = now;
        derive(existing);
        index.set(keyOf(existing), existing);
        updated++;
      } else {
        const e = { _id: raw._id || uid(), _created: raw._created || now, _updated: now };
        for (const f of ALL_FIELDS) e[f] = item[f] || '';
        if (!e.Favorite) e.Favorite = 'false';
        if (fromArchive) e['Profile Deleted'] = 'true';
        derive(e);
        entries.push(e); touched.add(e);
        index.set(k, e); byId.set(e._id, e);
        added++;
      }
    }
    if (entriesGen !== gen0) {
      // Stand wurde zwischendurch ausgetauscht → Babepedia-Felder der bearbeiteten Einträge übertragen
      const cur = new Map(entries.map(x => [x._id, x]));
      const KEEP = [...ALL_FIELDS, 'Profile Deleted', 'Deleted Since', 'Scraped At'];
      for (const t of touched) {
        const c = cur.get(t._id);
        if (!c) { if (!dropped.has(t._id)) entries.push(t); continue; }
        if (c === t) continue;
        for (const f of KEEP) if (t[f] !== undefined && !OWN_FIELDS.includes(f)) c[f] = t[f];
        for (const f of OWN_FIELDS) if (v(t, f) && !v(c, f)) c[f] = t[f];
        c._updated = Math.max(c._updated || 0, t._updated || 0); derive(c);
      }
      if (dropped.size) entries = entries.filter(x => !dropped.has(x._id));
    }
    // offene Änderungen zuerst sichern – erst danach bestätigt das Tool dem Userscript den Empfang
    if (JSON.stringify(pendingUpdates) !== pendingBefore) await savePendingUpdates();
    refreshFilters();
    render();
    await save();
    if (pending) setTimeout(() => { if (overlay.hidden) showPending(); else toast(`${pending} Einträge mit Änderungen – oben „Änderungen prüfen“.`); }, 300);
    return { added, updated, skipped, merged, renamed, pending, gone };
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
        if (data && Array.isArray(data.duels) && data.duels.length) {
          const have = new Set(duels.map(x => x.id)); let n = 0;
          for (const x of data.duels) if (x && x.id && !have.has(x.id)) { duels.push(x); n++; }
          if (n) { await saveDuels(); toast(`${n} Abgleich-Ergebnisse aus dem Backup übernommen.`, 'ok'); }
        }
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
    toast(`Import: ${r.added} neu, ${r.updated} bekannt${r.pending ? ` (${r.pending} mit Änderungen zum Prüfen)` : ''}${r.renamed ? `, ${r.renamed} umbenannt` : ''}${r.merged ? `, ${r.merged} zusammengeführt` : ''}${r.skipped ? `, ${r.skipped} übersprungen` : ''}.`, 'ok');
  }

  // ---------- Brücke zum Userscript ----------
  // Scraped At (Skript schreibt TTMMJJJJ) → Zeitstempel; ohne Datum = 0 (zuerst aktualisieren)
  function scrapedTs(e) {
    const x = v(e, 'Scraped At'); let m;
    if ((m = x.match(/^(\d{2})\.?(\d{2})\.?(\d{4})$/))) return Date.UTC(+m[3], +m[2] - 1, +m[1]);
    if ((m = x.match(/^(\d{4})-(\d{2})-(\d{2})/))) return Date.UTC(+m[1], +m[2] - 1, +m[3]);
    return 0;
  }
  // Dem Skript mitteilen, welche Profile schon im Tool sind (Ausgrauen auf Babepedia) und wann sie
  // zuletzt geholt wurden (für „🔁 Update – älteste zuerst“)
  // ---------- Update-Plan: rechtzeitig und in verträglichen Portionen aktualisieren ----------
  // Ziel: jedes aktive Babepedia-Profil spätestens alle `updInterval` Tage neu holen, pro Lauf höchstens `updMax`.
  // Empfohlen wird pro Woche mindestens die „Wochenmenge“ (aktive Profile · 7 / Rhythmus) der ältesten – auch wenn sie noch
  // nicht fällig sind. So zieht sich ein großer Block gleich alter Profile (z. B. nach einem Komplett-Update) von selbst auseinander.
  // Erinnert wird, wenn etwas überfällig ist oder in den letzten 7 Tagen weniger als die Wochenmenge geholt wurde –
  // höchstens einmal pro Tag (nach einem Lauf erst am nächsten Tag wieder), damit es nicht zu viel auf einmal wird.
  if (!ui.updInterval) ui.updInterval = 90;
  if (!ui.updMax) ui.updMax = 150;
  const isActiveLink = (e) => /^https?:\/\/(www\.)?babepedia\.com\/babe\//i.test(v(e, 'Profile URL')) && !isTrue(e['Profile Deleted']);
  function updatePlan() {
    const DAY = 864e5, now = Date.now(), iv = ui.updInterval * DAY;
    let active = 0, overdue = 0, soon = 0, oldest = Infinity, newest = 0, week = 0;
    for (const e of entries) {
      if (!isActiveLink(e)) continue;
      active++;
      const ts = scrapedTs(e);
      oldest = Math.min(oldest, ts); newest = Math.max(newest, ts);
      if (ts >= now - 7 * DAY) week++;
      if (ts < now - iv) overdue++;
      else if (ts < now - iv + 7 * DAY) soon++;
    }
    const perWeek = Math.ceil(active * 7 / ui.updInterval);
    const want = Math.min(active, Math.max(overdue + soon, perWeek - week));
    const sinceLast = newest ? Math.floor((now - newest) / DAY) : 999;
    const due = active > 0 && (overdue > 0 || (want >= Math.max(10, perWeek * 0.2) && sinceLast >= 1));
    const recommended = due ? Math.min(ui.updMax, want) : 0;
    return { active, overdue, soon, perWeek, week, want, sinceLast, recommended, oldest: oldest === Infinity ? 0 : oldest, interval: ui.updInterval, max: ui.updMax, runs: due ? Math.ceil(want / ui.updMax) : 0 };
  }
  function renderUpdateBanner() {
    const box = $('#upd-banner'); if (!box) return;
    const pl = updatePlan();
    let hide = false; try { hide = localStorage.getItem('bp-organizer-upd-hide') === new Date().toDateString(); } catch {}
    if (!pl.recommended || hide) { box.hidden = true; return; }
    box.hidden = false;
    const head = pl.overdue ? `${pl.overdue} Profile sind überfällig${pl.soon ? ` (+${pl.soon} diese Woche)` : ''}` : `Update fällig – in den letzten 7 Tagen ${pl.week} von ${pl.perWeek} Profilen der Wochenmenge geholt`;
    box.innerHTML = `<span>🔁 <b>${head}</b> – empfohlen: <b>${pl.recommended}</b> holen${pl.runs > 1 ? ` (noch ${pl.want} diese Woche, also ${pl.runs} Läufe à höchstens ${pl.max} an verschiedenen Tagen)` : ''}. Auf Babepedia: „🔁 Update“.</span>
      <span class="upd-acts"><button class="btn small" id="upd-cfg">Rhythmus…</button><button class="btn small ghost" id="upd-hide">Heute ausblenden</button></span>`;
    $('#upd-hide').onclick = () => { try { localStorage.setItem('bp-organizer-upd-hide', new Date().toDateString()); } catch {} box.hidden = true; };
    $('#upd-cfg').onclick = showUpdateSettings;
  }
  function showUpdateSettings() {
    const pl = updatePlan();
    openModal(`
      <div class="modal-head"><h2>Update-Rhythmus</h2><div class="actions"><button class="x" data-action="close" aria-label="Schließen">×</button></div></div>
      <div class="help">
        <p>${pl.active} Einträge haben ein aktives Babepedia-Profil. Das Tool erinnert, wenn Profile fällig werden, und empfiehlt dem Skript eine verträgliche Menge pro Lauf.</p>
        <div class="field"><label>Jedes Profil spätestens alle … Tage aktualisieren</label><input type="number" id="upd-iv" min="7" max="365" step="1" value="${ui.updInterval}"></div>
        <div class="field"><label>Höchstens … Profile pro Lauf</label><input type="number" id="upd-max" min="10" max="1000" step="10" value="${ui.updMax}"></div>
        <p class="muted" id="upd-info"></p>
      </div>
      <div class="form-foot"><button class="btn" data-action="close">Abbrechen</button><button class="btn primary" id="upd-save">Übernehmen</button></div>`);
    const info = () => {
      const iv = Math.max(7, +$('#upd-iv').value || 90), mx = Math.max(10, +$('#upd-max').value || 150);
      const pw = Math.ceil(pl.active * 7 / iv), runs = Math.ceil(pw / mx);
      $('#upd-info').textContent = `Das sind etwa ${pw} Profile pro Woche – also ${runs <= 1 ? 'ein Lauf' : runs + ' Läufe'} pro Woche (bei ca. 15 Profilen pro Minute rund ${Math.round(pw / 15)} Minuten insgesamt).`;
    };
    $('#upd-iv').addEventListener('input', info); $('#upd-max').addEventListener('input', info); info();
    $('#upd-save').addEventListener('click', () => {
      ui.updInterval = Math.max(7, Math.min(365, Math.round(+$('#upd-iv').value || 90)));
      ui.updMax = Math.max(10, Math.min(1000, Math.round(+$('#upd-max').value || 150)));
      saveUI(); closeModal(true); renderUpdateBanner(); sendKnown();
      toast('Update-Rhythmus gespeichert.', 'ok');
    });
  }

  function sendKnown(reqId) {
    const slugs = [], ids = [], stale = [];
    for (const e of entries) {
      const s = slugOf(e['Profile URL']); if (s) slugs.push(s);
      const id = v(e, 'Babe ID'); if (id) ids.push(String(id));
      const url = v(e, 'Profile URL');
      if (/^https?:\/\/(www\.)?babepedia\.com\/babe\//i.test(url) && !isTrue(e['Profile Deleted'])) stale.push([url, scrapedTs(e)]);
    }
    stale.sort((a, b) => a[1] - b[1]);
    window.postMessage({ type: 'BP_KNOWN', id: reqId || null, slugs, ids, count: entries.length, stale, plan: updatePlan() }, location.origin);
  }
  let bridgeQueue = Promise.resolve();
  window.addEventListener('message', (ev) => {
    if (ev.origin !== location.origin) return;
    const d = ev.data;
    if (!d || typeof d !== 'object') return;
    if (d.type === 'BP_PING' && ready) window.postMessage({ type: 'BP_TOOL_READY' }, location.origin);
    if (d.type === 'BP_KNOWN_REQ' && ready) sendKnown(d.id);
    if (d.type === 'BP_VOTE_PROG' && ready) bridgeQueue = bridgeQueue.then(() => onVoteProg(d)).catch(() => {});
    if (d.type === 'BP_SYNC' && Array.isArray(d.items) && ready) {
      // Bestätigung (ACK) erst nach erfolgreichem Speichern – sonst bleibt der Batch im Userscript erhalten
      bridgeQueue = bridgeQueue.then(() => withImportLock(async () => { entries = await load(); return importItems(d.items); })).then(r => {
        window.postMessage({ type: 'BP_SYNC_ACK', id: d.id, ...r }, location.origin);
        sendKnown();   // neuer Stand (z. B. Scraped At) gleich ans Skript
        toast(`Von Babepedia übernommen: ${r.added} neu, ${r.updated} bekannt${r.pending ? ` (${r.pending} mit Änderungen zum Prüfen)` : ''}${r.gone ? `, ${r.gone} auf Babepedia gelöscht` : ''}${r.renamed ? `, ${r.renamed} umbenannt` : ''}${r.merged ? `, ${r.merged} zusammengeführt` : ''}.`, 'ok');
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
  const CORE_FIELDS = [['Professions', 'Profession'], ['Nationality', 'Nationality'], ['Hair color', 'Hair Color'], ['Ethnicity', 'Ethnicity'], ['Born', 'Born'], ['Bra/Cup', 'Bra/Cup'], ['__img', 'Bild']];
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
    const sf = $('#f-status').value;

    const xf = Object.entries(xfVals).filter(([, x]) => x);
    let list = entries.filter(e => {
      if (statFilter && !statFilter.test(e)) return false;
      if (fav && !isTrue(e.Favorite)) return false;
      for (const [f, want] of xf) {
        const vals = xfValues(e, f);
        if (want === '__empty' ? vals.length : !vals.includes(want)) return false;
      }
      if (cf && !catList(e).includes(cf)) return false;
      if (sf) { const st = profileStatus(e); if (sf === 'gone-any' ? !st.startsWith('gone') : st !== sf) return false; }
      if (mf) {
        const miss = CORE_FIELDS.filter(([f]) => isMissing(e, f)).map(([f]) => f);
        if (mf === 'any') { if (!miss.length) return false; }
        else if (mf === 'none') { if (miss.length) return false; }
        else if (mf.startsWith('only:')) { if (miss.length !== 1 || miss[0] !== mf.slice(5)) return false; }
        else if (!miss.includes(mf)) return false;
      }
      // Ranker-Filter nur über die Verknüpfung mit dem Image Ranker (alte Werte tool/notool aus gespeicherten Filtern weiter verstehen)
      if (rk === 'stale') { if (!rankerStale.has(e._id)) return false; }
      else if (rk) { const want = rk === 'true' || rk === 'tool'; if (!!e._ranker !== want) return false; }
      if (rf) {
        const st = ratingDiff(e).state;
        if (rf === 'diff' && st !== 'diff') return false;
        if (rf === 'same' && st !== 'same') return false;
        if (rf === 'missing' && !(st === 'site-only' || st === 'mine-only')) return false;
        if (rf === 'site-only' && st !== 'site-only') return false;
        if (rf === 'mine-only' && st !== 'mine-only') return false;
        if (rf === 'none' && st !== 'none') return false;
        if (rf === 'scored' && !hasScore(e)) return false;
        if (rf === 'unscored' && hasScore(e)) return false;
        if (rf === 'sc-diff' && !(hasScore(e) && siteRating(e) != null && Number(v(e, 'My Rating')) !== siteRating(e))) return false;
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
      score: (e) => -(num(e.Score) ?? -1),
      rank: (e) => num(e.Rank) ?? 1e9,
      young: (e) => age(e) ?? 999,
      old: (e) => -(age(e) ?? -1),
      height: (e) => -(num(e.Height) ?? -1),
      ranker: (e) => e._ranker ? -(e._ranker.score + 1) : 1,
      site: (e) => -(num(e['User Rating']) ?? -1),
      diff: (e) => { const d = ratingDiff(e).d; return d === undefined ? 1 : -Math.abs(d); },
      random: (e) => shuffleKey(e._id),
      scraped: (e) => /babepedia\.com\/babe\//i.test(v(e, 'Profile URL')) && !isTrue(e['Profile Deleted']) ? scrapedTs(e) : 9e15   // wie „🔁 Update (älteste)“
    }[ui.sort] || (() => 0);
    return list.map(e => ({ e, k: key(e), n: v(e, 'Name') }))
      .sort((a, b) => (a.k - b.k) || collator.compare(a.n, b.n))
      .map(x => x.e);
  }

  // ---------- Darstellung ----------
  // ---------- Ansicht anpassen: Kachel-Inhalte und Filter ----------
  // Einstellungen liegen in ui (localStorage 'bp-organizer-ui', klein, pro Gerät)
  const DERIVED = ['Alter', 'Geburtsjahr'];
  // Anzeige-Namen (die Feldnamen in den Daten bleiben englisch)
  const FIELD_LABELS = {
    'Global Rating': 'Babepedia Ø', 'User Rating': 'Meine Babepedia-Note', 'Score': 'Tool-Note', 'My Rating': 'Tool-Note (gerundet)',
    'My Rating (old)': 'Alte eigene Note', 'Face Score': 'Gesicht', 'Body Score': 'Body', 'Hot Score': 'Hot', 'Cute Score': 'Cute', 'Sympathy Score': 'Sympathie',
    '__cats': 'Kategorien kompakt (G B H C S)', 'Profile Deleted': 'Babepedia-Profil gelöscht', 'Scraped At': 'Zuletzt von Babepedia geholt', 'Deleted Since': 'Gelöscht festgestellt am', '__status': 'Profil-Status', 'Cover Checked': 'Kachelbild geprüft'
  };
  const lab = (f) => FIELD_LABELS[f] || f;
  const CARD_FIELD_CHOICES = ['Cover Checked', 'Nationality', 'Alter', 'Geburtsjahr', 'Height', 'Weight', 'Measurements', 'Bra/Cup', 'Boobs', 'Hair color', 'Eye color', 'Body type',
    'Ethnicity', 'Professions', 'Profession Category', 'Birthplace', 'Born', 'Years active', 'Tattoos', 'Piercings', 'Sexuality', 'AKA', 'Tags',
    'Score', '__cats', 'Face Score', 'Body Score', 'Hot Score', 'Cute Score', 'Sympathy Score', 'User Rating', 'Global Rating', 'Votes', 'Rank', 'Highest Rank', 'Babe ID', 'Scraped At'];
  const CARD_BADGES = [['global', 'Ø Babepedia Ø'], ['rank', '# Rank'], ['rating', '♥ Tool-Note (mit Babepedia-Note)'], ['ranker', '🏆 Ranker-Tier'],
    ['fut', '🃏 Kategorien als Karte (Tool-Note + Werte)'], ['cover', '✓ Ecke „Kachelbild geprüft“']];
  const BUILTIN_FILTERS = [['f-nationality', 'Nationalität'], ['f-cat', 'Bereich'], ['f-hair', 'Haarfarbe'], ['f-eyes', 'Augenfarbe'], ['f-body', 'Figur'],
    ['f-active', 'Aktiv'], ['f-rating', 'Noten'], ['f-ranker', 'Ranker'], ['f-missing', 'Fehlende Werte'], ['f-status', 'Profil-Status'], ['f-fav', 'nur Favoriten']];
  const EXTRA_FILTER_CHOICES = ['Cover Checked', 'Ethnicity', 'Sexuality', 'Professions', 'Birthplace', 'Geburtsjahr', 'Alter', 'Height', 'Bra/Cup', 'Boobs', 'Tattoos', 'Piercings',
    'Measurements', 'Weight', 'Years active', 'Tags', 'Score', 'User Rating', 'Global Rating', 'Exact Birthdate', 'Favorite',
    'Face Score', 'Body Score', 'Hot Score', 'Cute Score', 'Sympathy Score'];
  const MULTI_FIELDS = new Set(['Professions', 'Tags', 'AKA']);
  if (!Array.isArray(ui.cardFields)) ui.cardFields = ['Nationality', 'Alter', 'Height'];
  if (!Array.isArray(ui.cardBadges)) ui.cardBadges = CARD_BADGES.map(b => b[0]);
  if (!ui.cardBadgesV2) { for (const k of ['fut', 'cover']) if (!ui.cardBadges.includes(k)) ui.cardBadges.push(k); ui.cardBadgesV2 = true; }
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
    if (f === 'Scraped At') return v(e, f) ? '🔁 ' + fmtDate(v(e, f), true) : '';
    if (f === 'Nationality') return natDisplay(e);
    if (f === 'Global Rating') return v(e, f) ? `BP Ø ${v(e, f).replace('.', ',')}` : '';
    if (f === 'User Rating') return v(e, f) && !isTrue(e['Profile Deleted']) ? `Meine BP ${v(e, f)}` : '';
    if (f === 'My Rating' || f === 'Score') return v(e, 'Score') ? `♥ ${v(e, 'Score').replace('.', ',')}` : '';
    if (f === '__cats') { const t = SCORE_CATS.map(c => v(e, c.f) ? c.key + fmtScoreVal(v(e, c.f)) : '').filter(Boolean).join(' '); return t; }
    if (/ Score$/.test(f)) return v(e, f) ? `${lab(f)} ${fmtScoreVal(v(e, f))}` : '';
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
  // Zusatzfilter: Kommazahlen-Noten in ganze Stufen zusammenfassen (9,0–9,9 statt jeder Einzelwert)
  const XF_BUCKET = { 'Score': 1, 'Global Rating': 2 };
  function xfValues(e, f) {
    if (f === 'Cover Checked') return [isTrue(e[f]) ? 'ja' : 'nein'];
    const vals = fieldValues(e, f);
    if (!(f in XF_BUCKET) || !vals.length) return vals;
    const x = num(vals[0]); if (x == null) return vals;
    const n = Math.floor(x + 1e-9), d = XF_BUCKET[f];
    return [n >= 10 ? '10' : `${n},${'0'.repeat(d)}–${n},${'9'.repeat(d)}`];
  }
  function renderExtraFilters() {
    const box = $('#xf'); if (!box) return;
    for (const k of Object.keys(xfVals)) if (!ui.extraFilters.includes(k)) delete xfVals[k];
    box.innerHTML = ui.extraFilters.map(f => {
      const counts = new Map(); let empty = 0;
      for (const e of entries) { const vals = xfValues(e, f); if (!vals.length) empty++; vals.forEach(x => counts.set(x, (counts.get(x) || 0) + 1)); }
      const isNum = ['Alter', 'Geburtsjahr', 'Height', 'Weight', 'My Rating', 'User Rating', 'Score', 'Global Rating'].includes(f) || / Score$/.test(f);
      const keys = [...counts.keys()].sort((a, b) => isNum ? (num(a) - num(b)) : a.localeCompare(b, 'de'));
      const cur = xfVals[f] || '';
      return `<select data-xf="${esc(f)}" title="${esc(lab(f))}"><option value="">${esc(lab(f))}: alle</option>${empty ? `<option value="__empty" ${cur === '__empty' ? 'selected' : ''}>${esc(lab(f))}: (leer) – ${empty}</option>` : ''}${keys.map(k => `<option value="${esc(k)}" ${cur === k ? 'selected' : ''}>${esc(k)} (${counts.get(k)})</option>`).join('')}</select>`;
    }).join('');
  }

  function applyCardLook() {
    const b = document.body;
    b.classList.toggle('cards-s', ui.cardSize === 's'); b.classList.toggle('cards-l', ui.cardSize === 'l');
    b.classList.toggle('cards-top', !!ui.cardImgTop); b.classList.toggle('cards-noname', !!ui.cardNoName);
  }
  function showViewSettings() {
    const chk = (name, val, on, label) => `<label class="chk"><input type="checkbox" name="${name}" value="${esc(val)}" ${on ? 'checked' : ''}> ${esc(label)}</label>`;
    openModal(`
      <div class="modal-head"><h2>Ansicht anpassen</h2><div class="actions"><button class="x" data-action="close" aria-label="Schließen">×</button></div></div>
      <form class="help view-cfg" id="view-cfg">
        <h3>Angaben auf den Kacheln</h3>
        <p class="muted">Erscheinen unter dem Namen in der gewählten Reihenfolge (Reihenfolge = Klick-Reihenfolge; zuerst gewählt steht vorne).</p>
        <div class="cfg-grid" id="cfg-card">${CARD_FIELD_CHOICES.map(f => chk('card', f, ui.cardFields.includes(f), lab(f))).join('')}</div>
        <p class="muted" id="cfg-order"></p>
        <h3>Kacheln</h3>
        <div class="cfg-grid">
          ${[['s', 'klein'], ['m', 'mittel'], ['l', 'groß']].map(([k, l]) => `<label class="chk"><input type="radio" name="size" value="${k}" ${(ui.cardSize || 'm') === k ? 'checked' : ''}> ${l}</label>`).join('')}
          <label class="chk"><input type="checkbox" name="imgtop" ${ui.cardImgTop ? 'checked' : ''}> Bildausschnitt oben (Gesicht)</label>
          <label class="chk"><input type="checkbox" name="noname" ${ui.cardNoName ? 'checked' : ''}> nur Bilder (ohne Name und Angaben)</label>
        </div>
        <h3>Abzeichen auf dem Bild</h3>
        <div class="cfg-grid">${CARD_BADGES.map(([k, l]) => chk('badge', k, ui.cardBadges.includes(k), l)).join('')}</div>
        <h3>Filter in der Leiste</h3>
        <div class="cfg-grid">${BUILTIN_FILTERS.map(([id, l]) => chk('filter', id, !ui.hiddenFilters[id], l)).join('')}</div>
        <h3>Zusätzliche Filter</h3>
        <p class="muted">Auswahl mit allen vorkommenden Werten (und „leer“).</p>
        <div class="cfg-grid">${EXTRA_FILTER_CHOICES.map(f => chk('extra', f, ui.extraFilters.includes(f), lab(f))).join('')}</div>
      </form>
      <div class="form-foot">
        <button class="btn ghost" id="cfg-default">Standard</button>
        <button class="btn" data-action="close">Abbrechen</button>
        <button class="btn primary" id="cfg-save">Übernehmen</button>
      </div>`);
    const form = $('#view-cfg');
    let order = ui.cardFields.slice();
    const showOrder = () => { $('#cfg-order').textContent = order.length ? 'Reihenfolge: ' + order.map(lab).join(' · ') : 'Keine Angaben ausgewählt.'; };
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
      ui.cardSize = 'm'; ui.cardImgTop = false; ui.cardNoName = false; applyCardLook();
      saveUI(); closeModal(true); applyFilterVisibility(); renderExtraFilters(); render();
    });
    $('#cfg-save').addEventListener('click', () => {
      const vals = (n) => [...form.querySelectorAll(`input[name="${n}"]:checked`)].map(i => i.value);
      ui.cardFields = order;
      ui.cardBadges = vals('badge');
      ui.cardSize = (form.querySelector('input[name="size"]:checked') || {}).value || 'm';
      ui.cardImgTop = form.querySelector('input[name="imgtop"]').checked;
      ui.cardNoName = form.querySelector('input[name="noname"]').checked;
      applyCardLook();
      const shown = new Set(vals('filter'));
      ui.hiddenFilters = Object.fromEntries(BUILTIN_FILTERS.filter(([id]) => !shown.has(id)).map(([id]) => [id, true]));
      ui.extraFilters = vals('extra');
      saveUI(); closeModal(true); applyFilterVisibility(); renderExtraFilters(); render();
      toast('Ansicht gespeichert (gilt für dieses Gerät).', 'ok');
    });
  }

  function ratingBadge(e) {
    const r = ratingDiff(e);
    const tn = v(e, 'Score').replace('.', ',');
    if (r.state === 'same') return `<span class="badge mine" title="Tool-Note ${tn} – gerundet gleich meiner Babepedia-Note">♥ ${tn} ✓</span>`;
    if (r.state === 'diff') return `<span class="badge diff" title="Tool-Note ${tn} (gerundet ${r.mine}) – meine Babepedia-Note ${r.site}">♥ ${tn} · BP ${r.site}</span>`;
    if (r.state === 'mine-only') return `<span class="badge mine" title="Tool-Note – auf Babepedia noch nicht bewertet">♥ ${tn}</span>`;
    if (r.state === 'gone') return hasScore(e) ? `<span class="badge mine" title="Tool-Note – Babepedia-Profil gelöscht, kein Abgleich">♥ ${tn}</span>` : '';
    if (r.state === 'site-only') return `<span class="badge site" title="Nur meine Babepedia-Note, noch keine Tool-Note">BP ${r.site}</span>`;
    return '';
  }

  function diffCell(e) {
    const r = ratingDiff(e);
    if (r.state === 'same') return '<span class="ok">=</span>';
    if (r.state === 'diff') return `<span class="warn">${fmtDiff(r.d)}</span>`;
    return '';
  }

  function render() {
    renderUpdateBanner();
    if (rankerTags.size) { rankerStale = new Map(); for (const e of entries) { const d = computeStale(e); if (d.length) rankerStale.set(e._id, d); } }
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
    renderStatChip();
    if (!list.length) { main.innerHTML = `<div class="empty"><h2>Keine Treffer</h2><p>Passe Suche oder Filter an.</p></div>`; return; }
    if (ui.view === 'stats') { main.innerHTML = statsHTML(list); drawWorldMap(list); return; }

    shown = list; shownCount = 0;
    if (ui.view === 'table') {
      main.innerHTML = `<div class="table-wrap"><table><thead><tr>
        <th></th><th>Name</th><th>Nationality</th><th>Profession Category</th><th>Alter</th><th>Height</th><th>Hair color</th><th>Measurements</th><th>BP Ø</th><th>Rank</th><th>Meine BP</th><th>Tool-Note</th><th>Δ</th><th>🏆</th><th>★</th>
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
          <td class="num">${esc(v(e, 'Score').replace('.', ','))}</td>
          <td class="num">${diffCell(e)}</td>
          <td>${e._ranker ? '🏆' : ''}</td>
          <td>${isTrue(e.Favorite) ? '<span style="color:var(--accent)">♥</span>' : ''}</td>
        </tr>`;
  }
  // Karten-Stil wie eine Sammelkarte: große Tool-Note + Flagge links, Kategorien rechts
  const futV = (x) => x == null ? '–' : (x % 1 ? Math.floor(x) + '½' : String(x));
  function futHTML(e) {
    const s = scoreOf(e); if (!s) return '';
    const st = SCORE_CATS.map(c => {
      const x = num(v(e, c.f)), unset = x == null;
      return `<span class="fut-s${unset ? ' unset' : ''}" title="${esc(c.label)}${unset && c.f === 'Sympathy Score' ? ' – nicht gesetzt, zählt als 2,5' : ''}"><b>${futV(x)}</b><i>${esc(c.short)}</i></span>`;
    }).join('');
    const r = ratingDiff(e);
    const bp = r.state === 'same' ? `<span class="fut-s ok" title="gleich meiner Babepedia-Note"><b>✓</b><i>BP</i></span>`
      : r.state === 'diff' ? `<span class="fut-s diff" title="meine Babepedia-Note ${r.site} – Tool-Note gerundet ${r.mine}"><b>${r.site}</b><i>BP</i></span>`
      : `<span class="fut-s unset" title="${r.state === 'gone' ? 'Babepedia-Profil gelöscht' : 'auf Babepedia noch nicht bewertet'}"><b>–</b><i>BP</i></span>`;
    const nat = fieldValues(e, 'Nationality')[0];
    return `<div class="fut" title="Tool-Note ${esc(v(e, 'Score'))}">
      <div class="fut-main"><b>${s.ten.toFixed(1).replace('.', ',')}</b><span>${nat ? (flagFor(nat) || '') : ''}</span></div>
      <div class="fut-grid">${st}${bp}</div></div>`;
  }
  function cardHTML(e) {
    const fut = ui.cardBadges.includes('fut') ? futHTML(e) : '';
    const coverOk = ui.cardBadges.includes('cover') && isTrue(e['Cover Checked']);
    return `
      <article class="card" data-id="${esc(e._id)}">
        <button class="fav-btn ${isTrue(e.Favorite) ? 'on' : ''}" data-fav="${esc(e._id)}" title="Favorit">${isTrue(e.Favorite) ? '♥' : '♡'}</button>
        <div class="img${fut ? ' has-fut' : ''}">${coverTag(e)}${coverOk ? '<div class="cover-ok" title="Kachelbild geprüft"><span>✓ Bild</span></div>' : ''}${fut}
          <div class="badges">
            ${ui.cardBadges.includes('global') && v(e, 'Global Rating') ? `<span class="badge rating" title="Babepedia Ø (alle Nutzer)">Ø ${esc(v(e, 'Global Rating'))}</span>` : ''}
            ${ui.cardBadges.includes('rank') && v(e, 'Rank') ? `<span class="badge">#${esc(v(e, 'Rank'))}</span>` : ''}
            ${ui.cardBadges.includes('rating') && !fut ? ratingBadge(e) : ''}
            ${ui.cardBadges.includes('ranker') && e._ranker ? rankerBadge(e) : ''}${profileStatus(e).startsWith('gone') ? `<span class="badge gone" title="${esc(STATUS_LABEL[profileStatus(e)])}">${profileStatus(e) === 'gone' ? '⚠︎ gelöscht' : '🏛️ gelöscht'}</span>` : ''}${rankerStale.has(e._id) ? `<span class="badge rk-stale" title="${esc(staleTitle(rankerStale.get(e._id)))}">⟳ Ranker</span>` : ''}
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
  // ---------- Statistik ----------
  // Zeigt, wie oft Eigenschaften vorkommen – immer für die aktuell gefilterte Liste.
  // Ein Klick auf einen Balken filtert die Liste danach (Chip in der Leiste, ✕ entfernt ihn).
  let statFilter = null;          // { label, test(e) } – nicht gespeichert
  let statRefs = [];              // Klickziele der aktuellen Statistik
  const STAT_CATS = [
    ['Nationality', 'Nationalität'], ['Profession Category', 'Bereich'], ['Professions', 'Professions'], ['Hair color', 'Haarfarbe'], ['Eye color', 'Augenfarbe'],
    ['Body type', 'Figur'], ['Ethnicity', 'Ethnicity'], ['Bra/Cup', 'Cup'], ['Boobs', 'Boobs'], ['Sexuality', 'Sexuality'], ['Tattoos', 'Tattoos'],
    ['Piercings', 'Piercings'], ['Active', 'Aktiv'], ['__status', 'Profil-Status'], ['Favorite', 'Favorit'], ['Tags', 'Tags'], ['Geburtsland', 'Geburtsland'], ['Birthplace', 'Geburtsort']];
  const COUNTRY_ALIAS = { 'usa': 'United States', 'us': 'United States', 'u.s.': 'United States', 'uk': 'United Kingdom', 'england': 'United Kingdom', 'russian federation': 'Russia' };
  function statValues(e, f) {
    if (f === '__status') return [STATUS_LABEL[profileStatus(e)]];
    if (f !== 'Geburtsland') return fieldValues(e, f);
    const bp = v(e, 'Birthplace'); if (!bp || bp.toLowerCase() === 'n/a') return [];
    const last = bp.split(',').pop().trim(); return last ? [COUNTRY_ALIAS[last.toLowerCase()] || last] : [];
  }
  const CUP_ORDER = 'AA A B C D DD DDD E F FF G GG H HH I J K L M N'.split(' ');
  function statSection(title, rows, total, empty, opts = {}) {
    if (!rows.length) return '';
    const max = Math.max(...rows.map(r => r.n), opts.emptyRow ? opts.emptyRow.n : 0);
    const limit = opts.limit || 15;
    const bar = (r) => {
      const i = statRefs.push(r) - 1;
      const pct = total ? (r.n / total * 100) : 0;
      return `<button class="st-row" data-sf="${i}" title="${esc(r.label)} – Klick filtert die Liste"><span class="st-lbl">${r.html || esc(r.label)}</span><span class="st-bar"><i style="width:${(r.n / max * 100).toFixed(1)}%"></i></span><span class="st-n">${r.n}</span><span class="st-p">${pct < 1 && pct > 0 ? '<1' : Math.round(pct)} %</span></button>`;
    };
    const head = rows.slice(0, limit), rest = rows.slice(limit);
    return `<section class="st-card${opts.wide ? ' wide' : ''}${opts.span ? ' span2' : ''}">
      <h3>${esc(title)} <span class="muted">${rows.length} Wert${rows.length === 1 ? '' : 'e'}${empty ? ` · ${empty} ohne Angabe` : ''}</span></h3>
      ${head.map(bar).join('')}
      ${rest.length ? `<details><summary>alle ${rows.length} zeigen</summary>${rest.map(bar).join('')}</details>` : ''}
      ${opts.emptyRow ? `<div class="st-empty">${bar(opts.emptyRow)}</div>` : ''}
    </section>`;
  }
  // Säulendiagramm für geordnete Werte (Alter, Größe, Cup, Noten …); Prozent bezogen auf Einträge mit Wert
  function histSection(title, rows, base, empty, opts = {}) {
    if (!rows.length) return '';
    const max = Math.max(...rows.map(r => r.n));
    const p = (n) => { const x = base ? n / base * 100 : 0; return x > 0 && x < 1 ? '<1' : Math.round(x); };
    const cols = rows.map(r => {
      const i = statRefs.push(r) - 1;
      return `<button class="st-col" data-sf="${i}" title="${esc(r.label)}: ${r.n} (${p(r.n)} %) – Klick filtert die Liste"><span class="st-cn">${r.n}</span><span class="st-cb"><i style="height:${Math.max(r.n / max * 100, 1.5).toFixed(1)}%"></i></span><span class="st-cl">${esc(r.short != null ? r.short : r.label)}</span></button>`;
    }).join('');
    return `<section class="st-card st-hist${opts.span ? ' span2' : ''}">
      <h3>${esc(title)} <span class="muted">${base} ${opts.unit || 'mit Wert'}${empty && !opts.unit ? ` · ${empty} ohne` : ''}${opts.note ? ' · ' + opts.note : ''}</span></h3>
      <div class="st-cols${rows.length > 18 ? ' dense' : ''}">${cols}</div>
    </section>`;
  }
  // Kategorien-Bewertungen als Tabelle: Zeile = Kategorie, Spalte = Wert
  function scoreMatrixHTML(list) {
    const steps = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];
    const fmt = (x) => String(x).replace('.', ',');
    let rowsHTML = '', any = false;
    for (const c of SCORE_CATS) {
      const f = c.f, vals = list.map(e => num(v(e, f))).filter(x => x != null);
      if (!vals.length) continue;
      any = true;
      const cnt = new Map(); vals.forEach(x => cnt.set(x, (cnt.get(x) || 0) + 1));
      const mx = Math.max(...cnt.values());
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      const cells = steps.map(x => {
        const n = cnt.get(x) || 0;
        if (!n) return `<td class="st-mx0">·</td>`;
        const i = statRefs.push({ label: `${c.label} ${fmt(x)}`, flabel: `${c.label}: ${fmt(x)}`, test: e => num(v(e, f)) === x }) - 1;
        return `<td><button data-sf="${i}" style="--a:${(0.15 + 0.85 * n / mx).toFixed(2)}" title="${esc(c.label)} ${fmt(x)}: ${n} – Klick filtert">${n}</button></td>`;
      }).join('');
      rowsHTML += `<tr><th>${esc(c.label)}</th>${cells}<td class="st-mxavg">${avg.toFixed(2).replace('.', ',')}</td><td class="st-mxn">${vals.length}</td></tr>`;
    }
    if (!any) return '';
    return `<section class="st-card span2 st-mx">
      <h3>Kategorien <span class="muted">Anzahl je Wert · Ø · bewertet</span></h3>
      <div class="st-mx-wrap"><table><thead><tr><th></th>${steps.map(x => `<th>${fmt(x)}</th>`).join('')}<th>Ø</th><th>n</th></tr></thead><tbody>${rowsHTML}</tbody></table></div>
      <p class="muted st-mx-note">Sympathie leer zählt in der Tool-Note als 2,5 und steht hier nicht mit drin.</p>
    </section>`;
  }
  // ---------- Weltkarte (Statistik) ----------
  // Kartendaten: world.json im Repo (Natural Earth 1:50m, gemeinfrei; Equal-Earth-Projektion, vorab vereinfacht).
  const COUNTRY_ALIASES = {
    'usa': 'US', 'us': 'US', 'u.s.': 'US', 'u.s.a.': 'US', 'america': 'US', 'uk': 'GB', 'great britain': 'GB', 'britain': 'GB',
    'england': 'GB', 'scotland': 'GB', 'wales': 'GB', 'northern ireland': 'GB', 'russian federation': 'RU', 'russia': 'RU', 'ussr': 'RU', 'soviet union': 'RU',
    'czech republic': 'CZ', 'czechoslovakia': 'CZ', 'korea, republic of': 'KR', 'republic of korea': 'KR', 'korea': 'KR', 'south korea': 'KR',
    "korea, democratic people's republic of": 'KP', 'north korea': 'KP', 'iran, islamic republic of': 'IR', 'moldova, republic of': 'MD',
    'macedonia, the former yugoslav republic of': 'MK', 'macedonia': 'MK', 'tanzania, united republic of': 'TZ', 'congo, the democratic republic of the': 'CD',
    'syrian arab republic': 'SY', 'syria': 'SY', 'bosnia and herzegowina': 'BA', 'bosnia': 'BA', 'viet nam': 'VN', "lao people's democratic republic": 'LA',
    'libyan arab jamahiriya': 'LY', 'brunei darussalam': 'BN', 'holland': 'NL', 'the netherlands': 'NL', 'ivory coast': 'CI', "cote d'ivoire": 'CI',
    'swaziland': 'SZ', 'burma': 'MM', 'yugoslavia': 'RS', 'serbia and montenegro': 'RS', 'east germany': 'DE', 'west germany': 'DE',
    'taiwan, province of china': 'TW', 'hong kong sar': 'HK', 'macau': 'MO', 'macao': 'MO', 'cape verde': 'CV', 'east timor': 'TL',
    'united states minor outlying islands': 'US', 'virgin islands (u.s.)': 'VI', 'virgin islands (british)': 'VG', 'turkiye': 'TR', 'türkiye': 'TR',
    'gibraltar': 'GB', 'reunion': 'FR', 'réunion': 'FR', 'guadeloupe': 'FR', 'martinique': 'FR', 'french guiana': 'FR', 'mayotte': 'FR',
    "lao, people's democratic republic": 'LA', 'laos': 'LA', 'congo, the republic of the': 'CG', 'republic of the congo': 'CG'
  };
  // US-Bundesstaaten und kanadische Provinzen, falls das Land fehlt
  const REGION_COUNTRY = Object.assign(
    Object.fromEntries('alabama alaska arizona arkansas california colorado connecticut delaware florida georgia hawaii idaho illinois indiana iowa kansas kentucky louisiana maine maryland massachusetts michigan minnesota mississippi missouri montana nebraska nevada ohio oklahoma oregon pennsylvania tennessee texas utah vermont virginia washington wisconsin wyoming'.split(' ').map(s => [s, 'US'])),
    { 'new hampshire': 'US', 'new jersey': 'US', 'new mexico': 'US', 'new york': 'US', 'north carolina': 'US', 'north dakota': 'US', 'rhode island': 'US', 'south carolina': 'US', 'south dakota': 'US', 'west virginia': 'US',
      'ontario': 'CA', 'quebec': 'CA', 'québec': 'CA', 'british columbia': 'CA', 'alberta': 'CA', 'manitoba': 'CA', 'saskatchewan': 'CA', 'nova scotia': 'CA', 'new brunswick': 'CA' });
  let countryIndex = null;
  function countryIso(name, world) {
    if (!countryIndex) {
      countryIndex = new Map();
      for (const c of world.c) for (const n of c.names) countryIndex.set(n, c.iso);
    }
    const n = String(name || '').toLowerCase().replace(/\s+/g, ' ').trim();
    if (!n) return '';
    const plain = n.replace(/\s*\(.*?\)\s*/g, ' ').trim();
    return COUNTRY_ALIASES[n] || countryIndex.get(n) || COUNTRY_ALIASES[plain] || countryIndex.get(plain) || REGION_COUNTRY[plain] || '';
  }
  // Geburtsland aus „Stadt, Region, Land“ (Babepedia schreibt z. B. „Seoul, Korea, Republic of“)
  function birthIso(e, world) {
    const parts = String(v(e, 'Birthplace')).split(',').map(s => s.trim()).filter(Boolean);
    if (!parts.length || /^n\/?a$/i.test(parts[0])) return '';
    for (let k = Math.min(3, parts.length); k >= 1; k--) {
      const iso = countryIso(parts.slice(-k).join(', '), world);
      if (iso) return iso;
    }
    return '';
  }
  // Gebiete ohne eigene Fläche auf der Karte dem Mutterland zuordnen
  const MAP_PARENT = { GF: 'FR', GP: 'FR', MQ: 'FR', RE: 'FR', YT: 'FR', GI: 'GB', SJ: 'NO', BV: 'NO', CX: 'AU', CC: 'AU', TK: 'NZ' };
  function natIsos(e) {
    return [...new Set(natNames(e).map(n => { let c = NATIONALITY_CODES[n.toLowerCase()] || ''; if (c.startsWith('GB-')) c = 'GB'; return MAP_PARENT[c] || c; }).filter(Boolean))];
  }

  let worldData = null;
  const loadWorld = () => worldData ? Promise.resolve(worldData) : fetch('world.json').then(r => { if (!r.ok) throw new Error('world.json ' + r.status); return r.json(); }).then(d => (worldData = d));
  const MAP_VIEWS = { world: null, eu: '436 17 178 103', na: '29 12 382 213', sa: '240 188 195 249', af: '444 107 208 267', as: '552 42 360 246' };
  if (!ui.mapMode) ui.mapMode = 'nat';
  if (!ui.mapView) ui.mapView = 'world';
  function mapSectionHTML() {
    const b = (k, v, l) => `<button class="${ui[k] === v ? 'on' : ''}" data-map-${k === 'mapMode' ? 'mode' : 'view'}="${v}">${l}</button>`;
    return `<section class="st-card wide st-map">
      <div class="st-map-head">
        <h3>Weltkarte</h3>
        <div class="seg small">${b('mapMode', 'nat', 'Nationalität')}${b('mapMode', 'birth', 'Geburtsland')}</div>
        <div class="seg small">${b('mapView', 'world', 'Welt')}${b('mapView', 'eu', 'Europa')}${b('mapView', 'na', 'N-Amerika')}${b('mapView', 'sa', 'S-Amerika')}${b('mapView', 'af', 'Afrika')}${b('mapView', 'as', 'Asien')}</div>
      </div>
      <div class="map-box" id="map-box"><p class="muted">Karte wird geladen…</p></div>
      <div class="map-info" id="map-info"><span class="muted">Land antippen für Details.</span></div>
    </section>`;
  }
  async function drawWorldMap(list) {
    const box = $('#map-box'); if (!box) return;
    let world;
    try { world = await loadWorld(); } catch (err) { box.innerHTML = `<p class="muted">Karte konnte nicht geladen werden (${esc(err.message || err)}).</p>`; return; }
    if (!document.body.contains(box)) return;
    const isosOf = ui.mapMode === 'birth' ? (e => { const i = birthIso(e, world); return i ? [MAP_PARENT[i] || i] : []; }) : natIsos;
    const counts = new Map(); let none = 0;
    for (const e of list) { const is = isosOf(e); if (!is.length) none++; is.forEach(i => counts.set(i, (counts.get(i) || 0) + 1)); }
    const max = Math.max(1, ...counts.values());
    const lmax = Math.log(max + 1);
    const pct = (n) => Math.round(18 + 82 * Math.log(n + 1) / lmax);
    const vb = MAP_VIEWS[ui.mapView] || `0 0 ${world.w} ${world.h}`;
    const dotR = (Number(vb.split(' ')[2]) / 400).toFixed(2);   // Punkte für kleine Länder passend zum Ausschnitt
    const shapes = world.c.map(c => {
      const n = counts.get(c.iso) || 0;
      const fill = n ? `color-mix(in srgb, var(--accent) ${pct(n)}%, var(--surface-3))` : '';
      const label = `${flagFor(c.n) || isoFlag(c.iso)} ${c.de}: ${n}`;
      return `<path d="${c.p}" data-iso="${c.iso}" class="${n ? 'has' : ''}" ${fill ? `style="fill:${fill}"` : ''}><title>${esc(label)}</title></path>` +
        (c.small && n ? `<circle cx="${c.c[0]}" cy="${c.c[1]}" r="${dotR}" data-iso="${c.iso}" class="has dot" style="fill:${fill}"><title>${esc(label)}</title></circle>` : '');
    }).join('');
    const known = new Set(world.c.map(c => c.iso));
    const offMap = [...counts.keys()].filter(i => !known.has(i)).reduce((a, i) => a + counts.get(i), 0);
    box.innerHTML = `<svg viewBox="${vb}" class="world" role="img" aria-label="Weltkarte">${shapes}</svg>
      <div class="map-legend"><span>1</span><i></i><span>${max}</span><span class="muted">${ui.mapMode === 'birth' ? 'nach Geburtsland' : 'nach Nationalität (Mehrfache zählen je Land)'} · ${counts.size} Länder${none ? ` · ${none} ohne Zuordnung` : ''}${offMap ? ` · ${offMap} ohne Fläche auf der Karte` : ''}</span></div>`;
    box.dataset.mode = ui.mapMode;
    mapCounts = { counts, world, isosOf };
  }
  let mapCounts = null;
  const isoFlag = (iso) => /^[A-Z]{2}$/.test(iso) ? [...iso].map(c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)).join('') : '';
  function mapPick(iso) {
    if (!mapCounts) return;
    const c = mapCounts.world.c.find(x => x.iso === iso); if (!c) return;
    const n = mapCounts.counts.get(iso) || 0;
    $$('#map-box [data-iso].sel').forEach(x => x.classList.remove('sel'));
    $$(`#map-box [data-iso="${iso}"]`).forEach(x => x.classList.add('sel'));
    const i = statRefs.push({ label: `${ui.mapMode === 'birth' ? 'Geburtsland' : 'Nationalität'}: ${c.de}`, test: (e) => mapCounts.isosOf(e).includes(iso) }) - 1;
    $('#map-info').innerHTML = `<b>${isoFlag(iso)} ${esc(c.de)}</b> · ${n} Eintr${n === 1 ? 'ag' : 'äge'}` + (n ? ` <button class="btn small" data-sf="${i}">Liste zeigen</button>` : '');
  }

  function statsHTML(list) {
    statRefs = [];
    const total = list.length;
    const mean = (xs) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
    const median = (xs) => { if (!xs.length) return null; const a = xs.slice().sort((x, y) => x - y), m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
    const f1 = (x, d = 1) => x == null ? '–' : x.toLocaleString('de-DE', { maximumFractionDigits: d });
    const pct = (n) => total ? Math.round(n / total * 100) + ' %' : '–';
    const ages = list.map(age).filter(x => x != null), hs = list.map(e => num(v(e, 'Height'))).filter(x => x > 100 && x < 230);
    const gr = list.map(e => num(v(e, 'Global Rating'))).filter(x => x != null), mr = list.map(e => num(v(e, 'Score'))).filter(x => x != null);
    const fav = list.filter(e => isTrue(e.Favorite)).length, rk = list.filter(e => e._ranker).length, act = list.filter(e => isTrue(e.Active)).length;
    const tile = (big, small, test, label) => {
      const i = test ? statRefs.push({ label, test }) - 1 : -1;
      return `<${test ? `button data-sf="${i}"` : 'div'} class="st-tile"><b>${big}</b><span>${small}</span></${test ? 'button' : 'div'}>`;
    };
    const tiles = [
      tile(total.toLocaleString('de-DE'), total === entries.length ? 'Einträge' : `von ${entries.length} Einträgen (gefiltert)`),
      tile(`${fav} <small>${pct(fav)}</small>`, 'Favoriten', e => isTrue(e.Favorite), 'Favorit'),
      tile(`${rk} <small>${pct(rk)}</small>`, 'im Image Ranker', e => !!e._ranker, 'im Ranker'),
      tile(`${act} <small>${pct(act)}</small>`, 'aktiv', e => isTrue(e.Active), 'aktiv'),
      tile(f1(mean(ages)), `Ø Alter · Median ${f1(median(ages), 0)}`),
      tile(f1(mean(hs), 0) + ' cm', `Ø Größe · ${hs.length ? Math.min(...hs) + '–' + Math.max(...hs) : '–'}`),
      tile(f1(mean(gr), 2), `Babepedia Ø im Mittel · ${gr.length} mit Wert`),
      tile(f1(mean(mr), 1), `Tool-Note im Mittel · ${mr.length} bewertet`, e => hasScore(e), 'Tool-Note vorhanden'),
    ].join('');

    // Kategorien: Werte zählen (Mehrfachfelder einzeln)
    const cats = STAT_CATS.map(([f, title]) => {
      const counts = new Map(); let empty = 0;
      for (const e of list) { const vals = [...new Set(statValues(e, f))]; if (!vals.length) empty++; vals.forEach(x => counts.set(x, (counts.get(x) || 0) + 1)); }
      let rows = [...counts].map(([label, n]) => ({ label, n, test: e => statValues(e, f).includes(label), flabel: `${title}: ${label}` }));
      if (f === 'Bra/Cup') rows.sort((a, b) => { const ia = CUP_ORDER.indexOf(a.label.toUpperCase()), ib = CUP_ORDER.indexOf(b.label.toUpperCase()); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.label.localeCompare(b.label); });
      else rows.sort((a, b) => b.n - a.n || a.label.localeCompare(b.label, 'de'));
      if (f === 'Nationality') rows.forEach(r => { r.html = `${flagFor(r.label) || ''} ${esc(r.label)}`; });
      if (f === 'Bra/Cup') return histSection('Cup', rows, total - empty, empty, { span: true });
      return statSection(title, rows, total, empty, { limit: f === 'Bra/Cup' ? 30 : 15,
        emptyRow: empty ? { label: '(ohne Angabe)', n: empty, test: e => !statValues(e, f).length, flabel: `${title}: ohne Angabe` } : null });
    });

    // Zahlen: in Stufen einteilen → Säulendiagramm
    const NUMDEF = {
      'Alter': ['Alter', 5, ' J.'], 'Geburtsjahr': ['Geburtsjahrzehnt', 10, 'er'], 'Height': ['Größe', 5, ' cm'], 'Weight': ['Gewicht', 5, ' kg'],
      'Global Rating': ['Babepedia Ø (alle Nutzer)', 0.1, ''], 'User Rating': ['Meine Babepedia-Note', 1, ''], 'Score': ['Tool-Note (aus Kategorien)', 0.5, '']
    };
    const numVal = (e, f) => f === 'Alter' ? age(e) : num(fieldValues(e, f)[0]);
    const numOk = (f, x) => x != null && !(f === 'Height' && (x < 100 || x > 230)) && !(f === 'Weight' && (x < 25 || x > 200)) && !(f === 'User Rating' && false);
    const binOf = (x, step) => Math.round(Math.floor(x / step + 1e-9) * step * 100) / 100;
    const hist = (f, opts = {}) => {
      const [title, step, unit] = NUMDEF[f];
      const counts = new Map(); let empty = 0, base = 0;
      const val = (e) => f === 'User Rating' ? siteRating(e) : numVal(e, f);
      for (const e of list) { const x = val(e); if (!numOk(f, x)) { empty++; continue; } base++; const b = binOf(x, step); counts.set(b, (counts.get(b) || 0) + 1); }
      const keys = [...counts.keys()].sort((a, b) => a - b);
      if (!keys.length) return '';
      // Lücken auffüllen, damit die Achse gleichmäßig bleibt
      const all = [];
      for (let b = keys[0]; b <= keys[keys.length - 1] + 1e-9; b = Math.round((b + step) * 100) / 100) all.push(b);
      const nf = (b) => f === 'Geburtsjahr' ? String(b) : f1(b, step < 1 ? 2 : 0);
      const lbl = (b) => step === 1 || f === 'Geburtsjahr' ? `${nf(b)}${unit}` : step === 0.1 ? `${nf(b)}–${f1(b + 0.09, 2)}` : `${nf(b)}–${f1(b + step - (step < 1 ? 0.1 : 1), 1)}${unit}`;
      const rows = all.map(b => ({ label: lbl(b), short: f === 'Geburtsjahr' ? `'${String(b).slice(2)}` : nf(b), n: counts.get(b) || 0, flabel: `${title}: ${lbl(b)}`,
        test: e => { const x = val(e); return numOk(f, x) && binOf(x, step) === b; } }));
      return histSection(title, rows, base, empty, opts);
    };

    // Image Ranker: Tiers
    const tiers = new Map();
    list.forEach(e => { if (e._ranker && e._ranker.tier) tiers.set(e._ranker.tier, (tiers.get(e._ranker.tier) || 0) + 1); });
    // Kategorien-Note gegen Babepedia-Bewertung
    const dTest = (lo, hi) => (e) => { if (!hasScore(e) || siteRating(e) == null) return false; const d = Math.round(num(e.Score)) - siteRating(e); return d >= lo && d <= hi; };
    const cmpDefs = [['≤ −2 (niedriger)', -99, -2], ['−1', -1, -1], ['= gleich', 0, 0], ['+1', 1, 1], ['≥ +2 (höher)', 2, 99]];
    const cmpRows = cmpDefs.map(([label, lo, hi]) => ({ label, n: list.filter(dTest(lo, hi)).length, flabel: `Tool-Note vs. Babepedia-Note: ${label}`, test: dTest(lo, hi) })).filter(r => r.n);
    const cmpN = list.filter(e => hasScore(e) && siteRating(e) != null).length;
    const tierRows = RK_TIERS.map(([, t]) => t).filter(t => tiers.has(t)).map(t => ({ label: t, n: tiers.get(t), flabel: `Ranker-Tier: ${t}`,
      html: `<span class="badge rk-tier" style="--rk:${rkColor(t)}">${esc(t)}</span>`, test: e => e._ranker && e._ranker.tier === t }));

    // Vollständigkeit
    const COMPLETE = ['Main Image URL', 'Born', 'Nationality', 'Professions', 'Hair color', 'Eye color', 'Height', 'Weight', 'Measurements', 'Bra/Cup', 'Body type', 'Ethnicity', 'Babe ID', 'My Rating'];
    const compRows = COMPLETE.map(f => {
      const n = list.filter(e => f === 'Main Image URL' ? imgState(e) !== 'none' : fieldValues(e, f).length).length;
      const L = f === 'Main Image URL' ? 'Bild' : f === 'My Rating' ? 'Tool-Note' : lab(f);
      return { label: L, n, flabel: `${L}: fehlt`, test: e => f === 'Main Image URL' ? imgState(e) === 'none' : !fieldValues(e, f).length, title: 'Klick: Einträge, bei denen es fehlt' };
    });

    const catBy = {}; STAT_CATS.forEach(([f], k) => { catBy[f] = cats[k]; });
    const group = (id, title, html) => {
      const body = html.filter(Boolean).join('');
      if (!body) return '';
      const closed = (ui.statsClosed || []).includes(id);
      return `<details class="st-group" data-stg="${id}"${closed ? '' : ' open'}><summary><h2>${esc(title)}</h2></summary><div class="st-grid">${body}</div></details>`;
    };
    return `<div class="stats">
      <div class="st-tiles">${tiles}</div>
      <p class="muted st-hint">Gilt für die aktuell gefilterte Liste. Klick auf eine Zeile oder Säule filtert die Liste danach.</p>
      ${group('rating', 'Bewertungen', [
        scoreMatrixHTML(list),
        hist('Score', { span: true, unit: 'bewertet' }),
        statSection(`Tool-Note vs. meine Babepedia-Note (${cmpN})`, cmpRows, cmpN, 0, { limit: 10 }),
        statSection('Image Ranker – Tiers', tierRows, rk, 0, { limit: 20 }),
        hist('Global Rating', { span: true }),
        hist('User Rating', { note: 'ohne gelöschte Profile' })])}
      ${group('origin', 'Herkunft', [mapSectionHTML(), catBy['Nationality'], catBy['Geburtsland'], catBy['Birthplace'], catBy['Ethnicity']])}
      ${group('person', 'Person & Beruf', [hist('Alter', { span: true }), hist('Geburtsjahr'), catBy['Profession Category'], catBy['Professions'], catBy['Sexuality'], catBy['Active']])}
      ${group('look', 'Aussehen', [catBy['Hair color'], catBy['Eye color'], catBy['Body type'], catBy['Boobs'], hist('Height', { span: true }), hist('Weight', { span: true }),
        catBy['Bra/Cup'], catBy['Tattoos'], catBy['Piercings']])}
      ${group('data', 'Sammlung & Daten', [catBy['__status'], catBy['Favorite'], catBy['Tags'], statSection('Ausgefüllt (Klick = wo es fehlt)', compRows, total, 0, { limit: 20 })])}
    </div>`;
  }
  function renderStatChip() {
    const box = $('#sf'); if (!box) return;
    box.innerHTML = statFilter ? `<button class="chip st-chip" id="sf-clear" title="Diesen Filter entfernen">${esc(statFilter.label)} ✕</button>` : '';
  }

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
    refreshStale(id);
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

  function scoreRow(e, c, idx, active) {
    const cur = num(e[c.f]);
    const vals = c.vals || (c.half ? [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5] : [1, 2, 3, 4, 5]);
    const btns = vals.map(n => `<button class="sc-btn ${cur === n ? 'on' : ''} ${n % 1 ? 'half' : ''}" data-score="${c.f}" data-val="${n}" data-id="${esc(e._id)}" title="${esc(c.f === 'Sympathy Score' ? SYMPATHY_LABELS[n] : String(n).replace('.', ','))}">${n % 1 ? (cur === n ? Math.floor(n) + '½' : '½') : n}</button>`).join('');
    const extra = c.f === 'Sympathy Score' ? `<span class="sc-note">${cur ? esc(SYMPATHY_LABELS[cur]) : `nicht gesetzt – zählt als ${String(SCORE_W.symDefault).replace('.', ',')} (wirkt durchschnittlich)`}</span>` : (c.hint ? `<span class="sc-note">${esc(c.hint)}</span>` : '');
    return `<div class="sc-row ${active ? 'active' : ''}" data-sc-idx="${idx}"><span class="sc-lbl">${esc(c.label)}</span><span class="sc-btns">${btns}${cur != null ? `<button class="sc-clear" data-score="${c.f}" data-val="" data-id="${esc(e._id)}" title="entfernen">✕</button>` : ''}</span>${extra}</div>`;
  }
  function scoreSummary(e) {
    const s = scoreOf(e);
    if (!s) return `<div class="sc-sum muted">Gesicht, Body und Hot oder Cute bewerten – dann wird die Tool-Note berechnet.</div>`;
    const site = num(e['User Rating']), old = num(e['My Rating (old)']);
    const r = Math.round(s.ten);
    if (isTrue(e['Profile Deleted'])) return `<div class="sc-sum"><span class="muted">Tool-Note</span> <b class="sc-ten">${s.ten.toFixed(1).replace('.', ',')}</b> <span class="muted">/ 10 · Kategorien-Schnitt ${s.total.toFixed(2).replace('.', ',')} / 5${s.symAssumed ? ' · Sympathie nicht gesetzt (2,5)' : ''} · Babepedia-Profil gelöscht – kein Abgleich mehr</span>${old != null ? `<span class="sc-cmp muted">alte eigene Note ${old}</span>` : ''}</div>`;
    const bp = site == null ? 'auf Babepedia noch nicht bewertet' : site === r ? 'stimmt mit meiner Babepedia-Note überein ✓' : `meine Babepedia-Note ist ${site} – ändern`;
    return `<div class="sc-sum"><span class="muted">Tool-Note</span> <b class="sc-ten">${s.ten.toFixed(1).replace('.', ',')}</b> <span class="muted">/ 10 · Kategorien-Schnitt ${s.total.toFixed(2).replace('.', ',')} / 5${s.symAssumed ? ' · Sympathie nicht gesetzt (2,5)' : ''}</span>
      <span class="sc-bp ${site != null && site !== r ? 'diff' : ''}" title="Gerundete Tool-Note zum Eintragen auf Babepedia">Auf Babepedia eintragen: <b>${r}</b> <span class="muted">(${bp})</span></span>${old != null ? `<span class="sc-cmp muted">alte eigene Note ${old}</span>` : ''}</div>`;
  }
  function scoreBox(e) {
    return `<div class="sec score-box"><h3>Bewertung <span class="muted sc-anchor">${SCORE_ANCHORS}</span><button class="btn small sc-open" data-rate-mode="${esc(e._id)}" title="Im Bewertungsmodus öffnen und von hier aus durch die Liste blättern (R)">⭐ Bewertungsmodus</button></h3>
      ${SCORE_CATS.map((c, i) => scoreRow(e, c, i)).join('')}
      ${scoreSummary(e)}</div>`;
  }
  function setScore(id, f, val) {
    const e = byId(id); if (!e) return;
    e[f] = val === '' ? '' : String(val);
    e._updated = Date.now();
    derive(e);
    saveQuiet(); refreshItem(id);
  }



  // Zufällige Reihenfolge: fest pro „Mischen“, damit Blättern/Nachladen stabil bleibt
  let shuffleSeed = Math.floor(Math.random() * 2 ** 31);
  function shuffleKey(id) {
    let h = shuffleSeed ^ 0x9e3779b9;
    for (let i = 0; i < id.length; i++) { h = Math.imul(h ^ id.charCodeAt(i), 0x5bd1e995); h ^= h >>> 13; }
    return (h >>> 0) / 4294967296;
  }
  // 🎲 Zufälliger Eintrag aus der aktuellen (gefilterten) Liste
  let lastRandom = null;
  function randomEntry() {
    const list = shown.length ? shown : [];
    if (!list.length) { toast('Keine Einträge – Filter lockern.'); return; }
    let e = list[Math.floor(Math.random() * list.length)];
    if (list.length > 1 && e._id === lastRandom) e = list[(list.indexOf(e) + 1 + Math.floor(Math.random() * (list.length - 1))) % list.length];
    lastRandom = e._id;
    showDetail(e._id);
  }
  function showShortcuts() {
    openModal(`
      <div class="modal-head"><h2>Tastenkürzel &amp; Gesten</h2><div class="actions"><button class="x" data-action="close" aria-label="Schließen">×</button></div></div>
      <div class="help keys">
        <h3>Liste</h3>
        <dl class="kv">
          <div><dt><kbd>/</kbd></dt><dd>Suche</dd></div>
          <div><dt><kbd>Z</kbd></dt><dd>🎲 zufälliger Eintrag (aus der gefilterten Liste)</dd></div>
          <div><dt><kbd>B</kbd></dt><dd>🖼 Bilder der Liste durchblättern</dd></div>
          <div><dt><kbd>N</kbd></dt><dd>neuer Eintrag</dd></div>
          <div><dt><kbd>R</kbd></dt><dd>⭐ Bewertungsmodus (Kategorien)</dd></div>
          <div><dt><kbd>?</kbd></dt><dd>diese Übersicht</dd></div>
        </dl>
        <h3>Detailansicht</h3>
        <dl class="kv">
          <div><dt><kbd>←</kbd> <kbd>→</kbd> / wischen</dt><dd>vorheriger / nächster Eintrag</dd></div>
          <div><dt><kbd>Z</kbd></dt><dd>noch ein zufälliger Eintrag</dd></div>
          <div><dt><kbd>Leertaste</kbd> / <kbd>B</kbd></dt><dd>Bilder groß ansehen</dd></div>
          <div><dt><kbd>F</kbd></dt><dd>Favorit an/aus</dd></div>
          <div><dt><kbd>R</kbd></dt><dd>diesen Eintrag im Bewertungsmodus bewerten</dd></div>
          <div><dt><kbd>E</kbd></dt><dd>bearbeiten</dd></div>
          <div><dt><kbd>Esc</kbd></dt><dd>schließen</dd></div>
        </dl>
        <h3>Bild-Betrachter</h3>
        <dl class="kv">
          <div><dt><kbd>←</kbd> <kbd>→</kbd> / seitlich wischen</dt><dd>Bild zurück / weiter (am Ende: nächster Eintrag)</dd></div>
          <div><dt><kbd>↑</kbd> <kbd>↓</kbd> / nach oben wischen</dt><dd>Eintrag zurück / weiter</dd></div>
          <div><dt><kbd>Z</kbd></dt><dd>zufälliger Eintrag</dd></div>
          <div><dt><kbd>F</kbd></dt><dd>Favorit an/aus</dd></div>
          <div><dt><kbd>K</kbd></dt><dd>aktuelles Bild als Kachelbild</dd></div>
          <div><dt>Doppelklick / Doppeltipp</dt><dd>Zoom</dd></div>
          <div><dt><kbd>Esc</kbd> / nach unten wischen</dt><dd>schließen</dd></div>
        </dl>
      </div>`);
  }



  // Bild für den Image Ranker austauschen: der Ranker öffnet den Eintrag mit #e=<id>&pick=<Ranker-Bild>&tab=<Reiter>
  let rankerPick = null;   // { id: Ranker-Bild, tab, boId }
  function decoratePick(e) {
    const m = $('#modal .detail') || document.querySelector('.detail'); if (!m) return;
    const bar = document.createElement('div');
    bar.className = 'rk-pickbar';
    bar.innerHTML = `🖼️ <b>Anderes Bild für den Image Ranker wählen:</b> Klick auf „Dieses Bild nehmen“ unter dem gewünschten Bild. Elo, Duelle und Eigenschaften bleiben erhalten. <span data-rk-pick-msg></span>`;
    m.parentNode.insertBefore(bar, m);
    document.querySelectorAll('.img-grid .img-cell').forEach(cell => {
      const im = cell.querySelector('img[data-full]'); if (!im) return;
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'btn small rk-pick-btn'; b.textContent = '✔ Dieses Bild nehmen'; b.dataset.rkPick = im.dataset.full;
      cell.appendChild(b);
    });
  }
  async function sendReplacement(ref, btn) {
    if (!rankerPick) return;
    const msg = document.querySelector('[data-rk-pick-msg]'), setMsg = (t) => { if (msg) msg.textContent = t; };
    btn.disabled = true; setMsg('Hole das Bild…');
    try {
      const canFetch = await userscriptCanFetch();
      const img = await imageForTransfer(ref, canFetch);
      if (!img || (!img.blob && !img.url)) { btn.disabled = false; setMsg('Dieses Bild lässt sich nicht laden – bitte ein anderes wählen.'); return; }
      const e = byId(rankerPick.boId);
      const d = await transferDb();
      await new Promise((res, rej) => { const tx = d.transaction('jobs', 'readwrite'); tx.objectStore('jobs').put({ id: 'bo-img-' + Date.now(), from: 'b-organizer', createdAt: Date.now(), tab: rankerPick.tab, items: [{ boId: rankerPick.boId, name: e ? v(e, 'Name') : '', props: [], linkTo: rankerPick.id, create: false, replaceImage: true, blob: img.blob || null, url: img.url || '' }] }); tx.oncomplete = res; tx.onerror = tx.onabort = () => rej(tx.error); });
      d.close();
      if (transferChannel) transferChannel.postMessage({ type: 'job' });
      toast('Neues Bild an den Image Ranker übergeben' + (img.blob ? '.' : ' (nur als Link – Userscript nicht aktiv).'), 'ok');
      setMsg('✓ Gesendet. Du kannst zum Ranker zurückwechseln.');
      document.querySelectorAll('.rk-pick-btn').forEach(x => { x.disabled = true; });
      rankerPick = null;
    } catch (err) { btn.disabled = false; setMsg('Übergabe fehlgeschlagen: ' + (err && err.message || err)); }
  }
  function showDetail(id) {
    const e = byId(id); if (!e) return;
    const imgs = images(e);
    const skip = new Set(['Name', 'AKA', 'Exact Birthdate', 'Favorite', 'Tags', 'Notes', 'Profile URL', 'Archive URL']);
    const sec = (title, fields) => {
      const rows = fields.filter(f => !skip.has(f)).map(f => [f, fmtValue(e, f)]).filter(([, x]) => x !== '');
      if (!rows.length) return '';
      return `<div class="sec"><h3>${title}</h3><dl class="kv">${rows.map(([f, x]) => `<div><dt>${esc(lab(f))}</dt><dd>${esc(x)}</dd></div>`).join('')}</dl></div>`;
    };
    const links = ['Profile URL', 'Archive URL', ...LINK_FIELDS].filter(f => /^https?:\/\//i.test(v(e, f)));
    const galleries = splitList(e['Gallery Links']).filter(u => /^https?:\/\//i.test(u));
    const tags = splitList(e.Tags);

    const pos = shown.findIndex(x => x._id === e._id);
    const nav = pos >= 0 && shown.length > 1 ? `<div class="d-nav">
          <button class="btn small" data-dnav="-1" ${pos === 0 ? 'disabled' : ''} title="Vorheriger Eintrag (←)" aria-label="Vorheriger Eintrag">‹</button>
          <span class="muted">${pos + 1} / ${shown.length}</span>
          <button class="btn small" data-dnav="1" ${pos === shown.length - 1 ? 'disabled' : ''} title="Nächster Eintrag (→)" aria-label="Nächster Eintrag">›</button>
          <button class="btn small" data-action="random" title="Noch ein zufälliger Eintrag (Z)" aria-label="Zufälliger Eintrag">🎲</button></div>` : '';
    openModal(`
      <div class="modal-head">
        <h2>${esc(v(e, 'Name'))}</h2>
        ${nav}
        <div class="actions">
          <button class="btn small" data-action="to-ranker" data-id="${esc(e._id)}" title="An Image Ranker senden">🏆 An Ranker</button>
          <button class="btn small" data-action="edit" data-id="${esc(e._id)}">Bearbeiten</button>
          <button class="btn small" data-action="merge" data-id="${esc(e._id)}" title="Mit einem anderen Eintrag zusammenführen (doppelt angelegt, umbenannt …)">⇄ Zusammenführen</button>
          <button class="btn small danger" data-action="delete" data-id="${esc(e._id)}">Löschen</button>
          <button class="x" data-action="close" aria-label="Schließen">×</button>
        </div>
      </div>
      <div class="detail" data-detail="${esc(e._id)}">
        <div class="gallery">
          <div class="main" data-vw="0" title="Bilder ansehen">${coverTag(e)}${imgs.length > 1 ? `<span class="vw-hint">🖼 ${imgs.length}</span>` : ''}</div>
        </div>
        <div>
          <h1 class="d-title">${esc(v(e, 'Name'))}</h1>
          ${v(e, 'AKA') ? `<div class="d-aka">auch: ${esc(v(e, 'AKA'))}</div>` : ''}
          <div class="chips">
            <button class="chip accent" data-fav="${esc(e._id)}" style="cursor:pointer">${isTrue(e.Favorite) ? '♥ Favorit' : '♡ Als Favorit'}</button>
            ${v(e, 'Global Rating') ? `<span class="chip" title="Durchschnitt aller Nutzer auf Babepedia">Babepedia Ø ${esc(v(e, 'Global Rating'))}${v(e, 'Votes') ? ` (${esc(v(e, 'Votes'))} Stimmen)` : ''}</span>` : ''}
            ${v(e, 'Rank') ? `<span class="chip">Rank #${esc(v(e, 'Rank'))}</span>` : ''}
            ${v(e, 'Active') ? `<span class="chip">${isTrue(e.Active) ? 'aktiv' : 'inaktiv'}</span>` : ''}
            ${e._ranker ? `<a class="chip ranker" href="/Image-Ranker/#bo=${encodeURIComponent(e._id)}" target="_blank" rel="noopener" title="Im Image Ranker öffnen">🏆 ${esc(e._ranker.tier)} · Score ${e._ranker.score} · Platz ${e._ranker.rank}/${e._ranker.total} (${esc(e._ranker.tab)})</a>` : ''}
            ${rankerStale.has(e._id) ? `<button class="chip rk-stale" data-action="to-ranker" data-id="${esc(e._id)}" title="${esc(staleTitle(rankerStale.get(e._id)))}">⟳ Im Ranker veraltet: ${esc([...new Set(rankerStale.get(e._id).map(x => x.name))].join(', '))} – nochmal senden</button>` : ''}

            ${missingCore(e).length ? `<span class="chip missing" title="Diese Werte fehlen (werden auch vom Image Ranker genutzt)">⚠ fehlt: ${esc(missingCore(e).join(', '))}</span>` : ''}
            ${v(e, 'Archive URL') ? `<a class="chip" href="${esc(v(e, 'Archive URL'))}" target="_blank" rel="noopener noreferrer" title="Aus dem Internet Archive übernommen">🏛️ aus dem Archiv</a>` : ''}
            ${catList(e).map(c => `<button class="chip cat" data-cat="${esc(c)}" title="Alle aus diesem Bereich anzeigen">${esc(c)}</button>`).join('')}
            ${tags.map(t => `<button class="chip tag" data-tag="${esc(t)}">#${esc(t)}</button>`).join('')}
          </div>
          ${profileStatus(e).startsWith('gone') ? `<div class="sec gone-box">⚠︎ <b>${esc(STATUS_LABEL[profileStatus(e)])}</b>${v(e, 'Deleted Since') ? ` <span class="muted">(festgestellt ${esc(fmtDate(v(e, 'Deleted Since')))})</span>` : ''}<br><span class="muted">Daten und Bilder bleiben erhalten; das rollierende Update fragt dieses Profil nicht mehr ab.${profileStatus(e) === 'gone' ? ' Bilder von Babepedia können nach und nach nicht mehr laden – eigene Bilder hochladen sichert sie.' : ''} Taucht das Profil wieder auf, wird der Status beim nächsten Holen automatisch zurückgesetzt.</span></div>` : ''}
          ${scoreBox(e)}
          ${v(e, 'Notes') ? `<div class="sec"><h3>Notizen</h3><div class="notes">${esc(v(e, 'Notes'))}</div></div>` : ''}
          ${sec('Allgemein', GROUPS[0].fields)}
          ${sec('Aussehen', GROUPS[1].fields)}
          ${sec('Babepedia', GROUPS[3].fields)}
          ${imgs.length ? `<div class="sec"><h3>Bilder (${imgs.length}) <button class="cover-chk ${isTrue(e['Cover Checked']) ? 'on' : ''}" data-cover-chk="${esc(e._id)}" title="Kachelbild als geprüft markieren / Markierung entfernen">${isTrue(e['Cover Checked']) ? '✓ Kachelbild geprüft' : '☐ Kachelbild geprüft'}</button></h3><div class="img-grid">${imgs.map((u, i) => `<div class="img-cell" data-vw="${i}"><img src="${esc(thumbUrl(R(u)))}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" data-full="${esc(u)}" data-fallback="✕"${thumbUrl(R(u)) !== R(u) ? ` data-alts="${esc(R(u))}"` : ''}>${isLocal(u) ? '<span class="img-own" title="Eigenes Bild">📁</span>' : ''}<button class="img-cover-btn ${i === 0 ? 'on' : ''}" data-set-cover="${esc(u)}" data-id="${esc(e._id)}" title="${i === 0 ? 'Aktuelles Cover' : 'Als Cover verwenden'}">★</button></div>`).join('')}</div></div>` : ''}
          ${links.length ? `<div class="sec"><h3>Links</h3><div class="links">${links.map(f => `<a href="${esc(v(e, f))}" target="_blank" rel="noopener noreferrer">${esc(linkLabel(f))}</a>`).join('')}</div></div>` : ''}
          ${galleries.length ? `<div class="sec"><h3>Galerien (${galleries.length})</h3><div class="links">${galleries.map((u, i) => `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">Galerie ${i + 1}</a>`).join('')}</div></div>` : ''}
        </div>
      </div>`);
    if (rankerPick && rankerPick.boId === e._id) decoratePick(e);
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
      return `<div class="field check"><input type="checkbox" ${name} ${isTrue(val) ? 'checked' : ''}><label for="${id}">${esc(lab(f))}</label>${hint}</div>`;
    }
    let input;
    if (Array.isArray(t)) {
      const opts = t.includes(val) ? t : [...t, val];
      input = `<select ${name}>${opts.map(o => `<option value="${esc(o)}" ${o === val ? 'selected' : ''}>${esc(o || '–')}</option>`).join('')}</select>`;
    } else if (t === 'date') {
      input = `<input type="date" ${name} value="${esc(ddToIso(val))}">`;
    } else if (t === 'num') {
      input = `<input type="number" ${f === 'My Rating' ? 'min="1" max="10" step="1"' : 'step="any"'} ${name} value="${esc(val)}" ${f === 'Score' ? 'readonly' : ''}>`;
    } else if (t === 'score') {
      input = `<input type="number" min="1" max="5" step="${f === 'Sympathy Score' ? 1 : 0.5}" ${name} value="${esc(val)}">`;
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
    return `<div class="field${wide}"><label for="${id}">${esc(lab(f))}${f === 'Name' ? ' *' : ''}</label>${input}${hint}</div>`;
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
        <p>Bereits vorhandene Einträge werden anhand der Profil-URL erkannt und aktualisiert. Deine eigenen Felder (Favorit, Kategorien-Bewertung, Tags, Notizen) bleiben dabei erhalten.</p>
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

  // ---------- Blättern ----------
  // Detail: ‹ › / Pfeiltasten / Wischen wechseln zum vorherigen/nächsten Eintrag der aktuellen Liste.
  function detailStep(dir) {
    const det = $('[data-detail]', modal); if (!det) return;
    const i = shown.findIndex(x => x._id === det.dataset.detail);
    const n = shown[i + dir]; if (i < 0 || !n) return;
    showDetail(n._id);
    modal.classList.remove('slide-l', 'slide-r'); void modal.offsetWidth; modal.classList.add(dir > 0 ? 'slide-l' : 'slide-r');
  }

  // Bild-Betrachter: alle Bilder eines Eintrags; am Ende geht es mit dem nächsten Eintrag der Liste weiter.
  // Bedienung: ‹ › / Pfeiltasten / seitlich wischen = Bilder, ↑ ↓ / Knöpfe / nach oben wischen = Eintrag,
  // nach unten wischen / Esc = schließen, Doppeltipp = Zoom.
  let viewer = null;
  function openViewer(id, idx = 0) {
    let ids = shown.map(x => x._id);
    if (!ids.includes(id)) ids = [id];
    const el = document.createElement('div');
    el.className = 'viewer';
    el.innerHTML = `
      <div class="vw-top">
        <button class="vw-name" title="Details anzeigen"></button>
        <span class="vw-count"></span>
        <button class="vw-cover" title="Dieses Bild als Kachelbild (Cover) verwenden (K)">★ Als Kachelbild</button>
        <button class="vw-x" aria-label="Schließen">×</button>
      </div>
      <div class="vw-stage"><img alt="" referrerpolicy="no-referrer" draggable="false"><div class="vw-err" hidden>Bild lässt sich nicht laden</div></div>
      <button class="vw-arrow prev" aria-label="Vorheriges Bild">‹</button>
      <button class="vw-arrow next" aria-label="Nächstes Bild">›</button>
      <div class="vw-bottom">
        <button class="btn small" data-vwe="-1" title="Vorheriger Eintrag (↑)">⏮<span class="lbl"> Eintrag</span></button>
        <div class="vw-dots"></div>
        <button class="btn small" data-vwe="1" title="Nächster Eintrag (↓)"><span class="lbl">Eintrag </span>⏭</button>
      </div>`;
    document.body.appendChild(el);
    document.body.style.overflow = 'hidden';
    viewer = { el, ids, ei: ids.indexOf(id), ii: idx, imgs: [] };
    viewerLoad(true);

    el.addEventListener('click', (ev) => {
      const t = ev.target;
      if (t.closest('.vw-x')) return closeViewer();
      if (t.closest('.vw-cover')) return viewerSetCover();
      if (t.closest('.vw-arrow.prev')) return viewerStep(-1);
      if (t.closest('.vw-arrow.next')) return viewerStep(1);
      const eb = t.closest('[data-vwe]'); if (eb) return viewerEntry(Number(eb.dataset.vwe));
      const dot = t.closest('[data-dot]'); if (dot) { viewer.ii = Number(dot.dataset.dot); return viewerShow(); }
      if (t.closest('.vw-name')) { const id = viewer.ids[viewer.ei]; closeViewer(); showDetail(id); return; }
      if (t === el || t.classList.contains('vw-stage')) closeViewer();
    });
    el.addEventListener('dblclick', (ev) => { if (ev.target.tagName === 'IMG') toggleZoom(ev); });

    // Wischen
    let sx = 0, sy = 0, st = 0, multi = false, lastTap = 0;
    const img = $('.vw-stage img', el);
    el.addEventListener('touchstart', (ev) => {
      multi = ev.touches.length > 1; if (multi) return;
      sx = ev.touches[0].clientX; sy = ev.touches[0].clientY; st = Date.now();
    }, { passive: true });
    el.addEventListener('touchmove', (ev) => {
      if (multi || ev.touches.length > 1 || el.classList.contains('zoom')) { multi = multi || ev.touches.length > 1; return; }
      const dx = ev.touches[0].clientX - sx, dy = ev.touches[0].clientY - sy;
      img.style.transition = 'none';
      img.style.transform = Math.abs(dx) > Math.abs(dy) ? `translateX(${dx}px)` : `translateY(${dy}px)`;
      img.style.opacity = Math.abs(dy) > Math.abs(dx) ? String(Math.max(0.3, 1 - Math.abs(dy) / 500)) : '1';
    }, { passive: true });
    el.addEventListener('touchend', (ev) => {
      img.style.transition = ''; img.style.transform = ''; img.style.opacity = '';
      if (multi || el.classList.contains('zoom')) { if (ev.touches.length === 0) multi = false; return; }
      const tch = ev.changedTouches[0], dx = tch.clientX - sx, dy = tch.clientY - sy, fast = Date.now() - st < 300;
      const ax = Math.abs(dx), ay = Math.abs(dy);
      if (ax < 10 && ay < 10) {        // Tipp: Doppeltipp = Zoom
        if (ev.target.tagName === 'IMG' && Date.now() - lastTap < 300) { toggleZoom({ clientX: tch.clientX, clientY: tch.clientY }); lastTap = 0; ev.preventDefault(); }
        else lastTap = Date.now();
        return;
      }
      if (ax > ay && (ax > 60 || (fast && ax > 30))) viewerStep(dx < 0 ? 1 : -1);
      else if (ay > ax && (ay > 90 || (fast && ay > 40))) { if (dy > 0) closeViewer(); else viewerEntry(1); }
    });
  }
  function toggleZoom(ev) {
    const el = viewer && viewer.el; if (!el) return;
    const stage = $('.vw-stage', el), img = $('img', stage);
    const on = el.classList.toggle('zoom');
    if (on) {
      const r = img.getBoundingClientRect();
      const fx = (ev.clientX - r.left) / r.width, fy = (ev.clientY - r.top) / r.height;
      requestAnimationFrame(() => { stage.scrollLeft = fx * stage.scrollWidth - stage.clientWidth / 2; stage.scrollTop = fy * stage.scrollHeight - stage.clientHeight / 2; });
    }
  }
  function viewerLoad(keepIdx, atEnd) {
    // aktuellen Eintrag laden; Einträge ohne Bilder in Blätterrichtung überspringen
    const v0 = viewer, dir = v0.dir || 1, start = v0.ei;
    for (;;) {
      const e = byId(v0.ids[v0.ei]);
      v0.imgs = e ? images(e) : [];
      if (v0.imgs.length) break;
      const nx = v0.ei + dir;
      if (nx < 0 || nx >= v0.ids.length) { if (start !== v0.ei) { v0.ei = start; v0.imgs = images(byId(v0.ids[start])) || []; } break; }
      v0.ei = nx;
    }
    if (!keepIdx) v0.ii = atEnd ? v0.imgs.length - 1 : 0;
    v0.ii = Math.max(0, Math.min(v0.ii, v0.imgs.length - 1));
    viewerShow();
  }
  function viewerShow() {
    const { el, ids, ei, ii, imgs } = viewer;
    const e = byId(ids[ei]);
    $('.vw-name', el).textContent = e ? (isTrue(e.Favorite) ? '♥ ' : '') + v(e, 'Name') : '';
    $('.vw-count', el).textContent = (imgs.length ? `Bild ${ii + 1} / ${imgs.length}` : 'keine Bilder') + (ids.length > 1 ? ` · Eintrag ${ei + 1} / ${ids.length}` : '');
    const img = $('.vw-stage img', el), err = $('.vw-err', el);
    el.classList.remove('zoom');
    err.hidden = true; img.hidden = !imgs.length;
    if (imgs.length) {
      const full = R(imgs[ii]), alts = [full, thumbUrl(full)].filter((x, i, a) => x && a.indexOf(x) === i);
      let k = 0;
      img.onerror = () => { if (++k < alts.length) img.src = alts[k]; else { img.hidden = true; err.hidden = false; } };
      img.onload = () => { img.hidden = false; };
      img.src = alts[0];
      // Nachbarn vorladen
      [imgs[ii + 1], imgs[ii - 1]].filter(Boolean).forEach(u => { const p = new Image(); p.referrerPolicy = 'no-referrer'; p.src = R(u); });
    }
    const cb = $('.vw-cover', el), isCover = imgs.length && imgs[ii] === imgs[0];
    cb.hidden = !imgs.length;
    const ve = byId(viewer.ids[viewer.ei]);
    cb.classList.toggle('on', !!isCover);
    cb.classList.toggle('checked', !!isCover && isTrue(ve && ve['Cover Checked']));
    cb.textContent = coverBtnText(ve, isCover);
    cb.title = isCover ? 'Kachelbild als geprüft markieren / Markierung entfernen (K)' : 'Dieses Bild als Kachelbild verwenden (K)';
    $('.vw-dots', el).innerHTML = imgs.length > 1 && imgs.length <= 30 ? imgs.map((_, i) => `<button data-dot="${i}" class="${i === ii ? 'on' : ''}" aria-label="Bild ${i + 1}"></button>`).join('') : '';
    const last = ids.length === 1 && ii === imgs.length - 1, first = ids.length === 1 && ii === 0;
    $('.vw-arrow.prev', el).disabled = first; $('.vw-arrow.next', el).disabled = last;
    $$('[data-vwe]', el).forEach(b => { b.hidden = ids.length < 2; b.disabled = (b.dataset.vwe === '-1' ? ei === 0 : ei === ids.length - 1); });
  }
  // Kachelbild: anderes Bild → als Kachelbild setzen und als geprüft markieren; aktuelles Kachelbild → „geprüft“ umschalten
  function coverAction(e, u) {
    if (!e) return false;
    const imgs = images(e);
    if (u && imgs.length && u !== imgs[0]) {
      e.Cover = u; e['Cover Checked'] = 'true'; e._updated = Date.now();
      saveQuiet(); refreshItem(e._id); toast('Kachelbild gesetzt und als geprüft markiert.', 'ok');
      return true;
    }
    const on = !isTrue(e['Cover Checked']);
    e['Cover Checked'] = on ? 'true' : 'false'; e._updated = Date.now();
    saveQuiet(); refreshItem(e._id); toast(on ? 'Kachelbild als geprüft markiert.' : 'Markierung „Kachelbild geprüft“ entfernt.', 'ok');
    return false;
  }
  const coverBtnText = (e, isCover) => !isCover ? '☆ Als Kachelbild' : isTrue(e && e['Cover Checked']) ? '✓ Kachelbild geprüft' : '★ Kachelbild – passt?';
  function viewerSetCover() {
    if (!viewer) return;
    const e = byId(viewer.ids[viewer.ei]), u = viewer.imgs[viewer.ii];
    if (!e || !u) return;
    if (coverAction(e, u)) { viewer.imgs = images(e); viewer.ii = Math.max(0, viewer.imgs.indexOf(u)); }   // Cover steht jetzt vorne
    viewerShow();
  }
  function viewerStep(dir) {
    if (!viewer) return;
    const nx = viewer.ii + dir;
    if (nx >= 0 && nx < viewer.imgs.length) { viewer.ii = nx; return viewerShow(); }
    viewerEntry(dir, true);
  }
  function viewerEntry(dir, edge) {
    if (!viewer || viewer.ids.length < 2) return;
    const ne = viewer.ei + dir;
    if (ne < 0 || ne >= viewer.ids.length) { toast(dir > 0 ? 'Ende der Liste' : 'Anfang der Liste'); return; }
    viewer.ei = ne; viewer.dir = dir;
    viewerLoad(false, edge && dir < 0);
  }
  function closeViewer() {
    if (!viewer) return;
    const id = viewer.ids[viewer.ei];
    viewer.el.remove(); viewer = null;
    // Detail im Hintergrund auf den zuletzt angesehenen Eintrag bringen
    const det = !overlay.hidden && $('[data-detail]', modal);
    if (det && det.dataset.detail !== id) showDetail(id);
    if (overlay.hidden) document.body.style.overflow = '';
  }
  function browseImages() {
    if (!shown.length) { toast('Keine Einträge in der Liste.'); return; }
    openViewer(shown[0]._id, 0);
  }

  // ---------- ⭐ Bewertungsmodus ----------
  // Eintrag für Eintrag: Bild groß, Kategorien per Ziffer. Tasten: 1–5 = Wert für die markierte Kategorie
  // (springt weiter), . oder , = +½ auf den zuletzt gesetzten Wert, ↑/↓ bzw. G B H C S = Kategorie wählen,
  // ←/→ = Bild, Enter = nächster Eintrag, Rücktaste = vorheriger, Esc = beenden.
  let rater = null;
  function openRater() {
    const onlyOpen = ui.raterOnlyOpen !== false;
    const ids = shown.filter(e => !onlyOpen || !hasScore(e)).map(e => e._id);
    if (!ids.length) { toast(onlyOpen ? 'In der aktuellen Liste ist schon alles nach Kategorien bewertet.' : 'Keine Einträge in der Liste.'); return; }
    const el = document.createElement('div');
    el.className = 'rater';
    el.innerHTML = `
      <div class="rt-top">
        <button class="rt-name" title="Details öffnen"></button>
        <span class="rt-count"></span>
        <label class="chk rt-adv" title="Nach einer Ziffer automatisch zur nächsten Kategorie springen"><input type="checkbox" ${ui.raterAdvance ? 'checked' : ''}> Ziffer springt weiter</label>
        <label class="chk rt-only"><input type="checkbox" ${onlyOpen ? 'checked' : ''}> nur unbewertete</label>
        <button class="vw-x" aria-label="Beenden">×</button>
      </div>
      <div class="rt-body">
        <div class="rt-stage"><img alt="" referrerpolicy="no-referrer" draggable="false"><div class="vw-err" hidden>Bild lässt sich nicht laden</div>
          <button class="vw-arrow prev" aria-label="Vorheriges Bild">‹</button><button class="vw-arrow next" aria-label="Nächstes Bild">›</button><span class="rt-imgc"></span><button class="vw-cover rt-cover"></button></div>
        <div class="rt-panel">
          <div class="rt-meta"></div>
          <div class="rt-cats"></div>
          <div class="rt-sum"></div>
          <div class="rt-ref"></div>
          <label class="rt-notes"><span>Notizen <span class="muted">(Feld „Notes“, wird automatisch gespeichert)</span></span><textarea rows="3" placeholder="Eindruck, Begründung, Auffälligkeiten …"></textarea></label>
          <div class="rt-nav"><button class="btn" data-rt="-1">← Zurück</button><button class="btn primary" data-rt="1">Weiter →</button></div>
          <p class="muted rt-help">1–5 setzt die markierte Kategorie (bleibt stehen) · <kbd>.</kbd> +½ · <kbd>↑</kbd><kbd>↓</kbd> Kategorie · <kbd>←</kbd><kbd>→</kbd> Bild · <kbd>+</kbd><kbd>−</kbd> eine Stufe höher/tiefer · <kbd>Enter</kbd> weiter · <kbd>N</kbd> Notizen · <kbd>K</kbd> Kachelbild setzen/geprüft · <kbd>Esc</kbd> beenden<br>${SCORE_ANCHORS}</p>
        </div>
      </div>`;
    document.body.appendChild(el);
    document.body.style.overflow = 'hidden';
    rater = { el, ids, i: 0, img: 0, cat: 0, last: null, done: 0 };
    raterShow();
    el.addEventListener('click', (ev) => {
      const t = ev.target;
      if (t.closest('.vw-x')) return closeRater();
      if (t.closest('.vw-arrow.prev')) return raterImg(-1);
      if (t.closest('.vw-arrow.next')) return raterImg(1);
      if (t.closest('.rt-cover')) return raterCover();
      const nav = t.closest('[data-rt]'); if (nav) return raterStep(Number(nav.dataset.rt));
      const sc = t.closest('[data-score]');
      if (sc) { raterSet(SCORE_CATS.findIndex(c => c.f === sc.dataset.score), sc.dataset.val === '' ? '' : Number(sc.dataset.val), false); return; }
      const rs = t.closest('[data-ref-set]'); if (rs) { rater.preview = null; raterSet(rater.cat, Number(rs.dataset.refSet), false); return; }
      const rmo = t.closest('[data-ref-more]'); if (rmo) { rater.refOpen = Object.assign({}, rater.refOpen, { [rmo.dataset.refMore]: true }); raterRef(); return; }
      const ro = t.closest('[data-ref-open]');
      if (ro) { const x = byId(ro.dataset.refOpen); if (x) { const u = images(x)[0]; const im = $('.rt-stage img', rater.el); if (u) { rater.peek = x._id; im.src = R(u); $('.rt-imgc', rater.el).textContent = 'Vergleich: ' + v(x, 'Name') + ' – Bild antippen für zurück'; } } return; }
      if (t.closest('.rt-stage img') && rater.peek) { rater.peek = null; raterImgShow(); return; }
      const row = t.closest('[data-sc-idx]'); if (row) { rater.cat = Number(row.dataset.scIdx); raterCats(); return; }
      if (t.closest('.rt-name')) { const id = rater.ids[rater.i]; closeRater(); showDetail(id); }
    });
    const ta = $('.rt-notes textarea', el);
    let noteTimer = null;
    const saveNote = () => {
      clearTimeout(noteTimer); noteTimer = null;
      const e = raterEntry(); if (!e || ta.dataset.eid !== e._id) return;
      if ((e.Notes || '') === ta.value) return;
      e.Notes = ta.value; e._updated = Date.now(); saveQuiet(); refreshItem(e._id);
    };
    ta.addEventListener('input', () => { clearTimeout(noteTimer); noteTimer = setTimeout(saveNote, 600); });
    ta.addEventListener('blur', saveNote);
    rater.saveNote = saveNote;
    el.addEventListener('mouseover', (ev) => {
      const b = ev.target.closest('.rt-cats [data-score]');
      if (!b || b.dataset.val === '') return;
      const ci = SCORE_CATS.findIndex(c => c.f === b.dataset.score);
      const val = Number(b.dataset.val);
      if (rater.preview && rater.preview.cat === ci && rater.preview.val === val) return;
      rater.preview = { cat: ci, val }; raterRef();
    });
    el.addEventListener('mouseout', (ev) => {
      if (!rater.preview || !ev.target.closest('.rt-cats [data-score]')) return;
      if (ev.relatedTarget && ev.relatedTarget.closest && ev.relatedTarget.closest('.rt-cats [data-score]')) return;
      rater.preview = null; raterRef();
    });
    $('.rt-adv input', el).addEventListener('change', (ev) => { ui.raterAdvance = ev.target.checked; saveUI(); });
    $('.rt-only input', el).addEventListener('change', (ev) => { ui.raterOnlyOpen = ev.target.checked; saveUI(); toast('Gilt beim nächsten Start des Bewertungsmodus.'); });
    // Wischen auf dem Bild: Bilder wechseln
    let sx = 0, sy = 0;
    const stage = $('.rt-stage', el);
    stage.addEventListener('touchstart', (ev) => { if (ev.touches.length === 1) { sx = ev.touches[0].clientX; sy = ev.touches[0].clientY; } }, { passive: true });
    stage.addEventListener('touchend', (ev) => { const t = ev.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy; if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) raterImg(dx < 0 ? 1 : -1); });
  }
  // Alle Kategorie-Bewertungen entfernen (Notizen, alte eigene Note und Babepedia-Werte bleiben)
  async function clearScores() {
    const hit = entries.filter(e => SCORE_CATS.some(c => v(e, c.f)) || v(e, 'Score') || v(e, 'My Rating'));
    if (!hit.length) { toast('Es gibt keine Kategorie-Bewertungen.'); return; }
    if (!confirm(`⚠︎ Kategorien-Bewertungen zurücksetzen?\n\nBei ${hit.length} Einträgen werden Gesicht, Body, Hot, Cute und Sympathie gelöscht – und damit auch die Tool-Note.\n\nNotizen, die alte eigene Note und deine Babepedia-Werte bleiben erhalten.\nDas lässt sich nicht rückgängig machen (außer über ein Backup).\n\nTipp: vorher unter „Daten → Backup exportieren“ sichern.`)) return;
    if (!confirm(`Wirklich bei allen ${hit.length} Einträgen die Kategorien löschen?`)) return;
    const now = Date.now();
    for (const e of hit) {
      for (const c of SCORE_CATS) e[c.f] = '';
      e.Score = ''; e['My Rating'] = ''; e._updated = now;
    }
    refreshFilters(); render();
    try { await save(); toast(`Kategorien-Bewertungen bei ${hit.length} Einträgen zurückgesetzt.`, 'ok'); }
    catch (err) { toast('Speichern fehlgeschlagen: ' + (err && err.message || err), 'err'); }
  }
  // ---------- Babepedia-Note an die Tool-Note angleichen (über das Skript) ----------
  // Ziel = gerundete Tool-Note (1–10). Nur Einträge mit Tool-Note, Babe ID und aktivem Profil.
  function voteTarget(e) {
    if (!hasScore(e) || isTrue(e['Profile Deleted'])) return null;
    if (!/^\d+$/.test(v(e, 'Babe ID'))) return null;
    const t = Math.round(num(v(e, 'My Rating')));
    if (!(t >= 1 && t <= 10)) return null;
    const cur = num(v(e, 'User Rating'));
    return cur != null && Math.round(cur) === t ? null : t;
  }
  function votePing() {
    return new Promise(res => {
      const t = setTimeout(() => { window.removeEventListener('message', on); res(false); }, 1500);
      function on(ev) { if (ev.origin === location.origin && ev.data && ev.data.type === 'BP_VOTE_ACK') { clearTimeout(t); window.removeEventListener('message', on); res((ev.data.v || 1) >= 3); } }
      window.addEventListener('message', on);
      window.postMessage({ type: 'BP_VOTE_PING' }, location.origin);
    });
  }
  let voteRun = null;
  async function showVoteSync() {
    if (voteRun) { toast('Das Angleichen läuft schon.'); return; }
    const shown = filtered();
    const cand = shown.map(e => ({ e, t: voteTarget(e) })).filter(c => c.t != null);
    const noId = shown.filter(e => hasScore(e) && !isTrue(e['Profile Deleted']) && !/^\d+$/.test(v(e, 'Babe ID'))).length;
    if (!cand.length) { toast(`Keine Abweichungen: bei den angezeigten Einträgen stimmt die Babepedia-Note schon mit der Tool-Note überein${noId ? ` (${noId} ohne Babe ID übersprungen)` : ''}.`); return; }
    const max = ui.voteMax || 30;
    const row = (c) => `<tr><td>${esc(v(c.e, 'Name'))}</td><td class="num">${esc(v(c.e, 'User Rating') || '–')}</td><td class="num">→ <b>${c.t}</b></td><td class="num muted">${esc(v(c.e, 'Score'))}</td></tr>`;
    openModal(`
      <div class="modal-head"><h2>Babepedia-Noten angleichen</h2><div class="actions"><button class="x" data-action="close" aria-label="Schließen">×</button></div></div>
      <div class="help vote-dlg">
        <p>Bei <b>${cand.length}</b> der angezeigten Einträge weicht „Meine Babepedia-Note“ von der gerundeten Tool-Note ab. Das Skript trägt die Tool-Note auf Babepedia ein – dafür öffnet sich ein Babepedia-Tab (du musst dort eingeloggt sein), der die Liste abarbeitet (ein Profil alle 3 s) und sich danach schließt. Die ersten drei und dann jedes zehnte werden auf Babepedia nachgeprüft. Den Fortschritt siehst du dort und hier.${noId ? ` <span class="muted">${noId === 1 ? "1 Eintrag" : noId + " Einträge"} ohne Babe ID ${noId === 1 ? "wird" : "werden"} übersprungen.</span>` : ''}</p>
        <p class="muted">Es zählt die aktuelle Auswahl und Sortierung – mit Filtern kannst du eingrenzen, was dran kommt.</p>
        <label class="rk-limit">Höchstens <input type="number" id="vote-max" min="1" step="1" inputmode="numeric" value="${max}"> pro Lauf</label>
        <div class="vote-list"><table class="vote-tbl"><thead><tr><th>Name</th><th class="num">jetzt</th><th class="num">neu</th><th class="num">Tool-Note</th></tr></thead><tbody>${cand.slice(0, 300).map(row).join('')}</tbody></table>${cand.length > 300 ? `<p class="muted">… und ${cand.length - 300} weitere</p>` : ''}</div>
        <p id="vote-status" class="muted"></p>
        <div class="vote-acts"><button class="btn primary" id="vote-go">Auf Babepedia eintragen</button> <button class="btn" id="vote-stop" hidden>Anhalten</button></div>
        <pre id="vote-log" class="vote-log" hidden></pre>
      </div>`);
    $('#vote-go').addEventListener('click', async () => {
      const n = Math.max(1, parseInt($('#vote-max').value, 10) || max);
      ui.voteMax = n; saveUI();
      if (!(await votePing())) { $('#vote-status').textContent = '⚠︎ Das Skript antwortet nicht. Ist es in Tampermonkey aktiv und auf Version 14.26 oder neuer?'; return; }
      runVotes(cand.slice(0, n));
    });
  }
  function runVotes(list) {
    const id = 'vj' + Date.now().toString(36);
    voteRun = { id, seen: 0, total: list.length };
    const items = list.map(({ e, t }, i) => ({ _id: e._id, k: v(e, 'Babe ID'), x: t, name: v(e, 'Name'), url: v(e, 'Profile URL'), verify: i < 3 || i % 10 === 0 }));
    const go = $('#vote-go'), stop = $('#vote-stop');
    if (go) go.disabled = true;
    if (stop) { stop.hidden = false; stop.onclick = () => { window.postMessage({ type: 'BP_VOTE_STOP', id }, location.origin); stop.disabled = true; }; }
    if ($('#vote-status')) $('#vote-status').textContent = 'Babepedia-Tab wird geöffnet …';
    window.postMessage({ type: 'BP_VOTE_JOB', id, items }, location.origin);
  }
  // Fortschritt vom Skript (auch nachgereicht, wenn das Tool zwischendurch zu war)
  let voteDirty = false;
  async function onVoteProg(d) {
    const live = voteRun && voteRun.id === d.id;
    const results = Array.isArray(d.results) ? d.results : [];
    const from = live ? voteRun.seen : 0;
    const logEl = $('#vote-log');
    let changed = 0;
    for (const r of results.slice(from)) {
      if (live && logEl) { logEl.hidden = false; logEl.textContent += `${r.ok ? '✓' : '✗'} ${r.name}: ${r.x}${r.verified && r.ok ? ' (auf Babepedia geprüft)' : ''}${r.reason ? ' – ' + r.reason : (!r.ok && r.status != null ? ' – Status ' + r.status : '')}\n`; logEl.scrollTop = logEl.scrollHeight; }
    }
    for (const r of results) {
      if (!r.ok) continue;
      const e = byId(r._id);
      if (e && v(e, 'User Rating') !== String(r.x)) { e['User Rating'] = String(r.x); e._updated = Date.now(); changed++; }
    }
    if (live) voteRun.seen = results.length;
    if (live && $('#vote-status') && !d.finished) $('#vote-status').textContent = d.current ? `Läuft: ${d.current}` : `${results.length} / ${d.total} erledigt`;
    if (changed) voteDirty = true;
    if (voteDirty && (d.finished || results.length % 10 === 0)) {
      try { await save(); voteDirty = false; } catch (err) { toast('Speichern fehlgeschlagen: ' + (err && err.message || err), 'err'); }
    }
    if (!d.finished) return;
    const ok = results.filter(r => r.ok).length, fail = results.length - ok;
    const msg = `Babepedia-Noten: ${ok} eingetragen${fail ? `, ${fail} fehlgeschlagen` : ''}${d.reason ? ' – ' + d.reason : ''}.`;
    if (live) { if ($('#vote-status')) $('#vote-status').textContent = msg; const s2 = $('#vote-stop'); if (s2) s2.hidden = true; voteRun = null; }
    if (live || changed) { refreshFilters(); render(); toast(msg, fail ? 'err' : 'ok'); }
    window.postMessage({ type: 'BP_VOTE_DONE_ACK', id: d.id }, location.origin);
  }

  // ===================== KATEGORIE-ABGLEICH =====================
  // Zwei Einträge mit gleichem oder benachbartem Wert in einer Kategorie gegeneinander: hält die Bewertung stand?
  let calib = null;
  async function saveDuels() {
    try { await idbSet('duels', duels); if (SYNC) SYNC.changed(); }
    catch (err) { toast('Abgleich konnte nicht gespeichert werden: ' + (err && err.message || err), 'err'); }
  }
  const catSteps = (c) => c.vals || [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];
  const stepFrom = (c, x, d) => { const st = catSteps(c), i = st.indexOf(x); if (i < 0) return x; return st[Math.max(0, Math.min(st.length - 1, i + d))]; };
  const fmtV = (x) => String(x).replace('.', ',');
  // Kandidaten: aktuelle Liste, Wert in der Kategorie gesetzt (Sympathie 2,5 = „unbekannt“ zählt nicht)
  function calibPool(c) {
    return shown.filter(e => { const x = num(v(e, c.f)); return x != null && !(c.f === 'Sympathy Score' && x === 2.5); });
  }
  function calibPick() {
    const c = SCORE_CATS[calib.cat], pool = calibPool(c);
    if (pool.length < 2) return null;
    const cnt = new Map(), seen = new Set();
    for (const d of duels) if (d.cat === c.f) { cnt.set(d.a, (cnt.get(d.a) || 0) + 1); cnt.set(d.b, (cnt.get(d.b) || 0) + 1); seen.add([d.a, d.b].sort().join('|')); }
    const skip = calib.skip;
    const val = (e) => num(v(e, c.f));
    const rnd = () => Math.random();
    // A: möglichst selten verglichen; dann B mit gleichem/benachbartem Wert, noch nie gegen A
    const order = pool.slice().sort((x, y) => (cnt.get(x._id) || 0) - (cnt.get(y._id) || 0) || rnd() - .5);
    for (const a of order.slice(0, 60)) {
      const va = val(a);
      const opts = pool.filter(b => b !== a && Math.abs(val(b) - va) <= (c.vals ? 1 : 0.5) && !seen.has([a._id, b._id].sort().join('|')) && !skip.has([a._id, b._id].sort().join('|')));
      if (!opts.length) continue;
      // gleiche Werte etwas bevorzugen – dort ist die Frage „hält das?“ am klarsten
      opts.sort((x, y) => (Math.abs(val(x) - va) - Math.abs(val(y) - va)) * 0.5 + ((cnt.get(x._id) || 0) - (cnt.get(y._id) || 0)) * 0.3 + (rnd() - .5));
      const b = opts[0];
      return rnd() < .5 ? [a, b] : [b, a];
    }
    return null;
  }
  function openCalib() {
    if (calib) return;
    const el = document.createElement('div');
    el.className = 'calib';
    el.innerHTML = `
      <div class="cb-top">
        <b class="cb-title">⚖️ Kategorie-Abgleich</b>
        <div class="seg cb-cats">${SCORE_CATS.map((c, i) => `<button data-cbcat="${i}" title="Taste ${c.key}">${esc(c.label)}</button>`).join('')}</div>
        <span class="cb-count muted"></span>
        <button class="btn small cb-open" title="Duelle, bei denen du noch nicht entschieden hast">Offen (0)</button>
        <button class="vw-x" aria-label="Beenden">×</button>
      </div>
      <div class="cb-q"></div>
      <div class="cb-body"></div>
      <div class="cb-foot"></div>`;
    document.body.appendChild(el);
    document.body.style.overflow = 'hidden';
    calib = { el, cat: Math.max(0, Math.min(SCORE_CATS.length - 1, ui.calibCat || 0)), pair: null, img: [0, 0], answer: null, skip: new Set(), n: 0 };
    el.addEventListener('click', (ev) => {
      const t = ev.target;
      if (t.closest('.vw-x')) return closeCalib();
      const cc = t.closest('[data-cbcat]'); if (cc) return calibSetCat(Number(cc.dataset.cbcat));
      const an = t.closest('[data-cbans]'); if (an) return calibAnswer(an.dataset.cbans);
      const im = t.closest('[data-cbimg]'); if (im) return calibImg(Number(im.dataset.cbimg), ev.shiftKey ? -1 : 1);
      const fx = t.closest('[data-cbfix]'); if (fx) return calibFix(fx.dataset.cbfix, Number(fx.dataset.val), fx.dataset.duel);
      const kp = t.closest('[data-cbkeep]'); if (kp) return calibKeep(kp.dataset.cbkeep);
      const rd = t.closest('[data-cbredo]'); if (rd) { duels = duels.filter(x => x.id !== rd.dataset.cbredo); saveDuels(); return calibOpenList(); }
      if (t.closest('.cb-open')) return calib.list ? calibNext() : calibOpenList();
      if (t.closest('[data-cbback]')) return calibNext();
      if (t.closest('[data-cbnext]')) return calibNext();
      if (t.closest('[data-cbskip]')) { calib.skip.add(calib.pair.map(e => e._id).sort().join('|')); return calibNext(); }
      const nm = t.closest('[data-cbopen]'); if (nm) { const id = nm.dataset.cbopen; closeCalib(); showDetail(id); }
    });
    calibNext();
  }
  function closeCalib() {
    if (!calib) return;
    calib.el.remove(); calib = null;
    if (overlay.hidden) document.body.style.overflow = '';
    render();
  }
  function calibSetCat(i) { calib.cat = i; ui.calibCat = i; saveUI(); calibNext(); }
  // Hinweis „später entscheiden“: die Entscheidung bleibt in „Offen“, das Paar kommt nicht nochmal
  function calibNext() {
    calib.pair = calibPick(); calib.img = [0, 0]; calib.answer = null;
    calibRender();
  }
  function calibImg(side, d) {
    const e = calib.pair && calib.pair[side]; if (!e) return;
    const n = images(e).length; if (n < 2) return;
    calib.img[side] = (calib.img[side] + d + n) % n;
    calibRender();
  }
  function calibPaneHTML(e, side, reveal) {
    const c = SCORE_CATS[calib.cat], imgs = images(e), k = calib.img[side];
    const src = imgs.length ? R(imgs[k]) : '';
    const x = num(v(e, c.f));
    const mark = calib.answer && ((calib.answer === 'a' && side === 0) || (calib.answer === 'b' && side === 1)) ? ' win' : calib.answer === '=' ? ' tie' : '';
    return `<div class="cb-pane${mark}">
      <button class="cb-img" data-cbimg="${side}" title="Klick: nächstes Bild (Shift: vorheriges)">${src ? `<img src="${esc(src)}" alt="" referrerpolicy="no-referrer" draggable="false" onerror="this.onerror=null;this.src='${esc(thumbUrl(src) || '')}'">` : '<span class="muted">Keine Bilder</span>'}${imgs.length > 1 ? `<span class="cb-imgc">${k + 1} / ${imgs.length}</span>` : ''}</button>
      <div class="cb-name"><button class="linklike" data-cbopen="${esc(e._id)}" title="Details öffnen">${esc(v(e, 'Name'))}</button>
        <span class="cb-val">${reveal ? `${esc(c.label)}: <b>${fmtV(x)}</b>` : `${esc(c.label)}: <span class="muted">verdeckt</span>`}</span></div>
    </div>`;
  }
  // Bewertet ein Duell mit den AKTUELLEN Werten: hält es? Sonst Vorschläge zum Angleichen.
  function duelEval(d) {
    const c = SCORE_CATS.find(x => x.f === d.cat), A = byId(d.a), B = byId(d.b);
    if (!c || !A || !B) return null;
    const va = num(v(A, c.f)), vb = num(v(B, c.f));
    if (va == null || vb == null) return null;
    const fixes = [], fx = (e, val) => fixes.push({ id: e._id, val, txt: `${v(e, 'Name')} auf ${fmtV(val)}` });
    let ok = false, msg = '';
    if (d.r === '=') {
      ok = va === vb;
      if (ok) msg = 'Gleich eingeschätzt und gleich bewertet – hält.';
      else {
        const hi = va > vb ? A : B, lo = va > vb ? B : A, vh = Math.max(va, vb), vl = Math.min(va, vb);
        msg = vh - vl <= 0.5 && !c.vals ? `Gleich eingeschätzt, bewertet ${fmtV(vh)} gegen ${fmtV(vl)} – knapp, angleichen?` : `Gleich eingeschätzt, aber ${fmtV(vh)} gegen ${fmtV(vl)}.`;
        fx(hi, vl); fx(lo, vh);
      }
    } else {
      const win = d.r === 'a' ? A : B, lose = d.r === 'a' ? B : A;
      const vw = num(v(win, c.f)), vl = num(v(lose, c.f));
      if (vw > vl) { ok = true; msg = `${v(win, 'Name')} vorne und auch höher bewertet – hält.`; }
      else if (vw === vl) {
        msg = `${v(win, 'Name')} vorne, aber beide ${fmtV(vw)}.`;
        const up = stepFrom(c, vw, 1), dn = stepFrom(c, vl, -1);
        if (up !== vw) fx(win, up);
        if (dn !== vl) fx(lose, dn);
      } else {
        msg = `Widerspruch: ${v(win, 'Name')} vorne, aber niedriger bewertet (${fmtV(vw)} gegen ${fmtV(vl)}).`;
        fx(win, vl); fx(lose, vw);
      }
    }
    return { ok, msg, fixes, c, A, B };
  }
  // Offen = Duell passt (mit heutigen Werten) nicht und wurde weder angepasst noch „so gelassen“
  const duelOpen = (d) => !d.done && (() => { const r = duelEval(d); return r && !r.ok; })();
  function calibVerdict() {
    const d = calib.duel, r = duelEval(d);
    if (!r) return '';
    const fixes = r.fixes.map(f => `<button class="btn small" data-cbfix="${esc(f.id)}" data-val="${f.val}" data-duel="${esc(d.id)}">${esc(f.txt)}</button>`).join('');
    return `<div class="cb-verdict ${r.ok ? 'ok' : 'warn'}"><span>${r.ok ? '✓ ' : '⚠︎ '}${esc(r.msg)}</span>
      <span class="cb-fixes">${fixes}${fixes ? '<span class="muted">oder</span>' : ''}${fixes ? `<button class="btn small" data-cbkeep="${esc(d.id)}">so lassen</button>` : ''}<button class="btn small ${r.ok ? 'primary' : ''}" data-cbnext>${fixes ? 'später entscheiden' : 'Weiter'} <kbd>Enter</kbd></button></span></div>`;
  }
  // Liste der offenen Entscheidungen
  function calibOpenList() {
    const open = duels.filter(duelOpen).sort((a, b) => b.ts - a.ts);
    calib.list = true;
    const { el } = calib;
    $('.cb-q', el).innerHTML = `<b>Offene Entscheidungen</b> <span class="muted">(${open.length}) – Duelle, bei denen deine Wahl nicht zu den Werten passt</span>`;
    $('.cb-body', el).innerHTML = `<div class="cb-list">${open.length ? open.map(d => {
      const r = duelEval(d);
      const ans = d.r === '=' ? 'gleich' : `${esc(v(d.r === 'a' ? r.A : r.B, 'Name'))} vorne`;
      return `<div class="cb-item"><div class="cb-item-h"><b>${esc(r.c.label)}</b> · <button class="linklike" data-cbopen="${esc(r.A._id)}">${esc(v(r.A, 'Name'))}</button> (${fmtV(num(v(r.A, r.c.f)))}) gegen <button class="linklike" data-cbopen="${esc(r.B._id)}">${esc(v(r.B, 'Name'))}</button> (${fmtV(num(v(r.B, r.c.f)))}) · deine Wahl: ${ans} <span class="muted">· ${new Date(d.ts).toLocaleDateString('de-DE')}</span></div>
        <div class="cb-item-m muted">${esc(r.msg)}</div>
        <div class="cb-fixes">${r.fixes.map(f => `<button class="btn small" data-cbfix="${esc(f.id)}" data-val="${f.val}" data-duel="${esc(d.id)}">${esc(f.txt)}</button>`).join('')}<button class="btn small" data-cbkeep="${esc(d.id)}">so lassen</button><button class="btn small ghost" data-cbredo="${esc(d.id)}" title="Duell löschen, das Paar kommt wieder dran">neu vergleichen</button></div></div>`;
    }).join('') : '<p class="muted">Keine offenen Entscheidungen.</p>'}</div>`;
    $('.cb-foot', el).innerHTML = `<div class="cb-ans"><button class="btn primary" data-cbback>← zurück zum Abgleich</button></div>`;
    calibCount();
  }
  function calibCount() {
    const c = SCORE_CATS[calib.cat], done = duels.filter(d => d.cat === c.f).length, pool = calibPool(c).length, open = duels.filter(duelOpen).length;
    $('.cb-count', calib.el).textContent = `${done} Duell${done === 1 ? '' : 'e'} in ${c.label}${calib.n ? ` · ${calib.n} in dieser Runde` : ''} · ${pool} bewertet`;
    const ob = $('.cb-open', calib.el);
    ob.textContent = `Offen (${open})`; ob.classList.toggle('has', open > 0); ob.classList.toggle('on', !!calib.list);
  }
  function calibRender() {
    const { el } = calib, c = SCORE_CATS[calib.cat];
    $$('.cb-cats button', el).forEach((b, i) => b.classList.toggle('on', i === calib.cat));
    calib.list = false;
    const pool = calibPool(c).length;
    calibCount();
    if (!calib.pair) {
      $('.cb-q', el).innerHTML = '';
      $('.cb-body', el).innerHTML = `<div class="cb-empty"><p>${pool < 2 ? `In der aktuellen Liste sind in „${esc(c.label)}“ weniger als zwei Einträge bewertet.` : `Für „${esc(c.label)}“ gibt es gerade keine neuen Paare mit gleichem oder benachbartem Wert.`}</p><p class="muted">Andere Kategorie wählen oder später mit mehr Bewertungen wiederkommen.</p></div>`;
      $('.cb-foot', el).innerHTML = '';
      return;
    }
    const [A, B] = calib.pair, rev = !!calib.answer;
    $('.cb-q', el).innerHTML = `Wer ist in <b>${esc(c.label)}</b>${c.hint ? ` <span class="muted">(${esc(c.hint)})</span>` : ''} stärker?`;
    $('.cb-body', el).innerHTML = calibPaneHTML(A, 0, rev) + calibPaneHTML(B, 1, rev);
    $('.cb-foot', el).innerHTML = rev ? calibVerdict()
      : `<div class="cb-ans"><button class="btn" data-cbans="a"><kbd>←</kbd> links</button><button class="btn" data-cbans="="><kbd>↓</kbd> gleich</button><button class="btn" data-cbans="b">rechts <kbd>→</kbd></button></div>
         <p class="muted cb-help">Werte sind verdeckt, bis du entschieden hast · Bild anklicken bzw. <kbd>Q</kbd>/<kbd>P</kbd> = nächstes Bild links/rechts · ${SCORE_CATS.map(x => `<kbd>${x.key}</kbd>`).join('')} Kategorie · <kbd>Leertaste</kbd> überspringen · <kbd>Esc</kbd> beenden</p>`;
  }
  function calibAnswer(r) {
    if (!calib.pair || calib.answer) return;
    const c = SCORE_CATS[calib.cat], [A, B] = calib.pair;
    calib.answer = r; calib.n++;
    calib.duel = { id: 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), cat: c.f, a: A._id, b: B._id, va: num(v(A, c.f)), vb: num(v(B, c.f)), r, ts: Date.now() };
    duels.push(calib.duel);
    saveDuels();
    calibRender();
  }
  function calibFix(id, val, duelId) {
    const d = duels.find(x => x.id === duelId), c = SCORE_CATS.find(x => x.f === (d ? d.cat : SCORE_CATS[calib.cat].f));
    setScore(id, c.f, val);
    if (d) { d.done = 'fixed'; d.doneTs = Date.now(); saveDuels(); }
    toast(`${v(byId(id), 'Name')}: ${c.label} → ${fmtV(val)}`, 'ok');
    calib.list ? calibOpenList() : calibNext();
  }
  function calibKeep(duelId) {
    const d = duels.find(x => x.id === duelId);
    if (d) { d.done = 'keep'; d.doneTs = Date.now(); saveDuels(); }
    calib.list ? calibOpenList() : calibNext();
  }
  function calibKey(ev) {
    if (ev.target.closest && ev.target.closest('input, textarea, select')) return;
    const k = ev.key;
    if (k === 'Escape') { ev.preventDefault(); return closeCalib(); }
    const ci = SCORE_CATS.findIndex(c => c.key === k.toUpperCase());
    if (ci >= 0 && !ev.ctrlKey && !ev.metaKey) { ev.preventDefault(); return calibSetCat(ci); }
    if (calib.list) { if (k === 'Enter') { ev.preventDefault(); calibNext(); } return; }
    if (!calib.pair) return;
    if (!calib.answer) {
      if (k === 'ArrowLeft') { ev.preventDefault(); return calibAnswer('a'); }
      if (k === 'ArrowRight') { ev.preventDefault(); return calibAnswer('b'); }
      if (k === 'ArrowDown' || k === '=' || k === '0') { ev.preventDefault(); return calibAnswer('='); }
      if (k === ' ') { ev.preventDefault(); calib.skip.add(calib.pair.map(e => e._id).sort().join('|')); return calibNext(); }
    } else if (k === 'Enter' || k === ' ') { ev.preventDefault(); return calibNext(); }
    if (k === 'q' || k === 'Q') { ev.preventDefault(); return calibImg(0, 1); }
    if (k === 'p' || k === 'P') { ev.preventDefault(); return calibImg(1, 1); }
  }

  function openRaterFor(id) {
    const keep = ui.raterOnlyOpen; ui.raterOnlyOpen = false;
    closeModal(true);
    openRater();
    ui.raterOnlyOpen = keep;
    if (rater) { rater.fromDetail = true; const i = rater.ids.indexOf(id); if (i >= 0) { rater.i = i; raterShow(); } else { rater.ids.unshift(id); rater.i = 0; raterShow(); } }
  }
  function raterEntry() { return rater && byId(rater.ids[rater.i]); }
  function raterShow() {
    const e = raterEntry(); if (!e) return;
    const { el } = rater;
    $('.rt-name', el).textContent = (isTrue(e.Favorite) ? '♥ ' : '') + v(e, 'Name');
    $('.rt-count', el).textContent = `${rater.i + 1} / ${rater.ids.length}` + (rater.done ? ` · ${rater.done} bewertet` : '');
    $('.rt-meta', el).innerHTML = [natDisplay(e), age(e) != null ? age(e) + ' J.' : '', v(e, 'Professions'), siteRating(e) != null ? `meine Babepedia-Note ${v(e, 'User Rating')}` : '', v(e, 'Global Rating') ? `Babepedia Ø ${v(e, 'Global Rating')}` : '', e._ranker ? `Ranker ${e._ranker.tier} · ${e._ranker.score}` : '', v(e, 'My Rating (old)') ? `alte eigene Note ${v(e, 'My Rating (old)')}` : ''].filter(Boolean).map(esc).join(' · ');
    rater.img = 0; rater.refOpen = {}; rater.preview = null;
    const ta = $('.rt-notes textarea', el); ta.value = e.Notes || ''; ta.dataset.eid = e._id;
    raterImgShow(); raterCats();
    const nx = byId(rater.ids[rater.i + 1]); if (nx) { const u = images(nx)[0]; if (u) { const p = new Image(); p.referrerPolicy = 'no-referrer'; p.src = R(u); } }
  }
  function raterImgShow() {
    const e = raterEntry(), imgs = images(e), { el } = rater;
    rater.peek = null;
    const img = $('.rt-stage img', el), err = $('.rt-stage .vw-err', el);
    err.hidden = true; img.hidden = !imgs.length;
    $('.rt-imgc', el).textContent = imgs.length > 1 ? `${rater.img + 1} / ${imgs.length}` : '';
    const cb = $('.rt-cover', el), isCover = imgs.length && rater.img === 0;
    cb.hidden = !imgs.length;
    cb.classList.toggle('on', !!isCover); cb.classList.toggle('checked', !!isCover && isTrue(e['Cover Checked']));
    cb.textContent = coverBtnText(e, isCover) + ' (K)';
    if (!imgs.length) { err.hidden = false; err.textContent = 'Keine Bilder'; return; }
    const full = R(imgs[rater.img]), alts = [full, thumbUrl(full)].filter((x, i, a) => x && a.indexOf(x) === i);
    let k = 0;
    img.onerror = () => { if (++k < alts.length) img.src = alts[k]; else { img.hidden = true; err.hidden = false; err.textContent = 'Bild lässt sich nicht laden'; } };
    img.src = alts[0];
  }
  function raterImg(d) { const n = images(raterEntry()).length; if (n < 2) return; rater.img = (rater.img + d + n) % n; raterImgShow(); }
  function raterCats() {
    const e = raterEntry(), { el } = rater;
    $('.rt-cats', el).innerHTML = SCORE_CATS.map((c, i) => scoreRow(e, c, i, i === rater.cat)).join('');
    $('.rt-sum', el).innerHTML = scoreSummary(e);
    raterRef();
  }
  // Vergleich: wer liegt in der markierten Kategorie gleich, eine Stufe darüber und darunter?
  // Zeigt den gesetzten Wert – oder (Maus) den Wert, über dem der Zeiger gerade steht.
  function raterRef() {
    const e = raterEntry(), { el } = rater;
    const ci = rater.preview ? rater.preview.cat : rater.cat, c = SCORE_CATS[ci];
    const cur = num(e[c.f]);
    const center = rater.preview ? rater.preview.val : cur;
    const box = $('.rt-ref', el);
    const byVal = new Map();
    for (const x of entries) { const n = num(x[c.f]); if (n != null && x._id !== e._id) (byVal.get(n) || byVal.set(n, []).get(n)).push(x); }
    if (!byVal.size) { box.innerHTML = `<div class="muted rt-ref-empty">Vergleich: Sobald andere Einträge in „${esc(c.label)}“ bewertet sind, siehst du hier, wer gleich, darüber und darunter liegt.</div>`; return; }
    const lbl = (n) => String(n).replace('.5', '½');
    if (center == null) {
      box.innerHTML = `<div class="rt-ref-head"><b>${esc(c.label)}</b> <span class="muted">– Wert wählen (oder mit der Maus über eine Zahl fahren), dann siehst du, wer gleich, darüber und darunter liegt.</span></div>
        <div class="rt-ref-dist">${[...byVal.keys()].sort((a, b) => b - a).map(n => `<span>${lbl(n)}: ${byVal.get(n).length}</span>`).join('')}</div>`;
      return;
    }
    const vals = [...byVal.keys()].sort((a, b) => a - b);
    const above = vals.find(n => n > center), below = [...vals].reverse().find(n => n < center);
    const sortPeers = (list) => list.slice().sort((a, b) => (imgState(a) === 'none') - (imgState(b) === 'none') || (num(b.Score) ?? 0) - (num(a.Score) ?? 0));
    const open = rater.refOpen || {};
    const row = (n, kind) => {
      if (n == null) return `<div class="rt-ref-row empty"><span class="rt-ref-lbl">${kind === 'up' ? '▲ darüber' : '▼ darunter'}</span><span class="muted">– noch niemand</span></div>`;
      const peers = sortPeers(byVal.get(n) || []);
      const lim = open[n] ? 24 : 6;
      return `<div class="rt-ref-row ${kind}">
        <button class="rt-ref-lbl" data-ref-set="${n}" title="Diesen Wert setzen">${kind === 'up' ? '▲' : kind === 'down' ? '▼' : '='} <b>${lbl(n)}</b> <span class="muted">${peers.length}</span></button>
        <div class="rt-ref-strip">${peers.slice(0, lim).map(x => `<button class="rt-ref-item" data-ref-open="${esc(x._id)}" title="${esc(v(x, 'Name'))}${x.Score ? ' · ♥ ' + esc(String(x.Score).replace('.', ',')) : ''}">${coverTag(x)}<span>${esc(v(x, 'Name'))}</span></button>`).join('')}
          ${peers.length > lim ? `<button class="rt-ref-more" data-ref-more="${n}">+${peers.length - lim}</button>` : ''}${!peers.length ? '<span class="muted">– noch niemand</span>' : ''}</div>
      </div>`;
    };
    box.innerHTML = `<div class="rt-ref-head"><b>${esc(c.label)}</b> <span class="muted">${rater.preview ? 'Vorschau für ' + lbl(center) : 'Vergleich zu ' + lbl(center)} – Klick auf ein Bild zeigt es groß, auf den Wert setzt ihn</span></div>
      ${row(above, 'up')}${row(center, 'same')}${row(below, 'down')}`;
  }
  function raterSet(ci, val, advance) {
    const e = raterEntry(); if (!e || ci < 0) return;
    const c = SCORE_CATS[ci];
    const before = hasScore(e);
    setScore(e._id, c.f, val);
    if (!before && hasScore(e)) rater.done++;
    rater.last = ci;
    if (advance) rater.cat = Math.min(SCORE_CATS.length - 1, ci + 1);
    else rater.cat = ci;
    raterCats();
    $('.rt-count', rater.el).textContent = `${rater.i + 1} / ${rater.ids.length}` + (rater.done ? ` · ${rater.done} bewertet` : '');
  }
  function raterStep(d) {
    if (rater.saveNote) rater.saveNote();
    const n = rater.i + d;
    if (n < 0) return;
    if (n >= rater.ids.length) { toast(`Fertig – ${rater.done} Einträge bewertet.`, 'ok'); closeRater(); return; }
    rater.i = n; rater.cat = 0; rater.last = null; raterShow();
  }
  function raterCover() {
    const e = raterEntry(); if (!e || rater.peek) return;
    const u = images(e)[rater.img];
    if (coverAction(e, u)) rater.img = Math.max(0, images(e).indexOf(u));
    raterImgShow();
  }
  function raterKey(ev) {
    const k = ev.key;
    // Beim Tippen in den Notizen keine Tastenkürzel; Esc verlässt das Feld
    if (ev.target && ev.target.closest && ev.target.closest('.rt-notes')) { if (k === 'Escape') { ev.preventDefault(); rater.saveNote(); ev.target.blur(); } return; }
    if (k === 'Escape') { closeRater(); return; }
    if (k === 'n' || k === 'N') { ev.preventDefault(); $('.rt-notes textarea', rater.el).focus(); return; }
    if (k === 'k' || k === 'K') { ev.preventDefault(); raterCover(); return; }
    if (/^[1-5]$/.test(k)) { rater.preview = null; raterSet(rater.cat, Number(k), !!ui.raterAdvance); return; }
    if ((k === '.' || k === ',') && rater.last != null) {
      const c = SCORE_CATS[rater.last], cur = num(raterEntry()[c.f]);
      if (cur != null && cur % 1 === 0 && (c.vals ? c.vals.includes(cur + 0.5) : c.half && cur < 5)) raterSet(rater.last, cur + 0.5, false);
      if (ui.raterAdvance) { rater.cat = Math.min(SCORE_CATS.length - 1, rater.last + 1); raterCats(); }
      return;
    }
    // + / − : Wert der markierten Kategorie um eine (halbe) Stufe ändern – der Vergleich geht mit
    if (k === '+' || k === '-' || k === '*' || k === '_') {
      const c = SCORE_CATS[rater.cat], vals = c.vals || (c.half ? [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5] : [1, 2, 3, 4, 5]);
      const cur = num(raterEntry()[c.f]);
      const i = cur == null ? vals.indexOf(3) : vals.indexOf(cur);
      const ni = Math.max(0, Math.min(vals.length - 1, i + ((k === '+' || k === '*') ? 1 : -1)));
      rater.preview = null; raterSet(rater.cat, vals[ni], false);
      return;
    }
    if (k === 'ArrowDown' || k === 'Tab' || k === 'ArrowUp') rater.preview = null;
    if (k === 'ArrowDown' || k === 'Tab') { ev.preventDefault(); rater.cat = (rater.cat + (ev.shiftKey && k === 'Tab' ? SCORE_CATS.length - 1 : 1)) % SCORE_CATS.length; raterCats(); return; }
    if (k === 'ArrowUp') { ev.preventDefault(); rater.cat = (rater.cat + SCORE_CATS.length - 1) % SCORE_CATS.length; raterCats(); return; }
    const ck = SCORE_CATS.findIndex(c => c.key === k.toUpperCase());
    if (ck >= 0 && k.length === 1) { rater.cat = ck; raterCats(); return; }
    if (k === 'ArrowRight') { ev.preventDefault(); raterImg(1); return; }
    if (k === 'ArrowLeft') { ev.preventDefault(); raterImg(-1); return; }
    if (k === 'Enter' || k === ' ') { ev.preventDefault(); raterStep(1); return; }
    if (k === 'Backspace') { ev.preventDefault(); raterStep(-1); return; }
    if (k === 'Delete') { raterSet(rater.cat, '', false); return; }
  }
  function closeRater() {
    if (!rater) return;
    if (rater.saveNote) rater.saveNote();
    const backTo = rater.fromDetail ? rater.ids[rater.i] : null;
    rater.el.remove(); rater = null;
    if (overlay.hidden) document.body.style.overflow = '';
    render();
    if (backTo) showDetail(backTo);   // aus der Detailansicht gestartet: dorthin zurück (zum zuletzt bewerteten Eintrag)
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
      case 'merge': showMerge(el.dataset.id); break;
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
          download(`babe-organizer-backup-${stamp()}.json`, JSON.stringify({ app: 'bp-organizer', version: 2, exported: new Date().toISOString(), entries, duels, images }, null, 1), 'application/json');
          const n = Object.keys(images).length;
          if (n) toast(`Backup mit ${n} eigenen Bildern erstellt.`, 'ok');
        })().catch(err => toast('Backup fehlgeschlagen: ' + (err.message || err), 'err'));
        break;
      case 'scan-images': scanImages(true); break;
      case 'find-dups': findDuplicates(); break;
      case 'random': randomEntry(); break;
      case 'shortcuts': showShortcuts(); break;
      case 'export-csv':
        if (!entries.length) { toast('Keine Einträge zum Exportieren.', 'err'); break; }
        download(`babe-organizer-${entries.length}-profile.csv`, '﻿' + toCSV(entries), 'text/csv;charset=utf-8');
        break;
      case 'help': showHelp(); break;
      case 'clear-scores': clearScores(); break;
      case 'vote-sync': showVoteSync(); break;
      case 'calib': openCalib(); break;
      case 'upd-cfg': showUpdateSettings(); break;
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

    const rm = t.closest('[data-rate-mode]');
    if (rm && !t.closest('.rater')) { openRaterFor(rm.dataset.rateMode); return; }
    const sc = t.closest('[data-score]');
    if (sc && !t.closest('.rater')) {
      setScore(sc.dataset.id, sc.dataset.score, sc.dataset.val);
      const box = t.closest('.score-box');
      if (box) { const e = byId(sc.dataset.id); box.outerHTML = scoreBox(e); }
      return;
    }
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
    const dnav = t.closest('[data-dnav]');
    if (dnav) { detailStep(Number(dnav.dataset.dnav)); return; }
    const vw = t.closest('.detail [data-vw]');
    if (vw && t.tagName === 'IMG' || (vw && vw.classList.contains('main'))) {
      const det = t.closest('[data-detail]');
      if (det) { openViewer(det.dataset.detail, Number(vw.dataset.vw)); return; }
    }
    const rkPick = t.closest('[data-rk-pick]');
    if (rkPick) { sendReplacement(rkPick.dataset.rkPick, rkPick); return; }
    const cchk = t.closest('[data-cover-chk]');
    if (cchk) { const e = byId(cchk.dataset.coverChk); if (e) { coverAction(e, null); render(); showDetail(e._id); } return; }
    const setCover = t.closest('[data-set-cover]');
    if (setCover) {
      const e = byId(setCover.dataset.id);
      if (e) { coverAction(e, setCover.dataset.setCover); render(); showDetail(e._id); }
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
    if (calib) { calibKey(ev); return; }
    if (rater) { raterKey(ev); return; }
    if (viewer) {
      const k = ev.key;
      if (k === 'Escape') { closeViewer(); return; }
      if (k === 'ArrowRight' || k === ' ') { ev.preventDefault(); viewerStep(1); return; }
      if (k === 'ArrowLeft') { ev.preventDefault(); viewerStep(-1); return; }
      if (k === 'ArrowDown' || k === 'PageDown') { ev.preventDefault(); viewerEntry(1); return; }
      if (k === 'ArrowUp' || k === 'PageUp') { ev.preventDefault(); viewerEntry(-1); return; }
      if ((k === 'z' || k === 'Z') && viewer.ids.length > 1) { viewer.ei = Math.floor(Math.random() * viewer.ids.length); viewer.dir = 1; viewerLoad(false); return; }
      if (k === 'f' || k === 'F') { toggleFav(viewer.ids[viewer.ei]); viewerShow(); return; }
      if (k === 'k' || k === 'K') { viewerSetCover(); return; }
      return;
    }
    const tag = ((document.activeElement || {}).tagName || '');
    const typing = /INPUT|TEXTAREA|SELECT/.test(tag) || (document.activeElement && document.activeElement.isContentEditable);
    if (!typing && !ev.ctrlKey && !ev.metaKey && !ev.altKey) {
      const det = !overlay.hidden && $('[data-detail]', modal);
      const k = ev.key;
      if (det) {
        const id = det.dataset.detail;
        if (k === 'z' || k === 'Z') { randomEntry(); return; }
        if (k === ' ' || k === 'b' || k === 'B') { ev.preventDefault(); openViewer(id, 0); return; }
        if (k === 'f' || k === 'F') { toggleFav(id); return; }
        if (k === 'e' || k === 'E') { ev.preventDefault(); showForm(id); return; }
        if (k === 'r' || k === 'R') { ev.preventDefault(); openRaterFor(id); return; }
      } else if (overlay.hidden) {
        if (k === '/') { ev.preventDefault(); $('#q').focus(); return; }
        if (k === 'z' || k === 'Z') { randomEntry(); return; }
        if (k === 'b' || k === 'B') { browseImages(); return; }
        if (k === 'n' || k === 'N') { ev.preventDefault(); showForm(); return; }
        if (k === 'r' || k === 'R') { ev.preventDefault(); openRater(); return; }
        if (k === '?') { showShortcuts(); return; }
      }
    }
    if (!overlay.hidden && $('[data-detail]', modal) && !/INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '') && !ev.ctrlKey && !ev.metaKey && !ev.altKey) {
      if (ev.key === 'ArrowRight') { ev.preventDefault(); detailStep(1); return; }
      if (ev.key === 'ArrowLeft') { ev.preventDefault(); detailStep(-1); return; }
    }
    if (ev.key === 'Escape') {
      const lb = $('.lightbox'); if (lb) { lb.remove(); return; }
      if (!overlay.hidden) closeModal();
    }
    if ((ev.ctrlKey || ev.metaKey) && ev.key === 's' && $('#entry-form')) { ev.preventDefault(); saveForm(); }
  });

  $('#btn-new').addEventListener('click', () => showForm());
  $('#btn-browse').addEventListener('click', browseImages);
  $('#btn-pending').addEventListener('click', showPending);
  $('#btn-random').addEventListener('click', randomEntry);
  $('#btn-rate').addEventListener('click', openRater);
  // Desktop: Werkzeug-Knöpfe in der Kopfzeile (lösen dieselben Aktionen aus wie die in der Leiste)
  document.querySelector('.top-tools').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-proxy]'); if (!b) return;
    if (b.dataset.proxy === 'calib') return openCalib();
    const t = $(b.dataset.proxy); if (t) t.click();
  });
  // „Zufällig“ in der Sortierung: bei jeder erneuten Wahl neu mischen

  {
    // Detail: seitlich wischen = vorheriger/nächster Eintrag
    let sx = 0, sy = 0, st = 0, ok = false;
    overlay.addEventListener('touchstart', (ev) => {
      ok = ev.touches.length === 1 && !!$('[data-detail]', modal) && !ev.target.closest('input, textarea, select, .rating, .rk-pick');
      if (!ok) return;
      sx = ev.touches[0].clientX; sy = ev.touches[0].clientY; st = Date.now();
    }, { passive: true });
    overlay.addEventListener('touchend', (ev) => {
      if (!ok || viewer) return; ok = false;
      const t = ev.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.8 && Date.now() - st < 700) detailStep(dx < 0 ? 1 : -1);
    });
  }
  $('#file-input').addEventListener('change', (ev) => {
    const f = ev.target.files[0];
    if (f) handleFile(f);
    ev.target.value = '';
  });
  let searchTimer = null;
  $('#q').addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(render, 180); });
  ['#f-nationality', '#f-hair', '#f-eyes', '#f-body', '#f-active', '#f-fav', '#f-rating', '#f-cat', '#f-ranker', '#f-missing', '#f-status'].forEach(s => $(s).addEventListener('input', render));
  // Bild-Filter: ungeprüfte Einträge im Hintergrund prüfen, Liste danach aktualisieren
  $('#f-missing').addEventListener('input', (ev) => { if (filterNeedsImages(ev.target.value)) scanImages(false); });
  $('#sort').addEventListener('change', (ev) => {
    ui.sort = ev.target.value;
    if (ui.sort === 'random') shuffleSeed = Math.floor(Math.random() * 2 ** 31);   // erneut wählen = neu mischen
    saveUI(); render();
  });
  $$('.seg button').forEach(b => b.addEventListener('click', () => { ui.view = b.dataset.view; if (ui.view !== 'stats') ui.lastListView = ui.view; saveUI(); render(); }));
  $('#btn-to-ranker').addEventListener('click', () => openRankerSend(filtered()));
  // Statistik: auf-/zugeklappte Gruppen merken
  document.addEventListener('toggle', (ev) => {
    const d = ev.target; if (!d.matches || !d.matches('details.st-group')) return;
    const id = d.dataset.stg, set = new Set(ui.statsClosed || []);
    d.open ? set.delete(id) : set.add(id);
    ui.statsClosed = [...set]; saveUI();
  }, true);
  $('#main').addEventListener('click', (ev) => {
    if (ui.view === 'stats') {
      const mm = ev.target.closest('[data-map-mode]'), mv = ev.target.closest('[data-map-view]'), cty = ev.target.closest('#map-box [data-iso]');
      if (mm || mv) {
        if (mm) ui.mapMode = mm.dataset.mapMode; else ui.mapView = mv.dataset.mapView;
        saveUI();
        $$('[data-map-mode]').forEach(x => x.classList.toggle('on', x.dataset.mapMode === ui.mapMode));
        $$('[data-map-view]').forEach(x => x.classList.toggle('on', x.dataset.mapView === ui.mapView));
        $('#map-info').innerHTML = '<span class="muted">Land antippen für Details.</span>';
        drawWorldMap(filtered());
        return;
      }
      if (cty) { mapPick(cty.dataset.iso); return; }
    }
    const b = ev.target.closest('[data-sf]'); if (!b || ui.view !== 'stats') return;
    if (b.closest('summary')) return;
    const r = statRefs[Number(b.dataset.sf)]; if (!r || !r.test) return;
    statFilter = { label: r.flabel || r.label, test: r.test };
    ui.view = ui.lastListView || 'grid'; saveUI(); render(); window.scrollTo(0, 0);
  });
  $('#sf').addEventListener('click', (ev) => { if (ev.target.closest('#sf-clear')) { statFilter = null; render(); } });
  $('#xf').addEventListener('input', (ev) => { const sel = ev.target.closest('[data-xf]'); if (!sel) return; xfVals[sel.dataset.xf] = sel.value; render(); });
  $('#btn-view-cfg').addEventListener('click', showViewSettings);
  applyFilterVisibility();
  applyCardLook();
  if (ui.sort === 'mine') ui.sort = 'score';
  if (['young', 'old', 'height'].includes(ui.sort)) ui.sort = 'name';   // Sortierung nach Alter/Größe entfernt   // „Meine Bewertung“ ist jetzt die Tool-Note
  $('#btn-reset').addEventListener('click', () => {
    $('#q').value = ''; Object.keys(FILTERS).forEach(id => $('#' + id).value = '');
    $('#f-active').value = ''; $('#f-rating').value = ''; $('#f-cat').value = ''; $('#f-ranker').value = ''; $('#f-missing').value = ''; $('#f-status').value = ''; $('#f-fav').checked = false;
    for (const k of Object.keys(xfVals)) delete xfVals[k];
    statFilter = null;
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
      collections: { entries: { type: 'array', id: '_id' }, duels: { type: 'array', id: 'id' } },
      shards: 32,
      stampDelay: 1500,
      get: () => ({ entries, duels }),
      apply: async (d) => {
        entries = (d.entries || []).filter(e => e && typeof e === 'object').map(derive); entriesGen++;
        if (Array.isArray(d.duels)) duels = d.duels.filter(x => x && x.id);
        try { await save(); await idbSet('duels', duels); } catch { return false; }
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

  // Einträge, die schon in einem noch nicht abgeholten Auftrag stecken (Ranker noch nicht geöffnet) – nicht doppelt senden
  async function pendingTransferIds(tab) {
    try {
      const d = await transferDb();
      const jobs = await new Promise(res => { const r = d.transaction('jobs').objectStore('jobs').getAll(); r.onsuccess = () => res(r.result || []); r.onerror = () => res([]); });
      d.close();
      return new Set(jobs.filter(j => j.from === 'b-organizer' && j.tab === tab).flatMap(j => (j.items || []).map(i => i.boId)));
    } catch { return new Set(); }
  }
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
  const RK_FIELDS = [...GROUPS[0].fields, ...GROUPS[1].fields, 'My Rating', 'Score', 'Face Score', 'Body Score', 'Hot Score', 'Cute Score', 'Sympathy Score', 'Favorite', 'Tags', 'Global Rating', 'User Rating', 'Alter']
    .filter((f, i, a) => a.indexOf(f) === i && !['Name', 'Exact Birthdate'].includes(f))
    .flatMap(f => f === 'Born' ? ['Born', 'Geburtsjahr'] : [f]);      // „Geburtsjahr“ = nur die Jahreszahl aus Born
  const RK_NUMBERS = new Set(['Alter', 'Geburtsjahr']);
  const rkType = (f) => RK_MULTI.has(f) ? 'multi' : (RK_NUMBERS.has(f) || TYPES[f] === 'num' || TYPES[f] === 'score') ? 'number' : 'exact';
  function rkValues(e, f, type) {
    if (f === 'Alter') { const a = age(e); return a == null ? [] : [String(a)]; }
    if (f === 'Geburtsjahr') { const m = String(v(e, 'Born')).match(/(\d{4})$/); return m ? [m[1]] : []; }
    // Nationalität immer einheitlich mit Flagge senden – auch bei von Hand eingetragenen Werten ohne Flagge
    if (f === 'Nationality') { const n = natNames(e).map(withFlag); return !n.length ? [] : type === 'multi' ? n : [n.join(', ')]; }
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
        return `<div class="rk-f"><label class="chk"><input type="checkbox" data-rk-f="${esc(f)}" ${s ? 'checked' : ''}> ${esc(lab(f))}</label>
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
        ${single ? '' : `<label class="rk-limit">Höchstens <input type="number" id="rk-limit" min="1" step="1" inputmode="numeric" placeholder="alle" value="${prefs._limit || ''}"> Einträge, die noch nicht im Ranker sind <span class="muted">(in der aktuellen Sortierung; schon verknüpfte zählen nicht – beim nächsten Mal kommen die nächsten dran)</span></label>`}
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
      const limit = single ? 0 : Math.max(0, Math.floor(Number($('#rk-limit').value) || 0));
      prefs[t] = Object.assign({}, prefs[t], { fields }); prefs._lastTab = t; prefs._linkOnly = linkOnly;
      if (!single) { if (limit) prefs._limit = limit; else delete prefs._limit; }
      rkSavePrefs(prefs);
      $('#rk-next').disabled = true; $('#rk-msg').textContent = 'Lese den Ranker…';
      const rImgs = await rankerTabImages(t);
      const rows = matchEntries(list, rImgs);
      // Entscheidung je Eintrag: 'link' (target), 'new', 'skip'
      const pending = await pendingTransferIds(t);
      rows.forEach(r => { if (pending.has(r.e._id) && (r.kind === 'none' || r.kind === 'check')) { r.kind = 'pending'; r.target = null; } });
      rows.forEach(r => { r.dec = r.target ? 'link' : (r.kind === 'none' && !linkOnly ? 'new' : 'skip'); });
      // Limit: nur die ersten N Einträge, die noch nicht im Ranker sind (kein Treffer / bitte prüfen); der Rest kommt beim nächsten Mal
      if (limit) {
        let n = 0;
        rows.forEach(r => { if (r.kind === 'none' || r.kind === 'check') { if (++n > limit) { r.kind = 'later'; r.dec = 'skip'; r.target = null; } } });
      }
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
          ${sec('⏳ Schon gesendet, wartet auf den Ranker', g('pending'), false, 'Diese Einträge stecken in einem Auftrag, den der Image Ranker noch nicht abgeholt hat (er übernimmt ihn beim nächsten Öffnen). Sie werden nicht noch einmal gesendet.')}
          ${sec('⏸ Später (über dem Limit)', g('later'), false, 'Werden diesmal übersprungen und beim nächsten Senden angeboten. Einzelne kannst du trotzdem jetzt verknüpfen oder neu anlegen.')}
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
        c.onsuccess = () => { const k = c.result; if (!k) { d.close(); return res(out); } const im = k.value; out.push({ id: im.id, tab: im.tab, elo: im.elo, boId: im.boId, tags: im.boId ? im.tags : null }); k.continue(); };
        c.onerror = () => { d.close(); res(null); };
      };
    });
    if (!imgs || !imgs.length) return;
    // Eigenschaften im Ranker merken (nur lesen), um veraltete Werte zu erkennen
    rankerTags = new Map();
    imgs.forEach(i => { if (i.boId) { if (!rankerTags.has(i.boId)) rankerTags.set(i.boId, []); rankerTags.get(i.boId).push({ tab: i.tab, tags: i.tags || {} }); } });
    rankerStale = new Map();
    for (const e of entries) { const d = computeStale(e); if (d.length) rankerStale.set(e._id, d); }
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
    else if (staleSig() !== lastStaleSig) render();
    lastStaleSig = staleSig();
  }
  // ---------- Ranker veraltet ----------
  // Vergleicht die Werte, die beim Senden als Eigenschaften gewählt wurden (Auswahl pro Reiter in
  // 'bp-organizer-ranker'), mit dem, was im Image Ranker steht. Unterschiede = nochmal senden.
  let rankerTags = new Map(), rankerStale = new Map(), lastStaleSig = '';
  const staleSig = () => [...rankerStale.keys()].sort().join(',');
  const rkNorm = (x) => { const t = String(x ?? '').trim().toLowerCase(); return t !== '' && !isNaN(Number(t)) ? String(Number(t)) : t; };
  function computeStale(e) {
    const list = rankerTags.get(e._id); if (!list) return [];
    const prefs = rkPrefs(), out = [];
    for (const { tab, tags } of list) {
      const fields = prefs[tab] && prefs[tab].fields; if (!fields) continue;   // für diesen Reiter nie gesendet
      for (const [f, spec] of Object.entries(fields)) {
        const name = spec.name || f, type = spec.type;
        const want = rkValues(e, f, type).map(rkNorm).filter(Boolean);
        const t = tags[name];
        const have = (t ? (type === 'multi' && Array.isArray(t.values) ? t.values : [t.value]) : []).map(rkNorm).filter(Boolean);
        const same = type === 'multi' ? want.length === have.length && want.every(x => have.includes(x)) : (want[0] || '') === (have[0] || '');
        if (!same) out.push({ tab, f, name, have: t ? (t.values ? t.values.join(', ') : t.value) : '', want: rkValues(e, f, type).join(', ') });
      }
    }
    return out;
  }
  function refreshStale(id) {
    if (!rankerTags.size) return;
    const e = byId(id); if (!e) return;
    const d = computeStale(e);
    if (d.length) rankerStale.set(id, d); else rankerStale.delete(id);
  }
  const staleTitle = (d) => 'Im Ranker veraltet – nochmal senden:\n' + d.map(x => `${x.name}: ${x.have || '(leer)'} → ${x.want || '(leer)'}`).join('\n');
  if (transferChannel) transferChannel.onmessage = (ev) => { if (ev.data && ev.data.type === 'done' && ready) readRankerStatus().catch(() => {}); };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && ready) readRankerStatus().catch(() => {}); });

  // Direktlink /b-organizer/#e=<id> (z. B. aus dem Image Ranker) öffnet den Eintrag
  function openFromHash() {
    const m = location.hash.match(/^#e=([^&]+)(?:&pick=(\d+)&tab=(.*))?$/);
    if (!m || !ready) return;
    const id = decodeURIComponent(m[1]);
    rankerPick = m[2] ? { id: Number(m[2]), tab: decodeURIComponent(m[3] || '') || 'Standard', boId: id } : null;
    history.replaceState(null, '', location.pathname + location.search);
    if (byId(id)) showDetail(id); else toast('Dieser Eintrag ist im Babe Organizer nicht (mehr) vorhanden.', 'err');
  }
  window.addEventListener('hashchange', openFromHash);

  // Änderungen aus anderen Tabs übernehmen
  if (channel) channel.onmessage = async () => { const fresh = await load(); entries = fresh; entriesGen++; await loadLocalImages().catch(() => {}); refreshFilters(); render(); };

  (async () => {
    $('#main').innerHTML = '<div class="empty"><p>Lade Daten…</p></div>';
    try {
      entries = await load();
      await loadLocalImages().catch(() => {});
      await loadImgCheck();
      await loadPending();
      try { duels = (await idbGet('duels')) || []; } catch { duels = []; }
      // Einmalig: Einträge mit Archiv-Kopie gelten als auf Babepedia gelöscht (Archiv-Übernahme = Original weg)
      try {
        if (!localStorage.getItem('bp-organizer-archmig1')) {
          for (const e of entries) if (v(e, 'Archive URL') && !isTrue(e['Profile Deleted'])) { e['Profile Deleted'] = 'true'; e._updated = Date.now(); deriveChanged = true; }
          localStorage.setItem('bp-organizer-archmig1', '1');
        }
        // Einmalig: bei Archiv-Einträgen ist „Zuletzt geholt“ das Datum der Archiv-Kopie
        if (!localStorage.getItem('bp-organizer-archmig2')) {
          for (const e of entries) {
            const ad = isTrue(e['Profile Deleted']) && archiveDate(v(e, 'Archive URL'));
            if (ad && v(e, 'Scraped At') !== ad) { e['Scraped At'] = ad; e._updated = Date.now(); deriveChanged = true; }
          }
          localStorage.setItem('bp-organizer-archmig2', '1');
        }
      } catch (_) {}
      // Einmalige Umstellung (z. B. English → British) dauerhaft speichern, sobald der Sync bereit ist
      if (deriveChanged) setTimeout(() => { deriveChanged = false; save().then(() => toast('Gespeicherte Werte vereinheitlicht und gespeichert.', 'ok')).catch(() => {}); }, 2500);
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
