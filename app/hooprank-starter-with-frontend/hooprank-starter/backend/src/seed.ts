import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { UsersService } from './users/users.service';
import { User } from './users/user.entity';

async function bootstrap() {
    const app = await NestFactory.createApplicationContext(AppModule);
    const usersService = app.get(UsersService);

    const mockPlayers = [
        {
            firebaseUid: 'mock-player-1',
            email: 'lebron@example.com',
            name: 'LeBron James',
            photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/c/cf/LeBron_James_crop_2020.jpg',
            rating: 5.0,
            position: 'F',
            height: "6'9\"",
            weight: '250 lbs',
            age: 39,
            matchesPlayed: 1400,
        },
        {
            firebaseUid: 'mock-player-2',
            email: 'curry@example.com',
            name: 'Stephen Curry',
            photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/b/b8/Stephen_Curry_2016_June_16.jpg',
            rating: 4.9,
            position: 'G',
            height: "6'2\"",
            weight: '185 lbs',
            age: 36,
            matchesPlayed: 900,
        },
        {
            firebaseUid: 'mock-player-3',
            email: 'durant@example.com',
            name: 'Kevin Durant',
            photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/b/b9/Kevin_Durant_2018_June_08.jpg',
            rating: 4.9,
            position: 'F',
            height: "6'10\"",
            weight: '240 lbs',
            age: 35,
            matchesPlayed: 1000,
        },
        {
            firebaseUid: 'mock-player-4',
            email: 'jokic@example.com',
            name: 'Nikola Jokic',
            photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/1/1c/Nikola_Joki%C4%87_2019.jpg',
            rating: 5.0,
            position: 'C',
            height: "6'11\"",
            weight: '284 lbs',
            age: 29,
            matchesPlayed: 600,
        },
        {
            firebaseUid: 'mock-player-5',
            email: 'luka@example.com',
            name: 'Luka Doncic',
            photoUrl: 'https://upload.wikimedia.org/wikipedia/commons/b/b8/Luka_Doncic_2021.jpg',
            rating: 4.8,
            position: 'G',
            height: "6'7\"",
            weight: '230 lbs',
            age: 25,
            matchesPlayed: 400,
        },
    ];

    for (const player of mockPlayers) {
        const existing = await usersService.findOrCreate(player.firebaseUid, player.email);
        await usersService.updateProfile(existing.id, {
            name: player.name,
            photoUrl: player.photoUrl,
            rating: player.rating,
            position: player.position,
            height: player.height,
            weight: player.weight,
            age: player.age,
            matchesPlayed: player.matchesPlayed,
        });
        console.log(`Seeded ${player.name}`);
    }

    await app.close();
}

bootstrap();
