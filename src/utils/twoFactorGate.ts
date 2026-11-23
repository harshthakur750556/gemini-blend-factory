export interface TwoFactorChallenge {
  code: string;
  issuedAt: number;
  expiresAt: number;
}

/**
 * Generates a 6-digit numeric one-time challenge code for gating sensitive
 * pipeline switches (e.g., leaving isolated Cloud GitHub CI for local machine execution).
 */
export function generateTwoFactorChallenge(ttlMs = 180_000): TwoFactorChallenge {
  let num = 0;
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.getRandomValues === 'function') {
    const buf = new Uint32Array(1);
    globalThis.crypto.getRandomValues(buf);
    num = buf[0] % 1_000_000;
  } else {
    num = Math.floor(Math.random() * 1_000_000);
  }
  const code = String(num).padStart(6, '0');
  const issuedAt = Date.now();
  return {
    code,
    issuedAt,
    expiresAt: issuedAt + ttlMs,
  };
}

export function verifyTwoFactorPermission(params: {
  challenge: TwoFactorChallenge;
  enteredCode: string;
  acknowledgedRisk: boolean;
  now?: number;
}): { ok: boolean; reason?: string } {
  const now = params.now ?? Date.now();
  if (!params.acknowledgedRisk) {
    return {
      ok: false,
      reason: 'Factor 1 required: confirm that scripts will execute on your local machine.',
    };
  }
  if (now > params.challenge.expiresAt) {
    return {
      ok: false,
      reason: 'Verification code expired. Generate a fresh 6-digit code.',
    };
  }
  const normalized = params.enteredCode.replace(/[\s-]/g, '');
  if (!/^\d{6}$/.test(normalized)) {
    return {
      ok: false,
      reason: 'Factor 2 required: enter the 6-digit verification code shown above.',
    };
  }
  if (normalized !== params.challenge.code) {
    return {
      ok: false,
      reason: 'Verification code does not match. Check all 6 digits and try again.',
    };
  }
  return { ok: true };
}
