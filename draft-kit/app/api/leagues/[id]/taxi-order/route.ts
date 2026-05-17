import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { connectToDatabase } from "@/lib/db/mongodb";
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

    const teamIds = (league.teams ?? []).map((t) => t.id);
    const stored = (league.taxiDraftOrder ?? []).filter((id) => teamIds.includes(id));
    const order = stored.length === teamIds.length && stored.length > 0 ? stored : teamIds;

    return NextResponse.json({ order }, { status: 200 });
  } catch (error) {
    console.error("Get taxi-order route error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(
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
    const { order } = body;

    if (!Array.isArray(order)) {
      return NextResponse.json({ error: "order must be an array of team ids" }, { status: 400 });
    }

    await connectToDatabase();

    const league = await League.findOne({ _id: id, userId: decoded.userId });
    if (!league) {
      return NextResponse.json({ error: "League not found" }, { status: 404 });
    }

    const teamIds = (league.teams ?? []).map((t) => t.id);
    const cleaned = order.map((v: unknown) => String(v));
    const unique = Array.from(new Set(cleaned));

    if (unique.length !== cleaned.length) {
      return NextResponse.json({ error: "order contains duplicate team ids" }, { status: 400 });
    }
    if (unique.length !== teamIds.length) {
      return NextResponse.json(
        { error: `order must include all ${teamIds.length} teams exactly once` },
        { status: 400 },
      );
    }
    for (const tid of unique) {
      if (!teamIds.includes(tid)) {
        return NextResponse.json(
          { error: `team id ${tid} does not belong to this league` },
          { status: 400 },
        );
      }
    }

    league.taxiDraftOrder = unique;
    await league.save();

    return NextResponse.json({ order: unique }, { status: 200 });
  } catch (error) {
    console.error("Put taxi-order route error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
