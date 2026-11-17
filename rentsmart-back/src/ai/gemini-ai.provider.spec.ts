import { GeminiAiProvider } from './gemini-ai.provider';

describe('GeminiAiProvider', () => {
  const fetchImpl = jest.fn();
  const provider = () =>
    new GeminiAiProvider('fake-api-key', 'gemini-test', fetchImpl);
  const input = {
    name: 'Sala Alameda',
    type: 'sala de reuniones',
    region: 'Región Metropolitana',
    commune: 'Santiago',
    address: 'Av. Grecia 1000',
    capacity: 8,
    amenities: ['Wi-Fi'],
    rules: 'No fumar',
    pricePerHour: 12000,
    pricePerDay: 80000,
    schedule: [{ weekday: 1, startTime: '09:00', endTime: '18:00' }],
    photos: [{ mimeType: 'image/jpeg', data: Buffer.from('photo') }],
  };

  beforeEach(() => {
    fetchImpl.mockReset();
    fetchImpl.mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'Una sala luminosa.' }] } }],
      }),
    });
  });

  it('envía los datos y las fotos a Gemini y devuelve el texto generado', async () => {
    const controller = new AbortController();

    await expect(
      provider().generateSpaceDescription(input, controller.signal),
    ).resolves.toBe('Una sala luminosa.');

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': 'fake-api-key',
        },
        signal: controller.signal,
      }),
    );
    const [, options] = fetchImpl.mock.calls[0] as [string, { body: string }];
    const parts = (
      JSON.parse(options.body) as {
        contents: { parts: Array<Record<string, unknown>> }[];
      }
    ).contents[0].parts;
    expect(parts[0].text).toContain('"name":"Sala Alameda"');
    expect(parts[0].text).toContain('Redacta 3 a 5 oraciones enlazadas como prosa natural');
    expect(parts[0].text).toContain('No enumeres datos ni uses viñetas');
    expect(parts[0].text).toContain('Se arrienda [tipo] en [comuna]');
    expect(parts[0].text).toContain('"publicAddress":"Av. Grecia 1000"');
    expect(parts[0].text).toContain('"ownerRules":"No fumar"');
    expect(parts[0].text).toContain('"pricePerHour":12000');
    expect(parts[0].text).toContain('"pricePerDay":80000');
    expect(parts[0].text).toContain('"day":"lunes"');
    expect(parts[1]).toEqual({
      inline_data: {
        mime_type: 'image/jpeg',
        data: Buffer.from('photo').toString('base64'),
      },
    });
  });

  it('rechaza tipos de imagen no admitidos antes de enviar la petición', async () => {
    await expect(
      provider().generateSpaceDescription(
        {
          ...input,
          photos: [{ mimeType: 'text/html', data: Buffer.from('x') }],
        },
        new AbortController().signal,
      ),
    ).rejects.toThrow('Gemini solo admite fotos JPEG, PNG o WebP');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('expone errores del proveedor para que el servicio superior use el respaldo', async () => {
    fetchImpl.mockResolvedValue({ ok: false, status: 503 });

    await expect(
      provider().generateSpaceDescription(input, new AbortController().signal),
    ).rejects.toThrow('Gemini respondió con estado 503');
  });

  it('rechaza respuestas sin texto', async () => {
    fetchImpl.mockResolvedValue({ ok: true, json: async () => ({}) });

    await expect(
      provider().generateSpaceDescription(input, new AbortController().signal),
    ).rejects.toThrow('Gemini no devolvió una descripción');
  });
});
