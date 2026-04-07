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

export async function POST(request: NextRequest) {
  try {
    const token = getTokenFromRequest(request);

    if (!token) {
      return NextResponse.json(
        { error: "missing authorization token" },
        { status: 401 }
      );
    }

    const decoded = verifyToken(token);

    if (!decoded) {
      return NextResponse.json(
        { error: "invalid or expired token" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { leagueName, teamCount, budget, scoringType, categories } = body;

    if (!leagueName || !teamCount || !budget) {
      return NextResponse.json(
        { error: "leagueName, teamCount, and budget are required" },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const newLeague = await League.create({
      userId: decoded.userId,
      leagueName: String(leagueName).trim(),
      teamCount: Number(teamCount),
      budget: Number(budget),
      scoringType: scoringType ? String(scoringType) : "rotisserie",
      categories: Array.isArray(categories) ? categories : [],
    });

    return NextResponse.json(
      {
        message: "league created successfully",
        league: newLeague,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create league route error:", error);

    return NextResponse.json(
      { error: "internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const token = getTokenFromRequest(request);

    if (!token) {
      return NextResponse.json(
        { error: "missing authorization token" },
        { status: 401 }
      );
    }

    const decoded = verifyToken(token);

    if (!decoded) {
      return NextResponse.json(
        { error: "invalid or expired token" },
        { status: 401 }
      );
    }

    await connectToDatabase();

    const leagues = await League.find({ userId: decoded.userId }).sort({
      createdAt: -1,
    });

    return NextResponse.json({ leagues }, { status: 200 });
  } catch (error) {
    console.error("Get leagues route error:", error);

    return NextResponse.json(
      { error: "internal server error" },
      { status: 500 }
    );
  }
}

