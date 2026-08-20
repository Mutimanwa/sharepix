import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity, Linking, ActivityIndicator, Pressable } from 'react-native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { 
  UserCircle02Icon, 
  Logout01Icon, 
  Camera01Icon, 
  ArrowRight01Icon, 
  ShieldCheckIcon,
  CheckmarkBadge01Icon
} from '@hugeicons/core-free-icons';
import { Field } from '../components/UI';
import { useStore } from '../store';
import { colors } from '../theme';
import { isSupabaseConfigured } from '../config';
import { signOut } from '../services/auth';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

// ── COMPOSANTS RÉUTILISABLES POUR L'UI ──

// Ligne de paramètre avec un Switch (zone de clic élargie)
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
        // Empêche le switch de capturer le clic au détriment du Pressable parent sur Android
        pointerEvents="none" 
      />
    </Pressable>
  );
}

// Ligne de navigation pour les liens (CGV, FAQ, etc.)
function LinkRow({ title, onPress, isLast, isDestructive }) {
  return (
    <TouchableOpacity 
      style={[styles.row, !isLast && styles.rowBorder]} 
      onPress={onPress} 
      activeOpacity={0.7}
    >
      <Text style={[styles.rt, isDestructive && { color: colors.coralDark }]}>{title}</Text>
      <HugeiconsIcon icon={ArrowRight01Icon} size={18} color={isDestructive ? colors.coralDark : colors.muted} />
    </TouchableOpacity>
  );
}

// ── ÉCRAN PRINCIPAL ──

export default function ProfileScreen({ navigation }) {
  const { state, updateProfile, clearAuthUser } = useStore();
  const p = state.profile;
  const insets = useSafeAreaInsets();
  const user = state.user;
  const [busyOut, setBusyOut] = useState(false);

  const handleLogout = async () => {
    if (busyOut) return;
    setBusyOut(true);
    try { await signOut(); } catch {}
    clearAuthUser();
    setBusyOut(false);
  };

  const handleSave = () => {
    // Logique de sauvegarde API/Store ici
    console.log("Profil sauvegardé");
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
          <TouchableOpacity style={styles.avatarContainer} activeOpacity={0.8}>
            <View style={styles.avatar}>
              <Text style={styles.avatarInitials}>
                {user ? (user.firstName || user.email || 'S')[0].toUpperCase() : <HugeiconsIcon icon={UserCircle02Icon} size={50} color="#fff" />}
              </Text>
            </View>
            <View style={styles.avatarBadge}>
              <HugeiconsIcon icon={Camera01Icon} size={14} color="#fff" />
            </View>
          </TouchableOpacity>
        </View>

        {/* ── BANNIÈRE COMPTE : GESTION DU MODE INVITE VS CONNECTÉ ── */}
        {isSupabaseConfigured && !user && (
          <View style={[styles.card, styles.guestCard]}>
            <View style={styles.accountRow}>
              <View style={[styles.accountIcon, { backgroundColor: '#FFF3E0' }]}>
                   <HugeiconsIcon icon={Camera01Icon} size={34} color={colors.tealDark} />
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

        {isSupabaseConfigured && user && (
          <View style={styles.card}>
            <View style={styles.accountRow}>
              <View style={[styles.accountIcon, { backgroundColor: colors.tealLight }]}>
                <HugeiconsIcon icon={CheckmarkBadge01Icon} size={24} color={colors.tealDark} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.accountT}>
                  {`${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Compte vérifié'}
                </Text>
                <Text style={styles.accountS}>{user.email}</Text>
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
       <Text style={styles.sectionTitle}>Informations personnelles</Text>
        <View style={styles.card}>
          <Field label="Prénom" value={p.firstName} onChangeText={(firstName) => updateProfile({ firstName })} />
          
          <Field label="Nom de famille" value={p.lastName} onChangeText={(lastName) => updateProfile({ lastName })} />
        </View>

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
          <LinkRow title="FAQ - Questions Fréquentes" onPress={() => {}} />
          <LinkRow title="Restaurer les achats" onPress={() => {}} />
          <LinkRow title="Conditions Générales (CGV)" onPress={() => {}} />
          <LinkRow title="Sécurité des données" onPress={() => {}} />
          <LinkRow title="Supprimer mon compte" isDestructive onPress={() => {}} isLast />
        </View>

        <Text style={styles.versionText}>SharePix Version 1.0.0</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' }, // Fond légèrement gris pour faire ressortir les cartes blanches
  scrollContent: { paddingHorizontal: 16, paddingBottom: 40 },
  
  // Header
  head: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 20, justifyContent: 'space-between', alignItems: 'center' , borderBottomWidth: 1, borderBottomColor: colors.border, },
  title: { fontSize: 20, fontWeight: '600', color: colors.tealDark },
  saveBtn: { paddingVertical: 6, paddingHorizontal: 12, },
  saveBtnText: { color: colors.coral  , fontWeight: '700', fontSize: 14 },

  // Avatar
  avatarSection: { alignItems: 'center', marginVertical: 20 },
  avatarContainer: { position: 'relative' },
  avatar: { width: 80, height: 80, borderRadius: 45, backgroundColor: colors.coral, alignItems: 'center', justifyContent: 'center', shadowColor: colors.coral, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  avatarInitials: { color: '#fff', fontSize: 32, fontWeight: '700' , alignItems: 'center', justifyContent: 'center' ,paddingTop: 6},
  avatarBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: colors.tealDark, width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#F7F9FA' },

  // Sections
  sectionTitle: { fontSize: 13, fontWeight: '600', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginLeft: 8, marginBottom: 8, marginTop: 16 },
  card: {  borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 16, marginBottom: 16 },
  
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
  helpDesc: { marginTop: 6, color: colors.teal, fontSize: 14, lineHeight: 20 },
  mailBtn: { marginTop: 16, backgroundColor: colors.coral, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  mailBtnText: { color: colors.white, fontWeight: '700', fontSize: 14 },

  versionText: { color: colors.muted, marginTop: 8, marginBottom: 10, textAlign: 'center', fontSize: 12, fontWeight: '500' },
});