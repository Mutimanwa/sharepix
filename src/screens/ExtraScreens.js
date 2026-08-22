import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Share,
  ScrollView,
  Image,
} from 'react-native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  Diamond01Icon,
  Video01Icon,
  Image01Icon,
  Copy01Icon,
  Tick02Icon,
  Delete02Icon,
} from '@hugeicons/core-free-icons';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../theme';
import { BackButton, CoralButton, Page, Sheet } from '../components/UI';
import { useStore } from '../store';
// ── SUPABASE ALBUMS : intégration ──
import { subscribeAlbumChanges } from '../services/albums';
// ── SUPABASE ALBUMS : fin ──

// ─────────────────────────────────────────────────────────────
// En-tête uniforme des écrans secondaires
// ─────────────────────────────────────────────────────────────
function ScreenHead({ title, onBack }) {
  return (
    <View style={styles.head}>
      <BackButton onPress={onBack} />
      <Text style={styles.headTitle}>{title}</Text>
      <View style={{ width: 44 }} />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Partage / copie du code d'invitation (réutilisé par QR + Membres)
// ─────────────────────────────────────────────────────────────
function shareAlbum(album) {
  return Share.share({
    message: `Rejoins mon album « ${album?.name} » sur SharePix. Code : ${album?.code}`,
  });
}

// ─────────────────────────────────────────────────────────────
// QR réel : encode le code d'invitation à 8 caractères.
// Un scan (appareil photo natif) affiche le code, copiable.
// ─────────────────────────────────────────────────────────────
export function QRScreen({ route, navigation }) {
  const album = useStore().state.albums.find((a) => a.id === route.params.id);
  const insets = useSafeAreaInsets();
  const [copied, setCopied] = useState(false);

  if (!album) {
    return (
      <Page style={styles.root} edges={['top']}>
        <ScreenHead title="Code QR" onBack={() => navigation.goBack()} />
        <View style={styles.center}>
          <Text style={styles.hintCenter}>Album introuvable</Text>
        </View>
      </Page>
    );
  }

  const copy = async () => {
    await Clipboard.setStringAsync(album.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <Page style={styles.root} edges={['top']}>
      <ScreenHead title="Code QR" onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={[styles.qrContainer, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.qrCard}>
          <QRCode value={album.code} size={200} color={colors.tealDeep} backgroundColor="#fff" />
        </View>
        <Text style={styles.albumName}>{album.name}</Text>
        <Text style={styles.hintCenter}>
          Scannez ce code avec l'appareil photo pour récupérer le code d'invitation.
        </Text>

        <TouchableOpacity style={styles.codeBox} onPress={copy} activeOpacity={0.7}>
          <Text style={styles.code}>{album.code}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {copied && <Text style={styles.copiedTxt}>Copié !</Text>}
            <HugeiconsIcon icon={copied ? Tick02Icon : Copy01Icon} size={16} color={colors.teal} />
          </View>
        </TouchableOpacity>

        <CoralButton
          title="Partager le code"
          onPress={() => shareAlbum(album)}
          style={{ marginTop: 18, width: '100%' }}
        />
      </ScrollView>
    </Page>
  );
}

// ─────────────────────────────────────────────────────────────
// Membres : liste RÉELLE (cloud) + retrait par le propriétaire.
// Refresh au focus + Realtime (arrivée/départ en direct).
// ─────────────────────────────────────────────────────────────
export function MembersScreen({ route, navigation }) {
  const { state, refreshAlbumMembers, removeAlbumMember } = useStore();
  const album = state.albums.find((a) => a.id === route.params.id);
  const insets = useSafeAreaInsets();
  const [copied, setCopied] = useState(false);
  const [confirm, setConfirm] = useState(null); // membre à retirer

  const myId = state.user?.id;
  // Un album local hors-ligne appartient toujours à l'utilisateur
  const isOwner = !album?.cloud || album?.ownerId === myId;
  const members = album?.members || [];

  // ── SUPABASE ALBUMS : intégration ──
  // Au focus : chargement des membres réels + abonnement Realtime.
  const refreshRef = useRef(refreshAlbumMembers);
  refreshRef.current = refreshAlbumMembers;

  useFocusEffect(
    useCallback(() => {
      if (!album?.cloud) return undefined;
      refreshRef.current(route.params.id);

      let timer = null;
      const unsubscribe = subscribeAlbumChanges(route.params.id, () => {
        clearTimeout(timer);
        timer = setTimeout(() => refreshRef.current(route.params.id), 400);
      });
      return () => {
        clearTimeout(timer);
        unsubscribe();
      };
    }, [route.params.id, album?.cloud])
  );
  // ── SUPABASE ALBUMS : fin ──

  if (!album) {
    return (
      <Page style={styles.root} edges={['top']}>
        <ScreenHead title="Membres" onBack={() => navigation.goBack()} />
        <View style={styles.center}>
          <Text style={styles.hintCenter}>Album introuvable</Text>
        </View>
      </Page>
    );
  }

  const copy = async () => {
    await Clipboard.setStringAsync(album.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const isOwnerRole = (m) => m.role === 'owner' || m.role === 'admin';

  return (
    <Page style={styles.root} edges={['top']}>
      <ScreenHead title="Membres" onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={[styles.membersScroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {members.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.membersCount}>
              {members.length} membre{members.length > 1 ? 's' : ''}
            </Text>
            {members.map((m, i) => {
              const me = m.userId === myId;
              return (
                <View
                  key={m.userId || `${m.name}-${i}`}
                  style={[styles.memberRow, i === members.length - 1 && { borderBottomWidth: 0 }]}
                >
                  <View style={styles.memberAvatar}>
                    <Text style={styles.memberAvatarTxt}>
                      {(m.name || 'M')[0].toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowT}>
                      {m.name}
                      {me ? ' (vous)' : ''}
                    </Text>
                    <Text style={styles.rowH}>
                      {isOwnerRole(m) ? 'Propriétaire' : 'Membre'}
                    </Text>
                  </View>
                  {/* Le propriétaire peut retirer un membre (jamais lui-même) */}
                  {isOwner && !me && !isOwnerRole(m) && (
                    <TouchableOpacity
                      style={styles.memberRemove}
                      onPress={() => setConfirm(m)}
                      hitSlop={8}
                      activeOpacity={0.7}
                    >
                      <HugeiconsIcon icon={Delete02Icon} size={18} color={colors.coral} />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        )}

        <View style={styles.emptyCard}>
          <Image
            source={require('../../assets/empty/members.png')}
            style={{ width: 190, height: 190 }}
          />
          <Text style={styles.emptyH}>
            {members.length > 0 ? 'Agrandir le cercle' : 'Pas encore de membres'}
          </Text>
          <Text style={styles.hintCenter}>
            Partagez le code d'invitation pour ajouter vos proches à « {album.name} ».
          </Text>
          <TouchableOpacity style={styles.codeBox} onPress={copy} activeOpacity={0.7}>
            <Text style={styles.code}>{album.code}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {copied && <Text style={styles.copiedTxt}>Copié !</Text>}
              <HugeiconsIcon icon={copied ? Tick02Icon : Copy01Icon} size={16} color={colors.teal} />
            </View>
          </TouchableOpacity>
          <CoralButton
            title="Inviter"
            onPress={() => shareAlbum(album)}
            style={{ marginTop: 16, width: '100%' }}
          />
        </View>
      </ScrollView>

      {/* Confirmation retrait d'un membre */}
      <Sheet
        title="Retirer un membre"
        visible={!!confirm}
        onClose={() => setConfirm(null)}
      >
        <View style={styles.confirmIco}>
          <HugeiconsIcon icon={Delete02Icon} size={28} color={colors.coral} />
        </View>
        <Text style={styles.emptyH}>Retirer {confirm?.name} ?</Text>
        <Text style={styles.hintCenter}>
          {confirm?.name} n'aura plus accès à « {album.name} » ni à ses photos.
        </Text>
        <CoralButton
          title="Retirer de l'album"
          onPress={() => {
            removeAlbumMember(album.id, confirm.userId);
            setConfirm(null);
          }}
          style={{ marginTop: 16, marginHorizontal: 8 }}
        />
        <CoralButton
          title="Annuler"
          color={colors.light}
          textColor={colors.tealDark}
          onPress={() => setConfirm(null)}
          style={{ marginHorizontal: 8 }}
        />
      </Sheet>
    </Page>
  );
}

// ─────────────────────────────────────────────────────────────
// Premium (vitrine — pas de paiement branché pour le moment)
// ─────────────────────────────────────────────────────────────
const PERKS = [
  { icon: Video01Icon, title: 'Vidéos illimitées', hint: 'Chaque membre peut déposer des films' },
  { icon: Image01Icon, title: 'Qualité originale', hint: 'Aucun recadrage, aucun tassement' },
  { icon: Diamond01Icon, title: 'Espace étendu', hint: 'Plus de souvenirs, plus longtemps' },
];

export function PremiumScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  return (
    <Page style={styles.root} edges={['top']}>
      <ScreenHead title="Album Premium" onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.cover}>
            <HugeiconsIcon icon={Diamond01Icon} size={36} color="#fff" />
          </View>
          <Text style={styles.albumName}>Passez à Premium</Text>
          <Text style={styles.hintCenter}>
            Vidéos, qualité originale et plus d'espace pour vos événements.
          </Text>
        </View>
        <View style={styles.card}>
          {PERKS.map((p, i) => (
            <View
              key={p.title}
              style={[styles.perk, i === PERKS.length - 1 && { borderBottomWidth: 0 }]}
            >
              <View style={styles.rowIco}>
                <HugeiconsIcon icon={p.icon} size={20} color={colors.tealDark} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowT}>{p.title}</Text>
                <Text style={styles.rowH}>{p.hint}</Text>
              </View>
              <HugeiconsIcon icon={Tick02Icon} size={18} color={colors.teal} />
            </View>
          ))}
        </View>
        <View style={styles.warn}>
          <Text style={styles.warnT}>
            Le Play Store n'est pas disponible pour le moment. Réessayez plus tard.
          </Text>
        </View>
      </ScrollView>
    </Page>
  );
}

// ─────────────────────────────────────────────────────────────
// Téléchargement PC (guide pas à pas)
// ─────────────────────────────────────────────────────────────
const STEPS = [
  {
    image: require('../../assets/ilustration/webdevise.png'),
    title: 'Ouvrez web.sharepix.app',
    hint: 'Sur l\'ordinateur, dans votre navigateur.',
  },
  {
    image: require('../../assets/ilustration/qrcode.png'),
    title: 'Scannez le QR affiché',
    hint: 'Tenez le téléphone devant l\'écran pour lier l\'album.',
  },
];

export function PcUploadScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  return (
    <Page style={styles.root} edges={['top']}>
      <ScreenHead title="Téléchargement PC" onBack={() => navigation.goBack()} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
      >
        <Text style={styles.lead}>
          Ajoutez photos et vidéos à l'album depuis le navigateur de votre ordinateur.
        </Text>
        {STEPS.map((s, i) => (
          <View key={s.title} style={styles.stepCard}>
            <View style={styles.n}>
              <Text style={styles.nTxt}>{i + 1}</Text>
            </View>
            <Image source={s.image} style={{ width: 200, height: 200 }} />
            <Text style={styles.stepT}>{s.title}</Text>
            <Text style={styles.rowH}>{s.hint}</Text>
          </View>
        ))}
      </ScrollView>
    </Page>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  headTitle: { fontWeight: '600', fontSize: 18, color: colors.tealDark },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  hintCenter: { color: colors.muted, textAlign: 'center', marginTop: 8, lineHeight: 20 },

  // QR
  qrContainer: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 60 },
  qrCard: {
    padding: 18,
    borderRadius: 5,
    backgroundColor: '#fff',
    shadowColor: '#164E52',
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 3,
  },
  albumName: {
    fontSize: 22,
    fontWeight: '600',
    marginTop: 18,
    color: colors.tealDark,
    textAlign: 'center',
  },
  codeBox: {
    marginTop: 18,
    backgroundColor: colors.light,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  code: { fontWeight: '700', letterSpacing: 2, color: colors.tealDark, fontSize: 16 },
  copiedTxt: { color: colors.teal, fontWeight: '700', fontSize: 12 },

  // Membres
  membersScroll: { paddingHorizontal: 16, paddingTop: 12, gap: 12 },
  card: { backgroundColor: '#fff', borderRadius: 18, overflow: 'hidden' },
  membersCount: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    color: colors.muted,
    fontWeight: '700',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#E8EEEE',
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.light,
    borderWidth: 1,
    borderColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarTxt: { fontWeight: '800', color: colors.tealDark },
  memberRemove: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FDECEA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmIco: {
    alignSelf: 'center',
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#FDECEA',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 10,
  },
  emptyCard: { backgroundColor: '#fff', borderRadius: 22, padding: 24, alignItems: 'center' },
  emptyH: { fontSize: 20, fontWeight: '600', textAlign: 'center', color: colors.tealDark },

  // Premium / partagé
  hero: { alignItems: 'center', marginBottom: 18 },
  cover: {
    width: 84,
    height: 84,
    borderRadius: 24,
    backgroundColor: colors.tealDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  perk: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#E8EEEE',
  },
  rowIco: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowT: { fontSize: 15, fontWeight: '700', color: colors.tealDark },
  rowH: { color: colors.muted, fontSize: 12, marginTop: 2 },
  warn: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginTop: 16 },
  warnT: { textAlign: 'center', color: colors.tealDark, lineHeight: 22 },

  // PC upload
  lead: { fontSize: 16, lineHeight: 23, color: colors.tealDark, marginBottom: 14 },
  stepCard: { backgroundColor: '#fff', borderRadius: 18, padding: 18, marginBottom: 12 },
  n: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.light,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  nTxt: { fontWeight: '800', color: colors.tealDark },
  stepT: { fontWeight: '700', fontSize: 16, color: colors.tealDark, marginTop: 8 },
});
