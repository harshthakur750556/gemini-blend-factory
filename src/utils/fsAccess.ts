import { normalizeWorkspacePath } from './pathSafety';
import type { WorkspaceFileEntry } from '../types';

const IGNORED_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  '.next',
  '__pycache__',
  '.venv',
  'venv',
  '.playwright-cli',
]);

const MAX_SCAN_FILES = 250;
const MAX_READ_BYTES = 512_000;

interface DirectoryPickerWindow extends Window {
  showDirectoryPicker?: (options?: {
    id?: string;
    mode?: 'read' | 'readwrite';
  }) => Promise<FileSystemDirectoryHandle>;
}

export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && typeof (window as DirectoryPickerWindow).showDirectoryPicker === 'function';
}

export async function pickLocalDirectory(): Promise<FileSystemDirectoryHandle> {
  const win = window as DirectoryPickerWindow;
  if (typeof win.showDirectoryPicker !== 'function') {
    throw new Error(
      'Your browser does not support the File System Access API (window.showDirectoryPicker). Use Chrome, Edge, or Opera on desktop.'
    );
  }
  return await win.showDirectoryPicker({
    id: 'blendfactory-local-workspace',
    mode: 'readwrite',
  });
}

export async function scanDirectoryTree(
  rootHandle: FileSystemDirectoryHandle
): Promise<WorkspaceFileEntry[]> {
  const results: WorkspaceFileEntry[] = [];

  async function walk(dir: FileSystemDirectoryHandle, prefix: string): Promise<void> {
    if (results.length >= MAX_SCAN_FILES) return;
    // FileSystemDirectoryHandle implements AsyncIterable<[string, FileSystemHandle]>
    const entriesIterable = (
      dir as unknown as { entries: () => AsyncIterable<[string, FileSystemHandle]> }
    ).entries();

    const batch: Array<[string, FileSystemHandle]> = [];
    for await (const entry of entriesIterable) {
      batch.push(entry);
    }
    batch.sort(([aName, aHandle], [bName, bHandle]) => {
      if (aHandle.kind !== bHandle.kind) return aHandle.kind === 'directory' ? -1 : 1;
      return aName.localeCompare(bName);
    });

    for (const [name, handle] of batch) {
      if (results.length >= MAX_SCAN_FILES) break;
      const relPath = prefix ? `${prefix}/${name}` : name;
      if (handle.kind === 'directory') {
        if (IGNORED_DIRS.has(name)) continue;
        await walk(handle as FileSystemDirectoryHandle, relPath);
      } else {
        try {
          const file = await (handle as FileSystemFileHandle).getFile();
          results.push({
            path: relPath,
            name,
            size: file.size,
            source: 'local',
          });
        } catch {
          results.push({
            path: relPath,
            name,
            size: 0,
            source: 'local',
          });
        }
      }
    }
  }

  await walk(rootHandle, '');
  return results;
}

export async function readFileFromDirectory(
  rootHandle: FileSystemDirectoryHandle,
  rawPath: string
): Promise<string> {
  const safePath = normalizeWorkspacePath(rawPath);
  const parts = safePath.split('/');
  let currentDir = rootHandle;

  for (let i = 0; i < parts.length - 1; i++) {
    currentDir = await currentDir.getDirectoryHandle(parts[i], { create: false });
  }
  const fileHandle = await currentDir.getFileHandle(parts[parts.length - 1], { create: false });
  const file = await fileHandle.getFile();
  if (file.size > MAX_READ_BYTES) {
    throw new Error(`File "${safePath}" exceeds 512KB text read limit (${file.size} bytes).`);
  }
  return await file.text();
}

export async function writeFileToDirectory(
  rootHandle: FileSystemDirectoryHandle,
  rawPath: string,
  content: string
): Promise<void> {
  const safePath = normalizeWorkspacePath(rawPath);
  const parts = safePath.split('/');
  let currentDir = rootHandle;

  for (let i = 0; i < parts.length - 1; i++) {
    currentDir = await currentDir.getDirectoryHandle(parts[i], { create: true });
  }
  const fileHandle = await currentDir.getFileHandle(parts[parts.length - 1], { create: true });
  const writable = await fileHandle.createWritable();
  try {
    await writable.write(content);
  } finally {
    await writable.close();
  }
}
