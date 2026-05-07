import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { connectToDatabase } from "@/lib/db/mongodb";
import { League } from "@/lib/models/League";
import { CustomPlayer } from "@/lib/models/CustomPlayer";

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
  context: { params: Promise<{ id: string; playerId: string }> },
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

    const { id, playerId } = await context.params;

    await connectToDatabase();

    const league = await League.findOne({ _id: id, userId: decoded.userId });
    if (!league) {
      return NextResponse.json(
        { error: "league not found or access denied" },
        { status: 404 },
      );
    }

    const customPlayer = await CustomPlayer.findOne({
      _id: playerId,
      leagueId: id,
    });

    if (!customPlayer) {
      return NextResponse.json(
        { error: "custom player not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        player: {
          id: `custom_${customPlayer._id}`,
          name: customPlayer.name,
          mlbTeam: customPlayer.mlbTeam || undefined,
          positions: customPlayer.positions,
          bats: customPlayer.bats,
          throws: customPlayer.throws,
          depthRole: customPlayer.depthRole,
          risk: customPlayer.risk,
          age: customPlayer.age,
          injuryStatus: customPlayer.injuryStatus,
          injuryNote: customPlayer.injuryNote,
          injuryReturn: customPlayer.injuryReturn,
          isCustom: true,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Get custom player route error:", error);

    return NextResponse.json(
      { error: "internal server error" },
      { status: 500 },
    );
  }
}