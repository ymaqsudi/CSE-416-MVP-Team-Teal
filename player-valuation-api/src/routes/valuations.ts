import { Router } from "express";
import { postValuationsBatch, getValuationsAll } from "../controllers/valuationsController.js";

const router = Router();

router.post("/batch", postValuationsBatch);
router.get("/all", getValuationsAll);

export default router;
