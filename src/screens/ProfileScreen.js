import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, ActivityIndicator, Pressable, Image, Alert, Modal, Animated } from 'react-native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { 
  UserCircle02Icon, 
  Logout01Icon, 
  Camera01Icon, 
  ArrowRight01Icon, 
  CheckmarkBadge01Icon,
  Delete02Icon,
  BubbleChatQuestionIcon,
  FileTextIcon,
  Shield01Icon,
} from '@hugeicons/core-free-icons';
import { Field } from '../components/UI';
import { useStore } from '../store';
import { colors } from '../theme';
import { isSupabaseConfigured } from '../config';
import { signOut, deleteAccount } from '../services/auth'; 
// ── SUPABASE PUSH : intégration ──
// (Dé)enregistrement du token Expo Push selon l'interrupteur ci-dessous
import { registerPushToken, unregisterPushToken } from '../services/push';
// ── SUPABASE PUSH : fin ──
// ── BUG-03 : SafeAreaView depuis react-native-safe-area-context ──
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import * as Application from 'expo-application';
import LocalInfoAccordion from '../components/LocalInfoAccordion';
import { FAQ_SECTIONS, PRIVACY_INTRO, PRIVACY_SECTIONS, TERMS_INTRO, TERMS_SECTIONS } from '../data/localInfo';

// ── COMPOSANTS RÉUTILISABLES POUR L'UI ──

function SwitchRow({ title, sub, value, onValueChange, isLast, disabled = false }) {
  const knobPosition = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(knobPosition, {
      toValue: value ? 1 : 0,
      friction: 7,
      tension: 80,
      useNativeDriver: true,
    }).start();
  }, [knobPosition, value]);

  const knobTransform = {
    transform: [{
      translateX: knobPosition.interpolate({
        inputRange: [0, 1],
        outputRange: [2, 22],
      }),
    }],
  };

  return (
    <Pressable
      style={[styles.row, !isLast && styles.rowBorder, disabled && styles.switchDisabled]}
      onPress={() => !disabled && onValueChange(!value)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
    >
      <View style={styles.rowTextContainer}>
        <Text style={styles.rt}>{title}</Text>
        {sub ? <Text style={styles.rs}>{sub}</Text> : null}
      </View>
      <View style={[styles.switchTrack, value && styles.switchTrackOn]} pointerEvents="none">
        <Animated.View style={[styles.switchKnob, knobTransform]} />
      </View>
    </Pressable>
  );
}

function LinkRow({ title, onPress, isLast, isDestructive }) {
  return (
    <TouchableOpacity 
      style={[styles.row, !isLast && styles.rowBorder]} 
      onPress={onPress} 
      activeOpacity={0.7}
    >
      <Text style={[styles.rt, isDestructive && { color: colors.coralDark }]}>{title}</Text>
      <HugeiconsIcon icon={isDestructive ? Delete02Icon : ArrowRight01Icon} size={18} color={isDestructive ? colors.coralDark : colors.muted} />
    </TouchableOpacity>
  );
}

// ── ÉCRAN PRINCIPAL ──

export default function ProfileScreen({ navigation }) {
  const { state, updateProfile, clearAuthUser } = useStore();
  const p = state.profile;
  const insets = useSafeAreaInsets();
  const user = state.user;
  const isAnonymous = user?.isAnonymous;
  
  const [busyOut, setBusyOut] = useState(false);
  const [busyDelete, setBusyDelete] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const initialProfileRef = useRef(null);

  const profileSignature = JSON.stringify({
    firstName: p.firstName || '',
    lastName: p.lastName || '',
  });
  if (initialProfileRef.current === null) initialProfileRef.current = profileSignature;
  const hasProfileChanges = profileSignature !== initialProfileRef.current;

  // En build installé, lire la version du binaire lui-même. En Expo Go / web,
  // utiliser la version de configuration du projet (app.json).
  const isNativeBuild = ['standalone', 'bare'].includes(Constants.executionEnvironment);
  const appVersion =
    (isNativeBuild ? Application.nativeApplicationVersion : null) ||
    Constants.expoConfig?.version ||
    '1.0.4';

  const changePushEnabled = async (enabled) => {
    if (pushBusy) return;
    setPushBusy(true);
    try {
      if (enabled) {
        const token = await registerPushToken();
        if (!token) {
          Alert.alert(
            'Notifications non activées',
            'Autorisez les notifications dans les réglages du téléphone et réessayez. Les notifications push nécessitent l’application installée sur un appareil.'
          );
          return;
        }
        const saved = await updateProfile({ notifications: true });
        if (!saved) {
          await unregisterPushToken();
          await updateProfile({ notifications: false });
          Alert.alert('Erreur', 'Votre préférence n’a pas pu être enregistrée. Vérifiez votre connexion.');
        }
        return;
      }

      const saved = await updateProfile({ notifications: false });
      const removed = await unregisterPushToken();
      if (!saved) await updateProfile({ notifications: true });
      if (!saved || !removed) {
        Alert.alert(
          'Préférence partiellement appliquée',
          'La désactivation a été demandée, mais le serveur n’a pas confirmé toutes les modifications. Réessayez avec une connexion stable.'
        );
      }
    } catch {
      Alert.alert('Erreur', 'Impossible de modifier les notifications pour le moment.');
    } finally {
      setPushBusy(false);
    }
  };

  const changePushCategory = async (key, value) => {
    const previousValue = Boolean(p[key]);
    const saved = await updateProfile({ [key]: value });
    if (!saved) {
      await updateProfile({ [key]: previousValue });
      Alert.alert('Erreur', 'Cette préférence n’a pas pu être synchronisée. Réessayez.');
    }
  };

  const handleLogout = () => {
    Alert.alert(
      "Se déconnecter",
      "Êtes-vous sûr de vouloir vous déconnecter ?",
      [
        { text: "Annuler", style: "cancel" },
        { text: "Se déconnecter", style: "destructive", onPress: executeLogout }
      ]
    );
  };

  const executeLogout = async () => {
    if (busyOut) return;
    setBusyOut(true);
    const removed = await unregisterPushToken();
    if (!removed) {
      Alert.alert(
        'Déconnexion impossible',
        'Impossible de retirer le jeton push de cet appareil. Réessayez avec une connexion internet avant de vous déconnecter.'
      );
      setBusyOut(false);
      return;
    }
    try { await signOut(); } catch {}
    clearAuthUser();
    setBusyOut(false);
  };

  const handleDeleteAccount = () => {
    if (!user) {
      Alert.alert("Mode Invité", "En tant qu'invité, vos données sont stockées uniquement sur cet appareil. Vous pouvez simplement réinitialiser l'application.");
      return;
    }

    Alert.alert(
      "Supprimer mon compte",
      "ATTENTION : Cette action est irréversible. Toutes vos données, albums et photos seront définitivement supprimées de nos serveurs.",
      [
        { text: "Annuler", style: "cancel" },
        { 
          text: "Supprimer définitivement", 
          style: "destructive",
          onPress: executeDeleteAccount 
        }
      ]
    );
  };

  const executeDeleteAccount = async () => {
    setBusyDelete(true);
    try {
      await deleteAccount();
      clearAuthUser();
      // Retour à l'accueil après suppression
      navigation.replace('Onboarding'); 
    } catch (err) {
      Alert.alert("Erreur", err.message);
    } finally {
      setBusyDelete(false);
    }
  };

 const handleSave = async () => {
   if (saving || !hasProfileChanges) return;
    setSaving(true);
    
    // On simule/attend le temps de la sauvegarde (local + synchro Supabase en arrière-plan)
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    initialProfileRef.current = profileSignature;
    setSaving(false);
    Alert.alert("Succès", "Votre profil a été mis à jour.");
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      
      {/* HEADER */}
      <View style={styles.head}>
        <Text style={styles.title}>Mon profil</Text>
        <TouchableOpacity
          onPress={handleSave}
          disabled={!hasProfileChanges || saving}
          activeOpacity={0.7}
          style={[styles.saveBtn, !hasProfileChanges && styles.saveBtnDisabled]}
        >
          <Text style={styles.saveBtnText}>Terminé</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* AVATAR ÉDITABLE */}
        <View style={styles.avatarSection}>
          <TouchableOpacity 
            style={styles.avatarContainer} 
            activeOpacity={0.8}
            onPress={() => Alert.alert("Photo de profil", "Modifiez votre photo directement depuis votre compte Google.")}
            accessibilityRole="button"
            accessibilityLabel="Modifier la photo de profil"
          >
            <View style={styles.avatar}>
              {/* AFFICHAGE CONDITIONNEL : Image URL ou Initiales */}
              {user?.avatarUrl ? (
                <Image source={{ uri: user.avatarUrl }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarInitials}>
                  {user ? (user.firstName || user.email || 'S')[0].toUpperCase() : 'S'}
                </Text>
              )}
            </View>
            <View style={styles.avatarBadge} pointerEvents="none">
              <HugeiconsIcon icon={Camera01Icon} size={14} color="#fff" />
            </View>
          </TouchableOpacity>
          <Text style={styles.avatarHint}>Photo de profil</Text>
        </View>

        {isSupabaseConfigured ? <Text style={styles.sectionTitle}>Compte</Text> : null}

        {/* ── BANNIÈRE COMPTE INVITÉ ── */}
        {isSupabaseConfigured && isAnonymous && (
          <View style={[styles.card, styles.guestCard]}>
            <View style={styles.accountRow}>
              <View style={[styles.accountIcon, styles.guestIcon]}>
                   <HugeiconsIcon icon={UserCircle02Icon} size={34} color={colors.coralDark} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.accountTitleRow}>
                  <Text style={styles.accountT}>Compte invité</Text>
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusBadgeText}>À sécuriser</Text>
                  </View>
                </View>
                <Text style={styles.accountS}>
                  Vos albums sont uniquement liés à cet appareil. Ajoutez un compte pour les retrouver partout.
                </Text>
              </View>
            </View>
            {/* ── SUPABASE ALBUMS : intégration ── */}
            {/* mode 'convert' : l'AuthScreen convertira le compte invité au lieu d'en créer un nouveau */}
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => navigation.navigate('Auth', { mode: 'convert' })}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Sécuriser mon compte invité"
            >
            {/* ── SUPABASE ALBUMS : fin ── */}
              <HugeiconsIcon icon={CheckmarkBadge01Icon} size={18} color={colors.coralDark} />
              <Text style={styles.primaryBtnText}>Sécuriser mon compte</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── COMPTE CONNECTÉ (DONNÉES GOOGLE) ── */}
        {/* P0-03 : `user` peut être null juste après la déconnexion →
            cette branche déréférençait user.firstName / user.email. */}
        {isSupabaseConfigured && !!user && !isAnonymous && (
          <View style={styles.card}>
            <View style={styles.accountRow}>
              <View style={{ flex: 1, gap: 4 }}>
                {/* Nom complet récupéré depuis Google */}
                <Text style={styles.accountName}>
                  {`${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Utilisateur'}
                </Text>
                {/* Email récupéré depuis Google */}
                <Text style={styles.accountEmail}>{user.email}</Text>
              </View>
              {/* Badge indiquant que c'est lié à Google */}
              <View style={styles.providerBadge}>
                <HugeiconsIcon icon={CheckmarkBadge01Icon} size={15} color="#4285F4" />
                <Text style={styles.providerBadgeText}>Google</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} disabled={busyOut} activeOpacity={0.85}>
              {busyOut ? (
                <ActivityIndicator color={colors.coralDark} size="small" />
              ) : (
                <HugeiconsIcon icon={Logout01Icon} size={18} color={colors.coralDark} />
              )}
              <Text style={styles.logoutBtnText}>
                {busyOut ? 'Déconnexion…' : 'Se déconnecter'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Aucun état Auth actif : proposer clairement la connexion/changement
            de compte au lieu de masquer entièrement la section Compte. */}
        {isSupabaseConfigured && !user && (
          <View style={styles.card}>
            <View style={styles.accountRow}>
              <View style={styles.accountIcon}>
                <HugeiconsIcon icon={UserCircle02Icon} size={34} color={colors.tealDark} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.accountT}>Aucun compte connecté</Text>
                <Text style={styles.accountS}>
                  Connectez-vous pour retrouver vos albums ou utiliser un autre compte.
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => navigation.navigate('Auth', { mode: 'login' })}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Se connecter ou changer de compte"
            >
              <HugeiconsIcon icon={UserCircle02Icon} size={18} color="#fff" />
              <Text style={styles.primaryBtnText}>Se connecter / changer de compte</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── INFORMATIONS PERSONNELLES ── */}
        {/* On masque cette section si l'utilisateur est connecté à Google 
            car ses infos sont déjà affichées dans la carte "Compte vérifié" au-dessus */}
        {isAnonymous && (
          <>
            <Text style={styles.sectionTitle}>Informations personnelles</Text>
            <View style={styles.card}>
              <Field label="Prénom" value={p.firstName} onChangeText={(firstName) => updateProfile({ firstName })} autoCapitalize="words" />
              <Field label="Nom de famille" value={p.lastName} onChangeText={(lastName) => updateProfile({ lastName })} autoCapitalize="words" />
            </View>
          </>
        )}

        {/* ── NOTIFICATIONS ── */}
        <Text style={styles.sectionTitle}>Préférences de notifications</Text>
        <View style={styles.card}>
          <SwitchRow
            title="Notifications push"
            sub={pushBusy ? 'Mise à jour…' : 'Recevoir des alertes même lorsque SharePix est fermé'}
            value={p.notifications}
            onValueChange={changePushEnabled}
            disabled={pushBusy}
          />
          <SwitchRow
            title="Nouvelles photos"
            sub="Quand un membre ajoute des photos"
            value={p.newPhotos}
            onValueChange={(v) => changePushCategory('newPhotos', v)}
            disabled={!p.notifications}
          />
          <SwitchRow
            title="Réactions J’aime"
            sub="Quand quelqu’un aime une photo"
            value={p.likes}
            onValueChange={(v) => changePushCategory('likes', v)}
            disabled={!p.notifications}
          />
          <SwitchRow
            title="Commentaires"
            sub="Quand quelqu’un commente une photo"
            value={p.comments}
            onValueChange={(v) => changePushCategory('comments', v)}
            disabled={!p.notifications}
          />
          <SwitchRow
            title="Nouveaux membres"
            sub="Quand une personne rejoint un album"
            value={p.memberJoined}
            onValueChange={(v) => changePushCategory('memberJoined', v)}
            disabled={!p.notifications}
            isLast
          />
        </View>

        {/* ── SUPPORT & AIDE ── */}
        <View style={styles.helpBox}>
          <Text style={styles.helpTitle}>Besoin d'aide ?</Text>
          <Text style={styles.helpDesc}>Une question ou un problème ? Notre équipe est là pour vous aider.</Text>
          <TouchableOpacity style={styles.mailBtn} onPress={() => Linking.openURL('mailto:hello@restartburundi@gmail.com')} activeOpacity={0.8}>
            <Text style={styles.mailBtnText}>Contacter le support</Text>
          </TouchableOpacity>
        </View>

        {/* ── AIDE ET INFORMATIONS LOCALES (fonctionnent hors connexion) ── */}
        <Text style={styles.sectionTitle}>Aide et informations</Text>
        <View style={styles.card}>
          <LocalInfoAccordion
            title="FAQ - Questions fréquentes"
            icon={BubbleChatQuestionIcon}
            intro="Réponses aux questions courantes sur SharePix."
            sections={FAQ_SECTIONS}
          />
          <LinkRow
            title="Restaurer les achats"
            onPress={() => Alert.alert('Achats', "Vous n'avez actuellement aucun achat in-app à restaurer.")}
          />
          <LocalInfoAccordion
            title="Conditions générales d’utilisation"
            icon={FileTextIcon}
            intro={TERMS_INTRO}
            updatedAt="Dernière mise à jour : août 2026"
            sections={TERMS_SECTIONS}
          />
          <LocalInfoAccordion
            title="Politique de confidentialité"
            icon={Shield01Icon}
            intro={PRIVACY_INTRO}
            updatedAt="Dernière mise à jour : août 2026"
            sections={PRIVACY_SECTIONS}
          />
          <LinkRow
            title={user ? 'Supprimer mon compte' : "Réinitialiser l'application"}
            isDestructive
            onPress={handleDeleteAccount}
            isLast
          />
        </View>

        {/* Version du binaire installé (ou de la configuration en Expo Go/web). */}
        <Text style={styles.versionText}>Version {appVersion}</Text>
      </ScrollView>

       {/* MODAL DE SAUVEGARDE DU PROFIL */}
      <Modal visible={saving} transparent animationType="fade">
        {/* BUG-03 : SafeAreaView gère l'encoche, plus de marginTop manuel. */}
        <SafeAreaView style={styles.modalContainer} edges={['top']}>
          <View style={[styles.savingBanner, { marginTop: 10 }]}>
            <ActivityIndicator size="small" color={colors.tealDark} />
            <Text style={styles.savingText}>
              Enregistrement de votre profil...
            </Text>
          </View>
        </SafeAreaView>
      </Modal>

      {/* LOADING OVERLAY POUR LA SUPPRESSION */}
      {busyDelete && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.coral} />
          <Text style={styles.loadingText}>Suppression de vos données...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 40 },
  
  // Header
  head: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 20, justifyContent: 'space-between', alignItems: 'center' , borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { fontSize: 20, fontWeight: '600', color: colors.tealDark },
  saveBtn: { paddingVertical: 6, paddingHorizontal: 12 },
  saveBtnText: { color: colors.coral, fontWeight: '700', fontSize: 14 },
  saveBtnDisabled: { opacity: 0.35 },

  // Avatar
  avatarSection: { alignItems: 'center', marginVertical: 20 },
  avatarContainer: { position: 'relative' },
  avatar: { 
    width: 90, 
    height: 90, 
    borderRadius: 45, 
    backgroundColor: colors.coral, 
    alignItems: 'center', 
    justifyContent: 'center', 
    shadowColor: colors.coral, 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.2, 
    shadowRadius: 8, 
    elevation: 4,
    overflow: 'hidden', // Important pour que l'image ne dépasse pas du cercle
  },
  avatarImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  avatarInitials: { color: '#fff', fontSize: 34, fontWeight: '700' },
  avatarBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: colors.tealDark, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  avatarHint: { marginTop: 8, color: colors.muted, fontSize: 12, fontWeight: '500' },

  // Sections
  sectionTitle: { fontSize: 13, fontWeight: '600', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginLeft: 8, marginBottom: 8, marginTop: 16 },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 16, marginBottom: 16 },
  
  // Field UX
  fieldHeader: { position: 'relative' },
  syncBadge: { position: 'absolute', right: 0, top: 5, fontSize: 10, color: colors.teal, fontWeight: '700', textTransform: 'uppercase' },

  // Compte & Invité
  guestCard: { borderColor: colors.border, borderWidth: 1, },
  accountRow: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  accountIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.light },
  guestIcon: { backgroundColor: '#FDECEA' },
  accountTitleRow: { flexDirection: 'row', alignItems: 'center',   flexWrap: 'wrap', gap: 8, marginBottom: 3 },
  accountT: { fontSize: 16, fontWeight: '600', color: colors.tealDark, marginBottom: 2 },
  accountS: { color: colors.muted, lineHeight: 18, fontSize: 13 },
  statusBadge: { backgroundColor: '#FFF1E8', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  statusBadgeText: { color: colors.coralDark, fontSize: 10, fontWeight: '700' },
  
  primaryBtn: { marginTop: 16, backgroundColor: "#FDECEA", borderRadius: 12, minHeight: 48, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  primaryBtnText: { color: colors.coralDark, fontWeight: '500', fontSize: 15 },
  
  logoutBtn: { marginTop: 16, backgroundColor: '#FDECEA', borderRadius: 12, height: 48, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  logoutBtnText: { color: colors.coralDark, fontWeight: '500', fontSize: 15 },

  // Lignes (Settings & Liens)
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  switchDisabled: { opacity: 0.45 },
  rowTextContainer: { flex: 1, paddingRight: 16 },
  rt: { fontSize: 16, fontWeight: '500', color: colors.tealDark },
  rs: { color: colors.muted, marginTop: 4, fontSize: 13, lineHeight: 18 },
  switchTrack: {
    width: 48,
    height: 28,
    borderRadius: 14,
    padding: 2,
    justifyContent: 'center',
    backgroundColor: '#D7E1E1',
    borderWidth: 1,
    borderColor: colors.border,
  },
  switchTrackOn: {
    backgroundColor: colors.teal,
    borderColor: colors.teal,
  },
  switchKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.white,
    shadowColor: '#164E52',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 2,
    elevation: 2,
  },

  // Aide box
  helpBox: { backgroundColor: colors.light, borderRadius: 16, padding: 20, marginVertical: 16, alignItems: 'flex-start' },
  helpTitle: { fontWeight: '600', fontSize: 18, color: colors.tealDark },
  helpDesc: { marginTop: 6, color: colors.tealDark, fontSize: 14, lineHeight: 20 },
  mailBtn: { marginTop: 16, backgroundColor: colors.coral, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  mailBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  versionText: { color: colors.muted, marginTop: 8, marginBottom: 10, textAlign: 'center', fontSize: 12, fontWeight: '500' },

  // Loading overlay pour la suppression
  loadingOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  loadingText: {
    marginTop: 16,
    color: colors.tealDark,
    fontWeight: '600',
    fontSize: 16,
  },
    // Modal de sauvegarde 
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.3)', 
  },
  savingBanner: {
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  savingText: {
    color: colors.tealDark, 
    fontWeight: '600',
    fontSize: 15,
  },
    // Compte Connecté (Nouveaux styles Google)
  accountName: { 
    fontSize: 18, 
    fontWeight: '700', 
    color: colors.tealDark,
    textTransform: 'capitalize', // Met la première lettre en majuscule automatiquement
  },
  accountEmail: { 
    color: colors.muted, 
    fontSize: 14, 
    lineHeight: 18 
  },
  providerBadge: { 
    backgroundColor: '#F1F3F4', // Le gris clair caractéristique de Google
    paddingHorizontal: 8, 
    paddingVertical: 5, 
    borderRadius: 20, 
    alignItems: 'center', 
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  providerBadgeText: { 
    color: '#5F6368', // Gris foncé Google
    fontSize: 12, 
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});