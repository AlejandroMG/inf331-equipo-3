import type { CatalogItem } from '../features/catalog/types'

/** Espacios de ejemplo (inventados) para el catálogo simulado: 14, así hay dos páginas con 12 por página. */
export const catalogData: CatalogItem[] = [
  { id: 'seed-space-1', name: 'Sala Alameda', typeName: 'Sala de reuniones', communeName: 'Santiago', capacity: 10, pricePerHour: 12000, pricePerDay: null, coverUrl: null },
  { id: 'seed-space-2', name: 'Estudio Luz Norte', typeName: 'Estudio fotográfico o audiovisual', communeName: 'Providencia', capacity: 8, pricePerHour: 18000, pricePerDay: 120000, coverUrl: null },
  { id: 'seed-space-3', name: 'Cowork Plaza Ñuñoa', typeName: 'Oficina o cowork', communeName: 'Ñuñoa', capacity: 6, pricePerHour: 7000, pricePerDay: 45000, coverUrl: null },
  { id: 'seed-space-4', name: 'Sala de ensayo Los Olivos', typeName: 'Sala de ensayo', communeName: 'San Miguel', capacity: 5, pricePerHour: 8000, pricePerDay: null, coverUrl: null },
  { id: 'seed-space-5', name: 'Cocina taller Providencia', typeName: 'Cocina equipada', communeName: 'Providencia', capacity: 12, pricePerHour: 15000, pricePerDay: 110000, coverUrl: null },
  { id: 'seed-space-6', name: 'Cancha techada Las Condes', typeName: 'Cancha', communeName: 'Las Condes', capacity: 14, pricePerHour: 25000, pricePerDay: null, coverUrl: null },
  { id: 'seed-space-7', name: 'Salón Jardín', typeName: 'Salón de eventos', communeName: 'Las Condes', capacity: 60, pricePerHour: 40000, pricePerDay: 280000, coverUrl: null },
  { id: 'seed-space-8', name: 'Taller metálico San Miguel', typeName: 'Taller', communeName: 'San Miguel', capacity: 6, pricePerHour: 9000, pricePerDay: 60000, coverUrl: null },
  { id: 'seed-space-9', name: 'Sala Directorio Centro', typeName: 'Sala de reuniones', communeName: 'Santiago', capacity: 16, pricePerHour: 20000, pricePerDay: null, coverUrl: null },
  { id: 'seed-space-10', name: 'Estudio de grabación Ñuñoa', typeName: 'Estudio fotográfico o audiovisual', communeName: 'Ñuñoa', capacity: 4, pricePerHour: 14000, pricePerDay: null, coverUrl: null },
  { id: 'mock-11', name: 'Bodega de eventos Santiago', typeName: 'Salón de eventos', communeName: 'Santiago', capacity: 80, pricePerHour: null, pricePerDay: 350000, coverUrl: null },
  { id: 'mock-12', name: 'Oficina compartida Providencia', typeName: 'Oficina o cowork', communeName: 'Providencia', capacity: 3, pricePerHour: 6000, pricePerDay: 38000, coverUrl: null },
  { id: 'mock-13', name: 'Sala de ensayo Centro', typeName: 'Sala de ensayo', communeName: 'Santiago', capacity: 6, pricePerHour: 9000, pricePerDay: null, coverUrl: null },
  { id: 'mock-14', name: 'Taller de cerámica', typeName: 'Taller', communeName: 'Ñuñoa', capacity: 8, pricePerHour: 11000, pricePerDay: null, coverUrl: null },
]
