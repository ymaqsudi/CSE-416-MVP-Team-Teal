import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { connectToDatabase } from "@/lib/db/mongodb";
import { League } from "@/lib/models/League";
import { PlayerNote } from "@/lib/models/PlayerNote";

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

    const playerNote = await PlayerNote.findOne({
      leagueId: id,
      playerId,
    });

    return NextResponse.json(
      { note: playerNote?.note ?? "" },
      { status: 200 },
    );
  } catch (error) {
    console.error("Get player note route error:", error);

    return NextResponse.json(
      { error: "internal server error" },
      { status: 500 },
    );
  }
}

export async function PUT(
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
    const body = await request.json();
    const { note, playerName } = body;

    if (typeof note !== "string") {
      return NextResponse.json(
        { error: "note must be a string" },
        { status: 400 },
      );
    }

    if (!playerName || typeof playerName !== "string") {
      return NextResponse.json(
        { error: "playerName is required" },
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

    const updatedNote = await PlayerNote.findOneAndUpdate(
      { leagueId: id, playerId },
      {
        leagueId: id,
        playerId,
        playerName,
        note: note.trim(),
        createdBy: decoded.userId,
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      },
    );

    return NextResponse.json(
      {
        message: "player note saved successfully",
        note: updatedNote.note,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Save player note route error:", error);

    return NextResponse.json(
      { error: "internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
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

    await PlayerNote.findOneAndDelete({
      leagueId: id,
      playerId,
    });

    return NextResponse.json(
      { message: "player note deleted successfully" },
      { status: 200 },
    );
  } catch (error) {
    console.error("Delete player note route error:", error);

    return NextResponse.json(
      { error: "internal server error" },
      { status: 500 },
    );
  }
}