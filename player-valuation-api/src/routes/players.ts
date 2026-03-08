import { Router } from "express";
import { getPlayers, getPlayerById, getValuation } from "../controllers/playersController.js";

const router = Router();

router.get("/", getPlayers);
router.get("/:id", getPlayerById);
router.get("/:id/valuation", getValuation);

export default router;
