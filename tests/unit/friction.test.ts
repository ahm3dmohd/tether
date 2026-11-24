import { describe, expect, it } from 'vitest';
import { BYPASS_SENTENCE } from '@/lib/constants';
import { sentenceMatches } from '@/ui/friction';

describe('bypass sentence', () => {
  it('must match exactly, ignoring only surrounding spaces', () => {
    expect(sentenceMatches(BYPASS_SENTENCE)).toBe(true);
    expect(sentenceMatches(`  ${BYPASS_SENTENCE} `)).toBe(true);
    expect(sentenceMatches(BYPASS_SENTENCE.toLowerCase())).toBe(false);
    expect(sentenceMatches(BYPASS_SENTENCE + '.')).toBe(false);
    expect(sentenceMatches('I am choosing to waste  this time')).toBe(false);
    expect(sentenceMatches('')).toBe(false);
  });
});
