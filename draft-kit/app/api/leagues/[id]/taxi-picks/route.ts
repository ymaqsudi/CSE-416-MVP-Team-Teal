import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { connectToDatabase } from "@/lib/db/mongodb";
import { League } from "@/lib/models/League";
import { DraftPick } from "@/lib/models/DraftPick";
import { TaxiPick } from "@/lib/models/TaxiPick";

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
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  return authHeader.substring(7);
}

function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as unknown as JwtPayload;
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
      return NextResponse.json({ error: "Missing authorization token" }, { status: 401 });
    }
    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
    }

    const { id } = await context.params;
    await connectToDatabase();

    const league = await League.findOne({ _id: id, userId: decoded.userId });
    if (!league) {
      return NextResponse.json({ error: "League not found" }, { status: 404 });
    }

    const picks = await TaxiPick.find({ leagueId: id }).sort({ teamId: 1, slotIndex: 1 });
    return NextResponse.json({ picks }, { status: 200 });
  } catch (error) {
    console.error("Get taxi-picks route error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const token = getTokenFromRequest(request);
    if (!token) {
      return NextResponse.json({ error: "Missing authorization token" }, { status: 401 });
    }
    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const { playerId, playerName, mlbTeam, positions, teamId, slotIndex } = body;

    if (!playerId || !playerName || !mlbTeam || !teamId) {
      return NextResponse.json(
        { error: "playerId, playerName, mlbTeam, and teamId are required" },
        { status: 400 },
      );
    }

    await connectToDatabase();

    const league = await League.findOne({ _id: id, userId: decoded.userId });
    if (!league) {
      return NextResponse.json({ error: "League not found" }, { status: 404 });
    }

    const taxiSlots = Number(league.taxiSlots) || 0;
    if (taxiSlots <= 0) {
      return NextResponse.json(
        { error: "Taxi draft is not enabled for this league" },
        { status: 400 },
      );
    }

    const team = (league.teams ?? []).find((t) => t.id === teamId);
    if (!team) {
      return NextResponse.json(
        { error: "Team does not belong to this league" },
        { status: 400 },
      );
    }

    const existingMain = await DraftPick.findOne({ leagueId: id, playerId });
    if (existingMain) {
      return NextResponse.json(
        { error: "Player has already been drafted in the main draft" },
        { status: 409 },
      );
    }

    const existingTaxi = await TaxiPick.findOne({ leagueId: id, playerId });
    if (existingTaxi) {
      return NextResponse.json(
        { error: "Player has already been taken in the taxi draft" },
        { status: 409 },
      );
    }

    const teamPicks = await TaxiPick.find({ leagueId: id, teamId }).select("slotIndex");
    if (teamPicks.length >= taxiSlots) {
      return NextResponse.json(
        { error: `This team already has ${taxiSlots} taxi picks.` },
        { status: 400 },
      );
    }

    const occupied = new Set(teamPicks.map((p) => p.slotIndex));
    let resolvedSlot: number;
    if (slotIndex === undefined || slotIndex === null) {
      let next = -1;
      for (let i = 0; i < taxiSlots; i++) {
        if (!occupied.has(i)) {
          next = i;
          break;
        }
      }
      if (next === -1) {
        return NextResponse.json(
          { error: "No free taxi slots for this team" },
          { status: 400 },
        );
      }
      resolvedSlot = next;
    } else {
      const n = Number(slotIndex);
      if (!Number.isInteger(n) || n < 0 || n >= taxiSlots) {
        return NextResponse.json(
          { error: `slotIndex must be an integer in 0..${taxiSlots - 1}` },
          { status: 400 },
        );
      }
      if (occupied.has(n)) {
        return NextResponse.json(
          { error: `Slot ${n} is already filled for this team` },
          { status: 409 },
        );
      }
      resolvedSlot = n;
    }

    const pick = await TaxiPick.create({
      leagueId: id,
      playerId,
      playerName,
      mlbTeam,
      positions: Array.isArray(positions) ? positions : [],
      teamId,
      teamName: team.name,
      slotIndex: resolvedSlot,
    });

    return NextResponse.json(
      { message: "Taxi pick recorded successfully", pick },
      { status: 201 },
    );
  } catch (error) {
    console.error("Post taxi-picks route error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
