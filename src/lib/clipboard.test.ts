// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyText } from './clipboard';

const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');

function setClipboard(value: unknown) {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value,
  });
}

afterEach(() => {
  if (originalClipboard) {
    Object.defineProperty(navigator, 'clipboard', originalClipboard);
  } else {
    Reflect.deleteProperty(navigator, 'clipboard');
  }
});

describe('copyText', () => {
  it('returns true when the clipboard write succeeds', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });

    await expect(copyText('https://example.test')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('https://example.test');
  });

  it('returns false when the clipboard API is unavailable', async () => {
    setClipboard(undefined);

    await expect(copyText('https://example.test')).resolves.toBe(false);
  });

  it('returns false when the clipboard write rejects', async () => {
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error('denied')) });

    await expect(copyText('https://example.test')).resolves.toBe(false);
  });
});
