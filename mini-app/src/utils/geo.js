// Флаг-эмодзи в Unicode — это не картинка, а две буквы ISO-кода страны,
// закодированные "Regional Indicator Symbol" — их можно посчитать
// формулой, без картинок и интернета.
export function codeToFlag(code) {
  if (!code || typeof code !== 'string') return null;
  const upper = code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(upper)) return null;
  return String.fromCodePoint(...[...upper].map((c) => 127397 + c.charCodeAt(0)));
}

// Название страны (по-русски или по-английски, в любом регистре) →
// код ISO 3166-1 alpha-2. Ключи в нижнем регистре для сравнения.
const COUNTRY_CODES = {
  // Европа
  germany: 'DE', германия: 'DE', deutschland: 'DE',
  poland: 'PL', польша: 'PL',
  france: 'FR', франция: 'FR',
  italy: 'IT', италия: 'IT',
  spain: 'ES', испания: 'ES',
  portugal: 'PT', португалия: 'PT',
  netherlands: 'NL', нидерланды: 'NL', голландия: 'NL', holland: 'NL',
  belgium: 'BE', бельгия: 'BE',
  switzerland: 'CH', швейцария: 'CH',
  austria: 'AT', австрия: 'AT',
  'united kingdom': 'GB', uk: 'GB', britain: 'GB', 'great britain': 'GB', england: 'GB',
  великобритания: 'GB', англия: 'GB', британия: 'GB',
  ireland: 'IE', ирландия: 'IE',
  sweden: 'SE', швеция: 'SE',
  norway: 'NO', норвегия: 'NO',
  denmark: 'DK', дания: 'DK',
  finland: 'FI', финляндия: 'FI',
  iceland: 'IS', исландия: 'IS',
  greece: 'GR', греция: 'GR',
  'czech republic': 'CZ', czechia: 'CZ', чехия: 'CZ',
  slovakia: 'SK', словакия: 'SK',
  slovenia: 'SI', словения: 'SI',
  croatia: 'HR', хорватия: 'HR',
  serbia: 'RS', сербия: 'RS',
  bulgaria: 'BG', болгария: 'BG',
  romania: 'RO', румыния: 'RO',
  hungary: 'HU', венгрия: 'HU',
  ukraine: 'UA', украина: 'UA',
  belarus: 'BY', беларусь: 'BY', белоруссия: 'BY',
  russia: 'RU', россия: 'RU',
  moldova: 'MD', молдова: 'MD',
  latvia: 'LV', латвия: 'LV',
  lithuania: 'LT', литва: 'LT',
  estonia: 'EE', эстония: 'EE',
  luxembourg: 'LU', люксембург: 'LU',
  malta: 'MT', мальта: 'MT',
  cyprus: 'CY', кипр: 'CY',
  turkey: 'TR', турция: 'TR',
  georgia: 'GE', грузия: 'GE',
  armenia: 'AM', армения: 'AM',
  azerbaijan: 'AZ', азербайджан: 'AZ',
  kazakhstan: 'KZ', казахстан: 'KZ',
  uzbekistan: 'UZ', узбекистан: 'UZ',
  // Северная Америка
  usa: 'US', us: 'US', america: 'US', 'united states': 'US',
  сша: 'US', америка: 'US',
  canada: 'CA', канада: 'CA',
  mexico: 'MX', мексика: 'MX',
  // Южная Америка
  brazil: 'BR', бразилия: 'BR',
  argentina: 'AR', аргентина: 'AR',
  chile: 'CL', чили: 'CL',
  colombia: 'CO', колумбия: 'CO',
  peru: 'PE', перу: 'PE',
  venezuela: 'VE', венесуэла: 'VE',
  // Азия
  china: 'CN', китай: 'CN',
  japan: 'JP', япония: 'JP',
  'south korea': 'KR', korea: 'KR', южнаякорея: 'KR', корея: 'KR',
  india: 'IN', индия: 'IN',
  indonesia: 'ID', индонезия: 'ID',
  vietnam: 'VN', вьетнам: 'VN',
  thailand: 'TH', таиланд: 'TH',
  philippines: 'PH', филиппины: 'PH',
  malaysia: 'MY', малайзия: 'MY',
  singapore: 'SG', сингапур: 'SG',
  taiwan: 'TW', тайвань: 'TW',
  'hong kong': 'HK', гонконг: 'HK',
  pakistan: 'PK', пакистан: 'PK',
  bangladesh: 'BD', бангладеш: 'BD',
  israel: 'IL', израиль: 'IL',
  uae: 'AE', 'united arab emirates': 'AE', оаэ: 'AE',
  'saudi arabia': 'SA', саудовскаяаравия: 'SA',
  qatar: 'QA', катар: 'QA',
  // Африка
  egypt: 'EG', египет: 'EG',
  morocco: 'MA', марокко: 'MA',
  'south africa': 'ZA', юар: 'ZA',
  nigeria: 'NG', нигерия: 'NG',
  kenya: 'KE', кения: 'KE',
  // Океания
  australia: 'AU', австралия: 'AU',
  'new zealand': 'NZ', новаязеландия: 'NZ',
};

// Ключи словаря без пробелов (для сравнения "great britain" ~
// "greatbritain") — нормализуем ввод так же.
function normalize(name) {
  return (name || '').trim().toLowerCase();
}

export function countryNameToCode(name) {
  const key = normalize(name);
  if (!key) return null;
  if (COUNTRY_CODES[key]) return COUNTRY_CODES[key];
  const collapsed = key.replace(/\s+/g, '');
  return COUNTRY_CODES[collapsed] ?? null;
}

// Главная функция — название страны → готовый флаг-эмодзи (или null,
// если страна не распознана).
export function geoToFlag(geoName) {
  const code = countryNameToCode(geoName);
  return code ? codeToFlag(code) : null;
}
