import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { Match } from '../matches/match.entity';

@Entity('courts')
export class Court {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    name: string;

    @Column('float')
    lat: number;

    @Column('float')
    lng: number;

    @Column({ nullable: true })
    address: string;

    // Extended metadata fields
    @Column({ nullable: true })
    city: string;

    @Column({ name: 'num_courts', type: 'int', default: 1 })
    numCourts: number;

    @Column({ type: 'boolean', default: false })
    lit: boolean;

    @Column({ type: 'boolean', default: false })
    indoor: boolean;

    @Column({ type: 'float', nullable: true })
    score: number;

    @Column({ nullable: true })
    source: string;

    @Column({ name: 'created_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    createdAt: Date;

    @OneToMany(() => Match, (match) => match.court)
    matches: Match[];
}
