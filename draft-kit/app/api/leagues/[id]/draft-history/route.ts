import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/mongodb";
import { League } from "@/lib/models/League";
import { DraftPick } from "@/lib/models/DraftPick";

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

    const rawPicks = await DraftPick.find({ leagueId: id })
      .sort({ pickNumber: 1 })
      .lean();
    const teamCount = league.teamCount;
    const picks = rawPicks.map((p) => ({
      ...p,
      _id: String(p._id),
      round: Math.floor((p.pickNumber - 1) / teamCount) + 1,
    }));

    return noStoreJson(
      {
        league: {
          _id: String(league._id),
          leagueName: league.leagueName,
          teamCount: league.teamCount,
          budget: league.budget,
          mainRosterSlots: league.mainRosterSlots,
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
