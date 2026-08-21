import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity, Linking, ActivityIndicator, Pressable, Image, Alert ,Modal ,SafeAreaView, } from 'react-native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { 
  UserCircle02Icon, 
  Logout01Icon, 
  Camera01Icon, 
  ArrowRight01Icon, 
  ShieldCheckIcon,
  CheckmarkBadge01Icon,
  Delete02Icon
} from '@hugeicons/core-free-icons';
import { Field } from '../components/UI';
import { useStore } from '../store';
import { colors } from '../theme';
import { isSupabaseConfigured } from '../config';
import { signOut, deleteAccount } from '../services/auth'; 
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants'; 

// ── COMPOSANTS RÉUTILISABLES POUR L'UI ──

function SwitchRow({ title, sub, value, onValueChange, isLast }) {
  return (
    <Pressable 
      style={[styles.row, !isLast && styles.rowBorder]} 
      onPress={() => onValueChange(!value)}
    >
      <View style={styles.rowTextContainer}>
        <Text style={styles.rt}>{title}</Text>
        {sub ? <Text style={styles.rs}>{sub}</Text> : null}
      </View>
      <Switch 
        value={value} 
        onValueChange={onValueChange} 
        trackColor={{ true: colors.coral, false: colors.muted }} 
        pointerEvents="none" 
      />
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
  const isAnonymous = user?.isAnonymous;
  
  const [busyOut, setBusyOut] = useState(false);
  const [busyDelete, setBusyDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  // Récupération dynamique de la version depuis app.json
  const appVersion = Constants.expoConfig?.version || '1.0.1';

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
    if (saving) return;
    setSaving(true);
    
    // On simule/attend le temps de la sauvegarde (local + synchro Supabase en arrière-plan)
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    setSaving(false);
    Alert.alert("Succès", "Votre profil a été mis à jour.");
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      
      {/* HEADER */}
      <View style={styles.head}>
        <Text style={styles.title}>Mon profil</Text>
        <TouchableOpacity onPress={handleSave} activeOpacity={0.7} style={styles.saveBtn}>
          <Text style={styles.saveBtnText}>Terminé</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* AVATAR ÉDITABLE */}
        <View style={styles.avatarSection}>
          <TouchableOpacity 
            style={styles.avatarContainer} 
            activeOpacity={0.8}
            onPress={() => user?.avatarUrl ? Alert.alert("Photo de profil", "Modifiez votre photo directement depuis votre compte Google.") : null}
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
            <View style={styles.avatarBadge}>
              <HugeiconsIcon icon={Camera01Icon} size={14} color="#fff" />
            </View>
          </TouchableOpacity>
        </View>

        {/* ── BANNIÈRE COMPTE ── */}
        {isSupabaseConfigured && isAnonymous && (
          <View style={[styles.card, styles.guestCard]}>
            <View style={styles.accountRow}>
              <View style={[styles.accountIcon, { backgroundColor: '#FFF3E0' }]}>
                   <HugeiconsIcon icon={UserCircle02Icon} size={34} color={colors.tealDark} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.accountT}>Sécurisez vos données</Text>
                <Text style={styles.accountS}>
                  Vous utilisez actuellement un compte invité. Liez une adresse e-mail pour sauvegarder vos albums et y accéder partout.
                </Text>
              </View>
            </View>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.navigate('Auth')} activeOpacity={0.85}>
              <Text style={styles.primaryBtnText}>Créer mon compte sécurisé</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── COMPTE CONNECTÉ (DONNÉES GOOGLE) ── */}
        {isSupabaseConfigured && !isAnonymous && (
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

        {/* ── INFORMATIONS PERSONNELLES ── */}
        {/* On masque cette section si l'utilisateur est connecté à Google 
            car ses infos sont déjà affichées dans la carte "Compte vérifié" au-dessus */}
        {!user && (
          <>
            <Text style={styles.sectionTitle}>Informations personnelles</Text>
            <View style={styles.card}>
              <Field label="Prénom" value={p.firstName} onChangeText={(firstName) => updateProfile({ firstName })} />
              <Field label="Nom de famille" value={p.lastName} onChangeText={(lastName) => updateProfile({ lastName })} />
            </View>
          </>
        )}

        {/* ── NOTIFICATIONS ── */}
        <Text style={styles.sectionTitle}>Préférences de notifications</Text>
        <View style={styles.card}>
          <SwitchRow title="Notifications push" value={p.notifications} onValueChange={(v) => updateProfile({ notifications: v })} />
          <SwitchRow title="Nouvelles Photos" sub="Quand un membre ajoute des photos" value={p.newPhotos} onValueChange={(v) => updateProfile({ newPhotos: v })} />
          <SwitchRow title="Mentions J'aime" sub="Quand quelqu'un aime vos photos" value={p.likes} onValueChange={(v) => updateProfile({ likes: v })} />
          <SwitchRow title="Commentaires" sub="Nouvelles interactions sur vos contenus" value={p.comments} onValueChange={(v) => updateProfile({ comments: v })} isLast />
        </View>

        {/* ── SUPPORT & AIDE ── */}
        <View style={styles.helpBox}>
          <Text style={styles.helpTitle}>Besoin d'aide ?</Text>
          <Text style={styles.helpDesc}>Une question ou un problème ? Notre équipe est là pour vous aider.</Text>
          <TouchableOpacity style={styles.mailBtn} onPress={() => Linking.openURL('mailto:hello@sharepix.app')} activeOpacity={0.8}>
            <Text style={styles.mailBtnText}>Contacter le support</Text>
          </TouchableOpacity>
        </View>

        {/* ── LIENS LÉGAUX ET AUTRES ── */}
        <View style={styles.card}>
          <LinkRow title="FAQ - Questions Fréquentes" onPress={() => Linking.openURL('https://sharepix.app/faq')} />
          <LinkRow title="Restaurer les achats" onPress={() => Alert.alert("Achats", "Vous n'avez actuellement aucun achat in-app à restaurer.")} />
          <LinkRow title="Conditions Générales (CGV)" onPress={() => Linking.openURL('https://sharepix.app/cgv')} />
          <LinkRow title="Sécurité des données" onPress={() => Linking.openURL('https://sharepix.app/privacy')} />
          <LinkRow 
            title={user ? "Supprimer mon compte" : "Réinitialiser l'application"} 
            isDestructive 
            onPress={handleDeleteAccount} 
            isLast 
          />
        </View>

        {/* VERSION DYNAMIQUE */}
        <Text style={styles.versionText}> Version {appVersion}</Text>
      </ScrollView>

       {/* MODAL DE SAUVEGARDE DU PROFIL */}
      <Modal visible={saving} transparent animationType="fade">
        <SafeAreaView style={styles.modalContainer}>
          <View style={[styles.savingBanner, { marginTop: insets.top + 10 }]}>
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

  // Sections
  sectionTitle: { fontSize: 13, fontWeight: '600', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginLeft: 8, marginBottom: 8, marginTop: 16 },
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 16, marginBottom: 16 },
  
  // Field UX
  fieldHeader: { position: 'relative' },
  syncBadge: { position: 'absolute', right: 0, top: 5, fontSize: 10, color: colors.teal, fontWeight: '700', textTransform: 'uppercase' },

  // Compte & Invité
  guestCard: { borderColor: '#F57C00', borderWidth: 1, backgroundColor: '#FFFDF9' },
  accountRow: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  accountIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  accountT: { fontSize: 16, fontWeight: '600', color: colors.tealDark, marginBottom: 2 },
  accountS: { color: colors.muted, lineHeight: 18, fontSize: 13 },
  
  primaryBtn: { marginTop: 16, backgroundColor: colors.coral, borderRadius: 12, height: 40, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '500', fontSize: 15 },
  
  logoutBtn: { marginTop: 16, backgroundColor: '#FDECEA', borderRadius: 12, height: 48, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  logoutBtnText: { color: colors.coralDark, fontWeight: '500', fontSize: 15 },

  // Lignes (Settings & Liens)
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  rowTextContainer: { flex: 1, paddingRight: 16 },
  rt: { fontSize: 16, fontWeight: '500', color: colors.tealDark },
  rs: { color: colors.muted, marginTop: 4, fontSize: 13, lineHeight: 18 },

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
    paddingHorizontal: 5, 
    paddingVertical: 5, 
    borderRadius: 20, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  providerBadgeText: { 
    color: '#5F6368', // Gris foncé Google
    fontSize: 12, 
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});