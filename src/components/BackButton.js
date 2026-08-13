import React from 'react';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { ArrowLeft01Icon, Cancel01Icon } from '@hugeicons/core-free-icons';
import { colors } from '../theme';

export default function BackButton({ onPress, variant = 'back' }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.hit} hitSlop={12} activeOpacity={0.75}>
      <View style={styles.circle}>
        <HugeiconsIcon
          icon={variant === 'close' ? Cancel01Icon : ArrowLeft01Icon}
          size={22}
          color={colors.tealDark}
        />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  hit: { width: 50, height: 50, alignItems: 'center', justifyContent: 'center' },
  circle: {
    backgroundColor: '#8d8c8c61',
    padding: 10,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
