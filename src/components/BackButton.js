import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../theme';

export default function BackButton({ onPress, variant = 'back', style = {} }) {
  return (
    <TouchableOpacity 
      onPress={onPress} 
      style={[styles.hit, style]} 
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      activeOpacity={0.75}
    >
      <Text style={styles.icon}>{variant === 'close' ? '✕' : '←'}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  hit: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 24,
    color: colors.tealDark,
    fontWeight: '400',
  },
});