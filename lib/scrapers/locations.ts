const INDIA_HINTS = [
  "bengaluru",
  "bangalore",
  "pune",
  "hyderabad",
  "mumbai",
  "chennai",
  "gurugram",
  "gurgaon",
  "noida",
  "ncr",
  "delhi",
  "kolkata",
  "ahmedabad",
  "india",
];
const GB_HINTS = ["london", "united kingdom", " uk", "uk,"];
const US_HINTS = [
  "new york",
  "san francisco",
  "seattle",
  "austin",
  "boston",
  "usa",
  "united states",
  " us,",
];

/** Best-effort country-code guess from a free-text location string. Defaults to India,
 * matching the app's primary geographic focus. Used to pick the right API/site region. */
export function guessCountryCode(location: string): "in" | "gb" | "us" {
  const l = ` ${location.toLowerCase()} `;
  if (INDIA_HINTS.some((h) => l.includes(h))) return "in";
  if (GB_HINTS.some((h) => l.includes(h))) return "gb";
  if (US_HINTS.some((h) => l.includes(h))) return "us";
  return "in";
}

export interface KeywordLocationCombo {
  keyword: string;
  location: string;
}

/** Cartesian product of keywords x locations, capped so a large keyword list can't
 * fan out into an unbounded number of outbound requests. */
export function buildCombos(
  keywords: string[],
  locations: string[],
  maxKeywords = 5
): KeywordLocationCombo[] {
  const kws = keywords.slice(0, maxKeywords);
  const combos: KeywordLocationCombo[] = [];
  for (const keyword of kws) {
    for (const location of locations) {
      combos.push({ keyword, location });
    }
  }
  return combos;
}
