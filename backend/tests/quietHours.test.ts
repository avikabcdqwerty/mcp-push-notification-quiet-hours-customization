import "reflect-metadata";
import { AppDataSource } from "../data-source";
import { QuietHoursEntity } from "../entities/QuietHoursEntity";
import { QuietHoursRepository } from "../repositories/QuietHoursRepository";
import { QuietHoursService } from "../services/QuietHoursService";
import NotificationService, { NotificationPayload } from "../services/NotificationService";

describe("Quiet Hours Feature", () => {
  let repository: QuietHoursRepository;
  let service: QuietHoursService;
  let notificationService: NotificationService;
  let userId: string;

  beforeAll(async () => {
    await AppDataSource.initialize();
    repository = new QuietHoursRepository();
    service = new QuietHoursService();
    notificationService = new NotificationService();
    userId = "11111111-1111-1111-1111-111111111111";
  });

  afterAll(async () => {
    await AppDataSource.destroy();
  });

  beforeEach(async () => {
    // Clean up quiet hours for user before each test
    const periods = await repository.findByUserId(userId);
    for (const period of periods) {
      await repository.delete(userId, period.id);
    }
  });

  describe("CRUD Operations", () => {
    it("should create a quiet hour period", async () => {
      const input = { startTime: "22:00", endTime: "07:00" };
      const created = await service.createQuietHour(userId, input);
      expect(created).toHaveProperty("id");
      expect(created.startTime).toBe("22:00");
      expect(created.endTime).toBe("07:00");
    });

    it("should not allow overlapping quiet hour periods", async () => {
      await service.createQuietHour(userId, { startTime: "22:00", endTime: "07:00" });
      await expect(
        service.createQuietHour(userId, { startTime: "06:00", endTime: "08:00" })
      ).rejects.toThrow("Quiet hour periods cannot overlap.");
    });

    it("should not allow invalid time formats", async () => {
      await expect(
        service.createQuietHour(userId, { startTime: "25:00", endTime: "07:00" })
      ).rejects.toThrow("Start and end times must be in HH:mm format.");
    });

    it("should update a quiet hour period", async () => {
      const created = await service.createQuietHour(userId, { startTime: "22:00", endTime: "07:00" });
      const updated = await service.updateQuietHour(userId, created.id, { startTime: "23:00", endTime: "06:00" });
      expect(updated.startTime).toBe("23:00");
      expect(updated.endTime).toBe("06:00");
    });

    it("should not update to overlapping period", async () => {
      const p1 = await service.createQuietHour(userId, { startTime: "22:00", endTime: "07:00" });
      const p2 = await service.createQuietHour(userId, { startTime: "08:00", endTime: "09:00" });
      await expect(
        service.updateQuietHour(userId, p2.id, { startTime: "06:00", endTime: "08:30" })
      ).rejects.toThrow("Quiet hour periods cannot overlap.");
    });

    it("should delete a quiet hour period", async () => {
      const created = await service.createQuietHour(userId, { startTime: "22:00", endTime: "07:00" });
      await service.deleteQuietHour(userId, created.id);
      const periods = await service.getQuietHoursForUser(userId);
      expect(periods.length).toBe(0);
    });

    it("should not delete a non-existent period", async () => {
      await expect(
        service.deleteQuietHour(userId, "non-existent-id")
      ).rejects.toThrow("Quiet hour period not found.");
    });
  });

  describe("Quiet Hour Logic", () => {
    it("should detect time within quiet hours (overnight)", async () => {
      await service.createQuietHour(userId, { startTime: "22:00", endTime: "07:00" });
      // 23:30 UTC
      const date = new Date(Date.UTC(2023, 0, 1, 23, 30));
      const isQuiet = await service.isWithinQuietHours(userId, date);
      expect(isQuiet).toBe(true);
      // 06:30 UTC
      const date2 = new Date(Date.UTC(2023, 0, 2, 6, 30));
      const isQuiet2 = await service.isWithinQuietHours(userId, date2);
      expect(isQuiet2).toBe(true);
      // 08:00 UTC
      const date3 = new Date(Date.UTC(2023, 0, 2, 8, 0));
      const isQuiet3 = await service.isWithinQuietHours(userId, date3);
      expect(isQuiet3).toBe(false);
    });

    it("should detect time within quiet hours (daytime)", async () => {
      await service.createQuietHour(userId, { startTime: "13:00", endTime: "15:00" });
      const date = new Date(Date.UTC(2023, 0, 1, 14, 0));
      const isQuiet = await service.isWithinQuietHours(userId, date);
      expect(isQuiet).toBe(true);
      const date2 = new Date(Date.UTC(2023, 0, 1, 16, 0));
      const isQuiet2 = await service.isWithinQuietHours(userId, date2);
      expect(isQuiet2).toBe(false);
    });

    it("should handle multiple quiet hour periods", async () => {
      await service.createQuietHour(userId, { startTime: "13:00", endTime: "15:00" });
      await service.createQuietHour(userId, { startTime: "18:00", endTime: "19:00" });
      const date = new Date(Date.UTC(2023, 0, 1, 18, 30));
      const isQuiet = await service.isWithinQuietHours(userId, date);
      expect(isQuiet).toBe(true);
    });

    it("should handle daylight saving edge case (simulate)", async () => {
      // Simulate a period that crosses DST change (assume UTC for test)
      await service.createQuietHour(userId, { startTime: "01:00", endTime: "03:00" });
      const date = new Date(Date.UTC(2023, 2, 12, 2, 0)); // DST change in US
      const isQuiet = await service.isWithinQuietHours(userId, date);
      expect(isQuiet).toBe(true);
    });
  });

  describe("Notification Suppression and Queuing", () => {
    it("should suppress and queue notifications during quiet hours", async () => {
      await service.createQuietHour(userId, { startTime: "22:00", endTime: "07:00" });
      const payload: NotificationPayload = {
        userId,
        message: "Test notification",
        timestamp: new Date(Date.UTC(2023, 0, 1, 23, 0)),
      };
      const delivered = await notificationService.sendNotification(payload);
      expect(delivered).toBe(false);
      const queued = notificationService.getQueuedNotifications(userId);
      expect(queued.length).toBe(1);
      expect(queued[0].message).toBe("Test notification");
    });

    it("should deliver notifications outside quiet hours", async () => {
      await service.createQuietHour(userId, { startTime: "22:00", endTime: "07:00" });
      const payload: NotificationPayload = {
        userId,
        message: "Test notification",
        timestamp: new Date(Date.UTC(2023, 0, 1, 10, 0)),
      };
      const delivered = await notificationService.sendNotification(payload);
      expect(delivered).toBe(true);
      const queued = notificationService.getQueuedNotifications(userId);
      expect(queued.length).toBe(0);
    });

    it("should deliver queued notifications after quiet hours", async () => {
      await service.createQuietHour(userId, { startTime: "22:00", endTime: "07:00" });
      const payload: NotificationPayload = {
        userId,
        message: "Queued notification",
        timestamp: new Date(Date.UTC(2023, 0, 1, 23, 0)),
      };
      await notificationService.sendNotification(payload);
      // Simulate time after quiet hours
      jest.spyOn(global.Date, "now").mockImplementation(() => Date.UTC(2023, 0, 2, 8, 0));
      const deliveredCount = await notificationService.deliverQueuedNotifications(userId);
      expect(deliveredCount).toBe(1);
      const queued = notificationService.getQueuedNotifications(userId);
      expect(queued.length).toBe(0);
      jest.spyOn(global.Date, "now").mockRestore();
    });

    it("should not deliver expired queued notifications", async () => {
      await service.createQuietHour(userId, { startTime: "22:00", endTime: "07:00" });
      const payload: NotificationPayload = {
        userId,
        message: "Expired notification",
        timestamp: new Date(Date.UTC(2023, 0, 1, 23, 0)),
        relevanceExpiresAt: new Date(Date.UTC(2023, 0, 2, 7, 30)),
      };
      await notificationService.sendNotification(payload);
      // Simulate time after expiration
      jest.spyOn(global.Date, "now").mockImplementation(() => Date.UTC(2023, 0, 2, 8, 0));
      const deliveredCount = await notificationService.deliverQueuedNotifications(userId);
      expect(deliveredCount).toBe(0);
      const queued = notificationService.getQueuedNotifications(userId);
      expect(queued.length).toBe(0);
      jest.spyOn(global.Date, "now").mockRestore();
    });
  });
});