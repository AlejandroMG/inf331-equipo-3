import { missingFields, PublishCheck } from './publish-rules';

const complete: PublishCheck = {
  typeId: 1,
  description: 'Sala luminosa',
  capacity: 10,
  communeId: 3,
  pricePerHour: 12000,
  pricePerDay: null,
  photoCount: 2,
  scheduleCount: 5,
};

describe('missingFields', () => {
  it('un espacio completo no tiene nada pendiente', () => {
    expect(missingFields(complete)).toEqual([]);
  });

  it('un borrador vacío lo tiene todo pendiente, en el orden del formulario', () => {
    expect(
      missingFields({
        typeId: null,
        description: null,
        capacity: null,
        communeId: null,
        pricePerHour: null,
        pricePerDay: null,
        photoCount: 0,
        scheduleCount: 0,
      }),
    ).toEqual([
      'type',
      'description',
      'capacity',
      'commune',
      'price',
      'photos',
      'schedule',
    ]);
  });

  it.each([
    ['type', { typeId: null }],
    ['description', { description: null }],
    ['description', { description: '   ' }],
    ['capacity', { capacity: null }],
    ['capacity', { capacity: 0 }],
    ['commune', { communeId: null }],
    ['photos', { photoCount: 0 }],
    ['schedule', { scheduleCount: 0 }],
  ] as const)('marca %s cuando falta (%j)', (field, patch) => {
    expect(missingFields({ ...complete, ...patch })).toEqual([field]);
  });

  describe('precio', () => {
    it('basta un precio por hora o uno por día', () => {
      expect(missingFields({ ...complete, pricePerHour: 5000, pricePerDay: null })).toEqual([]);
      expect(missingFields({ ...complete, pricePerHour: null, pricePerDay: 40000 })).toEqual([]);
      expect(missingFields({ ...complete, pricePerHour: 5000, pricePerDay: 40000 })).toEqual([]);
    });

    it('sin ninguno falta el precio, y un 0 no cuenta', () => {
      expect(missingFields({ ...complete, pricePerHour: null, pricePerDay: null })).toEqual(['price']);
      expect(missingFields({ ...complete, pricePerHour: 0, pricePerDay: 0 })).toEqual(['price']);
    });
  });

  it('con una sola foto y un solo tramo de horario ya está completo', () => {
    expect(missingFields({ ...complete, photoCount: 1, scheduleCount: 1 })).toEqual([]);
  });

  it('informa varias cosas a la vez', () => {
    expect(
      missingFields({ ...complete, photoCount: 0, pricePerHour: null, description: '' }),
    ).toEqual(['description', 'price', 'photos']);
  });
});
