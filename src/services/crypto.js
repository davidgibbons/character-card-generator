/**
 * crypto.js — AES-GCM encryption for sensitive config values stored in localStorage.
 *
 * A random 256-bit CryptoKey is generated on first run and stored as a raw key
 * in localStorage under KEYRING_KEY. This is "encrypted at rest" in the sense
 * that the persisted values are ciphertext blobs — a raw localStorage dump won't
 * reveal the API keys without also running the app.
 *
 * It does NOT protect against someone with access to the running browser session.
 *
 * Format of encrypted value: "<iv_b64>.<ciphertext_b64>"  (both base64url encoded)
 */

const KEYRING_KEY = 'charGeneratorConfig:keyring';
const ALGO = { name: 'AES-GCM', length: 256 };

let _key = null; // cached CryptoKey for this session

/** Generate a new random AES-GCM key and persist it as raw bytes. */
async function generateKey() {
  const key = await crypto.subtle.generateKey(ALGO, true, ['encrypt', 'decrypt']);
  const raw = await crypto.subtle.exportKey('raw', key);
  localStorage.setItem(KEYRING_KEY, bufToB64(new Uint8Array(raw)));
  return key;
}

/** Load or create the key for this browser. */
async function getKey() {
  if (_key) return _key;
  const stored = localStorage.getItem(KEYRING_KEY);
  if (stored) {
    try {
      const raw = b64ToBuf(stored);
      _key = await crypto.subtle.importKey('raw', raw, ALGO, false, ['encrypt', 'decrypt']);
      return _key;
    } catch {
      // Stored key is corrupt — generate a fresh one (existing ciphertext will fail to decrypt)
      console.warn('charCard crypto: stored keyring corrupted, regenerating');
    }
  }
  _key = await generateKey();
  return _key;
}

/** Encrypt a plaintext string. Returns "<iv_b64>.<ciphertext_b64>" or '' for empty input. */
export async function encrypt(plaintext) {
  if (!plaintext) return '';
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  return `${bufToB64(iv)}.${bufToB64(new Uint8Array(ciphertext))}`;
}

/** Decrypt a "<iv_b64>.<ciphertext_b64>" string. Returns '' on any failure. */
export async function decrypt(blob) {
  if (!blob || !blob.includes('.')) return blob ?? ''; // not encrypted — return as-is
  try {
    const key = await getKey();
    const [ivB64, ctB64] = blob.split('.');
    const iv = b64ToBuf(ivB64);
    const ciphertext = b64ToBuf(ctB64);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
    return new TextDecoder().decode(plain);
  } catch {
    // Wrong key or corrupt blob — return empty so the user re-enters
    console.warn('charCard crypto: decryption failed, key may have been rotated');
    return '';
  }
}

/** Encrypt an object's sensitive fields in-place, returning a new object. */
export async function encryptConfig(api) {
  const out = JSON.parse(JSON.stringify(api));
  out.text.apiKey = await encrypt(api.text.apiKey);
  out.image.apiKey = await encrypt(api.image.apiKey);
  out.sillytavern.password = await encrypt(api.sillytavern.password);
  return out;
}

/** Decrypt an object's sensitive fields in-place, returning a new object. */
export async function decryptConfig(api) {
  const out = JSON.parse(JSON.stringify(api));
  out.text.apiKey = await decrypt(api.text.apiKey);
  out.image.apiKey = await decrypt(api.image.apiKey);
  out.sillytavern.password = await decrypt(api.sillytavern.password);
  return out;
}

// ── Encoding helpers ─────────────────────────────────────────────────────────

function bufToB64(buf) {
  let binary = '';
  for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64ToBuf(b64) {
  const padded = b64.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded);
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
  return buf;
}
