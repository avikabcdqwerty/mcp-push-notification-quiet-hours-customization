import { DataSource, Repository } from "typeorm";
import { QuietHoursEntity } from "../entities/QuietHoursEntity";
import { AppDataSource } from "../data-source"; // Assumes a configured TypeORM DataSource
import { Logger } from "../utils/logger"; // Assumes a logger utility

export interface QuietHourInput {
  startTime: string;
  endTime: string;
}

/**
 * QuietHoursRepository provides CRUD operations for quiet hour settings.
 */
export class QuietHoursRepository {
  private repo: Repository<QuietHoursEntity>;

  constructor() {
    this.repo = AppDataSource.getRepository(QuietHoursEntity);
  }

  /**
   * Find all quiet hour periods for a user.
   * @param userId User's unique identifier
   * @returns Array of QuietHoursEntity
   */
  async findByUserId(userId: string): Promise<QuietHoursEntity[]> {
    try {
      return await this.repo.find({
        where: { userId },
        order: { startTime: "ASC" },
      });
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
   */
  async create(userId: string, input: QuietHourInput): Promise<QuietHoursEntity> {
    try {
      const entity = this.repo.create({
        userId,
        startTime: input.startTime,
        endTime: input.endTime,
      });
      return await this.repo.save(entity);
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
   */
  async update(userId: string, id: string, input: QuietHourInput): Promise<QuietHoursEntity> {
    try {
      const entity = await this.repo.findOneBy({ id, userId });
      if (!entity) {
        const error: any = new Error("Quiet hour period not found.");
        error.name = "NotFoundError";
        throw error;
      }
      entity.startTime = input.startTime;
      entity.endTime = input.endTime;
      return await this.repo.save(entity);
    } catch (error) {
      Logger.error(`Error updating quiet hour ${id} for user ${userId}`, error);
      throw error;
    }
  }

  /**
   * Delete a quiet hour period for a user.
   * @param userId User's unique identifier
   * @param id Quiet hour period ID
   */
  async delete(userId: string, id: string): Promise<void> {
    try {
      const entity = await this.repo.findOneBy({ id, userId });
      if (!entity) {
        const error: any = new Error("Quiet hour period not found.");
        error.name = "NotFoundError";
        throw error;
      }
      await this.repo.remove(entity);
    } catch (error) {
      Logger.error(`Error deleting quiet hour ${id} for user ${userId}`, error);
      throw error;
    }
  }
}