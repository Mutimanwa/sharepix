import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Modal,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { colors } from '../theme';
import { ArrowLeft01Icon, Cancel01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

export function Logo({ size = 42, color = colors.ink }) {
  return (
    <Text style={{ fontSize: size, color, fontFamily: 'Georgia', fontStyle: 'italic', fontWeight: '500' }}>
      SharePix
    </Text>
  );
}

export function LogoImage({ size = 42 }) {
  return <Image source={require('../../assets/sharepix-logo.png')} style={{ width: size, height: size }} />;
}

// Bouton uniforme avec taille fixe
export function CoralButton({ 
  title, 
  onPress, 
  disabled, 
  color = colors.coral, 
  textColor = '#fff',
  style = {},
  height = 45,
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.btn,
        { 
          backgroundColor: disabled ? '#E4E4E7' : color,
          height: height,
        },
        style,
      ]}
    >
      <Text style={[styles.btnText, { color: disabled ? '#fff' : textColor }]}>{title}</Text>
    </TouchableOpacity>
  );
}

// Bouton plus petit pour les actions secondaires
export function SmallButton({ 
  title, 
  onPress, 
  disabled, 
  color = colors.teal, 
  textColor = '#fff',
  style = {},
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.smallBtn,
        { 
          backgroundColor: disabled ? '#E4E4E7' : color,
        },
        style,
      ]}
    >
      <Text style={[styles.smallBtnText, { color: disabled ? '#fff' : textColor }]}>{title}</Text>
    </TouchableOpacity>
  );
}

export function OutlinePill({ title, onPress, icon, style = {} }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.pill, style]} activeOpacity={0.8}>
      <Text style={styles.pillText}>
        {icon} {title}
      </Text>
    </TouchableOpacity>
  );
}

export function Field({ label, value, onChangeText, placeholder, autoFocus, secureTextEntry, style = {} }) {
  return (
    <View style={[styles.fieldContainer, style]}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        autoFocus={autoFocus}
        secureTextEntry={secureTextEntry}
        style={styles.input}
        placeholderTextColor="#B0B0B0"
      />
    </View>
  );
}

// Sheet avec gestion du clavier
export function Sheet({ 
  visible, 
  onClose, 
  title, 
  children,
  keyboardVerticalOffset = Platform.OS === 'ios' ? 0 : 0,
}) {
  const scrollRef = useRef(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible) {
      // Reset scroll quand le sheet s'ouvre
      setTimeout(() => {
        scrollRef.current?.scrollTo({ y: 0, animated: false });
      }, 100);
    }
  }, [visible]);

  return (
    <Modal visible={visible} style={[insets.bottom]} animationType="slide" transparent>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.sheetWrap}
        keyboardVerticalOffset={keyboardVerticalOffset}
      >
        <Pressable style={styles.sheetOverlay} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.sheetHead}>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Text style={{ fontSize: 22 }}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.sheetTitle}>{title}</Text>
            <View style={{ width: 22 }} />
          </View>
          <ScrollView 
            ref={scrollRef}
            style={styles.sheetContent}
            contentContainerStyle={styles.sheetContentContainer}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            scrollEnabled={true}
          >
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// Page avec SafeArea par défaut
export function Page({ children, style = {}, edges = ['top', 'left', 'right'] }) {
  return (
    <SafeAreaView style={[styles.page, style]} edges={edges}>
      {children}
    </SafeAreaView>
  );
}

// Header de page avec bouton retour uniforme
export function PageHeader({ 
  title, 
  onBack, 
  rightComponent = null,
  backVariant = 'back',
}) {
  return (
    <View style={styles.pageHeader}>
      <TouchableOpacity 
        onPress={onBack} 
        style={styles.headerButton} 
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        activeOpacity={0.75}
      >
        <Text style={styles.headerBackText}>{backVariant === 'close' ? '✕' : '←'}</Text>
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={styles.headerRight}>
        {rightComponent}
      </View>
    </View>
  );
}

// Composant BackButton unifié (pour compatibilité)
export function BackButton({ onPress, variant = 'back', style = {} }) {
  return (
    <TouchableOpacity 
      onPress={onPress} 
      style={[styles.backButton, style]} 
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      activeOpacity={0.75}
    >
      {
        variant === 'close' ? (
           <HugeiconsIcon size={24} color={colors.tealDark} variant="stroke" icon={Cancel01Icon} />
        ) : (
          <HugeiconsIcon size={24} color={colors.tealDark} variant="stroke" icon={ArrowLeft01Icon} />
        )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // Page
  page: {
    flex: 1,
    backgroundColor: '#fff',
  },
  
  // Boutons
  btn: {
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 6,
    paddingHorizontal: 16,
  },
  btnText: {
    fontSize: 17,
    fontWeight: '600',
  },
  smallBtn: {
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    marginVertical: 4,
  },
  smallBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  pill: {
    borderWidth: 1,
    borderColor: '#D8D8D8',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  pillText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.ink,
  },
  
  // Field
  fieldContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 15,
    color: colors.muted,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: 5,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 17,
    backgroundColor: '#fff',
    maxHeight: 45,
  },
  
  // Sheet
  sheetWrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: '85%',
    minHeight: 200,
    paddingTop: 8,
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.tealDark,
  },
  sheetContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  sheetContentContainer: {
    paddingBottom: 30,
  },
  
  // Header
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    minHeight: 50,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBackText: {
    fontSize: 24,
    color: colors.tealDark,
    fontWeight: '400',
  },
  headerTitle: {
    flex: 1,
    fontWeight: '800',
    fontSize: 18,
    color: colors.tealDark,
    textAlign: 'center',
    marginLeft: -40, // Pour centrer avec le bouton retour
  },
  headerRight: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // BackButton
  backButton: {
    // backgroundColor: colors.light,
    borderRadius: 50,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginEnd: 10
  }
});