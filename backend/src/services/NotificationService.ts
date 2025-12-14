import { QuietHoursService } from "./QuietHoursService";
import { Logger } from "../utils/logger"; // Assumes a logger utility exists

// Interface for a notification payload
export interface NotificationPayload {
  userId: string;
  message: string;
  data?: any;
  timestamp: Date; // UTC
  relevanceExpiresAt?: Date; // Optional: when notification is no longer relevant
}

// Interface for queued notification
interface QueuedNotification extends NotificationPayload {
  queuedAt: Date;
}

// In-memory queue for demonstration; replace with persistent queue in production
const notificationQueue: Map<string, QueuedNotification[]> = new Map();

/**
 * NotificationService handles delivery, suppression, and queuing of push notifications
 * based on user quiet hour settings.
 */
export class NotificationService {
  private quietHoursService: QuietHoursService;

  constructor() {
    this.quietHoursService = new QuietHoursService();
  }

  /**
   * Attempt to deliver a notification to a user.
   * If within quiet hours, suppress or queue the notification.
   * @param payload NotificationPayload
   * @returns Promise<boolean> true if delivered, false if queued/suppressed
   */
  async sendNotification(payload: NotificationPayload): Promise<boolean> {
    try {
      const isQuiet = await this.quietHoursService.isWithinQuietHours(
        payload.userId,
        payload.timestamp
      );

      if (isQuiet) {
        Logger.info(
          `Notification for user ${payload.userId} queued due to quiet hours.`
        );
        this.queueNotification(payload);
        return false;
      } else {
        await this.deliverNotification(payload);
        return true;
      }
    } catch (error) {
      Logger.error(
        `Error processing notification for user ${payload.userId}`,
        error
      );
      throw error;
    }
  }

  /**
   * Queue a notification for later delivery.
   * @param payload NotificationPayload
   */
  private queueNotification(payload: NotificationPayload): void {
    const userQueue = notificationQueue.get(payload.userId) || [];
    userQueue.push({
      ...payload,
      queuedAt: new Date(),
    });
    notificationQueue.set(payload.userId, userQueue);
  }

  /**
   * Deliver queued notifications for a user after quiet hours end.
   * Only delivers notifications that are still relevant.
   * @param userId User's unique identifier
   * @returns Promise<number> Number of notifications delivered
   */
  async deliverQueuedNotifications(userId: string): Promise<number> {
    const now = new Date();
    const userQueue = notificationQueue.get(userId) || [];
    let deliveredCount = 0;

    // Filter and deliver relevant notifications
    const remainingQueue: QueuedNotification[] = [];
    for (const notification of userQueue) {
      // Check if notification is still relevant
      if (
        notification.relevanceExpiresAt &&
        now > notification.relevanceExpiresAt
      ) {
        Logger.info(
          `Queued notification for user ${userId} expired and will not be delivered.`
        );
        continue;
      }
      try {
        await this.deliverNotification(notification);
        deliveredCount++;
      } catch (error) {
        Logger.error(
          `Failed to deliver queued notification for user ${userId}`,
          error
        );
        remainingQueue.push(notification); // Keep in queue for retry
      }
    }
    if (remainingQueue.length > 0) {
      notificationQueue.set(userId, remainingQueue);
    } else {
      notificationQueue.delete(userId);
    }
    return deliveredCount;
  }

  /**
   * Deliver a notification immediately.
   * Replace this with actual push notification logic.
   * @param payload NotificationPayload
   */
  private async deliverNotification(payload: NotificationPayload): Promise<void> {
    // TODO: Integrate with push notification provider (e.g., Firebase, APNs)
    Logger.info(
      `Delivering notification to user ${payload.userId}: ${payload.message}`
    );
    // Simulate async delivery
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  /**
   * Periodically check and deliver queued notifications for all users.
   * Should be called by a scheduler (e.g., cron job).
   */
  async processAllQueuedNotifications(): Promise<void> {
    for (const userId of notificationQueue.keys()) {
      // Check if user is outside quiet hours
      const now = new Date();
      const isQuiet = await this.quietHoursService.isWithinQuietHours(
        userId,
        now
      );
      if (!isQuiet) {
        await this.deliverQueuedNotifications(userId);
      }
    }
  }

  /**
   * For testing: get queued notifications for a user.
   * @param userId User's unique identifier
   */
  getQueuedNotifications(userId: string): QueuedNotification[] {
    return notificationQueue.get(userId) || [];
  }
}

export default NotificationService;