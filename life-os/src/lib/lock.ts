import { db } from './db';

/**
 * On-device passcode lock. The passcode is never stored: only a PBKDF2-SHA256 hash with a random salt.
 * This protects the app from someone picking up an unlocked phone; it is not encryption of the
 * underlying IndexedDB data (which the browser already isolates per site).
 */
const ITERATIONS = 210_000;

const toHex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
const fromHex = (h: string) => new Uint8Array(h.match(/.{2}/g)!.map((x) => parseInt(x, 16)));

export async function hashPasscode(passcode: string, saltHex: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(passcode), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: fromHex(saltHex), iterations: ITERATIONS }, key, 256);
  return toHex(bits);
}

export function validPasscode(p: string) {
  return /^\d{4,8}$/.test(p);
}

export async function setPasscode(passcode: string, timeoutMin = 5) {
  if (!validPasscode(passcode)) throw new Error('Use 4 to 8 digits.');
  const salt = toHex(crypto.getRandomValues(new Uint8Array(16)).buffer as ArrayBuffer);
  const hash = await hashPasscode(passcode, salt);
  const s = (await db.settings.get('settings'))!;
  await db.settings.put({ ...s, lock: { enabled: true, salt, hash, timeoutMin } });
}

export async function verifyPasscode(passcode: string): Promise<boolean> {
  const s = await db.settings.get('settings');
  if (!s?.lock.enabled) return true;
  const h = await hashPasscode(passcode, s.lock.salt);
  // Constant-time-ish comparison.
  let diff = h.length ^ s.lock.hash.length;
  for (let i = 0; i < Math.min(h.length, s.lock.hash.length); i++) diff |= h.charCodeAt(i) ^ s.lock.hash.charCodeAt(i);
  return diff === 0;
}

export async function disableLock() {
  const s = (await db.settings.get('settings'))!;
  await db.settings.put({ ...s, lock: { enabled: false, salt: '', hash: '', timeoutMin: s.lock.timeoutMin } });
}
