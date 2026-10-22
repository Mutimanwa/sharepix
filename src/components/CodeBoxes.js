import React from 'react';
import { StyleSheet, TextInput } from 'react-native';
import { colors } from '../theme';

/**
 * Champ visible de code d'invitation.
 *
 * L'ancienne version dessinait des cases puis superposait un TextInput invisible.
 * Plusieurs claviers Android ne donnaient pas le focus à ce champ transparent
 * dans une Modal : on utilise désormais un vrai TextInput visible et tactile.
 */
export default function CodeBoxes({ value, onChange, length = 8, autoFocus = false }) {
  return (
    <TextInput
      value={value}
      onChangeText={(text) => onChange(text.replace(/[^A-Za-z0-9]/g, '').slice(0, length).toUpperCase())}
      placeholder="AB12CD34"
      placeholderTextColor="#9AABAB"
      autoCapitalize="characters"
      autoCorrect={false}
      keyboardType="default"
      maxLength={length}
      autoFocus={autoFocus}
      showSoftInputOnFocus
      selectTextOnFocus={false}
      accessibilityLabel="Code d’invitation à huit caractères"
      style={styles.input}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    marginVertical: 16,
    height: 52,
    borderWidth: 1.5,
    borderColor: colors.teal,
    borderRadius: 12,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    color: colors.tealDark,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 5,
    includeFontPadding: false,
  },
});
