import { Request, Response, NextFunction } from "express";

const API_KEY = process.env.API_KEY;

export function apiKeyMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const key = req.headers["x-api-key"];

  if (!API_KEY) {
    res.status(500).json({
      message: "Server misconfiguration: API_KEY not set",
    });
    return;
  }

  if (!key || key !== API_KEY) {
    res.status(401).json({
      message: "Unauthorized: missing or invalid x-api-key header",
    });
    return;
  }

  next();
}
