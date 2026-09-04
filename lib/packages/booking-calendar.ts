export type BookingAvailabilityItem = {
  date: string;
  available: number;
  capacity: number;
};

export type BookingCalendarCell = {
  isoDate: string;
  day: number;
  inMonth: boolean;
  isAvailable: boolean;
  isSoldOut: boolean;
  isSelectable: boolean;
  available: number;
  capacity: number;
};

function getMonthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function buildBookingWindowMonths(baseDate = new Date()) {
  const currentMonth = getMonthStart(baseDate);
  const nextMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
  return [
    { year: currentMonth.getFullYear(), month: currentMonth.getMonth() },
    { year: nextMonth.getFullYear(), month: nextMonth.getMonth() },
  ];
}

export function filterAvailabilityToBookingWindow(
  entries: BookingAvailabilityItem[],
  baseDate = new Date()
) {
  const today = toIsoDate(baseDate);
  return entries.filter((entry) => {
    const parsed = new Date(`${entry.date}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return false;
    return entry.date >= today;
  });
}

export function getMaxSelectablePeople(available: number, maxPeoplePerBooking: number) {
  const safeAvailable = Math.max(0, Math.floor(Number(available) || 0));
  const safeMaxPeople = Math.max(1, Math.floor(Number(maxPeoplePerBooking) || 1));
  return Math.max(0, Math.min(safeAvailable, safeMaxPeople));
}

export function buildBookingCalendarMonth(args: {
  year: number;
  month: number;
  entries: BookingAvailabilityItem[];
  requiredPeople?: number;
}) {
  const { year, month, entries, requiredPeople } = args;
  const minRequired = Math.max(1, Math.floor(Number(requiredPeople) || 1));
  const availabilityMap = new Map(entries.map((entry) => [entry.date, entry]));
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const startDate = new Date(year, month, 1 - startOffset);

  const cells: BookingCalendarCell[] = [];
  for (let index = 0; index < 42; index += 1) {
    const current = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + index);
    const isoDate = toIsoDate(current);
    const availability = availabilityMap.get(isoDate);
    const available = Math.max(0, Number(availability?.available ?? 0) || 0);
    const capacity = Math.max(0, Number(availability?.capacity ?? 0) || 0);
    const isAvailable = available >= minRequired;
    const isSoldOut = Boolean(availability) && available <= 0;

    cells.push({
      isoDate,
      day: current.getDate(),
      inMonth: current.getMonth() === month,
      isAvailable,
      isSoldOut,
      isSelectable: current.getMonth() === month && isAvailable,
      available,
      capacity,
    });
  }

  return cells;
}
