import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { DeveloperAccount } from "../models/DeveloperAccount.js";
import {
  jwtAuthMiddleware,
  signDevToken,
  devCookieOptions,
  DEV_COOKIE_NAME,
} from "../middleware/jwtAuth.js";

const router = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LEN = 8;
const BCRYPT_ROUNDS = 10;

router.post("/register", async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body ?? {};
    if (typeof email !== "string" || !EMAIL_RE.test(email)) {
      res.status(400).json({ message: "Invalid email" });
      return;
    }
    if (typeof password !== "string" || password.length < MIN_PASSWORD_LEN) {
      res.status(400).json({
        message: `Password must be at least ${MIN_PASSWORD_LEN} characters`,
      });
      return;
    }
    const normalized = email.toLowerCase();
    const exists = await DeveloperAccount.findOne({ email: normalized });
    if (exists) {
      res.status(409).json({ message: "Email already registered" });
      return;
    }
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const account = await DeveloperAccount.create({
      email: normalized,
      passwordHash,
    });
    const token = signDevToken(account._id.toString());
    res.cookie(DEV_COOKIE_NAME, token, devCookieOptions());
    res.status(201).json({ id: account._id.toString(), email: account.email });
  } catch (err) {
    console.error("register error", err);
    res.status(500).json({ message: "Internal error" });
  }
});

router.post("/login", async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body ?? {};
    if (typeof email !== "string" || typeof password !== "string") {
      res.status(400).json({ message: "Email and password required" });
      return;
    }
    const account = await DeveloperAccount.findOne({ email: email.toLowerCase() });
    if (!account) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }
    const ok = await bcrypt.compare(password, account.passwordHash);
    if (!ok) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }
    const token = signDevToken(account._id.toString());
    res.cookie(DEV_COOKIE_NAME, token, devCookieOptions());
    res.json({ id: account._id.toString(), email: account.email });
  } catch (err) {
    console.error("login error", err);
    res.status(500).json({ message: "Internal error" });
  }
});

router.post("/logout", (req: Request, res: Response): void => {
  res.clearCookie(DEV_COOKIE_NAME, devCookieOptions());
  res.json({ ok: true });
});

router.get(
  "/me",
  jwtAuthMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const account = await DeveloperAccount.findById(req.developerId);
      if (!account) {
        res.status(404).json({ message: "Account not found" });
        return;
      }
      res.json({
        id: account._id.toString(),
        email: account.email,
        createdAt: account.createdAt,
      });
    } catch (err) {
      console.error("me error", err);
      res.status(500).json({ message: "Internal error" });
    }
  }
);

router.post(
  "/change-password",
  jwtAuthMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { oldPassword, newPassword } = req.body ?? {};
      if (typeof oldPassword !== "string" || typeof newPassword !== "string") {
        res.status(400).json({ message: "oldPassword and newPassword required" });
        return;
      }
      if (newPassword.length < MIN_PASSWORD_LEN) {
        res.status(400).json({
          message: `New password must be at least ${MIN_PASSWORD_LEN} characters`,
        });
        return;
      }
      const account = await DeveloperAccount.findById(req.developerId);
      if (!account) {
        res.status(404).json({ message: "Account not found" });
        return;
      }
      const ok = await bcrypt.compare(oldPassword, account.passwordHash);
      if (!ok) {
        res.status(401).json({ message: "Current password incorrect" });
        return;
      }
      account.passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
      await account.save();
      res.json({ ok: true });
    } catch (err) {
      console.error("change-password error", err);
      res.status(500).json({ message: "Internal error" });
    }
  }
);

export default router;
