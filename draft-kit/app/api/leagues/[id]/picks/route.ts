import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { connectToDatabase } from "@/lib/db/mongodb";
import { League } from "@/lib/models/League";
import { DraftPick } from "@/lib/models/DraftPick";
import { Roster } from "@/lib/models/Roster";
import { getUnifiedLeaguePicks, syncValuationSession } from "@/lib/valuation/syncSession";

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

// GET /api/leagues/[id]/picks — fetch draft history for a league
export async function GET(
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

    await connectToDatabase();

    // verify the league belongs to this user
    const league = await League.findOne({ _id: id, userId: decoded.userId });
    if (!league) {
      return NextResponse.json({ error: "League not found" }, { status: 404 });
    }

    const picks = await getUnifiedLeaguePicks(league);

    return NextResponse.json({ picks }, { status: 200 });
  } catch (error) {
    console.error("Get picks route error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// POST /api/leagues/[id]/picks — record a new draft pick
export async function POST(
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
    const { playerId, playerName, mlbTeam, positions, teamId, price } = body;

    if (!playerId || !playerName || !mlbTeam || !teamId || !price) {
      return NextResponse.json(
        {
          error:
            "playerId, playerName, mlbTeam, teamId, and price are required",
        },
        { status: 400 },
      );
    }

    if (typeof price !== "number" || price < 1) {
      return NextResponse.json(
        { error: "price must be a number of at least 1" },
        { status: 400 },
      );
    }

    await connectToDatabase();

    // verify the league belongs to this user
    const league = await League.findOne({ _id: id, userId: decoded.userId });
    if (!league) {
      return NextResponse.json({ error: "League not found" }, { status: 404 });
    }

    const team = (league.teams ?? []).find((t) => t.id === teamId);
    if (!team) {
      return NextResponse.json(
        { error: "Team does not belong to this league" },
        { status: 400 },
      );
    }

    // prevent duplicate: same player already drafted or kept in this league
    const [existingPick, existingKeeper] = await Promise.all([
      DraftPick.findOne({ leagueId: id, playerId }),
      Roster.findOne({ leagueId: id, playerId }),
    ]);
    if (existingPick) {
      return NextResponse.json(
        { error: "Player has already been drafted in this league" },
        { status: 409 },
      );
    }
    if (existingKeeper) {
      return NextResponse.json(
        { error: "Player is already assigned as a keeper in this league" },
        { status: 409 },
      );
    }

    const mainRosterSlots = Number(league.mainRosterSlots) || 23;

    const [teamPicks, teamKeepers] = await Promise.all([
      DraftPick.find({ leagueId: id, teamId }).select("price"),
      Roster.find({ leagueId: id, teamName: team.name }).select("price"),
    ]);

    const teamPickCount = teamPicks.length + teamKeepers.length;

    if (teamPickCount >= mainRosterSlots) {
      return NextResponse.json(
        {
          error: `This team already has ${mainRosterSlots} main-roster players and cannot draft another main-roster player.`,
        },
        { status: 400 },
      );
    }

    const teamSpent =
      teamPicks.reduce((sum, pick) => sum + Number(pick.price || 0), 0) +
      teamKeepers.reduce((sum, r) => sum + Number(r.price || 0), 0);
    const remainingSpots = Math.max(mainRosterSlots - teamPickCount, 1);
    const maxAllowedBid = Math.max(Number(league.budget) - teamSpent - (remainingSpots - 1), 0);

    if (Number(price) > maxAllowedBid) {
      return NextResponse.json(
        {
          error: `This bid is too high for the selected team. Max allowed bid is $${maxAllowedBid}.`,
        },
        { status: 400 },
      );
    }

    // pick number = how many picks have been made so far + 1
    const pickCount = await DraftPick.countDocuments({ leagueId: id });

    const pick = await DraftPick.create({
      leagueId: id,
      playerId,
      playerName,
      mlbTeam,
      positions: Array.isArray(positions) ? positions : [],
      teamId,
      teamName: team.name,
      price: Number(price),
      pickNumber: pickCount + 1,
    });

    await syncValuationSession(league);

    return NextResponse.json(
      { message: "Pick recorded successfully", pick },
      { status: 201 },
    );
  } catch (error) {
    console.error("Post pick route error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// DELETE /api/leagues/[id]/picks — undo the most recent pick
export async function DELETE(
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

    await connectToDatabase();

    const league = await League.findOne({ _id: id, userId: decoded.userId });
    if (!league) {
      return NextResponse.json({ error: "League not found" }, { status: 404 });
    }

    // find and delete the most recent pick
    const lastPick = await DraftPick.findOneAndDelete(
      { leagueId: id },
      { sort: { pickNumber: -1 } },
    );

    if (!lastPick) {
      return NextResponse.json({ error: "No picks to undo" }, { status: 404 });
    }

    await syncValuationSession(league);

    return NextResponse.json(
      { message: "Last pick undone successfully", pick: lastPick },
      { status: 200 },
    );
  } catch (error) {
    console.error("Delete pick route error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
