import { rollDie } from "./dice";

export type CityEntry = { low: number; high: number; city: string };

export const CITY_ROLL_MAX = 348;

// Weighted city table: larger markets cover more of the 1 to 348 range.
export const CITY_TABLE: readonly CityEntry[] = [
  { low: 1, high: 42, city: "New York" },
  { low: 43, high: 61, city: "Los Angeles" },
  { low: 62, high: 77, city: "Chicago" },
  { low: 78, high: 93, city: "Dallas - Fort Worth" },
  { low: 94, high: 107, city: "Phoenix" },
  { low: 108, high: 119, city: "Houston" },
  { low: 120, high: 129, city: "Philadelphia" },
  { low: 130, high: 139, city: "Denver" },
  { low: 140, high: 147, city: "San Diego" },
  { low: 148, high: 155, city: "Orange County (Long Beach)" },
  { low: 156, high: 162, city: "San Antonio" },
  { low: 163, high: 169, city: "Charlotte" },
  { low: 170, high: 176, city: "San Francisco" },
  { low: 177, high: 183, city: "Washington DC" },
  { low: 184, high: 190, city: "Las Vegas" },
  { low: 191, high: 197, city: "Minneapolis / St Paul" },
  { low: 198, high: 203, city: "Seattle" },
  { low: 204, high: 209, city: "Boston" },
  { low: 210, high: 215, city: "Detroit" },
  { low: 216, high: 221, city: "Miami" },
  { low: 222, high: 226, city: "Jacksonville" },
  { low: 227, high: 231, city: "San Jose" },
  { low: 232, high: 236, city: "Columbus" },
  { low: 237, high: 241, city: "Indianapolis" },
  { low: 242, high: 246, city: "Milwaukee" },
  { low: 247, high: 251, city: "Atlanta" },
  { low: 252, high: 256, city: "Tampa" },
  { low: 257, high: 260, city: "Austin" },
  { low: 261, high: 264, city: "Nashville" },
  { low: 265, high: 268, city: "Oklahoma City" },
  { low: 269, high: 272, city: "Baltimore" },
  { low: 273, high: 276, city: "Sacramento" },
  { low: 277, high: 280, city: "Kansas City" },
  { low: 281, high: 284, city: "Cleveland" },
  { low: 285, high: 288, city: "Newark (Jersey City)" },
  { low: 289, high: 292, city: "Pittsburgh" },
  { low: 293, high: 295, city: "Louisville" },
  { low: 296, high: 298, city: "Portland" },
  { low: 299, high: 301, city: "Memphis" },
  { low: 302, high: 304, city: "Raleigh" },
  { low: 305, high: 307, city: "New Orleans" },
  { low: 308, high: 310, city: "Cincinnati" },
  { low: 311, high: 313, city: "Saint Louis" },
  { low: 314, high: 316, city: "Buffalo" },
  { low: 317, high: 318, city: "El Paso" },
  { low: 319, high: 320, city: "Albuquerque" },
  { low: 321, high: 322, city: "Fresno" },
  { low: 323, high: 324, city: "Tucson" },
  { low: 325, high: 326, city: "Omaha" },
  { low: 327, high: 328, city: "Virginia Beach" },
  { low: 329, high: 330, city: "Oakland" },
  { low: 331, high: 332, city: "Orlando" },
  { low: 333, high: 333, city: "Bakersfield" },
  { low: 334, high: 334, city: "Tulsa" },
  { low: 335, high: 335, city: "Wichita" },
  { low: 336, high: 336, city: "Honolulu" },
  { low: 337, high: 337, city: "Lexington KY" },
  { low: 338, high: 338, city: "Corpus Christi" },
  { low: 339, high: 339, city: "Greensboro" },
  { low: 340, high: 340, city: "Lincoln NE" },
  { low: 341, high: 341, city: "Anchorage" },
  { low: 342, high: 342, city: "Madison WI" },
  { low: 343, high: 343, city: "Reno" },
  { low: 344, high: 344, city: "Fort Wayne" },
  { low: 345, high: 345, city: "Lubbock" },
  { low: 346, high: 346, city: "Laredo" },
  { low: 347, high: 347, city: "Toledo" },
  { low: 348, high: 348, city: "Winston-Salem" },
];

export function normalizeCity(city: string) {
  return city.trim().toLowerCase();
}

export function cityForRoll(roll: number): CityEntry {
  const entry = CITY_TABLE.find((row) => roll >= row.low && roll <= row.high);
  if (!Number.isInteger(roll) || !entry) {
    throw new RangeError(`City roll must be a whole number from 1 to ${CITY_ROLL_MAX}.`);
  }
  return entry;
}

export type CityRoll = CityEntry & { roll: number };

// Rolls until it lands on a city not in `taken`. Returns null without rolling
// when every listed city is taken.
export function rollCity(
  taken: Iterable<string>,
  roll: () => number = () => rollDie(CITY_ROLL_MAX),
): CityRoll | null {
  const used = new Set(Array.from(taken, normalizeCity));
  if (CITY_TABLE.every((row) => used.has(normalizeCity(row.city)))) return null;

  for (;;) {
    const result = roll();
    const entry = cityForRoll(result);
    if (!used.has(normalizeCity(entry.city))) return { ...entry, roll: result };
  }
}
