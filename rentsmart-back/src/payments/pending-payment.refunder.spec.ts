import { Logger } from '@nestjs/common';
import { PendingPaymentRefunder } from './pending-payment.refunder';

describe('PendingPaymentRefunder', () => {
  afterEach(() => jest.restoreAllMocks());

  it('avisa del reembolso manual y lanza un error, porque no reembolsó nada', async () => {
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();

    await expect(new PendingPaymentRefunder().refundBooking('book-1', 26400, 'motivo')).rejects.toThrow('PA-03');

    expect(error).toHaveBeenCalledWith(expect.stringContaining('book-1'));
    expect(error).toHaveBeenCalledWith(expect.stringContaining('Reembolso manual'));
  });
});
