import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme';
import { reportError } from '../lib/sentry';

/**
 * ── FILET DE SÉCURITÉ (audit P1-14) ──────────────────────────────────────
 * Avant : la moindre exception de rendu (par ex. `user.firstName` sur null
 * dans ProfileScreen) produisait un écran blanc définitif, sans aucun moyen
 * de revenir à l'application.
 *
 * Ici on intercepte l'erreur, on l'affiche en mode développement, et on
 * propose de réessayer sans perdre la session (l'état du store est conservé).
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
    this.reset = this.reset.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Le service de crash est optionnel : `reportError` ne fait rien si
    // aucun DSN n'est configuré (voir src/lib/sentry.js).
    reportError(error, { componentStack: info?.componentStack });
    if (__DEV__) {
      console.error('💥 ErrorBoundary:', error, info?.componentStack);
    }
  }

  reset() {
    this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <View style={styles.root}>
        <Text style={styles.icon}>😕</Text>
        <Text style={styles.title}>Un problème est survenu</Text>
        <Text style={styles.body}>
          L'écran n'a pas pu s'afficher. Vos albums sont conservés.
        </Text>

        {__DEV__ ? (
          <Text style={styles.debug} numberOfLines={6}>
            {String(this.state.error?.message || this.state.error)}
          </Text>
        ) : null}

        <TouchableOpacity style={styles.button} onPress={this.reset} activeOpacity={0.85}>
          <Text style={styles.buttonText}>Réessayer</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    backgroundColor: colors.cream,
  },
  icon: { fontSize: 44, marginBottom: 12 },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.tealDark,
    marginBottom: 8,
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    lineHeight: 21,
    color: colors.muted,
    textAlign: 'center',
    marginBottom: 20,
  },
  debug: {
    fontSize: 11,
    color: '#B5544A',
    textAlign: 'center',
    marginBottom: 20,
    fontFamily: 'monospace',
  },
  button: {
    backgroundColor: colors.coral,
    paddingHorizontal: 28,
    paddingVertical: 13,
    borderRadius: 999,
  },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
