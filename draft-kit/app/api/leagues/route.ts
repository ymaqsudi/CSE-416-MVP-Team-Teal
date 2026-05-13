import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import jwt from "jsonwebtoken";
import { connectToDatabase } from "@/lib/db/mongodb";
import { League, SUPPORTED_ROSTER_SLOTS, defaultRosterSlots } from "@/lib/models/League";

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

function makeDefaultTeams(count: number): { id: string; name: string }[] {
  return Array.from({ length: count }, (_, i) => ({
    id: randomUUID(),
    name: `Team ${i + 1}`,
  }));
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
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = getTokenFromRequest(request);

    if (!token) {
      return NextResponse.json(
        { error: "missing authorization token" },
        { status: 401 },
      );
    }

    const decoded = verifyToken(token);

    if (!decoded) {
      return NextResponse.json(
        { error: "invalid or expired token" },
        { status: 401 },
      );
    }

    const body = await request.json();
    const { leagueName, teamCount, budget, mainRosterSlots, scoringType, categories, scope, rosterSlots } = body;
    const normalizedScope = scope === "AL" || scope === "NL" ? scope : "MLB";
    const normalizedRosterSlots = normalizeRosterSlots(rosterSlots) ?? defaultRosterSlots();
    const derivedMainRosterSlots = Object.values(normalizedRosterSlots).reduce(
      (s, n) => s + n,
      0,
    );
    const SUPPORTED_CATS = new Set(["HR", "RBI", "R", "SB", "AVG", "W", "ERA", "WHIP", "K", "SV"]);
    const normalizedCategories = Array.isArray(categories)
      ? categories
          .map((c: unknown) => String(c).trim().toUpperCase())
          .filter((c: string) => SUPPORTED_CATS.has(c))
      : [];

    if (!leagueName || !teamCount || !budget) {
      return NextResponse.json(
        { error: "leagueName, teamCount, and budget are required" },
        { status: 400 },
      );
    }

    await connectToDatabase();

    const seededTeams = makeDefaultTeams(Number(teamCount));
    const newLeague = await League.create({
      userId: decoded.userId,
      leagueName: String(leagueName).trim(),
      teamCount: Number(teamCount),
      budget: Number(budget),
      mainRosterSlots: derivedMainRosterSlots || Number(mainRosterSlots) || 23,
      scoringType: scoringType ? String(scoringType) : "rotisserie",
      categories: normalizedCategories,
      teams: seededTeams,
      myTeamId: seededTeams[0]?.id ?? "",
      scope: normalizedScope,
      rosterSlots: normalizedRosterSlots,
    });

    return NextResponse.json(
      {
        message: "league created successfully",
        league: newLeague,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Create league route error:", error);

    return NextResponse.json(
      { error: "internal server error" },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const token = getTokenFromRequest(request);

    if (!token) {
      return NextResponse.json(
        { error: "missing authorization token" },
        { status: 401 },
      );
    }

    const decoded = verifyToken(token);

    if (!decoded) {
      return NextResponse.json(
        { error: "invalid or expired token" },
        { status: 401 },
      );
    }

    await connectToDatabase();

    const leagues = await League.find({ userId: decoded.userId }).sort({
      createdAt: -1,
    });

    console.log(
      "GET leagues mainRosterSlots:",
      leagues.map((league) => ({
        id: league._id.toString(),
        name: league.leagueName,
        mainRosterSlots: league.mainRosterSlots,
      })),
    );

    // backfill teams/myTeamId for legacy leagues created before team identity existed
    for (const league of leagues) {
      if (!league.teams || league.teams.length === 0) {
        league.teams = makeDefaultTeams(league.teamCount);
        if (!league.myTeamId) league.myTeamId = league.teams[0].id;
        await league.save();
      }
    }

    return NextResponse.json({ leagues }, { status: 200 });
  } catch (error) {
    console.error("Get leagues route error:", error);

    return NextResponse.json(
      { error: "internal server error" },
      { status: 500 },
    );
  }
}
