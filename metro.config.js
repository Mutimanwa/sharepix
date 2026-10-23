const { getSentryExpoConfig } = require('@sentry/react-native/metro');

// Aucun Metro config personnalisé n'existait : partir de la config Expo
// standard enrichie par Sentry (Debug IDs/source maps).
module.exports = getSentryExpoConfig(__dirname);
