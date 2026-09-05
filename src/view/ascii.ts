/**
 * The Bar's fonts are ASCII bitmaps, so anything else draws as a blank or a
 * fallback box. Half a library of tracks here is in Cyrillic, so transliterate
 * rather than drop: "Гражданская оборона" reading as "Grazhdanskaya oborona"
 * is worth more than eighteen empty pixels.
 */
const CYRILLIC: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  ґ: 'g',
  д: 'd',
  е: 'e',
  ё: 'yo',
  є: 'ye',
  ж: 'zh',
  з: 'z',
  и: 'i',
  і: 'i',
  ї: 'yi',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'kh',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'shch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
};

const PUNCTUATION: Record<string, string> = {
  '–': '-',
  '—': '-',
  '―': '-',
  '−': '-',
  '‘': "'",
  '’': "'",
  '‚': ',',
  '“': '"',
  '”': '"',
  '…': '...',
  '×': 'x',
  '•': '-',
  ' ': ' ',
  '™': 'tm',
  '©': '(c)',
  '®': '(r)',
  '°': 'deg',
  '€': 'EUR',
  '£': 'GBP',
  '☆': '*',
  '★': '*',
  '❤': '<3',
};

export function toAscii(value: string): string {
  // Cyrillic goes first: NFKD would split ё and й into a bare е/и plus a mark,
  // and dropping that mark quietly turns "Май" into "Mai".
  const latin = transliterate(value);
  // Then NFKD splits the Latin accents off, and dropping the combining marks
  // leaves the base letter: "Björk" survives as "Bjork" rather than "Bjrk".
  const decomposed = latin.normalize('NFKD').replace(/\p{M}+/gu, '');
  let out = '';

  for (const character of decomposed) {
    const code = character.codePointAt(0) ?? 0;
    if (code >= 0x20 && code <= 0x7e) {
      out += character;
      continue;
    }

    const punctuation = PUNCTUATION[character];
    if (punctuation !== undefined) {
      out += punctuation;
      continue;
    }

    // Anything left (CJK, emoji) has no honest ASCII spelling; a space keeps
    // the words either side of it apart.
    out += ' ';
  }

  return out.replace(/\s+/g, ' ').trim();
}

function transliterate(value: string) {
  const characters = [...value];

  return characters
    .map((character, index) => {
      const lower = character.toLowerCase();
      const mapped = CYRILLIC[lower];
      if (mapped === undefined) {
        return character;
      }
      if (character === lower) {
        return mapped;
      }

      // A capital inside a run of capitals is shouting, and "ЩУКА" should not
      // come back as "ShchUKA".
      return isShouting(characters, index) ? mapped.toUpperCase() : capitalise(mapped);
    })
    .join('');
}

function isShouting(characters: string[], index: number) {
  return isUpper(characters[index - 1]) || isUpper(characters[index + 1]);
}

function isUpper(character: string | undefined) {
  return (
    character !== undefined &&
    character !== character.toLowerCase() &&
    character === character.toUpperCase()
  );
}

function capitalise(value: string) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}
