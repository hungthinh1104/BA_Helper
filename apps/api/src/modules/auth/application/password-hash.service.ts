import { Injectable } from '@nestjs/common';
import { randomBytes, scrypt as nodeScrypt, timingSafeEqual } from 'node:crypto';

const SCRYPT_PARAMS = {
  N: 131_072,
  r: 8,
  p: 1,
  keyLength: 64,
  maxmem: 160 * 1024 * 1024,
} as const;

const HASH_PREFIX = 'scrypt';
const HASH_VERSION = 'v=1';

@Injectable()
export class PasswordHashService {
  async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16);
    const derived = await this.derive(password, salt, SCRYPT_PARAMS);

    return [
      HASH_PREFIX,
      HASH_VERSION,
      `N=${SCRYPT_PARAMS.N}`,
      `r=${SCRYPT_PARAMS.r}`,
      `p=${SCRYPT_PARAMS.p}`,
      `keylen=${SCRYPT_PARAMS.keyLength}`,
      salt.toString('base64url'),
      derived.toString('base64url'),
    ].join('$');
  }

  async verifyPassword(hash: string, password: string): Promise<boolean> {
    const parsed = parseScryptHash(hash);
    if (!parsed) return false;

    const derived = await this.derive(password, parsed.salt, parsed.params);
    if (derived.length !== parsed.expected.length) return false;

    return timingSafeEqual(derived, parsed.expected);
  }

  private async derive(
    password: string,
    salt: Buffer,
    params: ScryptParams,
  ): Promise<Buffer> {
    const derived = await scryptAsync(password, salt, params.keyLength, {
      N: params.N,
      r: params.r,
      p: params.p,
      maxmem: SCRYPT_PARAMS.maxmem,
    });

    return derived;
  }
}

type ScryptParams = {
  N: number;
  r: number;
  p: number;
  keyLength: number;
};

function parseScryptHash(hash: string): {
  params: ScryptParams;
  salt: Buffer;
  expected: Buffer;
} | null {
  const [algorithm, version, rawN, rawR, rawP, rawKeyLength, rawSalt, rawHash] =
    hash.split('$');

  if (algorithm !== HASH_PREFIX || version !== HASH_VERSION) return null;
  if (!rawN || !rawR || !rawP || !rawKeyLength || !rawSalt || !rawHash) return null;

  const N = parsePositiveInt(rawN, 'N');
  const r = parsePositiveInt(rawR, 'r');
  const p = parsePositiveInt(rawP, 'p');
  const keyLength = parsePositiveInt(rawKeyLength, 'keylen');

  if (!N || !r || !p || !keyLength) return null;

  return {
    params: { N, r, p, keyLength },
    salt: Buffer.from(rawSalt, 'base64url'),
    expected: Buffer.from(rawHash, 'base64url'),
  };
}

function parsePositiveInt(raw: string, key: string): number | null {
  const [prefix, value] = raw.split('=');
  if (prefix !== key || !value) return null;

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function scryptAsync(
  password: string,
  salt: Buffer,
  keyLength: number,
  options: { N: number; r: number; p: number; maxmem: number },
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    nodeScrypt(password, salt, keyLength, options, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(Buffer.isBuffer(derivedKey) ? derivedKey : Buffer.from(derivedKey));
    });
  });
}
