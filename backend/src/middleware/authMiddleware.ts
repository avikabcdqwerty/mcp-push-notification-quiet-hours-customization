import { Request, Response, NextFunction } from "express";
import passport from "passport";
import { Logger } from "../utils/logger"; // Assumes a logger utility exists

/**
 * Express middleware to ensure the user is authenticated.
 * Attaches the authenticated user to req.user.
 * Responds with 401 Unauthorized if not authenticated.
 */
export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Use Passport.js to check authentication
  passport.authenticate("jwt", { session: false }, (err, user, info) => {
    if (err) {
      Logger.error("Authentication error", err);
      return res.status(500).json({ message: "Authentication error" });
    }
    if (!user) {
      Logger.warn("Unauthorized access attempt", { ip: req.ip, path: req.path });
      return res.status(401).json({ message: "Unauthorized" });
    }
    req.user = user;
    next();
  })(req, res, next);
}