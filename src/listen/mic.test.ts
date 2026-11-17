import { describe, expect, it } from 'vitest';
import { micAllowedHere } from './mic';

const page = (opts: { policy?: boolean; framed?: 'same' | 'other' }) => {
  const win: any = { document: {}, location: { origin: 'https://tonepath.example' } };
  if (opts.policy !== undefined) win.document.featurePolicy = { allowsFeature: () => opts.policy };
  if (!opts.framed) win.top = win;
  else if (opts.framed === 'same') win.top = { location: { origin: 'https://tonepath.example' } };
  else
    win.top = {
      get location(): never {
        throw new DOMException('Blocked a frame', 'SecurityError');
      },
    };
  return win as Window;
};

describe('micAllowedHere', () => {
  it('follows the permissions policy where the browser reports it', () => {
    expect(micAllowedHere(page({ policy: false, framed: 'other' }))).toBe(false);
    expect(micAllowedHere(page({ policy: true, framed: 'other' }))).toBe(true);
  });
  it('without it: the top page and a frame on its own site may, another site’s frame may not', () => {
    expect(micAllowedHere(page({}))).toBe(true);
    expect(micAllowedHere(page({ framed: 'same' }))).toBe(true);
    expect(micAllowedHere(page({ framed: 'other' }))).toBe(false);
  });
});
