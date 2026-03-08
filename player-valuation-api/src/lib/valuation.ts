/**
 * Simple MVP valuation logic.
 * Can be replaced with more advanced logic later.
 */
import { PlayerModel } from "../models/Player.js";

const DEPTH_BONUS: Record<string, number> = {
  Starter: 2,
  Backup: 0,
  Platoon: -1,
  Bench: -2,
  Minors: -3,
  Unknown: 0,
};

const RISK_ADJUST: Record<string, number> = {
  Low: 2,
  Med: 0,
  High: -3,
};

export async function computeValuation(playerId: string): Promise<{
  dollarValue: number;
  explanation: string;
}> {
  const player = await PlayerModel.findById(playerId).lean();
  if (!player) {
    return { dollarValue: 0, explanation: "Player not found." };
  }

  let value = (player as { baseValue?: number }).baseValue ?? 10;
  const depthRole = (player as { depthRole?: string }).depthRole ?? "Unknown";
  const risk = (player as { risk?: string }).risk ?? "Med";

  value += DEPTH_BONUS[depthRole] ?? 0;
  value += RISK_ADJUST[risk] ?? 0;
  value = Math.max(1, Math.round(value));

  const parts: string[] = [];
  if (depthRole === "Starter") parts.push("starting role");
  if (risk === "Low") parts.push("low risk");
  else if (risk === "High") parts.push("elevated risk discount");
  const explanation =
    parts.length > 0
      ? `Base value adjusted for ${parts.join(", ")}.`
      : "Standard projected auction value.";

  return { dollarValue: value, explanation };
}
