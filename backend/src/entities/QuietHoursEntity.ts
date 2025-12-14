import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

/**
 * QuietHoursEntity represents a user's quiet hour period.
 * Each period is defined by a start and end time (HH:mm, 24-hour format).
 */
@Entity({ name: "quiet_hours" })
@Index(["userId", "startTime", "endTime"])
export class QuietHoursEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  userId!: string;

  @Column({ type: "varchar", length: 5 })
  startTime!: string; // "HH:mm"

  @Column({ type: "varchar", length: 5 })
  endTime!: string; // "HH:mm"

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}