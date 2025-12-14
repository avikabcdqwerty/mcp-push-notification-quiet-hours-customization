import { QuietHoursRepository } from "../repositories/QuietHoursRepository";
import { QuietHoursEntity } from "../entities/QuietHoursEntity";
import { Logger } from "../utils/logger"; // Assume a logger utility exists

export interface QuietHourInput {
  startTime: string; // "HH:mm"
  endTime: string;   // "HH:mm"
}

export class QuietHoursService {
  private repository: QuietHoursRepository;

  constructor() {
    this.repository = new QuietHoursRepository();
  }

  /**
   * Get all quiet hour periods for a user.
   * @param userId User's unique identifier
   * @returns Array of QuietHoursEntity
   */
  async getQuietHoursForUser(userId: string): Promise<QuietHoursEntity[]> {
    try {
      return await this.repository.findByUserId(userId);
    } catch (error) {
      Logger.error(`Error fetching quiet hours for user ${userId}`, error);
      throw error;
    }
  }

  /**
   * Create a new quiet hour period for a user.
   * @param userId User's unique identifier
   * @param input QuietHourInput
   * @returns Created QuietHoursEntity
   * @throws ValidationError if input is invalid or overlaps
   */
  async createQuietHour(userId: string, input: QuietHourInput): Promise<QuietHoursEntity> {
    // Validate input
    this.validateTimeFormat(input.startTime, input.endTime);

    const existing = await this.repository.findByUserId(userId);
    if (this.hasOverlap(input, existing)) {
      Logger.warn(`Quiet hour overlap detected for user ${userId}`);
      const error: any = new Error("Quiet hour periods cannot overlap.");
      error.name = "ValidationError";
      throw error;
    }

    try {
      return await this.repository.create(userId, input);
    } catch (error) {
      Logger.error(`Error creating quiet hour for user ${userId}`, error);
      throw error;
    }
  }

  /**
   * Update an existing quiet hour period for a user.
   * @param userId User's unique identifier
   * @param id Quiet hour period ID
   * @param input QuietHourInput
   * @returns Updated QuietHoursEntity
   * @throws ValidationError if input is invalid or overlaps
   * @throws NotFoundError if period not found or not owned by user
   */
  async updateQuietHour(userId: string, id: string, input: QuietHourInput): Promise<QuietHoursEntity> {
    this.validateTimeFormat(input.startTime, input.endTime);

    const existing = await this.repository.findByUserId(userId);
    if (!existing.some((qh) => qh.id === id)) {
      Logger.warn(`Quiet hour ${id} not found for user ${userId}`);
      const error: any = new Error("Quiet hour period not found.");
      error.name = "NotFoundError";
      throw error;
    }
    if (this.hasOverlap(input, existing, id)) {
      Logger.warn(`Quiet hour overlap detected for user ${userId} on update`);
      const error: any = new Error("Quiet hour periods cannot overlap.");
      error.name = "ValidationError";
      throw error;
    }

    try {
      return await this.repository.update(userId, id, input);
    } catch (error) {
      Logger.error(`Error updating quiet hour ${id} for user ${userId}`, error);
      throw error;
    }
  }

  /**
   * Delete a quiet hour period for a user.
   * @param userId User's unique identifier
   * @param id Quiet hour period ID
   * @throws NotFoundError if period not found or not owned by user
   */
  async deleteQuietHour(userId: string, id: string): Promise<void> {
    const existing = await this.repository.findByUserId(userId);
    if (!existing.some((qh) => qh.id === id)) {
      Logger.warn(`Quiet hour ${id} not found for user ${userId} on delete`);
      const error: any = new Error("Quiet hour period not found.");
      error.name = "NotFoundError";
      throw error;
    }
    try {
      await this.repository.delete(userId, id);
    } catch (error) {
      Logger.error(`Error deleting quiet hour ${id} for user ${userId}`, error);
      throw error;
    }
  }

  /**
   * Check if a notification should be suppressed or queued based on quiet hours.
   * @param userId User's unique identifier
   * @param date Date object representing the notification time (UTC)
   * @returns true if within quiet hours, false otherwise
   */
  async isWithinQuietHours(userId: string, date: Date): Promise<boolean> {
    const quietHours = await this.repository.findByUserId(userId);
    if (quietHours.length === 0) return false;

    // Convert date to user's local time if needed (assume UTC for now)
    const minutes = date.getUTCHours() * 60 + date.getUTCMinutes();

    for (const period of quietHours) {
      const start = this.timeToMinutes(period.startTime);
      const end = this.timeToMinutes(period.endTime);
      if (this.isTimeInPeriod(minutes, start, end)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Validate time format and logical correctness.
   * @throws ValidationError if invalid
   */
  private validateTimeFormat(startTime: string, endTime: string): void {
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      const error: any = new Error("Start and end times must be in HH:mm format.");
      error.name = "ValidationError";
      throw error;
    }
    if (startTime === endTime) {
      const error: any = new Error("Start and end times cannot be the same.");
      error.name = "ValidationError";
      throw error;
    }
  }

  /**
   * Check for overlapping quiet hour periods.
   * @param input QuietHourInput
   * @param existing Array of QuietHoursEntity
   * @param editingId Optional ID to exclude from overlap check (for update)
   * @returns true if overlap detected
   */
  private hasOverlap(
    input: QuietHourInput,
    existing: QuietHoursEntity[],
    editingId?: string
  ): boolean {
    const inputStart = this.timeToMinutes(input.startTime);
    const inputEnd = this.timeToMinutes(input.endTime);

    for (const period of existing) {
      if (editingId && period.id === editingId) continue;
      const periodStart = this.timeToMinutes(period.startTime);
      const periodEnd = this.timeToMinutes(period.endTime);
      if (this.periodsOverlap(inputStart, inputEnd, periodStart, periodEnd)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Convert "HH:mm" to minutes since midnight.
   */
  private timeToMinutes(time: string): number {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
  }

  /**
   * Check if two periods overlap, considering overnight periods.
   */
  private periodsOverlap(
    s1: number,
    e1: number,
    s2: number,
    e2: number
  ): boolean {
    // Normalize overnight
    const range1 = e1 > s1 ? [[s1, e1]] : [[s1, 1440], [0, e1]];
    const range2 = e2 > s2 ? [[s2, e2]] : [[s2, 1440], [0, e2]];
    for (const [a1, a2] of range1) {
      for (const [b1, b2] of range2) {
        if (a1 < b2 && b1 < a2) return true;
      }
    }
    return false;
  }

  /**
   * Check if a time (in minutes) falls within a period, considering overnight.
   */
  private isTimeInPeriod(
    time: number,
    start: number,
    end: number
  ): boolean {
    if (start < end) {
      return time >= start && time < end;
    } else {
      // Overnight period
      return time >= start || time < end;
    }
  }
}