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
    "trashed = false and (name contains '.glb' or name contains '.gltf' or name contains '.blend' or name contains '.obj' or name contains '.stl')"
  );
  const fields = encodeURIComponent('files(id,name,mimeType,size,modifiedTime,webViewLink)');
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&orderBy=modifiedTime desc&pageSize=25`,
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

export async function uploadModelToGoogleDrive(file: File, sanitizedName: string): Promise<DriveFileRecord> {
  if (!cachedAccessToken) throw new Error('Sign in with Google to upload to Google Drive.');

  const lower = sanitizedName.toLowerCase();
  const mimeType = lower.endsWith('.glb')
    ? 'model/gltf-binary'
    : lower.endsWith('.gltf')
      ? 'model/gltf+json'
      : lower.endsWith('.obj')
        ? 'text/plain'
        : 'application/octet-stream';

  const metadata = {
    name: sanitizedName,
    mimeType,
    description: 'Uploaded from BlendFactory Studio 3D Workspace',
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', file, sanitizedName);

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
