// @ts-check
// ── Codes d'invitation et identifiants locaux ──────────────────────────
//
// ── P1-10 : pourquoi ce module existe ──────────────────────────────────
// Les codes d'invitation étaient tirés avec `Math.random()`. Ce générateur
// n'est pas cryptographique : sa suite peut être reconstruite à partir de
// quelques sorties, et un code d'invitation EST la clé d'accès à un album.
// Qui le devine entre dans l'album.
//
// On utilise désormais `expo-crypto` (Crypto.getRandomValues), qui puise
// dans le générateur du système.
//
// ── Choix de l'alphabet ────────────────────────────────────────────────
// 32 caractères, sans I, O, 0 et 1 (confusions à la saisie).
// 32 est une puissance de deux : 256 / 32 = 8 exactement, donc l'octet
// modulo 32 est uniforme. Aucun rejet, aucun biais statistique.
//
// 8 caractères × log2(32) = 40 bits. C'est le format affiché aux
// utilisateurs et celui attendu par la contrainte SQL `char_length = 8`.

import * as Crypto from 'expo-crypto';

export const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const INVITE_LENGTH = 8;

/**
 * Transforme des octets aléatoires en code lisible.
 * Fonction pure : c'est elle que les tests exercent, sans dépendance native.
 */
export function codeFromBytes(bytes, length = INVITE_LENGTH) {
  if (!bytes || bytes.length === 0) throw new Error('octets aléatoires requis');
  let code = '';
  for (let i = 0; i < length; i += 1) {
    // INVITE_ALPHABET.length === 32 → répartition uniforme
    code += INVITE_ALPHABET[bytes[i % bytes.length] % INVITE_ALPHABET.length];
  }
  return code;
}

/** Code d'invitation à 8 caractères, cryptographiquement sûr. */
export function generateInviteCode(length = INVITE_LENGTH) {
  const bytes = Crypto.getRandomValues(new Uint8Array(length));
  return codeFromBytes(bytes, length);
}

/** Identifiant local (photo ajoutée hors-ligne, entrée temporaire). */
export function randomId() {
  // randomUUID est disponible dans expo-crypto ; repli sur des octets.
  if (typeof Crypto.randomUUID === 'function') return Crypto.randomUUID();
  const bytes = Crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
