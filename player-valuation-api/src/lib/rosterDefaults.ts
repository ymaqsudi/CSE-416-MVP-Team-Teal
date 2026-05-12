/**
 * Default Yahoo-style 23-slot roster: 14 hitters + 9 pitchers.
 * CI (corner infield) accepts 1B|3B; MI (middle infield) accepts 2B|SS; UTIL accepts any
 * non-pitcher. Slot-eligibility rules live in sgpValuation.ts, not in player.positions.
 */
export function defaultRosterSlotsPerTeam(): Record<string, number> {
  return {
    C: 2,
    "1B": 1,
    "2B": 1,
    "3B": 1,
    SS: 1,
    CI: 1,
    MI: 1,
    OF: 5,
    UTIL: 1,
    P: 9,
  };
}

export function totalRosterSlotsPerTeam(slots: Record<string, number>): number {
  return Object.values(slots).reduce((a, b) => a + b, 0);
}
