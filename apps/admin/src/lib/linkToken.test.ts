import { describe, expect, it } from 'vitest';
import { linkToken } from './linkToken';

describe('linkToken', () => {
  it('keeps a clean base64url token as it is', () => {
    expect(linkToken(new URLSearchParams('token=AbCd_12-xyz'))).toBe('AbCd_12-xyz');
  });

  it('drops what a terminal or email app glued onto the end', () => {
    // Ctrl+click on a link inside a logged JSON string carries the escaped newline along.
    expect(linkToken(new URLSearchParams('token=AbCd_12-xyz%5Cn%5CnIf'))).toBe('AbCd_12-xyz');
    expect(linkToken(new URLSearchParams('token=AbCd_12-xyz%22'))).toBe('AbCd_12-xyz');
    expect(linkToken(new URLSearchParams('token=AbCd_12-xyz.'))).toBe('AbCd_12-xyz');
  });

  it('is empty when the link has no token', () => {
    expect(linkToken(new URLSearchParams(''))).toBe('');
  });
});
