import { Router, Request, Response, NextFunction } from "express";
import { QuietHoursService } from "../services/QuietHoursService";
import { authMiddleware } from "../middleware/authMiddleware";
import { Logger } from "../utils/logger"; // Assume a logger utility exists

const router = Router();
const quietHoursService = new QuietHoursService();

/**
 * @swagger
 * tags:
 *   name: QuietHours
 *   description: Manage user quiet hour settings
 */

/**
 * GET /api/quiet-hours
 * Get all quiet hour periods for the authenticated user.
 */
router.get(
  "/",
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const periods = await quietHoursService.getQuietHoursForUser(userId);
      return res.status(200).json(periods);
    } catch (error) {
      Logger.error("Failed to fetch quiet hours", error);
      next(error);
    }
  }
);

/**
 * POST /api/quiet-hours
 * Create a new quiet hour period for the authenticated user.
 */
router.post(
  "/",
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const { startTime, endTime } = req.body;
      const period = await quietHoursService.createQuietHour(userId, {
        startTime,
        endTime,
      });
      return res.status(201).json(period);
    } catch (error: any) {
      Logger.warn("Failed to create quiet hour", error);
      if (error.name === "ValidationError") {
        return res.status(400).json({ message: error.message });
      }
      next(error);
    }
  }
);

/**
 * PUT /api/quiet-hours/:id
 * Update an existing quiet hour period for the authenticated user.
 */
router.put(
  "/:id",
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const { id } = req.params;
      const { startTime, endTime } = req.body;
      const updated = await quietHoursService.updateQuietHour(userId, id, {
        startTime,
        endTime,
      });
      return res.status(200).json(updated);
    } catch (error: any) {
      Logger.warn("Failed to update quiet hour", error);
      if (error.name === "ValidationError") {
        return res.status(400).json({ message: error.message });
      }
      if (error.name === "NotFoundError") {
        return res.status(404).json({ message: error.message });
      }
      next(error);
    }
  }
);

/**
 * DELETE /api/quiet-hours/:id
 * Delete a quiet hour period for the authenticated user.
 */
router.delete(
  "/:id",
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const { id } = req.params;
      await quietHoursService.deleteQuietHour(userId, id);
      return res.status(204).send();
    } catch (error: any) {
      Logger.warn("Failed to delete quiet hour", error);
      if (error.name === "NotFoundError") {
        return res.status(404).json({ message: error.message });
      }
      next(error);
    }
  }
);

export default router;