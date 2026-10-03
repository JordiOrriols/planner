// Source: https://ajuntament.barcelona.cat/calendarifestius/en/index.html
export const HOLIDAY_YEARS = [2026, 2027] as const;
export const BARCELONA_HOLIDAYS = [
  { date: "2026-01-01", name: "New Year's Day" },
  { date: "2026-01-06", name: "Epiphany (Reyes)" },
  { date: "2026-04-03", name: "Good Friday" },
  { date: "2026-04-06", name: "Easter Monday" },
  { date: "2026-05-01", name: "Labour Day" },
  { date: "2026-05-25", name: "Whit Monday" },
  { date: "2026-06-24", name: "Sant Joan" },
  { date: "2026-08-15", name: "Assumption of Mary" },
  { date: "2026-09-11", name: "La Diada (Catalonia)" },
  { date: "2026-09-24", name: "La Mercè (Barcelona)" },
  { date: "2026-10-12", name: "Hispanic Day" },
  { date: "2026-12-08", name: "Immaculate Conception" },
  { date: "2026-12-25", name: "Christmas Day" },
  { date: "2026-12-26", name: "Sant Esteve" },
  { date: "2027-01-01", name: "New Year's Day" },
  { date: "2027-01-06", name: "Epiphany" },
  { date: "2027-03-26", name: "Good Friday" },
  { date: "2027-03-29", name: "Easter Monday" },
  { date: "2027-05-01", name: "Labour Day" },
  { date: "2027-05-17", name: "Whit Monday" },
  { date: "2027-06-24", name: "Sant Joan" },
  { date: "2027-09-11", name: "La Diada" },
  { date: "2027-09-24", name: "La Merce" },
  { date: "2027-10-12", name: "Hispanic Day" },
  { date: "2027-11-01", name: "All Saints" },
  { date: "2027-12-06", name: "Constitution Day" },
  { date: "2027-12-08", name: "Immaculate Conception" },
  { date: "2027-12-25", name: "Christmas Day" },
];

const HOLIDAY_MAP = new Map(BARCELONA_HOLIDAYS.map((h) => [h.date, h.name]));

export function hasHolidayCalendar(dateStr: string) {
  return HOLIDAY_YEARS.some((year) => dateStr.startsWith(`${year}-`));
}

export function isHoliday(dateStr: string) {
  if (!hasHolidayCalendar(dateStr))
    throw new Error(`Barcelona holidays are not verified for ${dateStr.slice(0, 4)}`);
  return HOLIDAY_MAP.has(dateStr);
}

export function holidayName(dateStr: string) {
  return HOLIDAY_MAP.get(dateStr);
}
