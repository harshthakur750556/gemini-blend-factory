import React, { useMemo } from 'react';
import { Check, FileCode2, X } from 'lucide-react';
import { computeLineDiff, extractDiffHunks } from '../utils/diffEngine';
import type { PendingDiffProposal } from '../types';

interface DiffApprovalCardProps {
  proposal: PendingDiffProposal;
  isBusy: boolean;
  onApprove: (proposalId: string) => void;
  onReject: (proposalId: string) => void;
}

export const DiffApprovalCard: React.FC<DiffApprovalCardProps> = ({
  proposal,
  isBusy,
  onApprove,
  onReject,
}) => {
  const diff = useMemo(
    () => computeLineDiff(proposal.beforeContent, proposal.afterContent),
    [proposal.beforeContent, proposal.afterContent]
  );

  const rows = useMemo(() => extractDiffHunks(diff, 3), [diff]);

  return (
    <div className="my-2.5 overflow-hidden rounded-xl border border-[#E5E1DA] bg-white shadow-[0_6px_20px_-8px_rgba(28,27,25,0.1)]">
      <div className="flex items-center justify-between gap-2 border-b border-[#EFECE6] bg-[#FAF9F6] px-3.5 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <FileCode2 className="h-3.5 w-3.5 shrink-0 text-[#2D5A4C]" />
          <span className="truncate font-mono text-[11px] font-medium text-[#1C1B19]">
            {proposal.path}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2 font-mono text-[10px] tabular-nums">
          <span className="text-[#2D5A4C]">+{diff.additions}</span>
          <span className="text-[#A8383B]">-{diff.deletions}</span>
          <span className="text-[#847E75]">·</span>
          <span className="text-[10px] font-medium capitalize text-[#5A564F]">
            {proposal.status}
          </span>
        </div>
      </div>

      {proposal.reason && (
        <div className="border-b border-[#EFECE6] px-3.5 py-2 text-[11px] text-[#5A564F]">
          {proposal.reason}
        </div>
      )}

      <div className="max-h-56 overflow-auto bg-[#FCFBF9] font-mono text-[10.5px] leading-[1.55]">
        {!diff.changed ? (
          <div className="px-3.5 py-3 text-[#847E75]">
            No textual differences detected relative to current file contents.
          </div>
        ) : (
          <table className="w-full border-collapse">
            <tbody>
              {rows.map((row, idx) => {
                if (row.kind === 'separator') {
                  return (
                    <tr key={`sep-${idx}`} className="bg-[#F3F0EA] text-[#847E75]">
                      <td colSpan={3} className="px-3 py-1 text-[10px]">
                        ··· {row.skippedCount} unchanged lines ···
                      </td>
                    </tr>
                  );
                }
                const { line } = row;
                const rowClass =
                  line.type === 'add'
                    ? 'bg-[#EBF4F0] text-[#1D4438]'
                    : line.type === 'remove'
                      ? 'bg-[#FAEDED] text-[#8D2C2F]'
                      : 'text-[#5A564F]';
                const marker = line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' ';
                return (
                  <tr key={`ln-${idx}`} className={rowClass}>
                    <td className="w-8 select-none border-r border-[#EFECE6] px-1.5 text-right text-[9.5px] text-[#A29B90] tabular-nums">
                      {line.oldLineNumber ?? ''}
                    </td>
                    <td className="w-8 select-none border-r border-[#EFECE6] px-1.5 text-right text-[9.5px] text-[#A29B90] tabular-nums">
                      {line.newLineNumber ?? ''}
                    </td>
                    <td className="whitespace-pre-wrap break-all px-2.5 py-0.5">
                      <span className="mr-1.5 select-none font-semibold">{marker}</span>
                      {line.content}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {proposal.status === 'pending' && (
        <div className="flex items-center justify-end gap-2 border-t border-[#EFECE6] bg-[#FAF9F6] px-3.5 py-2.5">
          <button
            type="button"
            disabled={isBusy}
            onClick={() => onReject(proposal.id)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#DCD7CE] bg-white px-3 py-1.5 text-[11px] font-medium text-[#5A564F] transition-colors hover:border-[#C5BEB3] hover:text-[#1C1B19] disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5" />
            Reject
          </button>
          <button
            type="button"
            disabled={isBusy}
            onClick={() => onApprove(proposal.id)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#2D5A4C] px-3.5 py-1.5 text-[11px] font-medium text-white transition-colors hover:bg-[#22453A] disabled:opacity-50"
          >
            <Check className="h-3.5 w-3.5" />
            Approve & Write
          </button>
        </div>
      )}
    </div>
  );
};
