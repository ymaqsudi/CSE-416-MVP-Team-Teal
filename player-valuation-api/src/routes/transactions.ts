import { Router } from "express";
import { getTransactions } from "../controllers/transactionsController.js";

const router = Router();

router.get("/", getTransactions);

export default router;
