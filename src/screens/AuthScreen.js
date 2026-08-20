import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  User02Icon,
  Mail01Icon,
  LockPasswordIcon,
  ViewIcon,
  ViewOffIcon,
  ArrowRight02Icon,
} from '@hugeicons/core-free-icons';
import { StatusBar } from 'expo-status-bar';
import { colors } from '../theme';
import { Logo } from '../components/UI';
import { useStore } from '../store';
import { signUp, signIn, translateAuthError } from '../services/auth';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Champ avec icône à gauche (+ éventuellement un bouton à droite)
function Input({ icon, right, ...props }) {
  return (
    <View style={styles.inputWrap}>
      <HugeiconsIcon icon={icon} size={20} color={colors.muted} strokeWidth={1.7} />
      <TextInput
        style={styles.input}
        placeholderTextColor={colors.muted}
        {...props}
      />
      {right}
    </View>
  );
}

export default function AuthScreen({ navigation }) {
  const { setAuthUser } = useStore();

  // 'login' | 'signup'
  const [mode, setMode] = useState('login');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');

  const isSignup = mode === 'signup';

  const switchMode = (m) => {
    if (m === mode) return;
    setMode(m);
    setErr('');
    setInfo('');
  };

  const validate = () => {
    if (isSignup && firstName.trim().length < 2) {
      setErr('Indique ton prénom pour continuer.');
      return false;
    }
    if (!EMAIL_RE.test(email.trim())) {
      setErr('Adresse email invalide.');
      return false;
    }
    if (password.length < 6) {
      setErr('Mot de passe trop court (6 caractères minimum).');
      return false;
    }
    return true;
  };

  const submit = async () => {
    if (busy) return;
    setErr('');
    setInfo('');
    Keyboard.dismiss();
    if (!validate()) return;

    setBusy(true);
    try {
      if (isSignup) {
        const { user, needsEmailConfirm } = await signUp({
          email: email.trim(),
          password,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
        });
        if (needsEmailConfirm) {
          // Le projet exige une confirmation d'email
          switchMode('login');
          setInfo('Compte créé ! Confirme ton email puis connecte-toi.');
        } else {
          setAuthUser(user);
          navigation.replace('Main');
        }
      } else {
        const { user } = await signIn({ email: email.trim(), password });
        setAuthUser(user);
        navigation.replace('Main');
      }
    } catch (e) {
      setErr(translateAuthError(e));
    } finally {
      setBusy(false);
    }
  };

  const eye = (
    <TouchableOpacity onPress={() => setShowPw((v) => !v)} hitSlop={10}>
      <HugeiconsIcon
        icon={showPw ? ViewOffIcon : ViewIcon}
        size={20}
        color={colors.muted}
        strokeWidth={1.7}
      />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Marque */}
          <View style={styles.brand}>
            <Logo size={54} variant="word" />
            <Text style={styles.tagline}>
              Partage tes souvenirs en privé, avec ceux qui comptent.
            </Text>
          </View>

          {/* Carte */}
          <View style={styles.card}>
            {/* Toggle Connexion / Inscription */}
            <View style={styles.seg}>
              <TouchableOpacity
                style={[styles.segBtn, !isSignup && styles.segBtnOn]}
                onPress={() => switchMode('login')}
                activeOpacity={0.8}
              >
                <Text style={[styles.segTxt, !isSignup && styles.segTxtOn]}>
                  Connexion
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segBtn, isSignup && styles.segBtnOn]}
                onPress={() => switchMode('signup')}
                activeOpacity={0.8}
              >
                <Text style={[styles.segTxt, isSignup && styles.segTxtOn]}>
                  Inscription
                </Text>
              </TouchableOpacity>
            </View>

            {/* Champs inscription uniquement */}
            {isSignup && (
              <>
                <Text style={styles.label}>Prénom</Text>
                <Input
                  icon={User02Icon}
                  placeholder="Ex : Aline"
                  autoCapitalize="words"
                  value={firstName}
                  onChangeText={setFirstName}
                />
                <Text style={styles.label}>Nom (facultatif)</Text>
                <Input
                  icon={User02Icon}
                  placeholder="Ex : Nkurunziza"
                  autoCapitalize="words"
                  value={lastName}
                  onChangeText={setLastName}
                />
              </>
            )}

            <Text style={styles.label}>Email</Text>
            <Input
              icon={Mail01Icon}
              placeholder="exemple@mail.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              value={email}
              onChangeText={setEmail}
            />

            <Text style={styles.label}>Mot de passe</Text>
            <Input
              icon={LockPasswordIcon}
              placeholder="6 caractères minimum"
              secureTextEntry={!showPw}
              autoCapitalize="none"
              autoComplete={isSignup ? 'new-password' : 'password'}
              value={password}
              onChangeText={setPassword}
              right={eye}
            />

            {/* Messages */}
            {err ? (
              <View style={styles.errBox}>
                <Text style={styles.errTxt}>{err}</Text>
              </View>
            ) : null}
            {info ? (
              <View style={styles.infoBox}>
                <Text style={styles.infoTxt}>{info}</Text>
              </View>
            ) : null}

            {/* CTA */}
            <TouchableOpacity
              style={[styles.cta, busy && { opacity: 0.7 }]}
              onPress={submit}
              disabled={busy}
              activeOpacity={0.85}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <HugeiconsIcon icon={ArrowRight02Icon} size={20} color="#fff" />
              )}
              <Text style={styles.ctaTxt}>
                {busy
                  ? 'Patientez…'
                  : isSignup
                    ? 'Créer mon compte'
                    : 'Se connecter'}
              </Text>
            </TouchableOpacity>

            {/* Lien bascule */}
            <TouchableOpacity
              style={styles.switchRow}
              onPress={() => switchMode(isSignup ? 'login' : 'signup')}
              hitSlop={8}
            >
              <Text style={styles.switchTxt}>
                {isSignup ? 'Déjà un compte ? ' : 'Pas encore de compte ? '}
                <Text style={styles.switchLink}>
                  {isSignup ? 'Se connecter' : "S'inscrire"}
                </Text>
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.foot}>
            Vos photos restent privées : seuls les invités avec le code y ont
            accès.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  scroll: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 24 },

  brand: { alignItems: 'center', marginTop: 24 },
  tagline: {
    color: colors.muted,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 12,
    paddingHorizontal: 24,
    lineHeight: 20,
  },

  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 18,
    marginTop: 24,
    shadowColor: '#0E3A3E',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 2,
  },

  seg: {
    flexDirection: 'row',
    backgroundColor: colors.light,
    borderRadius: 14,
    padding: 4,
  },
  segBtn: {
    flex: 1,
    height: 42,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segBtnOn: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  segTxt: { color: colors.muted, fontWeight: '700', fontSize: 14 },
  segTxtOn: { color: colors.tealDark },

  label: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 14,
    marginBottom: 6,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.light,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    height: 50,
  },
  input: { flex: 1, fontSize: 15, color: colors.tealDark },

  errBox: {
    backgroundColor: '#FDECEA',
    borderRadius: 12,
    padding: 10,
    marginTop: 14,
  },
  errTxt: { color: colors.coralDark, fontSize: 13, fontWeight: '600' },
  infoBox: {
    backgroundColor: colors.peach,
    borderRadius: 12,
    padding: 10,
    marginTop: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoTxt: { color: colors.tealDark, fontSize: 13, fontWeight: '600' },

  cta: {
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 18,
  },
  ctaTxt: { color: '#fff', fontWeight: '800', fontSize: 16 },

  switchRow: { alignItems: 'center', marginTop: 14 },
  switchTxt: { color: colors.muted, fontSize: 14 },
  switchLink: { color: colors.teal, fontWeight: '800' },

  foot: {
    textAlign: 'center',
    color: colors.muted,
    fontSize: 12,
    marginTop: 22,
    lineHeight: 18,
    paddingHorizontal: 12,
  },
});
