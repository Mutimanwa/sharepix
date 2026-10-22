import React, { useState } from 'react';
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
  // ── SUPABASE ALBUMS : intégration ──
  // Conversion invité → compte permanent (même identité, données conservées)
  convertAnonymousUser,
  linkGoogleIdentity,
  requestPasswordReset,
} from '../services/auth';
import { colors } from '../theme';
import LocalDocumentModal from '../components/LocalDocumentModal';
import { PRIVACY_INTRO, PRIVACY_SECTIONS, TERMS_INTRO, TERMS_SECTIONS } from '../data/localInfo';
import { GoogleMark, LogoImage } from '../components/UI';
import { useStore } from '../store';
import { isSupabaseConfigured } from '../config';

const { height } = Dimensions.get('window');

// Rediriger les appels OAuth vers l'application
WebBrowser.maybeCompleteAuthSession();

function PremiumInput({ label: _label, icon, ...props }) {
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
          showSoftInputOnFocus
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
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [legalDocument, setLegalDocument] = useState(null);

  const insets = useSafeAreaInsets();
  const { setAuthUser } = useStore();
  const [resetSending, setResetSending] = useState(false);
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
    if (!isLogin && !acceptedTerms) {
      setError('Veuillez accepter les conditions et la politique de confidentialité.');
      return false;
    }
    return true;
  };

  const validateTermsForGoogle = () => {
    if (!isLogin && !acceptedTerms) {
      setError('Veuillez accepter les conditions et la politique de confidentialité.');
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
        console.log('Email confirmation required');
        setLoading(false);
        return;
      }

      if (result.user) {
        console.log('✅ Auth SUCCESS');
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

  // ── P1-13 : mot de passe oublié ────────────────────────────────────
  // L'envoi se fait à partir de l'email déjà saisi. Message volontairement
  // neutre : on ne révèle pas si l'adresse correspond à un compte.
  const handleForgotPassword = async () => {
    const clean = email.trim();
    if (!clean || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) {
      setError("Saisissez d'abord votre adresse email, puis touchez « Mot de passe oublié ».");
      return;
    }
    setResetSending(true);
    setError('');
    try {
      await requestPasswordReset(clean);
      Alert.alert(
        'Email envoyé',
        `Si un compte existe pour ${clean}, un lien de réinitialisation vient d'être envoyé.`
      );
    } catch (err) {
      setError(translateAuthError(err));
    } finally {
      setResetSending(false);
    }
  };

  const handleGoogle = async () => {
    if (!validateTermsForGoogle()) return;
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
        // ── P1-07 : plus d'attente à l'aveugle ──
        // Avant : navigation après 1,5 s, sans vérifier qu'une session
        // existait — le code PKCE n'ayant jamais été échangé, on arrivait
        // sur l'accueil avec l'ancien compte anonyme.
        // Le service renvoie maintenant l'utilisateur réellement connecté.
        if (result.user) setAuthUser(result.user);
        navigation.replace('Main');
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
          keyboardShouldPersistTaps="always"
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
                <Text style={styles.googleText}>
                  {converting ? 'Lier mon compte Google' : 'Continuer avec Google'}
                </Text>
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

            {isLogin && !converting && (
              <Pressable
                onPress={handleForgotPassword}
                disabled={resetSending}
                hitSlop={10}
                style={styles.forgotRow}
                accessibilityRole="button"
              >
                <Text style={styles.forgotLink}>
                  {resetSending ? 'Envoi en cours…' : 'Mot de passe oublié ?'}
                </Text>
              </Pressable>
            )}

            {!isLogin && (
              <View style={styles.termsRow}>
                <Pressable
                  onPress={() => setAcceptedTerms((value) => !value)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: acceptedTerms }}
                  style={[styles.checkbox, acceptedTerms && styles.checkboxChecked]}
                >
                  {acceptedTerms && <Text style={styles.checkboxMark}>✓</Text>}
                </Pressable>
                <Text style={styles.termsText}>
                  J'accepte les{' '}
                  <Text
                    style={styles.termsLink}
                    onPress={() => setLegalDocument({
                      title: 'Conditions générales d’utilisation',
                      intro: TERMS_INTRO,
                      updatedAt: 'Dernière mise à jour : août 2026',
                      sections: TERMS_SECTIONS,
                    })}
                  >
                    conditions générales
                  </Text>{' '}
                  et la{' '}
                  <Text
                    style={styles.termsLink}
                    onPress={() => setLegalDocument({
                      title: 'Politique de confidentialité',
                      intro: PRIVACY_INTRO,
                      updatedAt: 'Dernière mise à jour : août 2026',
                      sections: PRIVACY_SECTIONS,
                    })}
                  >
                    politique de confidentialité
                  </Text>.
                </Text>
              </View>
            )}

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
              setAcceptedTerms(false);
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
      <LocalDocumentModal
        visible={Boolean(legalDocument)}
        document={legalDocument}
        onClose={() => setLegalDocument(null)}
      />
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
    marginTop: 80,
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
    borderColor: colors.tealDark,
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
  forgotRow: { alignItems: 'flex-end', marginTop: -4, marginBottom: 8 },
  forgotLink: { color: colors.coral, fontSize: 13, fontWeight: '600' },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 8,
    paddingVertical: 4,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    backgroundColor: colors.white,
  },
  checkboxChecked: {
    backgroundColor: colors.tealDark,
    borderColor: colors.tealDark,
  },
  checkboxMark: {
    color: colors.white,
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '700',
  },
  termsText: {
    flex: 1,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  termsLink: {
    color: colors.tealDark,
    fontWeight: '700',
    textDecorationLine: 'underline',
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