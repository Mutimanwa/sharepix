import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors } from '../theme';
import { CoralButton, Field, Logo, Sheet, Page } from '../components/UI';
// ── SQUELETTES : intégration ──
// Couvertures d'albums : pulsation jusqu'à onLoad, puis révélation en fondu
import { ProgressiveImage } from '../components/Skeleton';
// ── SQUELETTES : fin ──
import CodeBoxes from '../components/CodeBoxes';
import { useQrScanner } from '../components/QrScanner';
import { extractInviteCode } from '../lib/inviteCode';
import { IconVacances, IconFamille, IconBebe, IconSpecial } from '../components/HomeArt';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  Add01Icon,
  UserAdd01Icon,
  KeyboardIcon,
  QrCodeScanIcon,
  ArrowRight01Icon,
} from '@hugeicons/core-free-icons';
import { useStore } from '../store';
import { StatusBar } from 'expo-status-bar';

const suggestions = [
  { title: 'Vacances', sub: 'Vos plus beaux voyages', bg: '#D6F0F1', Icon: IconVacances },
  { title: 'Famille', sub: 'Retrouvailles et fêtes', bg: '#F8E3DE', Icon: IconFamille },
  { title: '1ère année', sub: 'Les premiers rires', bg: '#E4F4F4', Icon: IconBebe },
  { title: 'Moments clés', sub: 'Les instants uniques', bg: '#FDE8E4', Icon: IconSpecial },
];

export default function HomeScreen() {
  const nav = useNavigation();
  const route = useRoute(); // ── DEEP LINK QR : param ?code= du scan ──
  const { state, createAlbum, joinAlbum } = useStore();
  const scanner = useQrScanner();
  
  const [create, setCreate] = useState(false);
  const [joinStage, setJoinStage] = useState(null);
  const [name, setName] = useState('');
  const [first, setFirst] = useState(state.profile.firstName);
  const [code, setCode] = useState('');
  
  // <-- AJOUT des states de chargement
  const [loadingCreate, setLoadingCreate] = useState(false);
  const [loadingJoin, setLoadingJoin] = useState(false);

  const openCreatePopup = () => {
    setJoinStage(null);
    setCreate(true);
  };

  const openJoinPopup = () => {
    setCreate(false);
    setCode('');
    setJoinStage('options');
  };

  // ── DEEP LINK QR : intégration ──
  // Jointure factorisée : utilisée par le bouton "Continuer" ET par
  // l'arrivée d'un lien sharepix://join?code=XXXXXXXX (QR scanné).
  const submitJoin = async (codeToUse) => {
    const finalCode = String(codeToUse || code).trim().toUpperCase();
    if (finalCode.length < 8 || loadingJoin) return;
    setLoadingJoin(true);
    try {
      // Utilise la fonction cloud du store au lieu de chercher localement
      const album = await joinAlbum(finalCode);
      if (album) {
        setJoinStage(null);
        setCode('');
        nav.navigate('Album', { id: album.id });
      } else if (!state.user?.id) {
        // Session absente (hors-ligne ?) : code cloud invérifiable
        Alert.alert('Réseau', "Impossible de vérifier le code pour l'instant. Vérifiez votre connexion puis réessayez.");
      } else {
        Alert.alert('Introuvable', "Ce code d'album n'existe pas ou a été supprimé.");
      }
    } catch (err) {
      Alert.alert('Erreur', err.message || "Impossible de rejoindre l'album.");
    } finally {
      setLoadingJoin(false);
    }
  };

  // `submitJoin` est recréée à chaque rendu : on l'expose via une ref pour
  // que l'effet de deep link ci-dessous n'ait pas à la mettre en dépendance
  // (sinon l'effet se relancerait à chaque frappe dans les champs).
  const submitJoinRef = useRef(submitJoin);
  // Sans tableau de dépendances : la ref suit la dernière version de
  // `submitJoin` à chaque rendu (pattern « latest callback »).
  useEffect(() => {
    submitJoinRef.current = submitJoin;
  });

  const openJoinQrScanner = () => {
    setJoinStage(null);
    setCode('');
    // Laisser le panneau se retirer avant de monter la caméra plein écran.
    setTimeout(async () => {
      try {
        const opened = await scanner.openScanner({
          onScan: (data) => {
            const inviteCode = extractInviteCode(data);
            if (!inviteCode) {
              Alert.alert('QR non reconnu', "Scannez un code QR d'invitation SharePix.");
              return false;
            }
            submitJoinRef.current(inviteCode);
            return true;
          },
        });
        if (!opened) {
          Alert.alert('Caméra indisponible', "Autorisez l'accès à la caméra pour scanner un QR.");
        }
      } catch (error) {
        Alert.alert('Scanner indisponible', error?.message || 'Impossible d’ouvrir la caméra.');
      }
    }, 180);
  };

  // Lien sharepix://join?code=XXXXXXXX (QR scanné) :
  // 1. pré-remplit le code + ouvre la feuille de saisie
  // 2. auto-submit dès que la session est prête (au 1er démarrage l'auth
  //    anonyme peut encore être en cours → on garde le code en attente)
  const pendingJoin = useRef(null);
  useEffect(() => {
    const incoming = route.params?.code;
    if (incoming) {
      pendingJoin.current = String(incoming).trim().toUpperCase();
      setCode(pendingJoin.current);
      setJoinStage('code');
      // paramètre consommé : ne pas relancer le flux à la navigation suivante
      nav.setParams({ code: undefined });
    }
    if (pendingJoin.current && state.authChecked) {
      const toSubmit = pendingJoin.current;
      pendingJoin.current = null;
      submitJoinRef.current(toSubmit);
    }
  }, [route.params?.code, state.authChecked, nav]);
  // ── DEEP LINK QR : fin ──

  // Les albums cloud sont ordonnés du plus récent au plus ancien par le store.
  const featuredAlbum = state.albums[0] || null;
  const featuredPhoto = featuredAlbum?.photos?.[0];
  const featuredCover = featuredPhoto?.uri || featuredAlbum?.coverUrl;

  return (
    // ── BUG-03 : plus de compensation manuelle — Page applique l'inset top
    // via SafeAreaView (react-native-safe-area-context). La garder ici
    // produirait un double padding.
    <Page style={styles.root} edges={['top', 'left', 'right']}>
      <StatusBar style='dark' />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <Logo size={31} />
            <View style={styles.brandBadge}>
              <Text style={styles.brandBadgeText}>ALBUMS PARTAGÉS</Text>
            </View>
          </View>
          <Text style={styles.greeting}>
            {state.profile.firstName ? `Bonjour, ${state.profile.firstName}` : 'Bienvenue sur SharePix'}
          </Text>
          <Text style={styles.sub}>Vos moments préférés, réunis au même endroit.</Text>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroCopy}>
            <Text style={styles.heroEyebrow}>
              {featuredAlbum ? 'VOTRE DERNIER ALBUM' : 'DES SOUVENIRS À PARTAGER'}
            </Text>
            <Text style={styles.heroTitle} numberOfLines={3}>
              {featuredAlbum ? featuredAlbum.name : 'Chaque moment mérite d’être partagé.'}
            </Text>
            <Text style={styles.heroDescription} numberOfLines={3}>
              {featuredAlbum
                ? 'Vos photos restent réunies ici. Ouvrez votre album pour continuer.'
                : 'Créez un album privé et rassemblez les photos de toute la famille.'}
            </Text>
            {featuredAlbum ? (
              <TouchableOpacity
                style={styles.heroLink}
                activeOpacity={0.75}
                onPress={() => nav.navigate('Album', { id: featuredAlbum.id })}
                accessibilityRole="button"
                accessibilityLabel={`Ouvrir l’album ${featuredAlbum.name}`}
              >
                <Text style={styles.heroLinkText}>Ouvrir l’album</Text>
                <HugeiconsIcon icon={ArrowRight01Icon} size={17} color={colors.tealDark} strokeWidth={2} />
              </TouchableOpacity>
            ) : null}
          </View>
          <View style={styles.heroVisual}>
            {featuredCover ? (
              <ProgressiveImage
                uri={featuredCover}
                storagePath={featuredPhoto?.storagePath}
                style={styles.heroPhoto}
                radius={18}
              />
            ) : (
              <Image
                source={require('../../assets/ilustration/01.png')}
                style={styles.heroIllustration}
                resizeMode="contain"
                accessibilityLabel="Des proches qui partagent un album photo"
              />
            )}
          </View>
        </View>

        <View style={styles.actions} collapsable={false}>
          <TouchableOpacity
            style={styles.actCoral}
            onPress={openCreatePopup}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel="Créer un nouvel album"
            testID="home-create-album"
          >
            <HugeiconsIcon icon={Add01Icon} size={21} color={colors.white} strokeWidth={2.2} />
            <Text style={[styles.actTitle, { color: colors.white }]}>Créer un album</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actTeal}
            onPress={openJoinPopup}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel="Rejoindre un album"
            testID="home-join-album"
          >
            <HugeiconsIcon icon={UserAdd01Icon} size={21} color={colors.tealDark} strokeWidth={2} />
            <Text style={[styles.actTitle, { color: colors.tealDark }]}>Rejoindre</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionHead}>
          <View>
            <Text style={styles.sectionTitle}>Mes albums</Text>
            <Text style={styles.sectionSubtitle}>
              {state.albums.length > 0 ? 'Tous vos souvenirs partagés.' : 'Ils apparaîtront ici.'}
            </Text>
          </View>
          <Text style={styles.count}>{state.albums.length}</Text>
        </View>

        {state.albums.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <HugeiconsIcon icon={Add01Icon} size={23} color={colors.tealDark} strokeWidth={2} />
            </View>
            <View style={styles.emptyCopy}>
              <Text style={styles.emptyT}>Votre premier album vous attend</Text>
              <Text style={styles.emptyS}>Créez-le ou rejoignez l’album d’un proche pour commencer.</Text>
            </View>
          </View>
        ) : (
          <View style={styles.grid}>
            {state.albums.map((album) => (
              <TouchableOpacity
                key={album.id}
                style={styles.album}
                onPress={() => nav.navigate('Album', { id: album.id })}
                activeOpacity={0.84}
                accessibilityRole="button"
                accessibilityLabel={`Ouvrir l’album ${album.name}`}
              >
                <View style={styles.cover}>
                  {album.photos[0]?.uri || album.coverUrl ? (
                    <ProgressiveImage
                      uri={album.photos[0]?.uri || album.coverUrl}
                      storagePath={album.photos[0]?.storagePath}
                      style={styles.coverImg}
                      radius={16}
                    />
                  ) : (
                    <Image
                      source={require('../../assets/empty/photo.png')}
                      style={styles.coverPlaceholder}
                      resizeMode="contain"
                    />
                  )}
                </View>
                <Text style={styles.albumName} numberOfLines={1}>{album.name}</Text>
                <Text style={styles.albumMeta}>
                  {album.photos.length || album.photoCount || 0} photo{(album.photos.length || album.photoCount || 0) > 1 ? 's' : ''}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.ideasSection}>
          <View style={styles.sectionHead}>
            <View>
              <Text style={styles.sectionTitle}>Idées d’albums</Text>
              <Text style={styles.sectionSubtitle}>Une occasion pour chaque souvenir.</Text>
            </View>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.ideasList}
          >
            {suggestions.map((suggestion) => {
              const SuggestionIcon = suggestion.Icon;
              return (
                <TouchableOpacity
                  key={suggestion.title}
                  style={[styles.idea, { backgroundColor: suggestion.bg }]}
                  onPress={() => {
                    setName(suggestion.title);
                    setCreate(true);
                  }}
                  activeOpacity={0.84}
                  accessibilityRole="button"
                  accessibilityLabel={`Créer un album ${suggestion.title}`}
                >
                  <SuggestionIcon size={76} />
                  <View style={styles.ideaCopy}>
                    <Text style={styles.ideaT}>{suggestion.title}</Text>
                    <Text style={styles.ideaS}>{suggestion.sub}</Text>
                  </View>
                  <HugeiconsIcon icon={ArrowRight01Icon} size={18} color={colors.tealDark} strokeWidth={1.8} />
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </ScrollView>

      {/* Sheet Créer */}
      <Sheet visible={create} onClose={() => setCreate(false)} title="Personnalisez votre album">
        <Field
          label="Nom de l'album"
          value={name}
          onChangeText={setName}
          keyboardType="default"
          autoCapitalize="sentences"
          returnKeyType="next"
        />
        <Field 
          label="Votre prénom" 
          value={first} 
          onChangeText={setFirst}
          autoCapitalize="words"
          keyboardType="default"
        />
        <Text style={styles.sheetHint}>Vous pouvez à nouveau changer les deux.</Text>
        <CoralButton
          title={loadingCreate ? "Création en cours..." : "Créer un album"}
          disabled={!name.trim() || !first.trim() || loadingCreate}
          onPress={async () => {
            setLoadingCreate(true);
            try {
              const alb = await createAlbum({ name: name.trim(), firstName: first.trim() });
              setCreate(false);
              nav.navigate('Album', { id: alb.id });
            } catch (err) {
              Alert.alert("Erreur", err.message || "Impossible de créer l'album.");
            } finally {
              setLoadingCreate(false);
            }
          }}
        />
      </Sheet>

      {/* Parcours « Rejoindre » : choix code/QR puis saisie si nécessaire */}
      <Sheet
        visible={Boolean(joinStage)}
        onClose={() => {
          setJoinStage(null);
          setCode('');
        }}
        title={joinStage === 'options' ? 'Rejoindre un album' : 'Saisir le code'}
      >
        {joinStage === 'options' ? (
          <View style={styles.joinOptions}>
            <Text style={styles.joinIntro}>
              Choisissez comment vous avez reçu l’invitation.
            </Text>
            <TouchableOpacity
              style={styles.joinOption}
              activeOpacity={0.78}
              onPress={() => {
                setCode('');
                setJoinStage('code');
              }}
              accessibilityRole="button"
              accessibilityLabel="Saisir un code"
              accessibilityHint="Entrez le code à 8 caractères reçu avec l’invitation."
              testID="home-join-by-code"
            >
              <View style={[styles.joinOptionIcon, styles.joinCodeIcon]}>
                <HugeiconsIcon icon={KeyboardIcon} size={23} color={colors.tealDark} strokeWidth={1.8} />
              </View>
              <View style={styles.joinOptionCopy}>
                <Text style={styles.joinOptionTitle}>Saisir un code</Text>
                <Text style={styles.joinOptionDescription}>Entrez le code à 8 caractères reçu.</Text>
              </View>
              <HugeiconsIcon icon={ArrowRight01Icon} size={20} color={colors.muted} strokeWidth={1.8} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.joinOption}
              activeOpacity={0.78}
              onPress={openJoinQrScanner}
              accessibilityRole="button"
              accessibilityLabel="Scanner un QR code"
              accessibilityHint="Ouvre l’appareil photo pour scanner une invitation SharePix."
              testID="home-join-by-qr"
            >
              <View style={[styles.joinOptionIcon, styles.joinQrIcon]}>
                <HugeiconsIcon icon={QrCodeScanIcon} size={23} color={colors.coralDark} strokeWidth={1.8} />
              </View>
              <View style={styles.joinOptionCopy}>
                <Text style={styles.joinOptionTitle}>Scanner un QR code</Text>
                <Text style={styles.joinOptionDescription}>Scannez le code partagé par l’organisateur.</Text>
              </View>
              <HugeiconsIcon icon={ArrowRight01Icon} size={20} color={colors.muted} strokeWidth={1.8} />
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <TouchableOpacity
              onPress={() => setJoinStage('options')}
              style={{ marginBottom: 8, paddingVertical: 6 }}
              accessibilityRole="button"
              accessibilityLabel="Retour aux options de connexion"
            >
              <Text style={{ color: colors.tealDark, fontWeight: '700' }}>← Autres options</Text>
            </TouchableOpacity>
            <Text style={styles.sheetHint}>Entrez le code à 8 caractères pour rejoindre l'album.</Text>
            <CodeBoxes value={code} onChange={setCode} autoFocus />
            <CoralButton
              title={loadingJoin ? 'Recherche...' : 'Continuer'}
              disabled={code.length < 8 || loadingJoin}
              onPress={() => submitJoin()}
            />
          </>
        )}
      </Sheet>
    </Page>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  content: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 680,
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 32,
  },
  header: { marginBottom: 18 },
  brandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  brandBadge: {
    backgroundColor: colors.peach,
    borderRadius: 20,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  brandBadgeText: {
    color: colors.tealDark,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  greeting: {
    color: colors.tealDark,
    fontSize: 25,
    lineHeight: 31,
    fontWeight: '700',
    letterSpacing: -0.35,
  },
  sub: { color: colors.muted, marginTop: 3, fontSize: 14, lineHeight: 20 },
  heroCard: {
    minHeight: 202,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    backgroundColor: colors.peach,
    borderRadius: 24,
    padding: 17,
    marginBottom: 16,
  },
  heroCopy: { flex: 1, zIndex: 1 },
  heroEyebrow: {
    color: colors.tealDark,
    fontSize: 9,
    lineHeight: 13,
    fontWeight: '800',
    letterSpacing: 0.75,
    marginBottom: 7,
  },
  heroTitle: {
    color: colors.tealDeep,
    fontSize: 21,
    lineHeight: 26,
    fontWeight: '700',
    letterSpacing: -0.25,
  },
  heroDescription: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 7,
  },
  heroLink: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  heroLinkText: { color: colors.tealDark, fontSize: 12, fontWeight: '700', marginRight: 3 },
  heroVisual: {
    width: '41%',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 3,
  },
  heroIllustration: { width: 142, height: 158 },
  heroPhoto: { width: '100%', height: 146, borderRadius: 18 },
  actions: { flexDirection: 'row', gap: 10, marginBottom: 25 },
  actCoral: {
    flex: 1,
    minHeight: 52,
    backgroundColor: colors.coralDark,
    borderRadius: 17,
    paddingHorizontal: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actTeal: {
    flex: 1,
    minHeight: 52,
    backgroundColor: colors.white,
    borderColor: colors.teal,
    borderWidth: 1.5,
    borderRadius: 17,
    paddingHorizontal: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actTitle: { fontSize: 13, fontWeight: '700', marginLeft: 7 },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: { color: colors.tealDark, fontSize: 19, lineHeight: 24, fontWeight: '700' },
  sectionSubtitle: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 2 },
  count: {
    minWidth: 31,
    textAlign: 'center',
    overflow: 'hidden',
    backgroundColor: colors.peach,
    color: colors.tealDark,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    fontSize: 12,
    fontWeight: '700',
  },
  empty: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cream,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 20,
    padding: 15,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.peach,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },
  emptyCopy: { flex: 1 },
  emptyT: { color: colors.tealDark, fontSize: 14, fontWeight: '700' },
  emptyS: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 },
  album: { width: '50%', padding: 6 },
  cover: {
    height: 148,
    borderRadius: 16,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  coverImg: { width: '100%', height: '100%' },
  coverPlaceholder: { width: 94, height: 94 },
  albumName: { fontSize: 15, lineHeight: 20, fontWeight: '700', marginTop: 8, color: colors.tealDark },
  albumMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  ideasSection: { marginTop: 25 },
  ideasList: { paddingRight: 18, gap: 10 },
  idea: {
    width: 260,
    minHeight: 105,
    borderRadius: 20,
    padding: 12,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  ideaCopy: { flex: 1 },
  ideaT: { fontWeight: '700', color: colors.tealDark, fontSize: 15 },
  ideaS: { color: colors.muted, marginTop: 4, fontSize: 12, lineHeight: 16 },
  sheetHint: {
    textAlign: 'center',
    marginVertical: 10,
    fontSize: 14,
    color: colors.muted,
  },
  joinOptions: { paddingTop: 2, paddingBottom: 4 },
  joinIntro: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    marginHorizontal: 2,
    marginBottom: 14,
  },
  joinOption: {
    minHeight: 84,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 13,
    marginBottom: 11,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.white,
  },
  joinOptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  joinCodeIcon: { backgroundColor: colors.peach },
  joinQrIcon: { backgroundColor: '#FBEDE9' },
  joinOptionCopy: { flex: 1, paddingRight: 8 },
  joinOptionTitle: { color: colors.tealDark, fontSize: 15, fontWeight: '700' },
  joinOptionDescription: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 4 },
});
