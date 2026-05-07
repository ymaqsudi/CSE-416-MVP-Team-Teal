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

    await connectToDatabase();

    const league = await League.findOne({ _id: id, userId: decoded.userId });
    if (!league) {
      return NextResponse.json(
        { error: "league not found or access denied" },
        { status: 404 },
      );
    }

    const customPlayers = await CustomPlayer.find({ leagueId: id }).sort({
      createdAt: -1,
    });

    const players = customPlayers.map((player) => ({
      id: `custom_${player._id}`,
      name: player.name,
      mlbTeam: player.mlbTeam || undefined,
      positions: player.positions,
      bats: player.bats,
      throws: player.throws,
      depthRole: player.depthRole,
      risk: player.risk,
      age: player.age,
      injuryStatus: player.injuryStatus,
      injuryNote: player.injuryNote,
      injuryReturn: player.injuryReturn,
      isCustom: true,
    }));

    return NextResponse.json({ players }, { status: 200 });
  } catch (error) {
    console.error("Get custom players route error:", error);

    return NextResponse.json(
      { error: "internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(
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
    const body = await request.json();

    const {
      name,
      mlbTeam,
      positions,
      bats,
      throws,
      depthRole,
      risk,
      age,
      injuryStatus,
      injuryNote,
      injuryReturn,
    } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: "player name is required" },
        { status: 400 },
      );
    }

    if (!Array.isArray(positions) || positions.length === 0) {
      return NextResponse.json(
        { error: "at least one position is required" },
        { status: 400 },
      );
    }

    await connectToDatabase();

    const league = await League.findOne({ _id: id, userId: decoded.userId });
    if (!league) {
      return NextResponse.json(
        { error: "league not found or access denied" },
        { status: 404 },
      );
    }

    const customPlayer = await CustomPlayer.create({
      leagueId: id,
      createdBy: decoded.userId,
      name: name.trim(),
      mlbTeam: typeof mlbTeam === "string" ? mlbTeam.trim() : "",
      positions,
      bats,
      throws,
      depthRole,
      risk,
      age: age === "" || age === undefined ? undefined : Number(age),
      injuryStatus: injuryStatus ?? null,
      injuryNote: typeof injuryNote === "string" ? injuryNote.trim() : null,
      injuryReturn:
        typeof injuryReturn === "string" && injuryReturn.trim()
          ? injuryReturn.trim()
          : null,
      isCustom: true,
    });

    return NextResponse.json(
      {
        message: "custom player created successfully",
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
      { status: 201 },
    );
  } catch (error) {
    console.error("Create custom player route error:", error);

    return NextResponse.json(
      { error: "internal server error" },
      { status: 500 },
    );
  }
}