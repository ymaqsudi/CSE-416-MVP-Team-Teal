import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import jwt from "jsonwebtoken";
import { connectToDatabase } from "@/lib/db/mongodb";
import { League, SUPPORTED_ROSTER_SLOTS } from "@/lib/models/League";

function normalizeRosterSlots(raw: unknown): Record<string, number> | null {
  if (!raw || typeof raw !== "object") return null;
  const out: Record<string, number> = {};
  for (const key of SUPPORTED_ROSTER_SLOTS) {
    const v = (raw as Record<string, unknown>)[key];
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) continue;
    out[key] = Math.floor(n);
  }
  const total = Object.values(out).reduce((s, n) => s + n, 0);
  return total > 0 ? out : null;
}

const JWT_SECRET = process.env.JWT_SECRET as string;

if (!JWT_SECRET) {
  throw new Error("Missing JWT_SECRET in environment variables.");
}

type JwtPayload = {
  userId: string;
  email: string;
};

function getTokenFromRequest(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  return authHeader.substring(7);
}

function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as unknown as JwtPayload;
  } catch {
    return null;
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const token = getTokenFromRequest(request);

    if (!token) {
      return NextResponse.json(
        { error: "Missing authorization token" },
        { status: 401 },
      );
    }

    const decoded = verifyToken(token);

    if (!decoded) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 },
      );
    }

    const { id } = await context.params;
    const body = await request.json();
    console.log("PATCH league body:", body);
    const {
      leagueName,
      teamCount,
      budget,
      mainRosterSlots,
      scoringType,
      categories,
      teams: incomingTeams,
      myTeamId: incomingMyTeamId,
      scope,
      rosterSlots,
      taxiSlots,
      taxiDraftOrder,
    } = body;

    if (!leagueName || !teamCount || !budget) {
      return NextResponse.json(
        { error: "League name, team count, and budget are required" },
        { status: 400 },
      );
    }

    await connectToDatabase();

    const league = await League.findOne({ _id: id, userId: decoded.userId });
    if (!league) {
      return NextResponse.json({ error: "League not found" }, { status: 404 });
    }

    const nextTeamCount = Number(teamCount);

    // start from existing teams (preserve stable IDs), apply incoming name edits,
    // then resize to match teamCount by appending or trimming.
    const existing = league.teams ?? [];
    const incomingById = new Map<string, string>();
    if (Array.isArray(incomingTeams)) {
      for (const t of incomingTeams) {
        if (t && typeof t.id === "string" && typeof t.name === "string") {
          incomingById.set(t.id, t.name.trim() || "Unnamed");
        }
      }
    }

    const merged = existing.map((t, i) => ({
      id: t.id,
      name: incomingById.get(t.id) ?? t.name ?? `Team ${i + 1}`,
    }));

    if (merged.length < nextTeamCount) {
      for (let i = merged.length; i < nextTeamCount; i++) {
        merged.push({ id: randomUUID(), name: `Team ${i + 1}` });
      }
    } else if (merged.length > nextTeamCount) {
      merged.length = nextTeamCount;
    }

    league.leagueName = String(leagueName).trim();
    league.teamCount = nextTeamCount;
    league.budget = Number(budget);
    const normalizedRosterSlots = normalizeRosterSlots(rosterSlots);
    if (normalizedRosterSlots) {
      league.rosterSlots = normalizedRosterSlots;
      league.mainRosterSlots = Object.values(normalizedRosterSlots).reduce(
        (s, n) => s + n,
        0,
      );
    } else {
      league.mainRosterSlots = Number(mainRosterSlots) || league.mainRosterSlots || 23;
    }
    league.scoringType = scoringType ? String(scoringType) : "rotisserie";
    const SUPPORTED_CATS = new Set(["HR", "RBI", "R", "SB", "AVG", "W", "ERA", "WHIP", "K", "SV"]);
    league.categories = Array.isArray(categories)
      ? categories
          .map((c: unknown) => String(c).trim().toUpperCase())
          .filter((c: string) => SUPPORTED_CATS.has(c))
      : [];
    league.teams = merged;
    if (scope === "MLB" || scope === "AL" || scope === "NL") {
      league.scope = scope;
    }

    if (taxiSlots !== undefined) {
      const n = Number(taxiSlots);
      if (Number.isFinite(n) && n >= 0) {
        league.taxiSlots = Math.floor(n);
      }
    }

    if (Array.isArray(taxiDraftOrder)) {
      const validIdSet = new Set(merged.map((t) => t.id));
      const cleaned = taxiDraftOrder
        .map((v: unknown) => String(v))
        .filter((id: string) => validIdSet.has(id));
      const unique = Array.from(new Set(cleaned));
      if (unique.length === merged.length) {
        league.taxiDraftOrder = unique;
      } else {
        league.taxiDraftOrder = league.taxiDraftOrder.filter((id) => validIdSet.has(id));
      }
    } else {
      league.taxiDraftOrder = (league.taxiDraftOrder ?? []).filter((id) =>
        merged.some((t) => t.id === id),
      );
    }

    console.log("Before save mainRosterSlots:", league.mainRosterSlots);

    // keep myTeamId valid; accept incoming if it references a real team, else fall back
    const validIds = new Set(merged.map((t) => t.id));
    if (
      typeof incomingMyTeamId === "string" &&
      validIds.has(incomingMyTeamId)
    ) {
      league.myTeamId = incomingMyTeamId;
    } else if (!validIds.has(league.myTeamId)) {
      league.myTeamId = merged[0]?.id ?? "";
    }

    const updatedLeague = await league.save();
    console.log("After save mainRosterSlots:", updatedLeague.mainRosterSlots);

    return NextResponse.json(
      {
        message: "League updated successfully",
        league: updatedLeague,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Update league route error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
