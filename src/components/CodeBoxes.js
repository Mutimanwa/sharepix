import React, { useEffect, useRef } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable } from 'react-native';
import { colors } from '../theme';

export default function CodeBoxes({ value, onChange, length = 8, autoFocus = true }) {
  const input = useRef(null);

  useEffect(() => {
    if (autoFocus) {
      const t = setTimeout(() => input.current?.focus(), 280);
      return () => clearTimeout(t);
    }
  }, [autoFocus]);

  const active = Math.min(value.length, length - 1);

  return (
    <Pressable style={styles.wrap} onPress={() => input.current?.focus()}>
      <View style={styles.row}>
        {Array.from({ length }).map((_, k) => (
          <View key={k} style={[styles.box, k === active && styles.boxOn, value[k] && styles.boxFilled]}>
            <Text style={styles.char}>{value[k] || ''}</Text>
            {k === active && !value[k] ? <View style={styles.caret} /> : null}
          </View>
        ))}
      </View>
      <TextInput
        ref={input}
        value={value}
        onChangeText={(t) => onChange(t.replace(/[^A-Za-z0-9]/g, '').slice(0, length).toUpperCase())}
        autoCapitalize="characters"
        autoCorrect={false}
        keyboardType="default"
        maxLength={length}
        caretHidden
        style={styles.hidden}
        importantForAutofill="no"
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { marginVertical: 16 },
  row: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  box: {
    width: 36,
    height: 48,
    borderRadius: 10,
    backgroundColor: '#EEF5F5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  boxOn: {
    borderColor: colors.teal,
    backgroundColor: '#fff',
  },
  boxFilled: {
    backgroundColor: '#fff',
    borderColor: colors.tealDark,
  },
  char: { fontSize: 18, fontWeight: '800', color: colors.tealDark },
  caret: {
    position: 'absolute',
    width: 1.5,
    height: 20,
    backgroundColor: colors.teal,
    borderRadius: 1,
  },
  hidden: {
    position: 'absolute',
    opacity: 0,
    height: 48,
    width: '100%',
  },
});
