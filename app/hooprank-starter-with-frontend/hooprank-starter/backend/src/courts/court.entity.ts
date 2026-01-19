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

    @OneToMany(() => Match, (match) => match.court)
    matches: Match[];
}
