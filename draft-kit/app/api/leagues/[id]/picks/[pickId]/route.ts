import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/mongodb";
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
    return jwt.verify(token, JWT_SECRET) as unknown as JwtPayload;
  } catch {
    return null;
  }
}

// PATCH /api/leagues/[id]/picks/[pickId] — edit a previously recorded pick
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; pickId: string }> },
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

    const { id, pickId } = await context.params;
    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(pickId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const { teamId, price } = body as { teamId?: string; price?: number };

    if (teamId === undefined && price === undefined) {
      return NextResponse.json(
        { error: "At least one of teamId or price is required" },
        { status: 400 },
      );
    }

    if (price !== undefined && (typeof price !== "number" || price < 1)) {
      return NextResponse.json(
        { error: "price must be a number of at least 1" },
        { status: 400 },
      );
    }

    await connectToDatabase();

    const league = await League.findOne({ _id: id, userId: decoded.userId });
    if (!league) {
      return NextResponse.json({ error: "League not found" }, { status: 404 });
    }

    const pick = await DraftPick.findOne({ _id: pickId, leagueId: id });
    if (!pick) {
      return NextResponse.json({ error: "Pick not found" }, { status: 404 });
    }

    const nextTeamId = teamId ?? pick.teamId;
    const nextPrice = price ?? pick.price;

    let nextTeamName = pick.teamName;
    if (teamId !== undefined) {
      const team = (league.teams ?? []).find((t) => t.id === teamId);
      if (!team) {
        return NextResponse.json(
          { error: "Team does not belong to this league" },
          { status: 400 },
        );
      }
      nextTeamName = team.name;
    }

    const mainRosterSlots = Number(league.mainRosterSlots) || 23;

    const teamPicks = await DraftPick.find({
      leagueId: id,
      teamId: nextTeamId,
      _id: { $ne: pick._id },
    }).select("price");

    const teamPickCount = teamPicks.length;

    if (teamPickCount >= mainRosterSlots) {
      return NextResponse.json(
        {
          error: `This team already has ${mainRosterSlots} main-roster picks and cannot draft another main-roster player.`,
        },
        { status: 400 },
      );
    }

    const teamSpent = teamPicks.reduce(
      (sum, p) => sum + Number(p.price || 0),
      0,
    );
    const remainingSpots = Math.max(mainRosterSlots - teamPickCount, 1);
    const maxAllowedBid = Math.max(
      Number(league.budget) - teamSpent - (remainingSpots - 1),
      0,
    );

    if (Number(nextPrice) > maxAllowedBid) {
      return NextResponse.json(
        {
          error: `This bid is too high for the selected team. Max allowed bid is $${maxAllowedBid}.`,
        },
        { status: 400 },
      );
    }

    pick.teamId = nextTeamId;
    pick.teamName = nextTeamName;
    pick.price = Number(nextPrice);
    await pick.save();

    return NextResponse.json(
      { message: "Pick updated", pick },
      { status: 200 },
    );
  } catch (error) {
    console.error("Patch pick route error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
