import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/mongodb";
import { League } from "@/lib/models/League";

export const dynamic = "force-dynamic";

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

function noStoreJson(data: unknown, status: number) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store, must-revalidate" },
  });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const token = getTokenFromRequest(request);
    if (!token) {
      return noStoreJson({ error: "Missing authorization token" }, 401);
    }
    const decoded = verifyToken(token);
    if (!decoded) {
      return noStoreJson({ error: "Invalid or expired token" }, 401);
    }

    const { id } = await context.params;
    if (!mongoose.isValidObjectId(id)) {
      return noStoreJson({ error: "Invalid league id" }, 400);
    }

    await connectToDatabase();

    const league = await League.findOne({
      _id: id,
      userId: decoded.userId,
    }).lean();

    if (!league) {
      return noStoreJson({ error: "League not found" }, 404);
    }

    const picks = [...(league.draftPicks ?? [])].sort(
      (a, b) => a.pickNumber - b.pickNumber,
    );

    return noStoreJson(
      {
        league: {
          _id: String(league._id),
          leagueName: league.leagueName,
          teamCount: league.teamCount,
          budget: league.budget,
          scoringType: league.scoringType,
          teams: league.teams ?? [],
          myTeamId: league.myTeamId ?? "",
        },
        picks,
      },
      200,
    );
  } catch (error) {
    console.error("Draft history GET error:", error);
    return noStoreJson({ error: "Internal server error" }, 500);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const token = getTokenFromRequest(request);
    if (!token) {
      return noStoreJson({ error: "Missing authorization token" }, 401);
    }
    const decoded = verifyToken(token);
    if (!decoded) {
      return noStoreJson({ error: "Invalid or expired token" }, 401);
    }

    const { id } = await context.params;
    if (!mongoose.isValidObjectId(id)) {
      return noStoreJson({ error: "Invalid league id" }, 400);
    }

    const body = await request.json();
    const {
      teamId,
      playerId,
      playerName,
      mlbTeam,
      positions,
      price,
    } = body as Record<string, unknown>;

    if (!teamId || !playerId || !playerName || price === undefined || price === null) {
      return noStoreJson(
        { error: "teamId, playerId, playerName, and price are required" },
        400,
      );
    }

    const priceNum = Number(price);
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      return noStoreJson({ error: "price must be a non-negative number" }, 400);
    }

    await connectToDatabase();

    const league = await League.findOne({ _id: id, userId: decoded.userId });
    if (!league) {
      return noStoreJson({ error: "League not found" }, 404);
    }

    const team = (league.teams ?? []).find((t) => t.id === String(teamId));
    if (!team) {
      return noStoreJson(
        { error: "Team does not belong to this league" },
        400,
      );
    }

    if (!Array.isArray(league.draftPicks)) {
      league.draftPicks = [];
    }

    const pid = String(playerId).trim();
    if (league.draftPicks.some((p) => p.playerId === pid)) {
      return noStoreJson(
        { error: "This player is already in your draft history" },
        400,
      );
    }

    const maxPickNum = league.draftPicks.length
      ? Math.max(...league.draftPicks.map((p) => p.pickNumber))
      : 0;
    const nextPick = maxPickNum + 1;
    const round = Math.floor((nextPick - 1) / league.teamCount) + 1;

    league.draftPicks.push({
      pickNumber: nextPick,
      round,
      teamId: team.id,
      teamName: team.name,
      playerId: pid,
      playerName: String(playerName).trim(),
      mlbTeam: mlbTeam != null ? String(mlbTeam) : "",
      positions: Array.isArray(positions)
        ? positions.map((x) => String(x))
        : [],
      price: priceNum,
    });

    league.markModified("draftPicks");
    await league.save();

    const added = league.draftPicks[league.draftPicks.length - 1];

    return noStoreJson(
      {
        message: "Pick recorded",
        pick: added,
        league: {
          _id: String(league._id),
          leagueName: league.leagueName,
          teamCount: league.teamCount,
          budget: league.budget,
        },
      },
      201,
    );
  } catch (error) {
    console.error("Draft history POST error:", error);
    return noStoreJson({ error: "Internal server error" }, 500);
  }
}

/** Remove the most recent pick (undo), per course “fix mistakes” flow. */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const token = getTokenFromRequest(request);
    if (!token) {
      return noStoreJson({ error: "Missing authorization token" }, 401);
    }
    const decoded = verifyToken(token);
    if (!decoded) {
      return noStoreJson({ error: "Invalid or expired token" }, 401);
    }

    const { id } = await context.params;
    if (!mongoose.isValidObjectId(id)) {
      return noStoreJson({ error: "Invalid league id" }, 400);
    }

    await connectToDatabase();

    const league = await League.findOne({ _id: id, userId: decoded.userId });
    if (!league) {
      return noStoreJson({ error: "League not found" }, 404);
    }

    if (!Array.isArray(league.draftPicks)) {
      league.draftPicks = [];
    }

    if (!league.draftPicks.length) {
      return noStoreJson({ error: "No picks to undo" }, 400);
    }

    let maxIdx = 0;
    let maxNum = -1;
    league.draftPicks.forEach((p, i) => {
      if (p.pickNumber > maxNum) {
        maxNum = p.pickNumber;
        maxIdx = i;
      }
    });
    league.draftPicks.splice(maxIdx, 1);

    league.markModified("draftPicks");
    await league.save();

    return noStoreJson(
      {
        message: "Last pick removed",
        remainingPicks: league.draftPicks.length,
      },
      200,
    );
  } catch (error) {
    console.error("Draft history DELETE error:", error);
    return noStoreJson({ error: "Internal server error" }, 500);
  }
}
