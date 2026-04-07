import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      service: "draft-kit-backend",
      message: "Draft Kit backend is running",
    },
    { status: 200 }
  );
}