import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  type User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

export const DRIVE_SCOPES = ['https://www.googleapis.com/auth/drive.file'];

const firebaseApp = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);

const provider = new GoogleAuthProvider();
for (const scope of DRIVE_SCOPES) {
  provider.addScope(scope);
}

// Strict in-memory OAuth access token cache (never written to localStorage/sessionStorage)
let isSigningIn = false;
let cachedAccessToken: string | null = null;

export interface DriveFileRecord {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  webViewLink?: string;
}

export function initDriveAuth(
  onSignedIn: (user: User, token: string) => void,
  onSignedOut: () => void
) {
  return onAuthStateChanged(auth, (user) => {
    if (user && cachedAccessToken) {
      onSignedIn(user, cachedAccessToken);
    } else if (!isSigningIn) {
      cachedAccessToken = null;
      onSignedOut();
    }
  });
}

export async function signInWithGoogleDrive(): Promise<{ user: User; accessToken: string }> {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Google Drive access token was not returned by sign-in.');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
}

export function getCachedDriveToken(): string | null {
  return cachedAccessToken;
}

export async function signOutGoogleDrive(): Promise<void> {
  await auth.signOut();
  cachedAccessToken = null;
}

export async function listDrive3DModels(): Promise<DriveFileRecord[]> {
  if (!cachedAccessToken) throw new Error('Sign in with Google to access Google Drive.');
  const q = encodeURIComponent(
    "trashed = false and (name contains '.glb' or name contains '.gltf' or name contains '.blend' or name contains '.obj' or name contains '.stl' or name contains '.fbx' or name contains '.dae' or name contains '.ply' or name contains '.3mf')"
  );
  const fields = encodeURIComponent('files(id,name,mimeType,size,modifiedTime,webViewLink)');
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&orderBy=modifiedTime desc&pageSize=35`,
    {
      headers: { Authorization: `Bearer ${cachedAccessToken}` },
    }
  );
  if (!res.ok) {
    throw new Error(`Google Drive list failed (${res.status}).`);
  }
  const data = (await res.json()) as { files?: DriveFileRecord[] };
  return data.files || [];
}

/**
 * Finds or creates a folder in Google Drive under an optional parent folder ID.
 */
export async function ensureDriveFolder(folderName: string, parentId?: string): Promise<string> {
  if (!cachedAccessToken) throw new Error('Sign in with Google to manage Google Drive folders.');
  const safeName = folderName.replace(/'/g, '').trim() || 'BlendFactory_Models';
  const parentClause = parentId ? ` and '${parentId}' in parents` : '';
  const query = encodeURIComponent(
    `mimeType = 'application/vnd.google-apps.folder' and name = '${safeName}' and trashed = false${parentClause}`
  );
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)&pageSize=1`,
    {
      headers: { Authorization: `Bearer ${cachedAccessToken}` },
    }
  );
  if (searchRes.ok) {
    const found = (await searchRes.json()) as { files?: Array<{ id: string }> };
    if (found.files?.[0]?.id) {
      return found.files[0].id;
    }
  }

  const createRes = await fetch('https://www.googleapis.com/drive/v3/files?fields=id', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cachedAccessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: safeName,
      mimeType: 'application/vnd.google-apps.folder',
      ...(parentId ? { parents: [parentId] } : {}),
    }),
  });
  if (!createRes.ok) {
    throw new Error(`Failed to create Drive folder "${safeName}" (${createRes.status}).`);
  }
  const created = (await createRes.json()) as { id: string };
  return created.id;
}

export async function uploadBlobToGoogleDrive(
  blob: Blob,
  fileName: string,
  mimeType: string,
  parentFolderId?: string,
  description = 'Backed up from BlendFactory Studio'
): Promise<DriveFileRecord> {
  if (!cachedAccessToken) throw new Error('Sign in with Google to upload to Google Drive.');

  const metadata: Record<string, unknown> = {
    name: fileName,
    mimeType,
    description,
  };
  if (parentFolderId) {
    metadata.parents = [parentFolderId];
  }

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', blob, fileName);

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,modifiedTime,webViewLink',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${cachedAccessToken}` },
      body: form,
    }
  );
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Google Drive upload failed (${res.status}): ${errText.slice(0, 180)}`);
  }
  return (await res.json()) as DriveFileRecord;
}

export async function uploadModelToGoogleDrive(
  file: File,
  sanitizedName: string,
  parentFolderId?: string
): Promise<DriveFileRecord> {
  const lower = sanitizedName.toLowerCase();
  const mimeType = lower.endsWith('.glb')
    ? 'model/gltf-binary'
    : lower.endsWith('.gltf')
      ? 'model/gltf+json'
      : lower.endsWith('.obj') || lower.endsWith('.fbx') || lower.endsWith('.usda')
        ? 'text/plain'
        : lower.endsWith('.dae') || lower.endsWith('.3mf')
          ? 'application/xml'
          : 'application/octet-stream';

  return uploadBlobToGoogleDrive(
    file,
    sanitizedName,
    mimeType,
    parentFolderId,
    'Uploaded from BlendFactory Studio 3D Workspace'
  );
}

/**
 * Backs up a complete model bundle (main 3D asset + textures + screenshots + manifest)
 * into organized folders inside Google Drive:
 *   BlendFactory_Backup/<group>/<modelSlug>/
 *     ├── <modelFile>
 *     ├── manifest.json
 *     ├── textures/*
 *     └── screenshots/*
 */
export async function backupModelBundleToDrive(params: {
  group: string;
  modelSlug: string;
  modelBlob: Blob;
  modelFileName: string;
  manifestJson?: string;
  buildPy?: string;
  textures?: Array<{ name: string; blob: Blob; mimeType?: string }>;
  screenshots?: Array<{ name: string; blob: Blob; mimeType?: string }>;
}): Promise<{ folderId: string; uploadedCount: number }> {
  const rootId = await ensureDriveFolder('BlendFactory_Backup');
  const groupId = await ensureDriveFolder(params.group || 'General', rootId);
  const modelFolderId = await ensureDriveFolder(params.modelSlug, groupId);

  let uploadedCount = 0;

  await uploadBlobToGoogleDrive(
    params.modelBlob,
    params.modelFileName,
    'application/octet-stream',
    modelFolderId
  );
  uploadedCount += 1;

  if (params.manifestJson) {
    await uploadBlobToGoogleDrive(
      new Blob([params.manifestJson], { type: 'application/json' }),
      'manifest.json',
      'application/json',
      modelFolderId
    );
    uploadedCount += 1;
  }

  if (params.buildPy) {
    await uploadBlobToGoogleDrive(
      new Blob([params.buildPy], { type: 'text/x-python' }),
      'build.py',
      'text/plain',
      modelFolderId
    );
    uploadedCount += 1;
  }

  if (params.textures && params.textures.length > 0) {
    const texFolderId = await ensureDriveFolder('textures', modelFolderId);
    for (const tex of params.textures) {
      await uploadBlobToGoogleDrive(
        tex.blob,
        tex.name,
        tex.mimeType || 'image/png',
        texFolderId
      );
      uploadedCount += 1;
    }
  }

  if (params.screenshots && params.screenshots.length > 0) {
    const shotFolderId = await ensureDriveFolder('screenshots', modelFolderId);
    for (const shot of params.screenshots) {
      await uploadBlobToGoogleDrive(
        shot.blob,
        shot.name,
        shot.mimeType || 'image/png',
        shotFolderId
      );
      uploadedCount += 1;
    }
  }

  return { folderId: modelFolderId, uploadedCount };
}

export async function downloadDriveModelAsBlobUrl(fileId: string): Promise<string> {
  if (!cachedAccessToken) throw new Error('Sign in with Google to load models from Google Drive.');
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
    {
      headers: { Authorization: `Bearer ${cachedAccessToken}` },
    }
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch Drive model (${res.status}).`);
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
