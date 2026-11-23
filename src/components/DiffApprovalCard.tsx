import React, { useMemo } from 'react';
import type { PendingDiffProposal } from '../types';
import { computeLineDiff, extractDiffHunks } from '../utils/diffEngine';

interface DiffApprovalCardProps {
  proposal: PendingDiffProposal;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  busy?: boolean;
}

export const DiffApprovalCard: React.FC<DiffApprovalCardProps> = ({
  proposal,
  onApprove,
  onReject,
  busy = false,
}) => {
  const diff = useMemo(
    () => computeLineDiff(proposal.beforeContent, proposal.afterContent),
    [proposal.beforeContent, proposal.afterContent]
  );
  const hunks = useMemo(() => extractDiffHunks(diff, 2), [diff]);

  return (
    <div className="mt-2 rounded-lg border border-[#cbd5e1] bg-white overflow-hidden shadow-sm">
      <div className="px-3 py-2 bg-[#f8f9fa] border-b border-[#dcdfe4] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="material-symbols-outlined text-[15px] text-[#111318]">difference</span>
          <span className="font-mono text-[11px] font-semibold text-[#111318] truncate">{proposal.path}</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-mono shrink-0">
          <span className="text-emerald-700 font-semibold">+{diff.additions}</span>
          <span className="text-red-600 font-semibold">-{diff.deletions}</span>
          <span className="px-1.5 py-0.5 rounded bg-[#f0f2f5] border border-[#dcdfe4] text-[#111318] uppercase text-[9px]">
            {proposal.status}
          </span>
        </div>
      </div>

      <div className="max-h-52 overflow-y-auto font-mono text-[10px] leading-relaxed bg-[#fcfcfd]">
        {hunks.slice(0, 60).map((row, idx) => {
          if (row.kind === 'separator') {
            return (
              <div
                key={`sep-${idx}`}
                className="px-3 py-0.5 bg-[#f0f2f5] text-[#64748b] border-y border-[#e5e8ec]"
              >
                ··· {row.skippedCount} unchanged lines ···
              </div>
            );
          }
          const line = row.line;
          const bg =
            line.type === 'add'
              ? 'bg-emerald-50 text-emerald-950'
              : line.type === 'remove'
                ? 'bg-red-50 text-red-900'
                : 'text-[#334155]';
          const prefix = line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' ';
          return (
            <div key={`l-${idx}`} className={`px-3 py-0.5 whitespace-pre-wrap break-all ${bg}`}>
              <span className="inline-block w-4 select-none opacity-70">{prefix}</span>
              {line.content}
            </div>
          );
        })}
      </div>

      {proposal.status === 'pending' && (
        <div className="px-3 py-2 bg-[#f8f9fa] border-t border-[#dcdfe4] flex items-center justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => onReject(proposal.id)}
            className="px-2.5 py-1 rounded border border-[#dcdfe4] bg-white hover:bg-[#f0f2f5] text-[#111318] text-[11px] font-medium cursor-pointer"
          >
            Reject
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onApprove(proposal.id)}
            className="px-3 py-1 rounded bg-[#111318] hover:bg-black text-white text-[11px] font-semibold cursor-pointer"
          >
            Approve &amp; Write File
          </button>
        </div>
      )}
    </div>
  );
};
