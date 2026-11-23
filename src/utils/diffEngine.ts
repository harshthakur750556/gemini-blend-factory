export interface DiffLine {
  type: 'context' | 'add' | 'remove';
  content: string;
  oldLineNumber: number | null;
  newLineNumber: number | null;
}

export interface DiffResult {
  lines: DiffLine[];
  additions: number;
  deletions: number;
  changed: boolean;
}

/**
 * Computes a deterministic line-level LCS diff between before and after file contents.
 * Falls back cleanly to a full block replacement diff for very large files (>600 lines)
 * to keep UI diff cards instant.
 */
export function computeLineDiff(before: string, after: string): DiffResult {
  if (before === after) {
    const sameLines = before === '' ? [] : before.split('\n');
    return {
      lines: sameLines.map((content, idx) => ({
        type: 'context',
        content,
        oldLineNumber: idx + 1,
        newLineNumber: idx + 1,
      })),
      additions: 0,
      deletions: 0,
      changed: false,
    };
  }

  const oldLines = before === '' ? [] : before.split('\n');
  const newLines = after === '' ? [] : after.split('\n');

  if (oldLines.length * newLines.length > 360000) {
    const lines: DiffLine[] = [
      ...oldLines.map((content, i) => ({
        type: 'remove' as const,
        content,
        oldLineNumber: i + 1,
        newLineNumber: null,
      })),
      ...newLines.map((content, i) => ({
        type: 'add' as const,
        content,
        oldLineNumber: null,
        newLineNumber: i + 1,
      })),
    ];
    return {
      lines,
      additions: newLines.length,
      deletions: oldLines.length,
      changed: true,
    };
  }

  const m = oldLines.length;
  const n = newLines.length;
  const dp: Uint32Array[] = Array.from({ length: m + 1 }, () => new Uint32Array(n + 1));

  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (oldLines[i] === newLines[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = dp[i + 1][j] >= dp[i][j + 1] ? dp[i + 1][j] : dp[i][j + 1];
      }
    }
  }

  const lines: DiffLine[] = [];
  let i = 0;
  let j = 0;
  let additions = 0;
  let deletions = 0;

  while (i < m && j < n) {
    if (oldLines[i] === newLines[j]) {
      lines.push({
        type: 'context',
        content: oldLines[i],
        oldLineNumber: i + 1,
        newLineNumber: j + 1,
      });
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      lines.push({
        type: 'remove',
        content: oldLines[i],
        oldLineNumber: i + 1,
        newLineNumber: null,
      });
      deletions += 1;
      i += 1;
    } else {
      lines.push({
        type: 'add',
        content: newLines[j],
        oldLineNumber: null,
        newLineNumber: j + 1,
      });
      additions += 1;
      j += 1;
    }
  }

  while (i < m) {
    lines.push({
      type: 'remove',
      content: oldLines[i],
      oldLineNumber: i + 1,
      newLineNumber: null,
    });
    deletions += 1;
    i += 1;
  }

  while (j < n) {
    lines.push({
      type: 'add',
      content: newLines[j],
      oldLineNumber: null,
      newLineNumber: j + 1,
    });
    additions += 1;
    j += 1;
  }

  return {
    lines,
    additions,
    deletions,
    changed: additions > 0 || deletions > 0,
  };
}

export type DiffRenderRow =
  | { kind: 'line'; line: DiffLine }
  | { kind: 'separator'; skippedCount: number };

/**
 * Collapses long stretches of unchanged context lines so diff approval cards
 * immediately focus on the actual + / - hunks with surrounding context.
 */
export function extractDiffHunks(diff: DiffResult, contextLines = 3): DiffRenderRow[] {
  if (!diff.changed || diff.lines.length === 0) return [];

  const keep = new Uint8Array(diff.lines.length);
  for (let idx = 0; idx < diff.lines.length; idx++) {
    if (diff.lines[idx].type !== 'context') {
      const start = Math.max(0, idx - contextLines);
      const end = Math.min(diff.lines.length - 1, idx + contextLines);
      for (let k = start; k <= end; k++) {
        keep[k] = 1;
      }
    }
  }

  const rows: DiffRenderRow[] = [];
  let skipped = 0;
  for (let idx = 0; idx < diff.lines.length; idx++) {
    if (keep[idx] === 1) {
      if (skipped > 0) {
        rows.push({ kind: 'separator', skippedCount: skipped });
        skipped = 0;
      }
      rows.push({ kind: 'line', line: diff.lines[idx] });
    } else {
      skipped += 1;
    }
  }
  if (skipped > 0) {
    rows.push({ kind: 'separator', skippedCount: skipped });
  }
  return rows;
}

