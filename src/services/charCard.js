/**
 * charCard.js — Character card read/write using @lenml/char-card-reader for spec
 * normalization and a thin PNG writer for V3 chunk injection.
 *
 * Read path:  CharacterCard.from_json(raw) / CharacterCard.from_file(buffer)
 * Write path: charCard.createPng(imageBlob, appChar) → Blob
 *             charCard.download(blob, name)
 *
 * V3 spec: PNG tEXt chunk keyword is 'ccv3' (not 'chara').
 * See: https://github.com/kwaroran/character-card-spec-v3/blob/main/SPEC_V3.md#L22-L30
 */

import { CharacterCard } from '@lenml/char-card-reader';

export { CharacterCard };

// ── PNG constants ────────────────────────────────────────────────────────────

const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const CCv3_KEYWORD = 'ccv3';   // V3 chunk keyword (ST looks for this to detect V3 cards)
const CHARA_KEYWORD = 'chara'; // V1/V2 legacy keyword — we remove these on write

// CRC32 table (standard PNG CRC)
const CRC32_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c;
  }
  return t;
})();

function crc32(data) {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = CRC32_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// ── App char → V3 spec adapter ───────────────────────────────────────────────

/**
 * Convert the app's internal camelCase character object to a V3 spec object
 * suitable for embedding in a PNG or sending to ST.
 *
 * Uses CharacterCard.from_json to normalize, then toSpecV3() to produce the
 * correct envelope. Fields not in the V3 spec (qualityScore, _raw, etc.) are
 * dropped automatically.
 */
export function toV3Spec(appChar) {
  // Map app camelCase → V2 snake_case so the library can read it
  const v2shape = {
    spec: 'chara_card_v2',
    spec_version: '2.0',
    data: {
      name: appChar.name || '',
      description: appChar.description || '',
      personality: appChar.personality || '',
      scenario: appChar.scenario || '',
      first_mes: appChar.firstMessage || '',
      mes_example: appChar.mesExample || '',
      system_prompt: appChar.systemPrompt || '',
      creator_notes: appChar.creatorNotes || '',
      tags: Array.isArray(appChar.tags) ? appChar.tags : [],
      character_book: appChar.characterBook || undefined,
      alternate_greetings: Array.isArray(appChar.alternateGreetings) ? appChar.alternateGreetings : [],
      extensions: appChar.extensions || {},
    },
  };

  return CharacterCard.from_json(v2shape).toSpecV3();
}

/**
 * Convert a V3 spec object (or any CharacterCard instance) back to the app's
 * camelCase format after pulling from ST or importing a PNG.
 */
export function fromCard(card) {
  // card is a CharacterCard instance
  return {
    name: card.name || '',
    description: card.description || '',
    personality: card.personality || '',
    scenario: card.scenario || '',
    firstMessage: card.first_message || '',
    mesExample: card.message_example || '',
    systemPrompt: card.raw_data?.data?.system_prompt || '',
    creatorNotes: card.raw_data?.data?.creator_notes || '',
    tags: Array.isArray(card.tags) ? card.tags : [],
    characterBook: card.character_book || null,
    alternateGreetings: Array.isArray(card.alternate_greetings) ? card.alternate_greetings : [],
  };
}

// ── PNG chunk helpers ────────────────────────────────────────────────────────

function makePngChunk(type, data) {
  const typeBytes = new TextEncoder().encode(type);
  const combined = new Uint8Array(typeBytes.length + data.length);
  combined.set(typeBytes);
  combined.set(data, typeBytes.length);

  const crc = crc32(combined);
  const chunk = new Uint8Array(4 + 4 + data.length + 4);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, data.length, false); // length (big-endian)
  chunk.set(typeBytes, 4);
  chunk.set(data, 8);
  view.setUint32(8 + data.length, crc, false); // CRC
  return chunk;
}

function makeTextChunk(keyword, text) {
  const kw = new TextEncoder().encode(keyword);
  const tx = new TextEncoder().encode(text);
  const data = new Uint8Array(kw.length + 1 + tx.length);
  data.set(kw);
  data[kw.length] = 0; // null separator
  data.set(tx, kw.length + 1);
  return makePngChunk('tEXt', data);
}

/**
 * Strip all existing character card chunks (tEXt with 'chara', 'ccv3', or
 * 'character_card' keywords) from a PNG byte array.
 * Returns cleaned bytes and the position of the IEND chunk.
 */
function stripCardChunks(data) {
  if (data.length < 8) throw new Error('Not a valid PNG');
  for (let i = 0; i < 8; i++) {
    if (data[i] !== PNG_SIGNATURE[i]) throw new Error('Not a valid PNG');
  }

  const out = [data.slice(0, 8)]; // PNG signature
  let offset = 8;
  let iendPos = -1;

  while (offset < data.length) {
    if (offset + 12 > data.length) break;

    const view = new DataView(data.buffer, data.byteOffset + offset);
    const length = view.getUint32(0, false);
    if (length < 0 || offset + 12 + length > data.length) break;

    const type = String.fromCharCode(
      data[offset + 4], data[offset + 5], data[offset + 6], data[offset + 7]
    );
    const chunkTotal = 4 + 4 + length + 4;

    if (type === 'IEND') {
      iendPos = out.reduce((acc, b) => acc + b.length, 0);
    }

    // Drop tEXt chunks that carry card data (we'll write a fresh ccv3 chunk)
    if (type === 'tEXt') {
      const kw = new TextDecoder().decode(data.slice(offset + 8, offset + 8 + Math.min(20, length)));
      const nullIdx = kw.indexOf('\0');
      const keyword = (nullIdx >= 0 ? kw.slice(0, nullIdx) : kw).toLowerCase();
      if (keyword === 'chara' || keyword === 'ccv3' || keyword === 'character_card') {
        offset += chunkTotal;
        continue;
      }
    }

    out.push(data.slice(offset, offset + chunkTotal));
    offset += chunkTotal;

    if (type === 'IEND') break;
  }

  return { cleaned: out, iendPos };
}

// ── Public write API ─────────────────────────────────────────────────────────

/**
 * Inject V3 character data into a PNG image blob.
 * Returns a new Blob with the ccv3 tEXt chunk inserted before IEND.
 *
 * @param {Blob} imageBlob  — source PNG image
 * @param {object} appChar  — app internal character object (camelCase)
 * @returns {Promise<Blob>}
 */
export async function createPng(imageBlob, appChar) {
  const v3spec = toV3Spec(appChar);
  const jsonStr = JSON.stringify(v3spec);

  // base64-encode: library's Base64.encode handles UTF-8 correctly
  const b64 = btoa(unescape(encodeURIComponent(jsonStr)));

  const arrayBuffer = await imageBlob.arrayBuffer();
  const data = new Uint8Array(arrayBuffer);

  let cleaned, iendPos;
  try {
    ({ cleaned, iendPos } = stripCardChunks(data));
  } catch {
    // Not a valid PNG — fall back to canvas re-encode
    return await createPngFromCanvas(imageBlob, b64);
  }

  if (iendPos < 0) {
    return await createPngFromCanvas(imageBlob, b64);
  }

  const ccv3Chunk = makeTextChunk(CCv3_KEYWORD, b64);

  // Rebuild: everything before IEND + ccv3 chunk + IEND
  const parts = [];
  let pos = 0;
  for (const part of cleaned) {
    if (pos === iendPos) parts.push(ccv3Chunk);
    parts.push(part);
    pos += part.length;
  }

  const totalLen = parts.reduce((acc, p) => acc + p.length, 0);
  const result = new Uint8Array(totalLen);
  let off = 0;
  for (const p of parts) { result.set(p, off); off += p.length; }

  return new Blob([result], { type: 'image/png' });
}

/**
 * Fallback: draw image onto canvas, re-encode as PNG, then inject chunk.
 * Used when the source image is a JPEG, WebP, or corrupt PNG.
 */
async function createPngFromCanvas(imageBlob, b64) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(imageBlob);
    img.onload = async () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 400;
        canvas.height = img.naturalHeight || 400;
        canvas.getContext('2d').drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        canvas.toBlob(async (pngBlob) => {
          try {
            // Canvas always produces a valid PNG — no need for fallback here
            const ab = await pngBlob.arrayBuffer();
            const data = new Uint8Array(ab);
            const { cleaned, iendPos } = stripCardChunks(data);
            const ccv3Chunk = makeTextChunk(CCv3_KEYWORD, b64);
            const parts = [];
            let pos = 0;
            for (const part of cleaned) {
              if (pos === iendPos) parts.push(ccv3Chunk);
              parts.push(part);
              pos += part.length;
            }
            const totalLen = parts.reduce((acc, p) => acc + p.length, 0);
            const result = new Uint8Array(totalLen);
            let off = 0;
            for (const p of parts) { result.set(p, off); off += p.length; }
            resolve(new Blob([result], { type: 'image/png' }));
          } catch (err) { reject(err); }
        }, 'image/png');
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load image')); };
    img.src = url;
  });
}

/**
 * Trigger a browser download of a character card PNG.
 */
export function download(blob, characterName) {
  const safeName = (characterName || 'character').replace(/[^a-zA-Z0-9\s_-]/g, '').trim() || 'character';
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeName}_card.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}
