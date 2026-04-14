import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import jwt from "jsonwebtoken";
import { connectToDatabase } from "@/lib/db/mongodb";
import { League } from "@/lib/models/League";

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
    const {
      leagueName,
      teamCount,
      budget,
      scoringType,
      categories,
      teams: incomingTeams,
      myTeamId: incomingMyTeamId,
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
    league.scoringType = scoringType ? String(scoringType) : "rotisserie";
    league.categories = Array.isArray(categories) ? categories : [];
    league.teams = merged;

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
