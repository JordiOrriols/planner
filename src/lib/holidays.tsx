// Barcelona / Catalonia public holidays (2026). Used to reduce squad capacity.
export const BARCELONA_HOLIDAYS = [
  { date: "2026-01-01", name: "New Year's Day" },
  { date: "2026-01-06", name: "Epiphany (Reyes)" },
  { date: "2026-04-03", name: "Good Friday" },
  { date: "2026-04-06", name: "Easter Monday" },
  { date: "2026-05-01", name: "Labour Day" },
  { date: "2026-06-24", name: "Sant Joan" },
  { date: "2026-08-15", name: "Assumption of Mary" },
  { date: "2026-09-11", name: "La Diada (Catalonia)" },
  { date: "2026-09-24", name: "La Mercè (Barcelona)" },
  { date: "2026-10-12", name: "Hispanic Day" },
  { date: "2026-11-01", name: "All Saints" },
  { date: "2026-12-06", name: "Constitution Day" },
  { date: "2026-12-08", name: "Immaculate Conception" },
  { date: "2026-12-25", name: "Christmas Day" },
  { date: "2026-12-26", name: "Sant Esteve" }
];

const HOLIDAY_MAP = Object.fromEntries(BARCELONA_HOLIDAYS.map(h => [h.date, h.name]));

export function isHoliday(dateStr) {
  return !!HOLIDAY_MAP[dateStr];
}

export function holidayName(dateStr) {
  return HOLIDAY_MAP[dateStr];
}