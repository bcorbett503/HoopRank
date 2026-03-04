import { ForbiddenException } from '@nestjs/common';
import { MatchesController } from './matches.controller';

describe('MatchesController', () => {
  let controller: MatchesController;
  let matchesService: {
    create: jest.Mock;
  };
  let messagesService: {
    sendMessage: jest.Mock;
  };

  beforeEach(() => {
    matchesService = {
      create: jest.fn(),
    };
    messagesService = {
      sendMessage: jest.fn().mockResolvedValue(undefined),
    };

    controller = new MatchesController(
      matchesService as any,
      messagesService as any,
    );
  });

  describe('create', () => {
    it('creates a match for authenticated user and maps status for mobile', async () => {
      matchesService.create.mockResolvedValue({
        id: 'match-1',
        status: 'pending',
        creatorId: 'creator-1',
        opponentId: 'opponent-1',
      });

      const result = await controller.create('creator-1', {
        guestId: 'opponent-1',
      } as any);

      expect(matchesService.create).toHaveBeenCalledWith(
        'creator-1',
        'opponent-1',
        undefined,
        false,
      );
      expect(result).toMatchObject({
        id: 'match-1',
        status: 'waiting',
        creator_id: 'creator-1',
        opponent_id: 'opponent-1',
      });
    });

    it('passes autoAccept through for quick play match creation', async () => {
      matchesService.create.mockResolvedValue({
        id: 'match-qp-1',
        status: 'accepted',
        creatorId: 'creator-1',
        opponentId: 'opponent-1',
      });

      const result = await controller.create('creator-1', {
        guestId: 'opponent-1',
        autoAccept: true,
      } as any);

      expect(matchesService.create).toHaveBeenCalledWith(
        'creator-1',
        'opponent-1',
        undefined,
        true,
      );
      expect(result).toMatchObject({
        id: 'match-qp-1',
        status: 'live',
      });
    });

    it('rejects create when hostId does not match authenticated user', async () => {
      await expect(
        controller.create('creator-1', {
          hostId: 'different-user',
          guestId: 'opponent-1',
        } as any),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(matchesService.create).not.toHaveBeenCalled();
    });

    it('sends optional challenge message when provided', async () => {
      matchesService.create.mockResolvedValue({
        id: 'match-2',
        status: 'pending',
        creatorId: 'creator-1',
        opponentId: 'opponent-1',
      });

      await controller.create('creator-1', {
        guestId: 'opponent-1',
        message: 'Quick Play @ gym',
      } as any);

      expect(messagesService.sendMessage).toHaveBeenCalledWith(
        'creator-1',
        'opponent-1',
        'Quick Play @ gym',
        'match-2',
      );
    });
  });
});
