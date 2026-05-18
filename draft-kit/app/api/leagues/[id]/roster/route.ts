import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { connectToDatabase } from "@/lib/db/mongodb";
import { Roster } from "@/lib/models/Roster";
import { League } from "@/lib/models/League";
import { DraftPick } from "@/lib/models/DraftPick";

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

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
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

    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const teamName = searchParams.get("teamName");

    if (!teamName) {
      return NextResponse.json(
        { error: "teamName is required as a query parameter" },
        { status: 400 },
      );
    }

    await connectToDatabase();

    // Verify the league exists and belongs to the user
    const league = await League.findOne({ _id: id, userId: decoded.userId });
    if (!league) {
      return NextResponse.json(
        { error: "league not found or access denied" },
        { status: 404 },
      );
    }

    // Get all roster assignments (keepers) and draft picks for this league/team
    const [keepers, draftPicks] = await Promise.all([
      Roster.find({ leagueId: id, teamName })
        .sort({ position: 1, assignedAt: 1 })
        .lean(),
      DraftPick.find({ leagueId: id, teamName })
        .sort({ pickNumber: 1 })
        .lean(),
    ]);

    const draftedEntries = draftPicks.map((p) => ({
      _id: p._id,
      leagueId: p.leagueId,
      teamName: p.teamName,
      playerId: p.playerId,
      playerName: p.playerName,
      mlbTeam: p.mlbTeam,
      positions: p.positions ?? [],
      // Display-only slot: first position from the player's eligibilities,
      // falling back to UTIL. Not persisted — the draft flow doesn't track
      // slot assignment, this is just so the roster page can render the row.
      position: (p.positions ?? [])[0] ?? "UTIL",
      price: p.price,
      assignedAt: (p as { createdAt?: Date }).createdAt,
      pickNumber: p.pickNumber,
      isKeeper: false,
    }));

    const keeperEntries = keepers.map((r) => ({
      ...r,
      isKeeper: true,
    }));

    const roster = [...keeperEntries, ...draftedEntries];

    return NextResponse.json({ roster }, { status: 200 });
  } catch (error) {
    console.error("Get roster route error:", error);

    return NextResponse.json(
      { error: "internal server error" },
      { status: 500 },
    );
  }
}