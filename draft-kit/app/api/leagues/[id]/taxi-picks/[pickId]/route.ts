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

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string; pickId: string }> },
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

    const { id, pickId } = await context.params;
    await connectToDatabase();

    const league = await League.findOne({ _id: id, userId: decoded.userId });
    if (!league) {
      return NextResponse.json({ error: "League not found" }, { status: 404 });
    }

    const removed = await TaxiPick.findOneAndDelete({ _id: pickId, leagueId: id });
    if (!removed) {
      return NextResponse.json({ error: "Taxi pick not found" }, { status: 404 });
    }

    return NextResponse.json(
      { message: "Taxi pick removed", pick: removed },
      { status: 200 },
    );
  } catch (error) {
    console.error("Delete taxi-pick route error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string; pickId: string }> },
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

    const { id, pickId } = await context.params;
    const body = await request.json();
    const { playerId, playerName, mlbTeam, positions } = body;

    if (!playerId || !playerName || !mlbTeam) {
      return NextResponse.json(
        { error: "playerId, playerName, and mlbTeam are required" },
        { status: 400 },
      );
    }

    await connectToDatabase();

    const league = await League.findOne({ _id: id, userId: decoded.userId });
    if (!league) {
      return NextResponse.json({ error: "League not found" }, { status: 404 });
    }

    const pick = await TaxiPick.findOne({ _id: pickId, leagueId: id });
    if (!pick) {
      return NextResponse.json({ error: "Taxi pick not found" }, { status: 404 });
    }

    if (pick.playerId !== playerId) {
      const existingMain = await DraftPick.findOne({ leagueId: id, playerId });
      if (existingMain) {
        return NextResponse.json(
          { error: "Player has already been drafted in the main draft" },
          { status: 409 },
        );
      }
      const existingTaxi = await TaxiPick.findOne({
        leagueId: id,
        playerId,
        _id: { $ne: pickId },
      });
      if (existingTaxi) {
        return NextResponse.json(
          { error: "Player has already been taken in the taxi draft" },
          { status: 409 },
        );
      }
    }

    pick.playerId = playerId;
    pick.playerName = playerName;
    pick.mlbTeam = mlbTeam;
    pick.positions = Array.isArray(positions) ? positions : [];
    await pick.save();

    return NextResponse.json(
      { message: "Taxi pick updated", pick },
      { status: 200 },
    );
  } catch (error) {
    console.error("Put taxi-pick route error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
