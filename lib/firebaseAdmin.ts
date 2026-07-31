import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';

let _adminAuth: Auth | null = null;

function init() {
  if (_adminAuth) return;
  if (getApps().length > 0) {
    _adminAuth = getAuth();
    return;
  }
  const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (sa) {
    const trimmed = sa.trim();
    let parsed: any | null = null;
    if (trimmed.startsWith('{')) {
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        parsed = null;
      }
    } else if (/^[A-Za-z0-9+/=]+$/.test(trimmed)) {
      try {
        const json = Buffer.from(trimmed, 'base64').toString('utf-8');
        parsed = JSON.parse(json);
      } catch {
        parsed = null;
      }
    }
    if (parsed) {
      initializeApp({
        credential: cert(parsed),
      });
      _adminAuth = getAuth();
      return;
    }
    console.warn('[firebaseAdmin] FIREBASE_SERVICE_ACCOUNT presente pero no válido. Admin deshabilitado.');
    _adminAuth = null;
    return;
  }
  // Sin credenciales explícitas, no inicializamos para evitar errores en local
  console.warn('[firebaseAdmin] No se encontró FIREBASE_SERVICE_ACCOUNT. Firebase Admin deshabilitado.');
  _adminAuth = null;
}

init();

export const adminAuth = _adminAuth;
