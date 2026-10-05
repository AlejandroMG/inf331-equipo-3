import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  let prisma: PrismaService;

  beforeAll(async () => {
    // Se usa la BD de tests (puerto 5433), nunca la de desarrollo.
    const config = new ConfigService({
      DATABASE_URL: process.env.DATABASE_TEST_URL,
    });
    prisma = new PrismaService(config);
    await prisma.onModuleInit();
  });

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  it('se conecta a PostgreSQL', async () => {
    const result = await prisma.$queryRaw<{ ok: number }[]>`SELECT 1 AS ok`;
    expect(result[0].ok).toBe(1);
  });
});
