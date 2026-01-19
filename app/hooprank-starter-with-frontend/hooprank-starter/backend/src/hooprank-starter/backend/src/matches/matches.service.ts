import { Injectable } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { UsersService } from '../users/users.service';
import { HoopRankService } from '../ratings/hooprank.service';

export interface Match {
  id: string;
  hostId: string;
  guestId?: string;
  status: 'pending' | 'accepted' | 'completed' | 'cancelled';
  ratingDiff?: Record<string, number>;
}

@Injectable()
export class MatchesService {
  private matches = new Map<string, Match>();
  private rater = new HoopRankService();

  constructor(private readonly users: UsersService) {}

  create(hostId: string, guestId?: string): Match {
    const id = uuid();
    const m: Match = { id, hostId, guestId, status: 'pending' };
    this.matches.set(id, m);
    return m;
  }

  accept(id: string, guestId: string): Match {
    const m = this.matches.get(id);
    if (!m) throw new Error('match not found');
    m.guestId = guestId;
    m.status = 'accepted';
    return m;
  }

  complete(id: string, winner: string): Match {
    const m = this.matches.get(id);
    if (!m || !m.guestId) throw new Error('invalid match');
    const host = this.users.get(m.hostId)!;
    const guest = this.users.get(m.guestId)!;
    const hostWon = winner === m.hostId;
    const newHost = this.rater.updateRating(host.rating, guest.rating, hostWon);
    const newGuest = this.rater.updateRating(guest.rating, host.rating, !hostWon);

    const diffHost = Math.round((newHost - host.rating) * 10) / 10;
    const diffGuest = Math.round((newGuest - guest.rating) * 10) / 10;

    this.users.setRating(host.id, newHost);
    this.users.setRating(guest.id, newGuest);

    m.status = 'completed';
    m.ratingDiff = { [host.id]: diffHost, [guest.id]: diffGuest };
    return m;
  }

  get(id: string): Match | undefined {
    return this.matches.get(id);
  }
}
