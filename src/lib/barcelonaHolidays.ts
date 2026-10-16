import i18n from "@/i18n";
// Source: https://ajuntament.barcelona.cat/calendarifestius/en/index.html
export const HOLIDAY_YEARS = [2026, 2027] as const;
export const BARCELONA_HOLIDAYS = [
  { date: "2026-01-01", nameKey: "copy.newYearSDay" },
  { date: "2026-01-06", nameKey: "copy.epiphanyReyes" },
  { date: "2026-04-03", nameKey: "copy.goodFriday" },
  { date: "2026-04-06", nameKey: "copy.easterMonday" },
  { date: "2026-05-01", nameKey: "copy.labourDay" },
  { date: "2026-05-25", nameKey: "copy.whitMonday" },
  { date: "2026-06-24", nameKey: "copy.santJoan" },
  { date: "2026-08-15", nameKey: "copy.assumptionOfMary" },
  { date: "2026-09-11", nameKey: "copy.laDiadaCatalonia" },
  { date: "2026-09-24", nameKey: "copy.laMercBarcelona" },
  { date: "2026-10-12", nameKey: "copy.hispanicDay" },
  { date: "2026-12-08", nameKey: "copy.immaculateConception" },
  { date: "2026-12-25", nameKey: "copy.christmasDay" },
  { date: "2026-12-26", nameKey: "copy.santEsteve" },
  { date: "2027-01-01", nameKey: "copy.newYearSDay" },
  { date: "2027-01-06", nameKey: "copy.epiphany" },
  { date: "2027-03-26", nameKey: "copy.goodFriday" },
  { date: "2027-03-29", nameKey: "copy.easterMonday" },
  { date: "2027-05-01", nameKey: "copy.labourDay" },
  { date: "2027-05-17", nameKey: "copy.whitMonday" },
  { date: "2027-06-24", nameKey: "copy.santJoan" },
  { date: "2027-09-11", nameKey: "copy.laDiada" },
  { date: "2027-09-24", nameKey: "copy.laMerce" },
  { date: "2027-10-12", nameKey: "copy.hispanicDay" },
  { date: "2027-11-01", nameKey: "copy.allSaints" },
  { date: "2027-12-06", nameKey: "copy.constitutionDay" },
  { date: "2027-12-08", nameKey: "copy.immaculateConception" },
  { date: "2027-12-25", nameKey: "copy.christmasDay" },
];

const HOLIDAY_MAP = new Map(BARCELONA_HOLIDAYS.map((h) => [h.date, h.nameKey]));

export function hasHolidayCalendar(dateStr: string) {
  return HOLIDAY_YEARS.some((year) => dateStr.startsWith(`${year}-`));
}

export function isHoliday(dateStr: string) {
  if (!hasHolidayCalendar(dateStr))
    throw new Error(
      i18n.t("copy.barcelonaHolidaysAreNotVerifiedFor", { value1: dateStr.slice(0, 4) })
    );
  return HOLIDAY_MAP.has(dateStr);
}

export function holidayName(dateStr: string) {
  const key = HOLIDAY_MAP.get(dateStr);
  return key ? i18n.t(key) : undefined;
}
