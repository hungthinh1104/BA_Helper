import { computeArtifactContentHash } from '../../src/scanner/content-hasher';

describe('computeArtifactContentHash', () => {
  it('returns null for empty or entirely blank content', () => {
    expect(computeArtifactContentHash(null)).toBeNull();
    expect(computeArtifactContentHash(undefined)).toBeNull();
    expect(computeArtifactContentHash('')).toBeNull();
    expect(computeArtifactContentHash('   \n  \t  \n')).toBeNull();
  });

  it('computes identical hashes for identical content', () => {
    const text = 'class Foo {\n  bar() {}\n}';
    const hash1 = computeArtifactContentHash(text);
    const hash2 = computeArtifactContentHash(text);
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('normalizes CRLF and LF to identical hashes', () => {
    const textUnix = 'class Foo {\n  bar() {}\n}';
    const textWin = 'class Foo {\r\n  bar() {}\r\n}';
    expect(computeArtifactContentHash(textUnix)).toBe(computeArtifactContentHash(textWin));
  });

  it('trims trailing whitespace per line to produce identical hashes', () => {
    const textClean = 'class Foo {\n  bar() {}\n}';
    const textDirty = 'class Foo {  \t\n  bar() {}   \n}  ';
    expect(computeArtifactContentHash(textClean)).toBe(computeArtifactContentHash(textDirty));
  });

  it('ignores leading and trailing blank lines', () => {
    const textClean = 'class Foo {\n  bar() {}\n}';
    const textPadded = '\n\n\nclass Foo {\n  bar() {}\n}\n\n\n';
    expect(computeArtifactContentHash(textClean)).toBe(computeArtifactContentHash(textPadded));
  });

  it('produces different hashes for different body content', () => {
    const text1 = 'class Foo {\n  bar() {}\n}';
    const text2 = 'class Foo {\n  baz() {}\n}';
    expect(computeArtifactContentHash(text1)).not.toBe(computeArtifactContentHash(text2));
  });

  it('produces different hashes when content is appended', () => {
    const text1 = 'class Foo {\n  bar() {}\n}';
    const text2 = 'class Foo {\n  bar() {}\n  extra() {}\n}';
    expect(computeArtifactContentHash(text1)).not.toBe(computeArtifactContentHash(text2));
  });
});
