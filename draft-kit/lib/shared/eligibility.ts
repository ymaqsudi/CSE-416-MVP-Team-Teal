export const SLOT_ELIGIBILITY: Record<string, string[]> = {
  C: ["C"],
  "1B": ["1B"],
  "2B": ["2B"],
  "3B": ["3B"],
  SS: ["SS"],
  OF: ["OF"],
  MI: ["2B", "SS", "MI"],
  CI: ["1B", "3B", "CI"],
  U: ["C", "1B", "2B", "3B", "SS", "OF", "MI", "CI", "U"],
  P: ["P"],
  SP: ["P"],
  RP: ["P"],
  BN: ["C", "1B", "2B", "3B", "SS", "OF", "MI", "CI", "U", "P"],
};

export function isEligibleForSlot(playerPositions: string[], slot: string): boolean {
  const required = SLOT_ELIGIBILITY[slot];
  if (!required) return false;
  return playerPositions.some((p) => required.includes(p));
}

export function getEligibleSlots(playerPositions: string[]): string[] {
  return Object.keys(SLOT_ELIGIBILITY).filter((slot) =>
    isEligibleForSlot(playerPositions, slot)
  );
}
