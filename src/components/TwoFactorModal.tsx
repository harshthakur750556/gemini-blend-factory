import React, { useEffect, useState } from 'react';
import { RefreshCw, ShieldAlert, ShieldCheck, X } from 'lucide-react';
import {
  generateTwoFactorChallenge,
  verifyTwoFactorPermission,
  type TwoFactorChallenge,
} from '../utils/twoFactorGate';
import { validateLocalBlenderEndpoint } from '../utils/pathSafety';

interface TwoFactorModalProps {
  open: boolean;
  currentLocalEndpoint: string;
  onClose: () => void;
  onApproved: (validatedEndpoint: string) => void;
}

export const TwoFactorModal: React.FC<TwoFactorModalProps> = ({
  open,
  currentLocalEndpoint,
  onClose,
  onApproved,
}) => {
  const [challenge, setChallenge] = useState<TwoFactorChallenge>(() => generateTwoFactorChallenge());
  const [acknowledgedRisk, setAcknowledgedRisk] = useState(false);
  const [enteredCode, setEnteredCode] = useState('');
  const [endpointInput, setEndpointInput] = useState(currentLocalEndpoint);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(180);

  useEffect(() => {
    if (!open) return;
    const fresh = generateTwoFactorChallenge(180_000);
    setChallenge(fresh);
    setAcknowledgedRisk(false);
    setEnteredCode('');
    setEndpointInput(currentLocalEndpoint);
    setErrorMsg(null);
    setSecondsLeft(180);
  }, [open, currentLocalEndpoint]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setInterval(() => {
      const rem = Math.max(0, Math.ceil((challenge.expiresAt - Date.now()) / 1000));
      setSecondsLeft(rem);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [open, challenge.expiresAt]);

  if (!open) return null;

  const handleRegenerate = () => {
    const fresh = generateTwoFactorChallenge(180_000);
    setChallenge(fresh);
    setEnteredCode('');
    setErrorMsg(null);
    setSecondsLeft(180);
  };

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    const endpointCheck = validateLocalBlenderEndpoint(endpointInput);
    if (!endpointCheck.valid || !endpointCheck.normalized) {
      setErrorMsg(endpointCheck.reason || 'Invalid local endpoint URL.');
      return;
    }

    const check = verifyTwoFactorPermission({
      challenge,
      enteredCode,
      acknowledgedRisk,
    });
    if (!check.ok) {
      setErrorMsg(check.reason || 'Verification failed.');
      return;
    }

    setErrorMsg(null);
    onApproved(endpointCheck.normalized);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1C1B19]/35 p-4 animate-atelier-fade"
      role="dialog"
      aria-modal="true"
      aria-labelledby="twofactor-modal-title"
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-[#E5E1DA] bg-white shadow-[0_24px_64px_-16px_rgba(28,27,25,0.22)] animate-atelier-modal">
        <div className="flex items-start justify-between gap-3 border-b border-[#EFECE6] px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FDF6E9] text-[#9A6316]">
              <ShieldAlert className="h-4.5 w-4.5" />
            </div>
            <div>
              <h2
                id="twofactor-modal-title"
                className="font-display text-[18px] font-medium tracking-[-0.015em] text-[#1C1B19]"
              >
                Local Blender Permission
              </h2>
              <p className="mt-0.5 text-[12px] text-[#5A564F]">
                Two-factor verification required before leaving Cloud GitHub CI.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close permission dialog"
            className="rounded-lg p-1.5 text-[#847E75] transition-colors hover:bg-[#F5F3EF] hover:text-[#1C1B19]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleConfirm} className="space-y-4 px-6 py-5">
          <div className="rounded-xl border border-[#EBE6DD] bg-[#FAF9F6] p-4">
            <div className="text-[11px] font-semibold tracking-[0.04em] text-[#5A564F] uppercase">
              Factor 1 · Local Execution Consent
            </div>
            <label className="mt-2.5 flex cursor-pointer items-start gap-2.5 text-[12px] leading-relaxed text-[#1C1B19]">
              <input
                type="checkbox"
                checked={acknowledgedRisk}
                onChange={(e) => setAcknowledgedRisk(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-[#CFC9BE] accent-[#2D5A4C]"
              />
              <span>
                I understand scripts will run against my local Blender 4.2 bridge instead of isolated
                GitHub Actions CI runners.
              </span>
            </label>

            <div className="mt-3.5">
              <label
                htmlFor="local-blender-endpoint"
                className="block text-[11px] font-medium text-[#5A564F]"
              >
                Loopback Endpoint (127.0.0.1 / localhost)
              </label>
              <input
                id="local-blender-endpoint"
                type="text"
                value={endpointInput}
                onChange={(e) => setEndpointInput(e.target.value)}
                placeholder="http://127.0.0.1:8787/blender"
                className="mt-1.5 w-full rounded-lg border border-[#DCD7CE] bg-white px-3 py-2 font-mono text-[12px] text-[#1C1B19] outline-none transition-colors focus:border-[#2D5A4C]"
              />
            </div>
          </div>

          <div className="rounded-xl border border-[#EBE6DD] bg-[#FAF9F6] p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold tracking-[0.04em] text-[#5A564F] uppercase">
                Factor 2 · Verification Code
              </span>
              <span className="font-mono text-[11px] text-[#847E75] tabular-nums">
                {secondsLeft > 0 ? `Expires in ${secondsLeft}s` : 'Expired'}
              </span>
            </div>

            <div className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-[#E5E1DA] bg-white px-4 py-2.5">
              <span
                data-testid="twofactor-challenge-code"
                className="font-mono text-[20px] font-semibold tracking-[0.28em] text-[#1C1B19] tabular-nums"
              >
                {challenge.code}
              </span>
              <button
                type="button"
                onClick={handleRegenerate}
                className="inline-flex items-center gap-1 rounded-md border border-[#E5E1DA] px-2.5 py-1 text-[11px] font-medium text-[#5A564F] transition-colors hover:bg-[#F5F3EF] hover:text-[#1C1B19]"
              >
                <RefreshCw className="h-3 w-3" />
                Refresh
              </button>
            </div>

            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={enteredCode}
              onChange={(e) => setEnteredCode(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
              placeholder="Enter 6-digit code"
              aria-label="Enter 6-digit verification code"
              className="mt-3 w-full rounded-lg border border-[#DCD7CE] bg-white px-3 py-2 font-mono text-[14px] tracking-[0.24em] text-[#1C1B19] outline-none transition-colors focus:border-[#2D5A4C]"
            />
          </div>

          {errorMsg && (
            <div className="rounded-lg border border-[#F0D0D1] bg-[#FDF4F4] px-3.5 py-2.5 text-[12px] text-[#9E3134]">
              {errorMsg}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[#DCD7CE] bg-white px-4 py-2 text-[12px] font-medium text-[#5A564F] transition-colors hover:bg-[#F5F3EF] hover:text-[#1C1B19]"
            >
              Keep Cloud CI
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#2D5A4C] px-4 py-2 text-[12px] font-medium text-white transition-colors hover:bg-[#22453A]"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Switch to Local
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
