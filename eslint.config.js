// Configuration ESLint « flat » (ESLint 9) basée sur les règles Expo SDK 57.
// Lancer : npm run lint   (ou npx eslint . --fix)
const expoConfig = require('eslint-config-expo/flat');
const { defineConfig } = require('eslint/config');

module.exports = defineConfig([
  expoConfig,
  {
    // Fichiers générés / hors périmètre applicatif.
    ignores: [
      'node_modules/**',
      'dist/**',
      'web-build/**',
      '.expo/**',
      'supabase/migrations/**',
      'assets/**',
    ],
  },
  {
    files: ['**/*.js', '**/*.jsx'],
    rules: {
      // Le projet est en JS non typé : les props manquantes sont couvertes par
      // des valeurs par défaut, pas par PropTypes.
      'react/prop-types': 'off',
      'react-hooks/exhaustive-deps': 'warn',
      'no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          caughtErrors: 'none',
          // `const { user, authChecked, ...toPersist } = state` : destructuration
          // volontaire pour EXCLURE des champs de la persistance.
          ignoreRestSiblings: true,
        },
      ],

      // ── Règles du React Compiler, inadaptées à cette base ────────────────
      // Ce projet n'active pas le React Compiler d'Expo : ces règles
      // signalent des motifs qui ne posent problème QUE sous compilation
      // automatique, et produisent ici des faux positifs massifs.
      //
      // `refs` (50 occurrences) : React Native stocke les valeurs animées dans
      // `useRef(new Animated.Value(0)).current` — motif officiel de la doc
      // Animated. La règle ne distingue pas un `Animated.Value` d'un ref DOM
      // et interdit son `.interpolate()` pendant le rendu, alors que c'est
      // précisément l'usage attendu.
      'react-hooks/refs': 'off',
      // `set-state-in-effect` : les resets d'état sur changement d'identité
      // (photo courante, prop `visible`) sont des synchronisations
      // volontaires, pas des cascades accidentelles.
      'react-hooks/set-state-in-effect': 'off',
      // Ne concerne que la préservation des mémoïsations par le compilateur.
      'react-hooks/preserve-manual-memoization': 'off',

      // L'interface est entièrement en français : les apostrophes et
      // guillemets typographiques dans le texte JSX sont normaux.
      'react/no-unescaped-entities': 'off',
    },
  },
  {
    // Tests : les globals Jest ne sont pas fournis par le preset Expo.
    files: ['__tests__/**/*.js', '**/*.test.js'],
    languageOptions: {
      globals: {
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        jest: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        // Environnement Node de Jest
        Buffer: 'readonly',
        process: 'readonly',
      },
    },
  },
  {
    // Scripts Node (CI, outillage Supabase) : globals absents du preset Expo.
    files: ['*.config.js', '.eslintrc*', 'supabase/**/*.cjs', 'supabase/**/*.js', 'scripts/**/*.js'],
    languageOptions: {
      globals: {
        module: 'writable',
        require: 'readonly',
        process: 'readonly',
        __dirname: 'readonly',
        Buffer: 'readonly',
        console: 'readonly',
      },
    },
  },
]);
