import React, { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Dimensions,
  Alert,
  TextInput
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  ArrowLeft01Icon,
  EyeIcon,
  EyeOffIcon,
  LockPasswordIcon,
  Mail01Icon,
  UserIcon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';

import {
  signInWithEmail,
  signUpWithEmail,
  signInWithGoogle,
  translateAuthError,
} from '../services/auth';
// ── SUPABASE ALBUMS : intégration ──
// Conversion invité → compte permanent (même identité, données conservées)
import { convertAnonymousUser, linkGoogleIdentity } from '../services/auth';
// ── SUPABASE ALBUMS : fin ──
import { colors } from '../theme';
import { GoogleMark, LogoImage } from '../components/UI';
import { useStore } from '../store';
import { isSupabaseConfigured } from '../config';

const { height } = Dimensions.get('window');

// Rediriger les appels OAuth vers l'application
WebBrowser.maybeCompleteAuthSession();

function PremiumInput({ label, icon, ...props }) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={styles.inputContainer}>
      <View
        style={[
          styles.inputWrapper,
          isFocused && styles.inputWrapperFocused,
        ]}
      >
        {icon && (
          <HugeiconsIcon
            icon={icon}
            size={20}
            color={isFocused ? colors.teal : '#9CA3AF'}
            style={styles.inputIcon}
          />
        )}
        <TextInput
          placeholderTextColor={colors.muted}
          style={styles.input}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...props}
        />
        {props.rightElement && props.rightElement}
      </View>
    </View>
  );
}

export default function AuthScreen({ navigation, route }) {
  // ── SUPABASE ALBUMS : intégration ──
  // Mode « conversion » : ouvert depuis le profil avec { mode: 'convert' }
  // quand l'utilisateur a un compte invité. Deux choix offerts :
  //  - onglet inscription (défaut) : LIAISON du compte invité (Google ou
  //    email, même id conservé → aucune donnée perdue) ;
  //  - onglet connexion : connexion normale à un compte existant.
  const convertMode = route?.params?.mode === 'convert';
  // ── SUPABASE ALBUMS : fin ──
  const [mode, setMode] = useState(convertMode ? 'register' : 'login');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [needsEmailConfirm, setNeedsEmailConfirm] = useState(false);

  const insets = useSafeAreaInsets();
  const { setAuthUser } = useStore();
  const isLogin = mode === 'login';
  // ── SUPABASE ALBUMS : intégration ──
  // converting = onglet inscription actif dans le mode conversion
  const converting = convertMode && !isLogin;
  // ── SUPABASE ALBUMS : fin ──

  const validate = () => {
    setError('');
    setNeedsEmailConfirm(false);
    
    if (!email.trim()) {
      setError('Veuillez entrer votre adresse email.');
      return false;
    }
    if (!email.includes('@')) {
      setError('Veuillez entrer une adresse email valide.');
      return false;
    }
    if (!password) {
      setError('Veuillez entrer votre mot de passe.');
      return false;
    }
    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.');
      return false;
    }
    if (!isLogin && !firstName.trim()) {
      setError('Veuillez entrer votre prénom.');
      return false;
    }
    return true;
  };

  const handleEmailAuth = async () => {
    if (!validate()) return;
    if (!isSupabaseConfigured) {
      setError('Supabase n\'est pas configuré. Vérifie les clés dans config.js');
      return;
    }

    setLoading(true);
    setError('');
    setNeedsEmailConfirm(false);

    try {
      console.log('🔐 Auth START:', isLogin ? 'login' : 'signup');
      
      let result;
      // ── SUPABASE ALBUMS : intégration ──
      // Onglet inscription en mode conversion : liaison du compte invité
      // (updateUser conserve le même id → albums/photos préservés).
      // Onglet connexion : connexion normale à un compte existant.
      if (converting) {
        result = await convertAnonymousUser(email, password, { firstName, lastName });
      } else
      // ── SUPABASE ALBUMS : fin ──
      if (isLogin) {
        result = await signInWithEmail(email, password);
      } else {
        result = await signUpWithEmail(email, password, { firstName, lastName });
      }

      if (result.needsEmailConfirm) {
        setNeedsEmailConfirm(true);
        setError('Compte créé. Vérifiez votre email pour confirmer votre inscription.');
        console.log('📧 Email confirmation required');
        setLoading(false);
        return;
      }

      if (result.user) {
        console.log('✅ Auth SUCCESS:', result.user.email);
        setAuthUser(result.user);
        navigation.replace('Main');
      } else {
        setError('Une erreur est survenue. Veuillez réessayer.');
        console.log('❌ Auth: No user returned');
      }
    } catch (err) {
      const translated = translateAuthError(err);
      setError(translated);
      console.log('❌ Auth ERROR:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    if (!isSupabaseConfigured) {
      setError('Supabase n\'est pas configuré.');
      return;
    }

    setGoogleLoading(true);
    setError('');
    setNeedsEmailConfirm(false);

    try {
      console.log('🔐 Google Auth START');
      
      // ── SUPABASE ALBUMS : intégration ──
      // Onglet inscription en mode conversion : on LIE Google au compte
      // invité (linkIdentity, même id → rien n'est perdu). Onglet
      // connexion (ou écran normal) : connexion Google classique.
      const result = converting ? await linkGoogleIdentity() : await signInWithGoogle();
      // ── SUPABASE ALBUMS : fin ──
      
      if (result.success) {
        console.log('✅ Google Auth success, waiting for session...');
        // La session sera restaurée automatiquement
        // On navigue après un court délai
        setTimeout(() => {
          navigation.replace('Main');
        }, 1500);
      }
    } catch (err) {
      const translated = translateAuthError(err);
      setError(translated);
      console.log('❌ Google Auth ERROR:', err.message);
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />

      <KeyboardAvoidingView
        style={[styles.keyboard, { paddingBottom: insets.bottom }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scroll}
        >
          {/* Header */}
          <View style={styles.header}>
            <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
              <HugeiconsIcon icon={ArrowLeft01Icon} size={24} color={colors.tealDark} />
            </Pressable>
          </View>

          {/* Logo */}
          <View style={styles.brandContainer}>
            <LogoImage size={80} />
          </View>

          {/* Hero Text */}
          <View style={styles.heroSection}>
            <Text style={styles.title}>
              {/* ── SUPABASE ALBUMS : intégration ── */}
              {converting
                ? 'Sécurisez vos souvenirs.'
                : isLogin
                  ? 'Partagez, Découvrez, Revivez.'
                  : 'Rejoignez l\'aventure SharePix.'}
            </Text>
            <Text style={styles.subtitle}>
              {converting
                ? 'Liez votre compte Google ou ajoutez un email à votre compte invité : vos albums sont conservés.'
                : convertMode
                  ? 'Vous avez déjà un compte ? Connectez-vous. Attention : le compte invité actuel sera abandonné.'
                  : isLogin
                    ? 'Connectez-vous pour retrouver vos souvenirs.'
                    : 'Créez un compte pour partager vos moments.'}
            </Text>
            {/* ── SUPABASE ALBUMS : fin ── */}
          </View>

          {/* Google Button */}
          {/* ── SUPABASE ALBUMS : intégration ── */}
          {/* En mode conversion, ce bouton LIE Google au compte invité (voir handleGoogle) */}
          {/* ── SUPABASE ALBUMS : fin ── */}
          <Pressable
            style={[styles.googleButton, googleLoading && styles.disabled]}
            onPress={handleGoogle}
            disabled={googleLoading || loading}
          >
            {googleLoading ? (
              <ActivityIndicator color={colors.muted} />
            ) : (
              <>
                <View style={styles.googleIcon}>
                  <GoogleMark size={20} />
                </View>
                <Text style={styles.googleText}>Continuer avec Google</Text>
              </>
            )}
          </Pressable>

          {/* Separator */}
          <View style={styles.separator}>
            <View style={styles.line} />
            {/* ── SUPABASE ALBUMS : intégration ── */}
            <Text style={styles.separatorText}>
              {converting ? 'Ou avec un email et mot de passe' : 'Ou connectez-vous avec'}
            </Text>
            {/* ── SUPABASE ALBUMS : fin ── */}
            <View style={styles.line} />
          </View>

          {/* Formulaire */}
          <View style={styles.formContainer}>
            {!isLogin && (
              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <PremiumInput
                    icon={UserIcon}
                    placeholder="Prénom"
                    value={firstName}
                    onChangeText={setFirstName}
                    autoCapitalize="words"
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <PremiumInput
                    icon={UserIcon}
                    placeholder="Nom"
                    value={lastName}
                    onChangeText={setLastName}
                    autoCapitalize="words"
                  />
                </View>
              </View>
            )}

            <PremiumInput
              icon={Mail01Icon}
              placeholder="Entrez votre email..."
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <PremiumInput
              icon={LockPasswordIcon}
              placeholder="Votre mot de passe..."
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              rightElement={
                <Pressable onPress={() => setShowPassword(!showPassword)} hitSlop={15}>
                  <HugeiconsIcon 
                    icon={showPassword ? EyeOffIcon : EyeIcon} 
                    size={20} 
                    color="#9CA3AF" 
                  />
                </Pressable>
              }
            />

            {/* Error Box */}
            {!!error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Email Confirmation Info */}
            {needsEmailConfirm && (
              <View style={[styles.errorBox, styles.confirmBox]}>
                <Text style={styles.confirmText}>
                  📧 Un email de confirmation vous a été envoyé. 
                  Vérifiez votre boîte de réception (et vos spams) pour activer votre compte.
                </Text>
              </View>
            )}

            {/* Submit Button */}
            <Pressable
              style={[styles.submitButton, (loading || googleLoading) && styles.disabled]}
              onPress={handleEmailAuth}
              disabled={loading || googleLoading || needsEmailConfirm}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitText}>
                  {/* ── SUPABASE ALBUMS : intégration ── */}
                  {converting
                    ? 'Sécuriser mon compte invité'
                    : isLogin
                      ? 'Se connecter à SharePix'
                      : 'S\'inscrire sur SharePix'}
                  {/* ── SUPABASE ALBUMS : fin ── */}
                </Text>
              )}
            </Pressable>
          </View>

          {/* Switch */}
          {/* ── SUPABASE ALBUMS : intégration ── */}
          {/* En mode conversion, ce lien offre le 2e choix : connexion à un compte existant */}
          {/* ── SUPABASE ALBUMS : fin ── */}
          <Pressable
            style={styles.switchContainer}
            onPress={() => {
              setError('');
              setNeedsEmailConfirm(false);
              setMode(isLogin ? 'register' : 'login');
            }}
          >
            <Text style={styles.switchText}>
              {isLogin ? 'Pas encore de compte ? ' : 'Déjà un compte ? '}
              <Text style={styles.switchAction}>{isLogin ? 'S\'inscrire' : 'Se connecter'}</Text>
            </Text>
          </Pressable>

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.white,
  },
  keyboard: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 40,
    minHeight: height,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cream,
  },
  brandContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroSection: {
    marginVertical: 10,
  },
  title: {
    color: colors.tealDark,
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  subtitle: {
    color: '#9CA3AF',
    fontSize: 13,
    lineHeight: 24,
    marginTop: 5,
    fontWeight: '500',
    textAlign: 'center',
  },
  googleButton: {
    height: 45,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.tealDark,
    borderRadius: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleIcon: {
    marginRight: 12,
  },
  googleText: {
    color: colors.tealDark,
    fontSize: 16,
    fontWeight: '500',
  },
  separator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  separatorText: {
    marginHorizontal: 10,
    fontSize: 12,
    fontWeight: '500',
    color: '#9CA3AF',
  },
  formContainer: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
  },
  inputContainer: {
    marginBottom: 0,
  },
  inputWrapper: {
    height: 45,
    backgroundColor: 'transparent',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputWrapperFocused: {
    borderColor: colors.teal,
  },
  inputIcon: {
    marginRight: 15,
  },
  input: {
    flex: 1,
    color: colors.muted,
    fontSize: 16,
    height: '100%',
    paddingLeft: 10,
  },
  submitButton: {
    height: 45,
    borderRadius: 5,
    backgroundColor: colors.tealDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.6,
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderLeftWidth: 3,
    borderLeftColor: '#EF4444',
    padding: 12,
    borderRadius: 8,
    marginVertical: 4,
  },
  errorText: {
    color: '#F87171',
    fontSize: 13,
    fontWeight: '500',
  },
  confirmBox: {
    backgroundColor: 'rgba(52, 211, 153, 0.1)',
    borderLeftColor: '#34D399',
  },
  confirmText: {
    color: '#6EE7B7',
    fontSize: 13,
    fontWeight: '500',
  },
  switchContainer: {
    marginTop: 32,
    alignItems: 'center',
  },
  switchText: {
    color: '#9CA3AF',
    fontSize: 15,
  },
  switchAction: {
    color: colors.tealDark,
    fontWeight: '700',
  },
});