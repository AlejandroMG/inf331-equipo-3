import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const SPACE_TYPES = [
  'Sala de reuniones',
  'Oficina o cowork',
  'Estudio fotográfico o audiovisual',
  'Sala de ensayo',
  'Cocina equipada',
  'Cancha',
  'Salón de eventos',
  'Taller',
];

const AMENITIES = [
  'Wifi',
  'Proyector',
  'Estacionamiento',
  'Aire acondicionado',
  'Cocina',
];

const COMMUNES_RM = [
  'Santiago',
  'Providencia',
  'Ñuñoa',
  'Las Condes',
  'San Miguel',
];

async function main() {
  // --- Usuarios: uno por rol. Todos con la misma contraseña de prueba.
  const passwordHash = await bcrypt.hash('Password123', 10);

  await prisma.user.upsert({
    where: { email: 'admin@rentsmart.test' },
    update: {},
    create: {
      email: 'admin@rentsmart.test',
      name: 'Admin',
      passwordHash,
      role: 'ADMIN',
    },
  });
  const host = await prisma.user.upsert({
    where: { email: 'propietario@rentsmart.test' },
    update: {},
    create: {
      email: 'propietario@rentsmart.test',
      name: 'Paula Propietaria',
      passwordHash,
      isHost: true,
    },
  });
  await prisma.user.upsert({
    where: { email: 'arrendatario@rentsmart.test' },
    update: {},
    create: {
      email: 'arrendatario@rentsmart.test',
      name: 'Andrés Arrendatario',
      passwordHash,
    },
  });

  // --- Catálogos
  const types = [];
  for (const name of SPACE_TYPES) {
    types.push(
      await prisma.spaceType.upsert({
        where: { name },
        update: {},
        create: { name },
      }),
    );
  }
  for (const name of AMENITIES) {
    await prisma.amenity.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  const rm = await prisma.region.upsert({
    where: { name: 'Región Metropolitana' },
    update: {},
    create: { name: 'Región Metropolitana' },
  });
  const communes = [];
  for (const name of COMMUNES_RM) {
    communes.push(
      await prisma.commune.upsert({
        where: { regionId_name: { regionId: rm.id, name } },
        update: {},
        create: { name, regionId: rm.id },
      }),
    );
  }

  // --- 10 espacios activos, con horario lunes a viernes 09:00–21:00.
  for (let i = 1; i <= 10; i++) {
    const type = types[(i - 1) % types.length];
    const commune = communes[(i - 1) % communes.length];

    await prisma.space.upsert({
      // Id fijo para que el seed se pueda correr varias veces sin duplicar.
      where: { id: `seed-space-${i}` },
      update: {},
      create: {
        id: `seed-space-${i}`,
        ownerId: host.id,
        typeId: type.id,
        name: `${type.name} ${commune.name} ${i}`,
        description: `Espacio de prueba número ${i}.`,
        capacity: 4 + i,
        pricePerHour: 5000 + i * 1000,
        pricePerDay: i % 2 === 0 ? 40000 + i * 2000 : null,
        regionId: rm.id,
        communeId: commune.id,
        address: `Calle Falsa ${100 + i}`,
        addressDetail: `Oficina ${i}0`,
        rules: 'No fumar. Dejar el espacio limpio.',
        status: 'ACTIVE',
        rulesWeek: {
          create: [1, 2, 3, 4, 5].map((weekday) => ({
            weekday,
            startTime: '09:00',
            endTime: '21:00',
          })),
        },
      },
    });
  }

  console.log('Seed listo.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
