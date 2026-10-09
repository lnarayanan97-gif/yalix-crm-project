/**
 * Deterministic cryptographic and hashing utilities for YALIX CRM import idempotency.
 * Computes deterministic SHA-256 keys for emails, domains, and company identities.
 */

// Synchronous lightweight SHA-256 implementation (works in browser and Node)
export function sha256Sync(str: string): string {
  // Simple, robust SHA-256 implementation
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }

  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let i: number, j: number;
  let result = '';
  const words: number[] = [];
  const asciiBitLength = str.length * 8;

  let hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];

  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  // Encode UTF-8
  const utf8: number[] = [];
  for (let idx = 0; idx < str.length; idx++) {
    let charcode = str.charCodeAt(idx);
    if (charcode < 0x80) utf8.push(charcode);
    else if (charcode < 0x800) {
      utf8.push(0xc0 | (charcode >> 6), 0x80 | (charcode & 0x3f));
    } else if (charcode < 0xd800 || charcode >= 0xe000) {
      utf8.push(0xe0 | (charcode >> 12), 0x80 | ((charcode >> 6) & 0x3f), 0x80 | (charcode & 0x3f));
    } else {
      idx++;
      charcode = 0x10000 + (((charcode & 0x3ff) << 10) | (str.charCodeAt(idx) & 0x3ff));
      utf8.push(
        0xf0 | (charcode >> 18),
        0x80 | ((charcode >> 12) & 0x3f),
        0x80 | ((charcode >> 6) & 0x3f),
        0x80 | (charcode & 0x3f)
      );
    }
  }

  const utf8BitLength = utf8.length * 8;
  utf8.push(0x80);
  while ((utf8.length % 64) !== 56) utf8.push(0);
  for (let k = 0; k < 4; k++) utf8.push(0);
  utf8.push(
    (utf8BitLength >>> 24) & 0xff,
    (utf8BitLength >>> 16) & 0xff,
    (utf8BitLength >>> 8) & 0xff,
    utf8BitLength & 0xff
  );

  for (let b = 0; b < utf8.length; b += 4) {
    words.push((utf8[b] << 24) | (utf8[b + 1] << 16) | (utf8[b + 2] << 8) | utf8[b + 3]);
  }

  for (j = 0; j < words.length; j += 16) {
    const w = words.slice(j, j + 16);
    const oldHash = hash;
    hash = hash.slice(0);

    for (i = 0; i < 64; i++) {
      const s0 = i >= 16 ? rightRotate(w[i - 15], 7) ^ rightRotate(w[i - 15], 18) ^ (w[i - 15] >>> 3) : 0;
      const s1 = i >= 16 ? rightRotate(w[i - 2], 17) ^ rightRotate(w[i - 2], 19) ^ (w[i - 2] >>> 10) : 0;
      if (i >= 16) {
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }

      const S1 = rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25);
      const ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
      const temp1 = (hash[7] + S1 + ch + k[i] + w[i]) | 0;
      const S0 = rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22);
      const maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
      const temp2 = (S0 + maj) | 0;

      hash = [
        (temp1 + temp2) | 0,
        hash[0],
        hash[1],
        hash[2],
        (hash[3] + temp1) | 0,
        hash[4],
        hash[5],
        hash[6],
      ];
    }

    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  for (i = 0; i < 8; i++) {
    for (j = 3; j + 1; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }
  return result;
}

/**
 * Deterministic Contact Document ID derived from normalized business email.
 * Guarantees exact idempotency: same email always maps to identical Firestore Document ID.
 * Format: cnt_<sha256(normalizedEmail)[0..28]> (total length ~32 chars, strictly matching ^[a-zA-Z0-9_\-]+$)
 */
export function generateDeterministicContactId(normalizedEmail: string): string {
  const clean = normalizedEmail.toLowerCase().trim();
  const hash = sha256Sync(clean);
  return 'cnt_' + hash.substring(0, 28);
}

/**
 * Deterministic Company Document ID derived from normalized corporate domain or normalized company name.
 * Format: comp_<sha256(identifier)[0..28]>
 */
export function generateDeterministicCompanyId(domainOrName: string): string {
  const clean = domainOrName.toLowerCase().trim();
  const hash = sha256Sync(clean);
  return 'comp_' + hash.substring(0, 28);
}

/**
 * Deterministic Lead Document ID derived from contact ID + product interest.
 * Guarantees duplicate import runs do not create multiple duplicate leads for the same product!
 */
export function generateDeterministicLeadId(contactId: string, product: string): string {
  const clean = `${contactId}_${product.toLowerCase().trim()}`;
  const hash = sha256Sync(clean);
  return 'ld_' + hash.substring(0, 28);
}
