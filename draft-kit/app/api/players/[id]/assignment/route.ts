import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { connectToDatabase } from "@/lib/db/mongodb";
import { Roster } from "@/lib/models/Roster";
import { League } from "@/lib/models/League";

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
    const { leagueId, teamName, position, price, playerName, mlbTeam, positions } = body;

    if (!leagueId || !teamName || !position || price === undefined || !playerName || !mlbTeam) {
      return NextResponse.json(
        { error: "leagueId, teamName, position, price, playerName, and mlbTeam are required" },
        { status: 400 },
      );
    }

    await connectToDatabase();

    // Verify the league exists and belongs to the user
    const league = await League.findOne({ _id: leagueId, userId: decoded.userId });
    if (!league) {
      return NextResponse.json(
        { error: "league not found or access denied" },
        { status: 404 },
      );
    }

    // Check if this position is already filled in the roster
    const existingAssignment = await Roster.findOne({
      leagueId,
      teamName,
      position,
    });

    if (existingAssignment) {
      return NextResponse.json(
        { error: "position already filled in this team's roster" },
        { status: 409 },
      );
    }

    // Check if player is already assigned to another position in this league
    const playerAssignment = await Roster.findOne({
      leagueId,
      playerId: id,
    });

    if (playerAssignment) {
      return NextResponse.json(
        { error: "player is already assigned to this league" },
        { status: 409 },
      );
    }

    // Create the roster assignment
    const assignment = await Roster.create({
      leagueId,
      teamName,
      playerId: id,
      playerName,
      mlbTeam,
      positions: positions || [],
      position,
      price: Number(price),
      assignedBy: decoded.userId,
    });

    return NextResponse.json(
      {
        message: "player assigned to roster successfully",
        assignment,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Assign player to roster route error:", error);

    return NextResponse.json(
      { error: "internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
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
    const leagueId = searchParams.get("leagueId");
    const teamName = searchParams.get("teamName");
    const position = searchParams.get("position");

    if (!leagueId || !teamName || !position) {
      return NextResponse.json(
        { error: "leagueId, teamName, and position are required query parameters" },
        { status: 400 },
      );
    }

    await connectToDatabase();

    // Verify the league exists and belongs to the user
    const league = await League.findOne({ _id: leagueId, userId: decoded.userId });
    if (!league) {
      return NextResponse.json(
        { error: "league not found or access denied" },
        { status: 404 },
      );
    }

    // Find and delete the assignment
    const deletedAssignment = await Roster.findOneAndDelete({
      leagueId,
      teamName,
      playerId: id,
      position,
    });

    if (!deletedAssignment) {
      return NextResponse.json(
        { error: "assignment not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        message: "player unassigned from roster successfully",
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Unassign player from roster route error:", error);

    return NextResponse.json(
      { error: "internal server error" },
      { status: 500 },
    );
  }
}