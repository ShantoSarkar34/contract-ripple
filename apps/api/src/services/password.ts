import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

/**
 * scrypt parameters. N=2^15 keeps hashing under typical serverless CPU budgets
 * while requiring 32 MiB per verification. The parameters are stored in each
 * hash so they can be raised later without invalidating existing accounts.
 */
export type PasswordHashOptions = {
  N: number;
  r: number;
  p: number;
  keyLength: number;
  maxmem: number;
  saltBytes: number;
};

export const DEFAULT_PASSWORD_HASH_OPTIONS: PasswordHashOptions = {
  N: 32768,
  r: 8,
  p: 1,
  keyLength: 64,
  maxmem: 64 * 1024 * 1024,
  saltBytes: 16,
};

/**
 * Used to spend the same scrypt work when an email address is unknown. It is a
 * hash of a fixed non-credential string, not a real account password.
 */
export const DUMMY_PASSWORD_HASH =
  "scrypt$32768$8$1$r79QZ3OBvp7e1zzPg4OO3g==$NkSlmMJkasbm0RuFhw+sJbT95jK6mMlLcNcsQzRSZ4YGt8g3fQSjVB+97m9HxqLFgs8hXL90WWfviFexVuXgzg==";

const MAX_N = 1 << 20;
const MAX_R = 32;
const MAX_P = 16;
const MAX_KEY_LENGTH = 128;

function scryptAsync(
  password: string,
  salt: Buffer,
  keyLength: number,
  options: { N: number; r: number; p: number; maxmem: number },
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keyLength, options, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(derivedKey);
    });
  });
}

function parseHash(value: string):
  | {
      N: number;
      r: number;
      p: number;
      salt: Buffer;
      hash: Buffer;
    }
  | null {
  const parts = value.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") {
    return null;
  }

  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (
    !Number.isInteger(N) ||
    !Number.isInteger(r) ||
    !Number.isInteger(p) ||
    N < 2 ||
    N > MAX_N ||
    (N & (N - 1)) !== 0 ||
    r < 1 ||
    r > MAX_R ||
    p < 1 ||
    p > MAX_P
  ) {
    return null;
  }

  let salt: Buffer;
  let hash: Buffer;
  try {
    salt = Buffer.from(parts[4] ?? "", "base64");
    hash = Buffer.from(parts[5] ?? "", "base64");
  } catch {
    return null;
  }

  if (salt.length < 8 || hash.length < 16 || hash.length > MAX_KEY_LENGTH) {
    return null;
  }
  return { N, r, p, salt, hash };
}

export async function hashPassword(
  password: string,
  options: PasswordHashOptions = DEFAULT_PASSWORD_HASH_OPTIONS,
): Promise<string> {
  const salt = randomBytes(options.saltBytes);
  const derivedKey = await scryptAsync(password, salt, options.keyLength, {
    N: options.N,
    r: options.r,
    p: options.p,
    maxmem: options.maxmem,
  });
  return [
    "scrypt",
    options.N,
    options.r,
    options.p,
    salt.toString("base64"),
    derivedKey.toString("base64"),
  ].join("$");
}

/** Returns false for malformed or truncated hashes instead of throwing. */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parsed = parseHash(storedHash);
  if (!parsed) {
    return false;
  }

  const derivedKey = await scryptAsync(password, parsed.salt, parsed.hash.length, {
    N: parsed.N,
    r: parsed.r,
    p: parsed.p,
    maxmem: 64 * 1024 * 1024,
  });

  if (derivedKey.length !== parsed.hash.length) {
    return false;
  }
  return timingSafeEqual(derivedKey, parsed.hash);
}

/** Constant-work verification for an unknown account email. */
export async function spendDummyPasswordCheck(password: string): Promise<void> {
  await verifyPassword(password, DUMMY_PASSWORD_HASH);
}
