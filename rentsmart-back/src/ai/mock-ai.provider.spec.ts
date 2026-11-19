import { MockAiProvider } from './mock-ai.provider';

describe('MockAiProvider', () => {
  it('genera una descripción en prosa con ubicación, características y precios', async () => {
    const provider = new MockAiProvider();
    const result = await provider.generateSpaceDescription(
      {
        name: 'Sala Alameda',
        type: 'sala de reuniones',
        commune: 'Santiago',
        capacity: 8,
        amenities: ['Wi-Fi', 'proyector'],
        rules: 'No fumar',
        pricePerHour: 12000,
        pricePerDay: 80000,
        schedule: [{ weekday: 1, startTime: '09:00', endTime: '18:00' }],
        photos: [],
      },
      new AbortController().signal,
    );

    expect(result).toContain('Se arrienda sala de reuniones "Sala Alameda" en Santiago');
    expect(result).toContain('Cuenta con Wi-Fi y proyector.');
    expect(result).toContain('El valor es $12.000 por hora y $80.000 por día.');
    expect(result).toContain('Está disponible los lunes de 09:00 a 18:00.');
    expect(result).not.toContain('Tipo:');
  });
});
