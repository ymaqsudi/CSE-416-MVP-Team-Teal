import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { connectToDatabase } from "@/lib/db/mongodb";
import { League } from "@/lib/models/League";

const JWT_SECRET = process.env.JWT_SECRET;

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

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const token = getTokenFromRequest(request);

    if (!token) {
      return NextResponse.json(
        { error: "Missing authorization token" },
        { status: 401 }
      );
    }

    const decoded = verifyToken(token);

    if (!decoded) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const body = await request.json();
    const { leagueName, teamCount, budget, scoringType, categories } = body;

    if (!leagueName || !teamCount || !budget) {
      return NextResponse.json(
        { error: "League name, team count, and budget are required" },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const updatedLeague = await League.findOneAndUpdate(
      { _id: id, userId: decoded.userId },
      {
        leagueName: String(leagueName).trim(),
        teamCount: Number(teamCount),
        budget: Number(budget),
        scoringType: scoringType ? String(scoringType) : "rotisserie",
        categories: Array.isArray(categories) ? categories : [],
      },
      { new: true }
    );

    if (!updatedLeague) {
      return NextResponse.json(
        { error: "League not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        message: "League updated successfully",
        league: updatedLeague,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Update league route error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}