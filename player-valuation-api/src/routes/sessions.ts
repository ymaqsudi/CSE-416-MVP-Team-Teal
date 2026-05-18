import { Router } from "express";
import { createSession, patchSession, putDraftState } from "../controllers/sessionsController.js";

const router = Router();

router.post("/", createSession);
router.patch("/:sessionId", patchSession);
router.put("/:sessionId/draftState", putDraftState);

export default router;
