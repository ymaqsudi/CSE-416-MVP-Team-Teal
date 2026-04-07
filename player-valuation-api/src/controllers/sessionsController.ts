import { Request, Response } from "express";
import { randomBytes } from "crypto";
import { SessionModel } from "../models/Session.js";

export async function createSession(req: Request, res: Response): Promise<void> {
  try {
    const { league, draftState } = req.body ?? {};
    const numTeams = Number(league?.numTeams);
    const budget = Number(league?.budget);
    if (!league || !Number.isFinite(numTeams) || !Number.isFinite(budget) || numTeams < 1 || budget < 1) {
      res.status(400).json({
        message: "Invalid body: league.numTeams and league.budget (positive numbers) are required",
      });
      return;
    }

    const sessionId = "sess_" + randomBytes(12).toString("hex");

    await SessionModel.create({
      sessionId,
      league: {
        numTeams,
        budget,
        scoring: typeof league.scoring === "string" ? league.scoring : "5x5",
        rosterSlotsPerTeam: league.rosterSlotsPerTeam,
      },
      draftState: {
        picks: Array.isArray(draftState?.picks) ? draftState.picks : [],
        budgetsRemaining: Array.isArray(draftState?.budgetsRemaining)
          ? draftState.budgetsRemaining
          : [],
      },
    });

    res.status(201).json({ session_id: sessionId });
  } catch (e) {
    console.error("createSession", e);
    res.status(500).json({ message: "Internal server error" });
  }
}

export async function patchSession(req: Request, res: Response): Promise<void> {
  try {
    const { sessionId } = req.params;
    const { pick } = req.body ?? {};

    const priceNum = typeof pick?.price === "number" ? pick.price : Number(pick?.price);
    if (
      !pick ||
      typeof pick.teamInLeagueId !== "string" ||
      !Number.isFinite(priceNum)
    ) {
      res.status(400).json({
        message: "Body must include pick.teamInLeagueId (string) and pick.price (number)",
      });
      return;
    }

    if (pick.mlbPlayerId === undefined && pick.playerId === undefined) {
      res.status(400).json({
        message: "pick must include mlbPlayerId and/or playerId",
      });
      return;
    }

    const exists = await SessionModel.findOne({ sessionId }).lean().exec();
    if (!exists) {
      res.status(404).json({ message: "Session not found" });
      return;
    }

    const newPick = {
      mlbPlayerId: pick.mlbPlayerId !== undefined ? Number(pick.mlbPlayerId) : undefined,
      playerId: typeof pick.playerId === "string" ? pick.playerId : undefined,
      teamInLeagueId: pick.teamInLeagueId,
      price: priceNum,
    };

    await SessionModel.updateOne(
      { sessionId },
      { $push: { "draftState.picks": newPick } }
    ).exec();

    const { budgetsRemaining } = req.body ?? {};
    if (Array.isArray(budgetsRemaining)) {
      await SessionModel.updateOne(
        { sessionId },
        {
          $set: {
            "draftState.budgetsRemaining": budgetsRemaining.map((x: unknown) => Number(x)),
          },
        }
      ).exec();
    }

    const updated = await SessionModel.findOne({ sessionId }).lean().exec();
    const n = updated?.draftState?.picks?.length ?? 0;

    res.json({
      sessionId,
      picksRecorded: n,
    });
  } catch (e) {
    console.error("patchSession", e);
    res.status(500).json({ message: "Internal server error" });
  }
}
