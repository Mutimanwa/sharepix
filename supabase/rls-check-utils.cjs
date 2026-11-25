const NETWORK_ERROR = /fetch failed|ECONNREFUSED|ECONNRESET|ENOTFOUND|ETIMEDOUT|socket hang up|network|aborted|terminated/i;
const ACCESS_DENIED = /row[- ]level security|permission denied|not authorized|unauthorized|insufficient privilege|access denied|forbidden/i;

function errorFields(error) {
  return {
    name: String(error?.name || ''),
    code: String(error?.code || ''),
    status: Number(error?.status || error?.statusCode || 0),
    message: String(error?.message || error?.error || '').trim(),
    cause: String(error?.cause?.message || '').trim(),
  };
}

function isNetworkFailure(error) {
  const fields = errorFields(error);
  return NETWORK_ERROR.test(`${fields.name} ${fields.message} ${fields.cause}`);
}

function isPermissionDenied(error) {
  const fields = errorFields(error);
  return fields.code === '42501' || fields.status === 403 || ACCESS_DENIED.test(fields.message);
}

// Storage intentionally masks inaccessible objects as HTTP 400 NoSuchKey,
// rather than revealing whether another user's object exists.
function isStorageObjectHidden(error) {
  const fields = errorFields(error);
  return fields.status === 400 && fields.code === 'NoSuchKey';
}

function describeError(error) {
  const fields = errorFields(error);
  const details = [];
  if (fields.name) details.push(fields.name);
  if (fields.status) details.push(`HTTP ${fields.status}`);
  if (fields.code) details.push(`code ${fields.code}`);
  if (fields.message) details.push(fields.message.slice(0, 100));
  if (fields.cause && fields.cause !== fields.message) details.push(`cause: ${fields.cause.slice(0, 100)}`);
  if (details.length === 0) return 'détails d’erreur absents';
  if (details.length === 1 && fields.name) details.push('message et code absents');
  return details.join('; ');
}

module.exports = { describeError, isNetworkFailure, isPermissionDenied, isStorageObjectHidden };
