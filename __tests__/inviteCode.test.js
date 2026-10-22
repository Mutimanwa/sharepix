// Tests de la génération des codes d'invitation (P1-10).
//
// Objectif : garantir les propriétés qui font d'un code une clé d'accès
// correcte — longueur, alphabet, absence de biais, déterminisme de la
// fonction pure — et vérifier que `generateInviteCode` tire bien ses octets
// d'une source cryptographique (et non plus de `Math.random`).
//
// Fonctionne sans appareil : `expo-crypto` est remplacé par un double.

jest.mock('expo-crypto', () => {
  const { randomBytes } = require('crypto');
  let uuidCounter = 0;
  return {
    __esModule: true,
    getRandomValues: (arr) => {
      randomBytes(arr.length).copy(Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength));
      return arr;
    },
    randomUUID: () => `00000000-0000-4000-8000-${String(++uuidCounter).padStart(12, '0')}`,
  };
});

const {
  codeFromBytes,
  generateInviteCode,
  randomId,
  INVITE_ALPHABET,
  INVITE_LENGTH,
  extractInviteCode,
} = require('../src/lib/inviteCode');

describe('alphabet', () => {
  it('contient 32 caractères, puissance de deux (pas de biais modulo)', () => {
    expect(INVITE_ALPHABET).toHaveLength(32);
    expect(INVITE_ALPHABET.length & (INVITE_ALPHABET.length - 1)).toBe(0);
  });

  it('exclut les caractères ambigus à la saisie (I, O, 0, 1)', () => {
    for (const ambiguous of ['I', 'O', '0', '1']) {
      expect(INVITE_ALPHABET).not.toContain(ambiguous);
    }
  });
});

describe('codeFromBytes', () => {
  it('produit 8 caractères tous issus de l’alphabet', () => {
    const code = codeFromBytes([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(code).toHaveLength(INVITE_LENGTH);
    for (const ch of code) expect(INVITE_ALPHABET).toContain(ch);
  });

  it('est déterministe : mêmes octets → même code', () => {
    const bytes = [12, 200, 7, 255, 33, 99, 4, 61];
    expect(codeFromBytes(bytes)).toBe(codeFromBytes(bytes));
  });

  it('couvre les 32 positions pour les 256 valeurs d’octet possibles', () => {
    // 256 / 32 = 8 : chaque caractère doit être atteignable exactement
    // 8 fois. Si un caractère manquait, le code serait biaisé.
    const hits = new Map();
    for (let b = 0; b < 256; b += 1) {
      const ch = codeFromBytes([b], 1);
      hits.set(ch, (hits.get(ch) || 0) + 1);
    }
    expect(hits.size).toBe(INVITE_ALPHABET.length);
    for (const count of hits.values()) expect(count).toBe(8);
  });

  it('respecte une longueur personnalisée', () => {
    expect(codeFromBytes([9, 9, 9, 9], 4)).toHaveLength(4);
    expect(codeFromBytes([9], 12)).toHaveLength(12);
  });

  it('rejette une source vide', () => {
    expect(() => codeFromBytes([], 8)).toThrow();
    expect(() => codeFromBytes(null, 8)).toThrow();
  });
});

describe('generateInviteCode', () => {
  it('renvoie un code valide de 8 caractères', () => {
    for (let i = 0; i < 200; i += 1) {
      const code = generateInviteCode();
      expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);
    }
  });

  it('ne se répète pas : 500 tirages doivent être distincts', () => {
    const seen = new Set();
    for (let i = 0; i < 500; i += 1) seen.add(generateInviteCode());
    // 40 bits d'entropie : une collision sur 500 tirages serait le signe
    // d'une source déterministe (bug de `Math.random` remplacé par un
    // générateur figé, surcharge incorrecte de `getRandomValues`…).
    expect(seen.size).toBe(500);
  });
});

describe('randomId', () => {
  it('renvoie un identifiant non vide et unique', () => {
    const a = randomId();
    const b = randomId();
    expect(typeof a).toBe('string');
    expect(a.length).toBeGreaterThan(8);
    expect(a).not.toBe(b);
  });
});

describe('extractInviteCode', () => {
  it('accepte un code brut et le normalise en majuscules', () => {
    expect(extractInviteCode('ab12cd34')).toBe('AB12CD34');
  });

  it('extrait le code des liens d’invitation SharePix', () => {
    expect(extractInviteCode('sharepix://join?code=AB12CD34')).toBe('AB12CD34');
    expect(extractInviteCode('https://sharepix.app/join?code=EF56GH78')).toBe('EF56GH78');
  });

  it('rejette les codes invalides et les liens d’autres domaines', () => {
    expect(extractInviteCode('AB12')).toBeNull();
    expect(extractInviteCode('https://example.com/join?code=AB12CD34')).toBeNull();
  });
});
