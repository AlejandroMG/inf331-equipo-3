import { BadRequestException } from '@nestjs/common';
import { SpaceStatus } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { SpaceDescriptionAiService } from './space-description-ai.service';
import { GenerateSpaceDescriptionService } from './generate-space-description.service';

describe('GenerateSpaceDescriptionService', () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const space = {
    ownerId: 'owner-1',
    status: SpaceStatus.DRAFT,
    name: 'Sala Alameda',
    address: 'Av. Grecia 1000',
    capacity: 8,
    pricePerHour: 12000,
    pricePerDay: 80000,
    rules: 'No fumar',
    type: { name: 'Sala de reuniones' },
    commune: { name: 'Santiago' },
    region: { name: 'Región Metropolitana' },
    amenities: [{ amenity: { name: 'Wifi' } }],
    rulesWeek: [{ weekday: 1, startTime: '09:00', endTime: '18:00' }],
    photos: [{ storagePath: 'spaces/sala/cover.png' }],
  };
  const prisma = {
    space: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    aiSpaceGeneration: { updateMany: jest.fn() },
  };
  const storage = { read: jest.fn() };
  const ai = { generate: jest.fn() };
  let service: GenerateSpaceDescriptionService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.space.findUnique.mockResolvedValue(space);
    prisma.space.update.mockResolvedValue({});
    prisma.aiSpaceGeneration.updateMany.mockResolvedValue({ count: 1 });
    storage.read.mockResolvedValue(png);
    ai.generate.mockResolvedValue({
      description: 'Una sala luminosa y equipada.',
      source: 'mock',
      attemptsUsed: 1,
    });
    service = new GenerateSpaceDescriptionService(
      prisma as unknown as PrismaService,
      storage as unknown as StorageService,
      ai as unknown as SpaceDescriptionAiService,
    );
  });

  it('usa las fotos internas y conserva la sugerencia en el borrador editable', async () => {
    await expect(service.generate('owner-1', 'space-1')).resolves.toEqual({
      description: 'Una sala luminosa y equipada.',
      source: 'mock',
      attemptsUsed: 1,
    });

    expect(storage.read).toHaveBeenCalledWith('spaces/sala/cover.png');
    expect(ai.generate).toHaveBeenCalledWith(
      'owner-1',
      'space-1',
      expect.objectContaining({
        name: 'Sala Alameda',
        type: 'Sala de reuniones',
        commune: 'Santiago',
        region: 'Región Metropolitana',
        address: 'Av. Grecia 1000',
        photos: [{ data: png, mimeType: 'image/png' }],
        capacity: 8,
        amenities: ['Wifi'],
        rules: 'No fumar',
        pricePerHour: 12000,
        pricePerDay: 80000,
        schedule: [{ weekday: 1, startTime: '09:00', endTime: '18:00' }],
      }),
    );
    expect(prisma.space.update).toHaveBeenCalledWith({
      where: { id: 'space-1' },
      data: { description: 'Una sala luminosa y equipada.' },
    });
  });

  it('no genera cuando no hay fotos', async () => {
    prisma.space.findUnique.mockResolvedValue({ ...space, photos: [] });

    await expect(service.generate('owner-1', 'space-1')).rejects.toThrow(
      BadRequestException,
    );
    expect(ai.generate).not.toHaveBeenCalled();
  });

  it('marca como revisada solo una sugerencia existente del propietario', async () => {
    await expect(
      service.markReviewed('owner-1', 'space-1'),
    ).resolves.toBeUndefined();

    expect(prisma.aiSpaceGeneration.updateMany).toHaveBeenCalledWith({
      where: {
        spaceId: 'space-1',
        userId: 'owner-1',
        description: { not: null },
      },
      data: { reviewedAt: expect.any(Date) },
    });
  });
});
