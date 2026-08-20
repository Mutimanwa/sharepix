import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ImageBackground,
  Dimensions,
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
import {
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail,
} from '../services/auth';
import { colors } from '../theme';
import { GoogleMark, LogoImage } from '../components/UI';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { height } = Dimensions.get('window');

// Composant Input Premium avec gestion du focus
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

  const isLogin = mode === 'login';

  const validate = () => {
    setError('');
    if (!email.trim()) { setError('Veuillez entrer votre adresse email.'); return false; }
    if (!email.includes('@')) { setError('Veuillez entrer une adresse email valide.'); return false; }
    if (!password) { setError('Veuillez entrer votre mot de passe.'); return false; }
    if (password.length < 6) { setError('Le mot de passe doit contenir au moins 6 caractères.'); return false; }
    if (!isLogin && !firstName.trim()) { setError('Veuillez entrer votre prénom.'); return false; }
    return true;
  };

  const handleEmailAuth = async () => {
    if (!validate()) return;
    setLoading(true);
    setError('');
    try {
      let result = isLogin
        ? await signInWithEmail(email, password)
        : await signUpWithEmail(email, password, { firstName, lastName });

      if (result.error) {
        setError(getAuthError(result.error));
        return;
      }
      if (!result.user && !isLogin) {
        setError('Compte créé. Vérifiez votre email pour confirmer votre inscription.');
        return;
      }
      navigation.replace('Main');
    } catch (err) {
      setError(err?.message || 'Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    setError('');
    try {
      const result = await signInWithGoogle();
      if (result.error) {
        setError(getAuthError(result.error));
        return;
      }
      if (result.user) navigation.replace('Main');
    } catch (err) {
      setError(err?.message || 'Impossible de se connecter avec Google.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      

        <View style={styles.overlay}>
          <KeyboardAvoidingView
            style={[styles.keyboard , {paddingBottom: insets.bottom}]}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.scroll}
            >
              {/* Header Minimaliste */}
              <View style={styles.header}>
                <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
                  <HugeiconsIcon icon={ArrowLeft01Icon} size={24} color={colors.tealDark} />
                </Pressable>
              </View>

               {/* Logo ou Marque */}
                <View style={styles.brandContainer}>
                   <LogoImage size={80} />
                </View>

              {/* Texte Héro (Inspiré de "Buy It. Sell It. Find It Here.") */}
              <View style={styles.heroSection}>
                <Text style={styles.title}>
                  {isLogin ? 'Partagez , Découvrez ,Revivez.' : 'Rejoignez l\'aventure SharePix.'}
                </Text>
                <Text style={styles.subtitle}>
                  {isLogin
                    ? 'Connectez-vous pour retrouver vos souvenirs.'
                    : 'Créez un compte pour partager vos moments.'}
                </Text>
              </View>

              {/* Google Button (Glassmorphism style) */}
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
                      <GoogleMark />
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
                      <HugeiconsIcon icon={showPassword ? EyeOffIcon : EyeIcon} size={20} color="#9CA3AF" />
                    </Pressable>
                  }
                />

                {/* {isLogin && (
                  <Pressable style={styles.forgot}>
                    <Text style={styles.forgotText}>Mot de passe oublié ?</Text>
                  </Pressable>
                )} */}

                {/* Error Box */}
                {!!error && (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                {/* Submit Button (Couleur d'accentuation forte) */}
                <Pressable
                  style={[styles.submitButton, loading && styles.disabled]}
                  onPress={handleEmailAuth}
                  disabled={loading || googleLoading}
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

              {/* Switch (Login / Register) */}
              <Pressable 
                style={styles.switchContainer} 
                onPress={() => { setError(''); setMode(isLogin ? 'register' : 'login'); }}
              >
                <Text style={styles.switchText}>
                  {isLogin ? 'Pas encore de compte ? ' : 'Déjà un compte ? '}
                  <Text style={styles.switchAction}>{isLogin ? 'S\'inscrire' : 'Se connecter'}</Text>
                </Text>
              </Pressable>

            </ScrollView>
          </KeyboardAvoidingView>
        </View>
    </View>
  );
}

function getAuthError(error) {
  const message = error?.message?.toLowerCase() || '';
  if (message.includes('invalid login credentials')) return 'Email ou mot de passe incorrect.';
  if (message.includes('email not confirmed')) return 'Veuillez confirmer votre adresse email avant de vous connecter.';
  if (message.includes('user already registered')) return 'Un compte existe déjà avec cette adresse email.';
  if (message.includes('password')) return 'Le mot de passe fourni est invalide.';
  if (message.includes('network')) return 'Connexion impossible. Vérifiez votre connexion Internet.';
  return error?.message || 'Une erreur est survenue.';
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
  
  // Header
  header: {
    flex: 1,
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
    backgroundColor: colors.cream
  },

  // Hero Section

  brandContainer: {
    flex: 1 ,
    justifyContent: 'center',
    alignItems: 'center '
    
  },
  heroSection: {
    marginVertical: 10
  },

  title: {
    color: colors.tealDark,
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center'

  },
  subtitle: {
    color: '#9CA3AF',
    fontSize: 13,
    lineHeight: 24,
    marginTop: 5,
    fontWeight: '500',
  },

  // Buttons & Forms
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
  googleG: {
    fontSize: 20,
    fontWeight: '800',
    color: '#4285F4',
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

  forgot: {
    alignSelf: 'flex-end',
    marginTop: -4,
  },
  forgotText: {
    color: '#9CA3AF',
    fontWeight: '500',
    fontSize: 14,
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
  },
  errorText: {
    color: '#F87171',
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