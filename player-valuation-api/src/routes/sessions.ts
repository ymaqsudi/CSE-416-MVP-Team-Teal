import { Router } from "express";
import { createSession, patchSession } from "../controllers/sessionsController.js";

const router = Router();

router.post("/", createSession);
router.patch("/:sessionId", patchSession);

export default router;
