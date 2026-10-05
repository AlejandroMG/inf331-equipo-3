import { detectImageType } from './image-type';

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
const webp = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.from([0x24, 0, 0, 0]),
  Buffer.from('WEBPVP8 '),
]);

describe('detectImageType', () => {
  it('reconoce JPG, PNG y WebP por sus primeros bytes', () => {
    expect(detectImageType(jpeg)).toEqual({
      contentType: 'image/jpeg',
      extension: 'jpg',
    });
    expect(detectImageType(png)).toEqual({
      contentType: 'image/png',
      extension: 'png',
    });
    expect(detectImageType(webp)).toEqual({
      contentType: 'image/webp',
      extension: 'webp',
    });
  });

  it.each([
    ['texto', Buffer.from('hola mundo, esto no es una imagen')],
    ['un HTML', Buffer.from('<html><script>alert(1)</script></html>')],
    ['GIF', Buffer.from('GIF89a......')],
    ['un RIFF que no es WebP (WAV)', Buffer.from('RIFF\x24\x00\x00\x00WAVEfmt ', 'binary')],
    ['un PNG cortado', Buffer.from([0x89, 0x50, 0x4e, 0x47])],
    ['vacío', Buffer.alloc(0)],
  ])('rechaza %s', (_caso, data) => {
    expect(detectImageType(data)).toBeNull();
  });
});
