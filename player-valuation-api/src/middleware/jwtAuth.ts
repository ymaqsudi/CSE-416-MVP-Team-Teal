import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

declare module "express-serve-static-core" {
  interface Request {
    developerId?: string;
  }
}

export const DEV_COOKIE_NAME = "dev_token";

export function jwtAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    res.status(500).json({ message: "Server misconfiguration: JWT_SECRET not set" });
    return;
  }
  const token = req.cookies?.[DEV_COOKIE_NAME];
  if (!token || typeof token !== "string") {
    res.status(401).json({ message: "Unauthorized: missing session" });
    return;
  }
  try {
    const payload = jwt.verify(token, secret) as { sub?: string };
    if (!payload.sub) {
      res.status(401).json({ message: "Unauthorized: invalid token" });
      return;
    }
    req.developerId = payload.sub;
    next();
  } catch {
    res.status(401).json({ message: "Unauthorized: invalid token" });
  }
}

export function signDevToken(developerId: string): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET not set");
  return jwt.sign({ sub: developerId }, secret, { expiresIn: "7d" });
}

export function devCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  };
}
