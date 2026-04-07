/** Default 5×5-style roster slots per team (used for replacement-level depth). */
export function defaultRosterSlotsPerTeam(): Record<string, number> {
  return {
    C: 2,
    "1B": 1,
    "2B": 1,
    "3B": 1,
    SS: 1,
    OF: 5,
    P: 9,
  };
}

export function totalRosterSlotsPerTeam(slots: Record<string, number>): number {
  return Object.values(slots).reduce((a, b) => a + b, 0);
}
