import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { LocalStorageService } from '../src/storage/local-storage.service';
import { StorageService } from '../src/storage/storage.service';
import { SupabaseStorageService } from '../src/storage/supabase-storage.service';
import { seedPhotoSvg } from './seed-photos';

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

// Descripción por tipo (mismo orden que SPACE_TYPES), para que el texto cuadre con la foto.
const SPACE_DESCRIPTIONS = [
  'Sala con mesa larga, pantalla para presentaciones y sillas cómodas. Ideal para reuniones de equipo y talleres cortos.',
  'Oficina luminosa con escritorios, monitores y buena iluminación, para trabajar en silencio por horas o por el día.',
  'Estudio con fondo infinito blanco, luces de estudio con difusor y trípode para sesiones de foto o video.',
  'Sala insonorizada con paneles acústicos, batería, amplificador y micrófono para ensayar con tu banda.',
  'Cocina profesional con cocina a gas, campana, isla de trabajo y utensilios, para clases, catering o grabaciones.',
  'Cancha de pasto sintético con líneas marcadas y arcos, para partidos y entrenamientos.',
  'Salón con escenario, mesas redondas y luces ambientales, para celebraciones y eventos de empresa.',
  'Taller con banco de trabajo, tornillo de banco y panel de herramientas manuales para proyectos y reparaciones.',
];

/** Fuente de las fotos del seed: la misma que usa la API según STORAGE_DRIVER. */
function seedStorage(): StorageService {
  if (process.env.STORAGE_DRIVER !== 'supabase') return new LocalStorageService();
  return new SupabaseStorageService({
    url: process.env.SUPABASE_URL!.replace(/\/$/, ''),
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    bucket: process.env.SUPABASE_BUCKET!,
  });
}

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

  // --- 10 espacios activos, con una foto acorde a su tipo y horario lunes a viernes 09:00–21:00.
  const storage = seedStorage();
  for (let i = 1; i <= 10; i++) {
    const typeIndex = (i - 1) % types.length;
    const type = types[typeIndex];
    const commune = communes[(i - 1) % communes.length];

    await prisma.space.upsert({
      // Id fijo para que el seed se pueda correr varias veces sin duplicar.
      where: { id: `seed-space-${i}` },
      // La descripción se actualiza para que quien ya corrió el seed quede con textos que cuadran con la foto.
      update: { description: SPACE_DESCRIPTIONS[typeIndex] },
      create: {
        id: `seed-space-${i}`,
        ownerId: host.id,
        typeId: type.id,
        name: `${type.name} ${commune.name} ${i}`,
        description: SPACE_DESCRIPTIONS[typeIndex],
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

    // Foto de portada; si el espacio ya la tiene (seed repetido), no se vuelve a subir.
    const id = `seed-space-${i}`;
    if ((await prisma.spacePhoto.count({ where: { spaceId: id } })) === 0) {
      const variant = Math.floor((i - 1) / types.length);
      const { path, url } = await storage.upload(
        `seed/${id}.svg`,
        Buffer.from(seedPhotoSvg(type.name, variant)),
        'image/svg+xml',
      );
      await prisma.spacePhoto.create({
        data: { spaceId: id, storagePath: path, url, position: 0 },
      });
    }
  }

  console.log('Seed listo.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
