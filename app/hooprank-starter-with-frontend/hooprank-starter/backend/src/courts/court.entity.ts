import { Entity, Column, PrimaryColumn, OneToMany } from 'typeorm';
import { Match } from '../matches/match.entity';

/**
 * Court entity mapped to production PostgreSQL schema.
 * Production uses PostGIS geography type for location (geog column).
 */
@Entity('courts')
export class Court {
    @PrimaryColumn({ type: 'uuid' })
    id: string;

    @Column({ type: 'text' })
    name: string;

    @Column({ type: 'text', nullable: true })
    city: string;

    @Column({ type: 'boolean', nullable: true })
    indoor: boolean;

    @Column({ type: 'int', nullable: true })
    rims: number;

    @Column({ type: 'text', nullable: true })
    source: string;

    @Column({ type: 'boolean', default: false })
    signature: boolean;

    @Column({ type: 'text', nullable: true, default: 'public' })
    access: string; // 'public' | 'members' | 'paid'

    // Note: geog is PostGIS geography type - handled via raw queries in service
    // We don't map it directly as TypeORM doesn't natively support PostGIS

    @OneToMany(() => Match, (match) => match.court)
    matches: Match[];
}
