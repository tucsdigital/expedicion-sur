import { createHash, randomBytes } from 'node:crypto';

export function generatePasswordRecoveryToken(): { token: string; hash: string } {
  const secret = randomBytes(24).toString('hex');
  return {
    token: secret,
    hash: hashPasswordRecoveryToken(secret),
  };
}

export function hashPasswordRecoveryToken(token: string): string {
  return createHash('sha256').update(String(token ?? '')).digest('hex');
}
