import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
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
import { cloudFetchRecentPhotos, subscribePhotosSummary } from '../services/albums';
import { StatusBar } from 'expo-status-bar';

function formatRecentDate(timestamp) {
  if (!timestamp) return 'récemment';
  const minutes = Math.floor((Date.now() - timestamp) / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  return new Date(timestamp).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

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
  const [cloudRecentPhotos, setCloudRecentPhotos] = useState([]);
  const recentRefreshTimer = useRef(null);

  useFocusEffect(
    useCallback(() => {
      if (!state.user?.id) {
        setCloudRecentPhotos([]);
        return undefined;
      }
      let active = true;
      cloudFetchRecentPhotos(12)
        .then(({ data, error }) => {
          if (active && !error) setCloudRecentPhotos(data || []);
        })
        .catch(() => {});
      return () => { active = false; };
    }, [state.user?.id])
  );

  useEffect(() => {
    if (!state.user?.id) return undefined;
    const unsubscribe = subscribePhotosSummary(() => {
      clearTimeout(recentRefreshTimer.current);
      recentRefreshTimer.current = setTimeout(async () => {
        try {
          const { data, error } = await cloudFetchRecentPhotos(12);
          if (!error) setCloudRecentPhotos(data || []);
        } catch {
          // Les dernières photos déjà affichées restent disponibles hors-ligne.
        }
      }, 650);
    });
    return () => {
      clearTimeout(recentRefreshTimer.current);
      unsubscribe();
    };
  }, [state.user?.id]);

  const recentPhotos = useMemo(() => {
    const byId = new Map((cloudRecentPhotos || []).map((photo) => [photo.id, photo]));
    state.albums.forEach((album) => {
      (album.photos || []).forEach((photo) => {
        if (!byId.has(photo.id)) byId.set(photo.id, { ...photo, albumId: album.id, albumName: album.name });
      });
    });
    return [...byId.values()]
      .filter((photo) => photo.uri && photo.albumId)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, 12);
  }, [cloudRecentPhotos, state.albums]);

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

  return (
    // ── BUG-03 : plus de compensation manuelle — Page applique l'inset top
    // via SafeAreaView (react-native-safe-area-context). La garder ici
    // produirait un double padding.
    <Page style={styles.root} edges={['top', 'left', 'right']}>
      <StatusBar style='dark' />

        <View style={styles.header}>
          <Logo size={36} />
          <Text style={styles.sub}>Vos souvenirs, en un seul endroit</Text>
        </View> 

        {/* Actions Buttons */}
        <View style={[styles.actions, { paddingBottom: 10 }]} collapsable={false}>
          <TouchableOpacity
            style={styles.actCoral}
            onPress={openCreatePopup}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel="Créer un nouvel album"
            testID="home-create-album"
          >
            <HugeiconsIcon icon={Add01Icon} size={22} color={colors.coral} strokeWidth={2} />
            <Text style={[styles.actTitle, { color: colors.coral }]}>Nouvel album</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actTeal}
            onPress={openJoinPopup}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel="Rejoindre un album"
            testID="home-join-album"
          >
            <HugeiconsIcon icon={UserAdd01Icon} size={22} color={colors.tealDark} strokeWidth={2} />
            <Text style={[styles.actTitle , {color: colors.tealDark}]}>Rejoindre</Text>
          </TouchableOpacity>
        </View>

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={{ paddingBottom: 28 }}
        keyboardShouldPersistTaps="handled"
      >

        {recentPhotos.length > 0 && (
          <View style={styles.recentSection}>
            <View style={styles.rowHead}>
              <Text style={styles.h}>Photos récentes</Text>
              <Text style={styles.recentHint}>Tous vos albums</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentRail}>
              {recentPhotos.map((photo) => (
                <TouchableOpacity
                  key={`${photo.albumId}:${photo.id}`}
                  style={styles.recentCard}
                  activeOpacity={0.85}
                  onPress={() => nav.navigate('Album', { id: photo.albumId })}
                  accessibilityRole="button"
                  accessibilityLabel={`Ouvrir l’album ${photo.albumName || 'photo récente'}`}
                >
                  <View style={styles.recentImageWrap}>
                    <ProgressiveImage
                      uri={photo.uri}
                      storagePath={photo.storagePath}
                      style={styles.recentImage}
                      radius={12}
                    />
                    <View style={styles.recentTimePill}>
                      <Text style={styles.recentTime}>{formatRecentDate(photo.createdAt)}</Text>
                    </View>
                  </View>
                  <Text style={styles.recentAlbumName} numberOfLines={1}>{photo.albumName || 'Album'}</Text>
                  <Text style={styles.recentAuthor} numberOfLines={1}>
                    {photo.authorName ? `Ajoutée par ${photo.authorName}` : 'Nouvelle photo'}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Idee d'albums */}
        <Text style={styles.h}>Idées d'albums</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 8 }}>
          {suggestions.map((s) => {
            const Ico = s.Icon;
            return (
              <TouchableOpacity
                key={s.title}
                style={[styles.idea, { backgroundColor: s.bg }]}
                onPress={() => {
                  setName(s.title);
                  setCreate(true);
                }}
              >
                <Ico />
                <View style={{ flex: 1, justifyContent: 'center' }}>
                  <Text style={styles.ideaT}>{s.title}</Text>
                  <Text style={styles.ideaS}>{s.sub}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>



        {/* Albums */}
        <View style={styles.rowHead}>
          <Text style={styles.h}>Mes albums</Text>
          <Text style={styles.count}>{state.albums.length}</Text>
        </View>

        {state.albums.length === 0 ? (
          <View style={styles.empty}>
            <View >
               <Image source={require('../../assets/empty/album.png')} style={{ width: 120, height: 120 }} />
            </View>
            <Text style={styles.emptyT}>Aucun album pour le moment</Text>
            <Text style={styles.emptyS}>Créez le premier ou rejoignez un proche.</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {state.albums.map((a) => (
              <TouchableOpacity key={a.id} style={styles.album} onPress={() => nav.navigate('Album', { id: a.id })}>
                <View style={styles.cover}>
                  {/* ── COUVERTURE ACCUEIL : photos chargées (album déjà ouvert)
                      sinon couverture cloud pré-signée au boot (coverUrl) ── */}
                  {(a.photos[0]?.uri || a.coverUrl) ? (
                    // ── SQUELETTES : intégration ──
                    <ProgressiveImage
                      uri={a.photos[0]?.uri || a.coverUrl}
                      storagePath={a.photos[0]?.storagePath || a.coverStoragePath}
                      style={styles.coverImg}
                      radius={5}
                    />
                    // ── SQUELETTES : fin ──
                  ) : (
                    <Image source={require('../../assets/empty/photo.png')} style={{ width: 150, height: 150 }} />
                  )}
                </View>
                <Text style={styles.albumName} numberOfLines={1}>{a.name}</Text>
                <Text style={styles.albumMeta}>
                  {/* photos chargées (album ouvert) sinon compteur cloud pré-chargé (photoCount) */}
                  {a.photos.length || a.photoCount || 0} photo{(a.photos.length || a.photoCount || 0) > 1 ? 's' : ''}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
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
  root: { flex: 1, },
  header: {
    display: 'flex',
    flexDirection: 'column' ,
    paddingHorizontal: 18,
    paddingTop: 3,
    alignItems: 'center'
  },
  sub: { color: colors.muted, marginTop: 4, fontSize: 14 },
  actions: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 18,
    marginTop: 18,
    position: 'relative',
    zIndex: 10,
    elevation: 10,
  },
  actCoral: {
    flex: 1,
    minHeight: 48,
    color: colors.coral,
    borderColor: colors.coral,
    borderWidth: 1,
    borderRadius: 30,
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actTeal: {
    flex: 1,
    minHeight: 48,
    color: colors.tealDark,
    borderColor: colors.tealDark,
    borderWidth: 1,
    borderRadius: 30,
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actTitle: { color: '#fff', fontSize: 14, fontWeight: '600', marginLeft: 8 },
  h: { fontSize: 17, fontWeight: '600', color: colors.tealDark, paddingHorizontal: 18, marginTop: 22, marginBottom: 12 },
  idea: {
    width: 300,
    borderRadius: 5,
    padding: 14,
    marginLeft: 18,
    flexDirection: 'row',
    gap: 15,
    alignItems: 'center',
  },
  ideaT: { fontWeight: '700', color: colors.tealDark, fontSize: 15 },
  ideaS: { color: '#434848', marginTop: 4, fontSize: 15 },
  rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: 18 },
  recentSection: { marginTop: 3 },
  recentHint: { color: colors.muted, fontSize: 12, marginTop: 18 },
  recentRail: { paddingLeft: 18, paddingRight: 8, paddingBottom: 4 },
  recentCard: { width: 132, marginRight: 11 },
  recentImageWrap: { height: 142, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.cream },
  recentImage: { width: '100%', height: '100%' },
  recentTimePill: {
    position: 'absolute',
    left: 7,
    bottom: 7,
    borderRadius: 11,
    backgroundColor: 'rgba(20, 35, 35, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  recentTime: { color: '#fff', fontSize: 10, fontWeight: '600' },
  recentAlbumName: { color: colors.tealDark, fontSize: 13, fontWeight: '700', marginTop: 7 },
  recentAuthor: { color: colors.muted, fontSize: 11, marginTop: 2 },
  count: {
    marginTop: 10,
    backgroundColor: colors.teal,
    color: '#fff',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    fontWeight: '600',
  },
  empty: {
    marginHorizontal: 18,
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 22,
    alignItems: 'center',
  },
  emptyT: { fontWeight: '700', color: colors.tealDark },
  emptyS: { color: colors.muted, marginTop: 6, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12 },
  album: { width: '50%', padding: 6 },
  cover: {
    height: 150,
    borderRadius: 5,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  coverImg: { width: '100%', height: '100%' },
  albumName: { fontSize: 19, fontWeight: '600', marginTop: 8, color: colors.tealDark, paddingHorizontal: 4 },
  albumMeta: { color: colors.muted, paddingHorizontal: 4, marginTop: 2 },
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
  joinOptionTitle: {
    color: colors.tealDark,
    fontSize: 15,
    fontWeight: '700',
  },
  joinOptionDescription: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
});
