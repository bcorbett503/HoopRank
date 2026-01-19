import { Injectable } from '@nestjs/common';

export interface User {
  id: string;
  displayName: string;
  rating: number; // 1.0–5.0
  badges?: { kotc: { courtId: string; courtName: string; currentlyReigning: boolean }[] };
}

@Injectable()
export class UsersService {
  private users = new Map<string, User>();

  constructor() {
    this.create('u1', 'Jordan', 2.5);
    this.create('u2', 'Kobe', 2.5);
  }

  create(id: string, name: string, rating: number) {
    this.users.set(id, {
      id,
      displayName: name,
      rating,
      badges: { kotc: [] },
    });
  }

  get(id: string): User | undefined {
    return this.users.get(id);
  }

  setRating(id: string, rating: number) {
    const u = this.users.get(id);
    if (u) u.rating = rating;
  }
}
