import type { HistoryStateSummary } from '../types';

export interface HistoryCommand {
  id: string;
  label: string;
  timestamp: number;
  undo: () => void;
  redo: () => void;
}

export interface HistoryStack {
  past: HistoryCommand[];
  future: HistoryCommand[];
  maxDepth: number;
}

let commandSeq = 1;

export function createCommandId(prefix = 'cmd'): string {
  return `${prefix}-${Date.now()}-${commandSeq++}`;
}

export function createHistoryStack(maxDepth = 60): HistoryStack {
  return {
    past: [],
    future: [],
    maxDepth: Math.max(1, Math.floor(maxDepth)),
  };
}

export function pushHistoryCommand(
  stack: HistoryStack,
  command: Omit<HistoryCommand, 'id' | 'timestamp'> & { id?: string; timestamp?: number }
): HistoryStack {
  const entry: HistoryCommand = {
    id: command.id ?? createCommandId(),
    label: command.label,
    timestamp: command.timestamp ?? Date.now(),
    undo: command.undo,
    redo: command.redo,
  };
  const nextPast = [...stack.past, entry];
  if (nextPast.length > stack.maxDepth) {
    nextPast.splice(0, nextPast.length - stack.maxDepth);
  }
  return {
    past: nextPast,
    future: [],
    maxDepth: stack.maxDepth,
  };
}

export function stepUndo(stack: HistoryStack): {
  stack: HistoryStack;
  command: HistoryCommand | null;
} {
  if (stack.past.length === 0) {
    return { stack, command: null };
  }
  const command = stack.past[stack.past.length - 1];
  command.undo();
  return {
    command,
    stack: {
      past: stack.past.slice(0, -1),
      future: [command, ...stack.future],
      maxDepth: stack.maxDepth,
    },
  };
}

export function stepRedo(stack: HistoryStack): {
  stack: HistoryStack;
  command: HistoryCommand | null;
} {
  if (stack.future.length === 0) {
    return { stack, command: null };
  }
  const command = stack.future[0];
  command.redo();
  const nextPast = [...stack.past, command];
  if (nextPast.length > stack.maxDepth) {
    nextPast.splice(0, nextPast.length - stack.maxDepth);
  }
  return {
    command,
    stack: {
      past: nextPast,
      future: stack.future.slice(1),
      maxDepth: stack.maxDepth,
    },
  };
}

export function clearHistoryStack(stack: HistoryStack): HistoryStack {
  return {
    past: [],
    future: [],
    maxDepth: stack.maxDepth,
  };
}

export function getHistorySummary(stack: HistoryStack): HistoryStateSummary {
  const topUndo = stack.past.length > 0 ? stack.past[stack.past.length - 1] : null;
  const topRedo = stack.future.length > 0 ? stack.future[0] : null;
  return {
    canUndo: stack.past.length > 0,
    canRedo: stack.future.length > 0,
    undoLabel: topUndo ? topUndo.label : null,
    redoLabel: topRedo ? topRedo.label : null,
    undoCount: stack.past.length,
    redoCount: stack.future.length,
  };
}
