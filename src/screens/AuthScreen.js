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
  Linking,
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

export default function AuthScreen({ navigation }) {
  const [mode, setMode] = useState('login');
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

  // Gestion du deep link OAuth
  useEffect(() => {
    const handleDeepLink = async ({ url }) => {
      console.log('🔗 Deep link received in AuthScreen:', url);
      // Si l'URL contient des tokens, la session sera restaurée automatiquement
      // On peut simplement vérifier la session après un court délai
      if (url && url.includes('access_token')) {
        console.log('🔐 OAuth callback detected, checking session...');
        // Attendre que la session soit traitée par Supabase
        setTimeout(() => {
          // La session sera restaurée par le StoreProvider
          navigation.replace('Main');
        }, 1000);
      }
    };

    const subscription = Linking.addEventListener('url', handleDeepLink);
    
    // Vérifier si l'application a été ouverte avec une URL
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink({ url });
      }
    });

    return () => {
      subscription.remove();
    };
  }, [navigation]);

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
      
      // Utiliser la fonction d'authentification Google
      const result = await signInWithGoogle();
      
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
              {isLogin ? 'Partagez, Découvrez, Revivez.' : 'Rejoignez l\'aventure SharePix.'}
            </Text>
            <Text style={styles.subtitle}>
              {isLogin
                ? 'Connectez-vous pour retrouver vos souvenirs.'
                : 'Créez un compte pour partager vos moments.'}
            </Text>
          </View>

          {/* Google Button */}
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
            <Text style={styles.separatorText}>Ou connectez-vous avec</Text>
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
                  {isLogin ? 'Se connecter à SharePix' : 'S\'inscrire sur SharePix'}
                </Text>
              )}
            </Pressable>
          </View>

          {/* Switch */}
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