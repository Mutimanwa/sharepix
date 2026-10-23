// @ts-check

const SENSITIVE_FIELD = /^(?:access_?token|refresh_?token|id_?token|token(?:_?hash)?|authorization|cookie|password|code|client_?secret)$/i;
const SENSITIVE_URL_PARAMETER = /(?:^|[?#&]|%3f|%26)(?:code|access_?token|refresh_?token|id_?token|token(?:_?hash)?)=/i;
const REDACTED = '[donnée d’authentification masquée]';

function isSensitiveUrl(value) {
  const candidates = [value];
  try {
    candidates.push(decodeURIComponent(value.replace(/\+/g, '%20')));
  } catch {
    // La valeur peut être partiellement encodée : la version originale est
    // tout de même vérifiée ci-dessous.
  }

  return candidates.some((candidate) =>
    candidate.toLowerCase().includes('sharepix://') ||
    SENSITIVE_URL_PARAMETER.test(candidate)
  );
}

/**
 * Copie récursivement une valeur en masquant les URL de deep link et les
 * champs d’authentification avant qu’un événement ou breadcrumb soit envoyé.
 * @param {unknown} value
 * @param {WeakMap<object, unknown>} [seen]
 * @param {string} [fieldName]
 * @returns {any}
 */
export function sanitizeSentryData(value, seen = new WeakMap(), fieldName = '') {
  if (SENSITIVE_FIELD.test(fieldName)) return REDACTED;

  if (typeof value === 'string') {
    return isSensitiveUrl(value) ? REDACTED : value;
  }

  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return '[référence circulaire masquée]';

  const output = Array.isArray(value) ? [] : {};
  seen.set(value, output);

  for (const [key, child] of Object.entries(value)) {
    output[key] = sanitizeSentryData(child, seen, key);
  }

  return output;
}
