import type { Role } from "../content/schemas";

export const BOARD_LAYOUT = {
  columns: 3,
  rows: [
    { id: "backline", label: "Backline" },
    { id: "midline", label: "Midline" },
    { id: "frontline", label: "Frontline" },
  ],
} as const;

export const BOARD_SLOTS = BOARD_LAYOUT.rows.flatMap((_, rowIndex) =>
  Array.from(
    { length: BOARD_LAYOUT.columns },
    (_, columnIndex) => rowIndex * BOARD_LAYOUT.columns + columnIndex,
  ),
);
export const BOARD_SLOT_IDS = new Set(BOARD_SLOTS);
export const BOARD_CAPACITY = BOARD_SLOTS.length;

const rowPreference: Record<Role, string[]> = {
  tank: ["frontline", "midline", "backline"],
  fighter: ["frontline", "midline", "backline"],
  healer: ["midline", "backline"],
  shooter: ["backline", "midline", "frontline"],
  mage: ["backline", "midline", "frontline"],
};

export function preferredSlotsForRole(role: Role): number[] {
  const columnOrder = Array.from(
    { length: BOARD_LAYOUT.columns },
    (_, index) => index,
  ).sort(
    (a, b) =>
      Math.abs(a - (BOARD_LAYOUT.columns - 1) / 2) -
      Math.abs(b - (BOARD_LAYOUT.columns - 1) / 2),
  );
  return rowPreference[role].flatMap((rowId) => {
    const rowIndex = BOARD_LAYOUT.rows.findIndex((row) => row.id === rowId);
    if (rowIndex < 0) return [];
    return columnOrder.map(
      (column) => rowIndex * BOARD_LAYOUT.columns + column,
    );
  });
}

export function availableBoardSlots(
  roster: readonly { slot: number | null }[],
): number[] {
  const occupied = new Set(
    roster.flatMap((unit) => (unit.slot === null ? [] : [unit.slot])),
  );
  return BOARD_SLOTS.filter((slot) => !occupied.has(slot));
}
