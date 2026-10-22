/** Classe une URI selon l'API native sûre à utiliser pour l'enregistrer. */
export function classifyPhotoUri(uri) {
  const value = String(uri || '').trim();
  if (/^https?:\/\//i.test(value)) return 'remote';
  if (/^file:\/\//i.test(value)) return 'file';
  if (/^content:\/\//i.test(value)) return 'content';
  return 'unsupported';
}
