import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Modal,
  Pressable,
} from 'react-native';
import { colors } from '../theme';

export function Logo({ size = 42, color = colors.ink }) {
  return (
    <Text style={{ fontSize: size, color, fontFamily: 'Georgia', fontStyle: 'italic', fontWeight: '500' }}>
      SharePix
    </Text>
  );
}

export function LogoImage({ size = 42 }) {
  return (
    <Image source={require('../../assets/sharepix-logo.png')} style={{ width: size, height: size }} />
  );
}


export function CoralButton({ title, onPress, disabled, color = colors.coral, textColor = '#fff' }) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.btn,
        { backgroundColor: disabled ? '#E4E4E7' : color },
      ]}
    >
      <Text style={[styles.btnText, { color: disabled ? '#fff' : textColor }]}>{title}</Text>
    </TouchableOpacity>
  );
}

export function OutlinePill({ title, onPress, icon }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.pill} activeOpacity={0.8}>
      <Text style={styles.pillText}>
        {icon} {title}
      </Text>
    </TouchableOpacity>
  );
}

export function Field({ label, value, onChangeText, placeholder, autoFocus }) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        autoFocus={autoFocus}
        style={styles.input}
        placeholderTextColor="#B0B0B0"
      />
    </View>
  );
}

export function Sheet({ visible, onClose, title, children }) {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.sheetWrap}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHead}>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Text style={{ fontSize: 22 }}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.sheetTitle}>{title}</Text>
            <View style={{ width: 22 }} />
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 54,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 6,
  },
  btnText: { fontSize: 17, fontWeight: '600' },
  pill: {
    borderWidth: 1,
    borderColor: '#D8D8D8',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  pillText: { fontSize: 15, fontWeight: '500', color: colors.ink },
  label: { fontSize: 15, color: colors.muted, marginBottom: 8 },
  input: {
    borderWidth: 1.5,
    borderColor: '#111',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 17,
    backgroundColor: '#fff',
  },
  sheetWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingBottom: 28,
    paddingTop: 8,
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  sheetTitle: { fontSize: 18, fontWeight: '600' },
});
