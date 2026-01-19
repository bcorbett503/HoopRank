import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Match } from './match.entity';
import { UsersService } from '../users/users.service';
import { HoopRankService } from '../ratings/hooprank.service';

@Injectable()
export class MatchesService {
  private rater = new HoopRankService();

  constructor(
    @InjectRepository(Match)
    private matchesRepository: Repository<Match>,
    private readonly users: UsersService
  ) { }

  async create(hostId: string, guestId?: string, scheduledAt?: Date, courtId?: string): Promise<Match> {
    const match = this.matchesRepository.create({
      hostId,
      guestId,
      status: 'pending',
      scheduledAt,
      courtId
    });
    return await this.matchesRepository.save(match);
  }

  async accept(id: string, guestId: string): Promise<Match> {
    const m = await this.matchesRepository.findOne({ where: { id } });
    if (!m) throw new Error('match not found');

    m.guestId = guestId;
    m.status = 'accepted';
    return await this.matchesRepository.save(m);
  }

  async complete(id: string, winner: string): Promise<Match> {
    const m = await this.matchesRepository.findOne({ where: { id } });
    if (!m || !m.guestId) throw new Error('invalid match');

    const host = await this.users.get(m.hostId);
    const guest = await this.users.get(m.guestId);

    if (!host || !guest) throw new Error('users not found');

    const hostWon = winner === m.hostId;

    // Update ratings using new HoopRank logic
    const newHostRating = this.rater.updateRating(host.rating, guest.rating, host.matchesPlayed || 0, hostWon ? 1 : 0);
    const newGuestRating = this.rater.updateRating(guest.rating, host.rating, guest.matchesPlayed || 0, hostWon ? 0 : 1);

    const diffHost = Math.round((newHostRating - host.rating) * 100) / 100;
    const diffGuest = Math.round((newGuestRating - guest.rating) * 100) / 100;

    // Update users
    host.rating = newHostRating;
    host.matchesPlayed = (host.matchesPlayed || 0) + 1;

    guest.rating = newGuestRating;
    guest.matchesPlayed = (guest.matchesPlayed || 0) + 1;

    await this.users.updateProfile(host.id, { rating: host.rating, matchesPlayed: host.matchesPlayed });
    await this.users.updateProfile(guest.id, { rating: guest.rating, matchesPlayed: guest.matchesPlayed });

    m.status = 'completed';
    m.winnerId = winner;
    m.ratingDiff = { [host.id]: diffHost, [guest.id]: diffGuest };

    return await this.matchesRepository.save(m);
  }

  async get(id: string): Promise<Match | undefined> {
    return await this.matchesRepository.findOne({ where: { id }, relations: ['host', 'guest', 'court'] }) || undefined;
  }

  async findByCourt(courtId: string): Promise<Match[]> {
    return await this.matchesRepository.find({ where: { courtId } });
  }
}
