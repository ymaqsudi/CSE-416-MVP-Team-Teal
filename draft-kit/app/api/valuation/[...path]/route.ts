import { NextRequest, NextResponse } from "next/server";

// Server-side proxy: forwards every request from the browser to the Player
// Valuation API with the LICENSE_KEY injected as `x-license-key`. The license
// key never leaves the server — the browser only ever talks to /api/valuation/*.
//
// Why catch-all: routes like /players, /valuations, /sessions, /transactions
// (and anything added later) all flow through this single handler, so no
// future API endpoint can accidentally bypass licensing.

export const dynamic = "force-dynamic";

const VALUATION_API_URL = process.env.VALUATION_API_URL;
const LICENSE_KEY = process.env.LICENSE_KEY;

async function proxy(
  req: NextRequest,
  ctx: { params: Promise<{ path?: string[] }> }
): Promise<NextResponse> {
  if (!VALUATION_API_URL || !LICENSE_KEY) {
    return NextResponse.json(
      { message: "Valuation API not configured: set VALUATION_API_URL and LICENSE_KEY" },
      { status: 500 }
    );
  }

  const { path = [] } = await ctx.params;
  const upstreamPath = path.map(encodeURIComponent).join("/");
  const upstream = new URL(`${VALUATION_API_URL.replace(/\/+$/, "")}/${upstreamPath}`);

  const incoming = new URL(req.url);
  incoming.searchParams.forEach((v, k) => upstream.searchParams.append(k, v));

  const headers: Record<string, string> = {
    "x-license-key": LICENSE_KEY,
    accept: req.headers.get("accept") ?? "application/json",
  };
  const ct = req.headers.get("content-type");
  if (ct) headers["content-type"] = ct;

  let body: ArrayBuffer | undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    body = await req.arrayBuffer();
  }

  const upstreamRes = await fetch(upstream.toString(), {
    method: req.method,
    headers,
    body,
  });

  const respHeaders: Record<string, string> = {};
  const respCt = upstreamRes.headers.get("content-type");
  if (respCt) respHeaders["content-type"] = respCt;

  return new NextResponse(upstreamRes.body, {
    status: upstreamRes.status,
    headers: respHeaders,
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
