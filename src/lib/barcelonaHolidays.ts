import i18n from "@/i18n";
// Source: https://ajuntament.barcelona.cat/calendarifestius/en/index.html
export const HOLIDAY_YEARS = [2026, 2027] as const;
export const BARCELONA_HOLIDAYS = [
  { date: "2026-01-01", nameKey: "holidays.newYear" },
  { date: "2026-01-06", nameKey: "holidays.epiphanyReyes" },
  { date: "2026-04-03", nameKey: "holidays.goodFriday" },
  { date: "2026-04-06", nameKey: "holidays.easterMonday" },
  { date: "2026-05-01", nameKey: "holidays.labourDay" },
  { date: "2026-05-25", nameKey: "holidays.whitMonday" },
  { date: "2026-06-24", nameKey: "holidays.santJoan" },
  { date: "2026-08-15", nameKey: "holidays.assumption" },
  { date: "2026-09-11", nameKey: "holidays.diadaCatalonia" },
  { date: "2026-09-24", nameKey: "holidays.merceBarcelona" },
  { date: "2026-10-12", nameKey: "holidays.hispanicDay" },
  { date: "2026-12-08", nameKey: "holidays.immaculateConception" },
  { date: "2026-12-25", nameKey: "holidays.christmas" },
  { date: "2026-12-26", nameKey: "holidays.santEsteve" },
  { date: "2027-01-01", nameKey: "holidays.newYear" },
  { date: "2027-01-06", nameKey: "holidays.epiphany" },
  { date: "2027-03-26", nameKey: "holidays.goodFriday" },
  { date: "2027-03-29", nameKey: "holidays.easterMonday" },
  { date: "2027-05-01", nameKey: "holidays.labourDay" },
  { date: "2027-05-17", nameKey: "holidays.whitMonday" },
  { date: "2027-06-24", nameKey: "holidays.santJoan" },
  { date: "2027-09-11", nameKey: "holidays.diada" },
  { date: "2027-09-24", nameKey: "holidays.merce" },
  { date: "2027-10-12", nameKey: "holidays.hispanicDay" },
  { date: "2027-11-01", nameKey: "holidays.allSaints" },
  { date: "2027-12-06", nameKey: "holidays.constitution" },
  { date: "2027-12-08", nameKey: "holidays.immaculateConception" },
  { date: "2027-12-25", nameKey: "holidays.christmas" },
];

const HOLIDAY_MAP = new Map(BARCELONA_HOLIDAYS.map((h) => [h.date, h.nameKey]));

export function hasHolidayCalendar(dateStr: string) {
  return HOLIDAY_YEARS.some((year) => dateStr.startsWith(`${year}-`));
}

export function isHoliday(dateStr: string) {
  if (!hasHolidayCalendar(dateStr))
    throw new Error(i18n.t("planning.validation.unverifiedYear", { year: dateStr.slice(0, 4) }));
  return HOLIDAY_MAP.has(dateStr);
}

export function holidayName(dateStr: string) {
  const key = HOLIDAY_MAP.get(dateStr);
  return key ? i18n.t(key) : undefined;
}
