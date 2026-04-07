import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/db/mongodb";
import { User } from "@/lib/models/User";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, email, password } = body;

    if (!username || !email || !password) {
      return NextResponse.json(
        { error: "username, email, and password are required" },
        { status: 400 }
      );
    }

    if (typeof username !== "string" || typeof email !== "string" || typeof password !== "string") {
      return NextResponse.json(
        { error: "username, email, and password must all be strings" },
        { status: 400 }
      );
    }

    const trimmedUsername = username.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();

    if (trimmedUsername.length < 3) {
      return NextResponse.json(
        { error: "username must be at least 3 characters long" },
        { status: 400 }
      );
    }

    if (trimmedPassword.length < 6) {
      return NextResponse.json(
        { error: "password must be at least 6 characters long" },
        { status: 400 }
      );
    }

    await connectToDatabase();

    const existingUser = await User.findOne({ email: trimmedEmail });

    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(trimmedPassword, 10);

    const newUser = await User.create({
      username: trimmedUsername,
      email: trimmedEmail,
      passwordHash,
    });

    return NextResponse.json(
      {
        message: "user registered successfully",
        user: {
          id: newUser._id,
          username: newUser.username,
          email: newUser.email,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Register route error:", error);

    return NextResponse.json(
      { error: "internal server error" },
      { status: 500 }
    );
  }
}