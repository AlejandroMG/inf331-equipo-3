import { NotImplementedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentsService } from './payments.service';

// Mis pagos (PA-01) con la base como doble; contra la base de verdad está en test/payments.e2e-spec.ts.
describe('PaymentsService', () => {
  let service: PaymentsService;
  const prisma = { payment: { findMany: jest.fn(), count: jest.fn() } };

  const stored = (id: string, extra: Record<string, unknown> = {}) => ({
    id,
    bookingId: `b-${id}`,
    stripeSessionId: `cs_${id}`,
    stripePaymentIntentId: null,
    amount: 26400,
    fee: 2400,
    refundedAmount: 0,
    status: 'PENDING',
    createdAt: new Date('2030-10-13T15:07:00.000Z'),
    updatedAt: new Date('2030-10-13T15:07:00.000Z'),
    booking: { space: { name: 'Sala Alameda' } },
    ...extra,
  });

  beforeEach(async () => {
    jest.resetAllMocks();
    const module = await Test.createTestingModule({
      providers: [PaymentsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(PaymentsService);
  });

  describe('findMine', () => {
    it('trae una página de los pagos de mis reservas, los más recientes primero, con el nombre del espacio', async () => {
      prisma.payment.findMany.mockResolvedValue([stored('p2', { status: 'SUCCEEDED' }), stored('p1')]);
      prisma.payment.count.mockResolvedValue(12);

      const page = await service.findMine('renter', { page: 2, pageSize: 10 });

      const where = { booking: { renterId: 'renter' } };
      expect(prisma.payment.findMany).toHaveBeenCalledWith({
        where,
        include: { booking: { select: { space: { select: { name: true } } } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: 10,
        take: 10,
      });
      expect(prisma.payment.count).toHaveBeenCalledWith({ where });
      expect(page).toEqual({
        items: [
          {
            id: 'p2',
            bookingId: 'b-p2',
            spaceName: 'Sala Alameda',
            amount: 26400,
            fee: 2400,
            refundedAmount: 0,
            status: 'SUCCEEDED',
            createdAt: new Date('2030-10-13T15:07:00.000Z'),
          },
          expect.objectContaining({ id: 'p1', status: 'PENDING' }),
        ],
        total: 12,
        page: 2,
        pageSize: 10,
      });
      // No expone los ids de Stripe: no están en el contrato de PaymentDto.
      expect(Object.keys(page.items[0]).sort()).toEqual([
        'amount', 'bookingId', 'createdAt', 'fee', 'id', 'refundedAmount', 'spaceName', 'status',
      ]);
    });

    it('sin pagos responde una página vacía', async () => {
      prisma.payment.findMany.mockResolvedValue([]);
      prisma.payment.count.mockResolvedValue(0);

      await expect(service.findMine('renter', { page: 1, pageSize: 20 })).resolves.toEqual({
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
      });
    });
  });

  it('el webhook sigue respondiendo 501 hasta PA-02', () => {
    expect(() => service.handleWebhook(Buffer.from('{}'), 'firma')).toThrow(NotImplementedException);
  });
});
