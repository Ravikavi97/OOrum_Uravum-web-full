import { afterEach, describe, expect, it } from 'vitest';
import { decryptImage, encryptImage, safeDecryptImage } from './imageEncryption';

const originalKey = process.env.IMAGE_ENCRYPTION_KEY;

afterEach(() => {
  if (originalKey === undefined) {
    delete process.env.IMAGE_ENCRYPTION_KEY;
  } else {
    process.env.IMAGE_ENCRYPTION_KEY = originalKey;
  }
});

describe('image encryption', () => {
  it('decrypts images encrypted with the configured key', () => {
    process.env.IMAGE_ENCRYPTION_KEY = 'test-image-encryption-key-012345';
    const image = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);

    expect(safeDecryptImage(encryptImage(image))).toEqual(image);
  });

  it('returns legacy unencrypted image data unchanged', () => {
    const image = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

    expect(safeDecryptImage(image)).toEqual(image);
  });

  it('does not return encrypted bytes when decryption fails', () => {
    process.env.IMAGE_ENCRYPTION_KEY = 'first-image-encryption-key-012345';
    const encryptedImage = encryptImage(Buffer.from('image bytes'));
    process.env.IMAGE_ENCRYPTION_KEY = 'other-image-encryption-key-012345';

    expect(() => safeDecryptImage(encryptedImage)).toThrow();
  });

  it('decrypts an encrypted image with the low-level helper', () => {
    process.env.IMAGE_ENCRYPTION_KEY = 'test-image-encryption-key-012345';
    const image = Buffer.from('image bytes');

    expect(decryptImage(encryptImage(image))).toEqual(image);
  });
});
