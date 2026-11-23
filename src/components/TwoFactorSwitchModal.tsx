import React, { useEffect, useState } from 'react';
import {
  generateTwoFactorChallenge,
  verifyTwoFactorPermission,
  type TwoFactorChallenge,
} from '../utils/twoFactorGate';

interface TwoFactorSwitchModalProps {
  open: boolean;
  localEndpoint: string;
  onCancel: () => void;
  onVerified: (endpoint: string) => void;
}

export const TwoFactorSwitchModal: React.FC<TwoFactorSwitchModalProps> = ({
  open,
  localEndpoint,
  onCancel,
  onVerified,
}) => {
  const [challenge, setChallenge] = useState<TwoFactorChallenge>(() => generateTwoFactorChallenge(90_000));
  const [acknowledgedRisk, setAcknowledgedRisk] = useState(false);
  const [enteredCode, setEnteredCode] = useState('');
  const [endpointDraft, setEndpointDraft] = useState(localEndpoint);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [remainingSec, setRemainingSec] = useState(90);

  useEffect(() => {
    if (!open) return;
    const fresh = generateTwoFactorChallenge(90_000);
    setChallenge(fresh);
    setAcknowledgedRisk(false);
    setEnteredCode('');
    setEndpointDraft(localEndpoint);
    setErrorMsg(null);
    setRemainingSec(90);
  }, [open, localEndpoint]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((challenge.expiresAt - Date.now()) / 1000));
      setRemainingSec(left);
    }, 500);
    return () => window.clearInterval(timer);
  }, [open, challenge]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = verifyTwoFactorPermission({
      challenge,
      enteredCode,
      acknowledgedRisk,
      now: Date.now(),
    });
    if (!res.ok) {
      setErrorMsg(res.reason || '2-Factor verification failed.');
      return;
    }
    onVerified(endpointDraft.trim() || localEndpoint);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45"
      role="dialog"
      aria-modal="true"
      aria-label="2-Factor Permission Gate"
    >
      <div className="bg-white rounded-xl shadow-2xl border border-[#cbd5e1] w-full max-w-md overflow-hidden">
        <div className="px-4 py-3 bg-[#f8f9fa] border-b border-[#dcdfe4] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded bg-[#111318] text-white flex items-center justify-center">
              <span className="material-symbols-outlined text-[15px]">verified_user</span>
            </span>
            <div>
              <h2 className="text-xs font-bold text-[#111318] uppercase tracking-wide">
                2-Factor Pipeline Permission
              </h2>
              <p className="text-[10px] font-mono text-[#64748b]">Cloud GitHub CI → Local Blender Backup</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="w-7 h-7 rounded hover:bg-[#e5e8ec] text-[#64748b] hover:text-black flex items-center justify-center cursor-pointer"
            aria-label="Cancel 2FA Switch"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4 text-xs">
          {/* Factor 1 */}
          <div className="p-3 rounded-lg bg-[#f8f9fa] border border-[#dcdfe4] space-y-2">
            <div className="text-[10px] font-mono font-bold uppercase text-[#111318]">
              Factor 1 · Local Execution Boundary
            </div>
            <label className="flex items-start gap-2 cursor-pointer text-[#334155]">
              <input
                type="checkbox"
                checked={acknowledgedRisk}
                onChange={(e) => setAcknowledgedRisk(e.target.checked)}
                className="mt-0.5 rounded border-[#94a3b8] text-[#111318] focus:ring-[#111318]"
              />
              <span>
                I authorize routing Blender 4.2 Python builds to my local loopback worker instead of headless GitHub Actions CI.
              </span>
            </label>
            <div>
              <label className="block text-[10px] font-mono text-[#64748b] mb-1">Local Loopback Endpoint</label>
              <input
                type="text"
                value={endpointDraft}
                onChange={(e) => setEndpointDraft(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded bg-white border border-[#dcdfe4] font-mono text-[11px] text-[#111318]"
              />
            </div>
          </div>

          {/* Factor 2 */}
          <div className="p-3 rounded-lg bg-[#f8f9fa] border border-[#dcdfe4] space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold uppercase text-[#111318]">
                Factor 2 · Timed 6-Digit Verification
              </span>
              <span className="text-[10px] font-mono text-[#64748b]">Expires in {remainingSec}s</span>
            </div>
            <div className="flex items-center justify-between px-3 py-2 rounded bg-white border border-[#111318]">
              <span className="font-mono text-lg font-bold tracking-[0.28em] text-[#111318]">
                {challenge.code.slice(0, 3)}-{challenge.code.slice(3)}
              </span>
              <button
                type="button"
                onClick={() => {
                  const next = generateTwoFactorChallenge(90_000);
                  setChallenge(next);
                  setRemainingSec(90);
                  setErrorMsg(null);
                }}
                className="text-[10px] font-mono underline text-[#64748b] hover:text-black cursor-pointer"
              >
                Regenerate
              </button>
            </div>
            <input
              type="text"
              value={enteredCode}
              onChange={(e) => setEnteredCode(e.target.value)}
              placeholder="Enter 6-digit code above..."
              className="w-full px-2.5 py-1.5 rounded bg-white border border-[#dcdfe4] font-mono text-xs text-[#111318] focus:border-[#111318] focus:outline-none"
            />
          </div>

          {errorMsg && (
            <div className="p-2 rounded bg-red-50 border border-red-200 text-red-700 font-mono text-[11px]">
              {errorMsg}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1.5 rounded border border-[#dcdfe4] bg-white hover:bg-[#f0f2f5] text-[#111318] font-medium cursor-pointer"
            >
              Stay on Cloud CI
            </button>
            <button
              type="submit"
              className="px-3.5 py-1.5 rounded bg-[#111318] hover:bg-black text-white font-semibold cursor-pointer"
            >
              Verify &amp; Switch to Local
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
