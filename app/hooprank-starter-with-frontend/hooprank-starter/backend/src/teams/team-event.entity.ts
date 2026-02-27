import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { Team } from "./team.entity";

/**
 * Team event entity for practices and games
 */
@Entity("team_events")
export class TeamEvent {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "team_id", type: "uuid" })
  teamId: string;

  @Column({ type: "text" })
  type: string; // 'practice' or 'game'

  @Column({ type: "text" })
  title: string;

  @Column({ name: "event_date", type: "datetime" })
  eventDate: Date;

  @Column({ name: "end_date", type: "datetime", nullable: true })
  endDate: Date | null;

  @Column({ name: "location_name", type: "text", nullable: true })
  locationName: string | null;

  @Column({ name: "court_id", type: "varchar", length: 255, nullable: true })
  courtId: string | null;

  @Column({ name: "opponent_team_id", type: "uuid", nullable: true })
  opponentTeamId: string | null;

  @Column({ name: "opponent_team_name", type: "text", nullable: true })
  opponentTeamName: string | null;

  @Column({ name: "recurrence_rule", type: "text", nullable: true })
  recurrenceRule: string | null; // 'weekly', 'biweekly', 'daily', or null

  @Column({ type: "text", nullable: true })
  notes: string | null;

  @Column({ name: "match_id", type: "uuid", nullable: true })
  matchId: string | null;

  @Column({ name: "created_by", type: "text" })
  createdBy: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;

  @ManyToOne(() => Team)
  @JoinColumn({ name: "team_id" })
  team: Team;
}

/**
 * Attendance record for a team event (IN / OUT)
 */
@Entity("team_event_attendance")
export class TeamEventAttendance {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "event_id", type: "uuid" })
  eventId: string;

  @Column({ name: "user_id", type: "text" })
  userId: string;

  @Column({ type: "text", default: "in" })
  status: string; // 'in' or 'out'

  @CreateDateColumn({ name: "responded_at" })
  respondedAt: Date;

  @ManyToOne(() => TeamEvent)
  @JoinColumn({ name: "event_id" })
  event: TeamEvent;
}
