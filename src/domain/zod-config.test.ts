import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import './zod-config';
import { spotifyIdSchema } from './spotify-types';

describe('zod-config', () => {
  it('desliga o JIT do Zod (sem new Function sob a CSP sem unsafe-eval)', () => {
    expect(z.config().jitless).toBe(true);
    expect(spotifyIdSchema.safeParse('0TnOYISbd1XYRBk9myaseg').success).toBe(true);
  });
});
