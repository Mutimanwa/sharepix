import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  Alert, // <-- AJOUT
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors } from '../theme';
import { CoralButton, Field, Logo, Sheet, Page, SmallButton } from '../components/UI';
// ── SQUELETTES : intégration ──
// Couvertures d'albums : pulsation jusqu'à onLoad, puis révélation en fondu
import { ProgressiveImage } from '../components/Skeleton';
// ── SQUELETTES : fin ──
import CodeBoxes from '../components/CodeBoxes';
import { IconVacances, IconFamille, IconBebe, IconSpecial } from '../components/HomeArt';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { Add01Icon, UserAdd01Icon } from '@hugeicons/core-free-icons';
import { useStore } from '../store';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  const insets = useSafeAreaInsets();
  
  const [create, setCreate] = useState(false);
  const [join, setJoin] = useState(false);
  const [name, setName] = useState('');
  const [first, setFirst] = useState(state.profile.firstName);
  const [code, setCode] = useState('');
  
  // <-- AJOUT des states de chargement
  const [loadingCreate, setLoadingCreate] = useState(false);
  const [loadingJoin, setLoadingJoin] = useState(false);

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
        setJoin(false);
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

  // Lien sharepix://join?code=XXXXXXXX (QR scanné) :
  // 1. pré-remplit les cases + ouvre la feuille "Rejoindre"
  // 2. auto-submit dès que la session est prête (au 1er démarrage l'auth
  //    anonyme peut encore être en cours → on garde le code en attente)
  const pendingJoin = useRef(null);
  useEffect(() => {
    const incoming = route.params?.code;
    if (incoming) {
      pendingJoin.current = String(incoming).trim().toUpperCase();
      setCode(pendingJoin.current);
      setJoin(true);
      // paramètre consommé : ne pas relancer le flux à la navigation suivante
      nav.setParams({ code: undefined });
    }
    if (pendingJoin.current && state.authChecked) {
      const toSubmit = pendingJoin.current;
      pendingJoin.current = null;
      submitJoin(toSubmit);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params?.code, state.authChecked]);
  // ── DEEP LINK QR : fin ──

  return (
    <Page style={[styles.root ,{ paddingTop: insets.top }]} edges={['top', 'left', 'right']}>
      <StatusBar style='dark' />

        <View style={styles.header}>
          <Logo size={36} />
          <Text style={styles.sub}>Vos souvenirs, en un seul endroit</Text>
        </View> 

        {/* Actions Buttons */}
        <View style={[styles.actions,{paddingBottom: 10}]}>
          <TouchableOpacity style={[styles.actCoral]} onPress={() => setCreate(true)} activeOpacity={0.88}>
            <HugeiconsIcon icon={Add01Icon} size={22} color={colors.coral} strokeWidth={2} />
            <Text style={[styles.actTitle , {color: colors.coral}]}>Nouvel album</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actTeal}
            onPress={() => {
              setCode('');
              setJoin(true);
            }}
            activeOpacity={0.88}
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
                    <ProgressiveImage uri={a.photos[0]?.uri || a.coverUrl} style={styles.coverImg} radius={5} />
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
          autoFocus
        />
        <Field 
          label="Votre prénom" 
          value={first} 
          onChangeText={setFirst} 
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

      {/* Sheet Rejoindre */}
      <Sheet
        visible={join}
        onClose={() => {
          setJoin(false);
          setCode('');
        }}
        title="Rejoindre un album"
      >
        <Text style={styles.sheetHint}>Entrez le code à 8 caractères pour rejoindre l'album.</Text>
        {join ? <CodeBoxes value={code} onChange={setCode} /> : null}
        <CoralButton 
          title={loadingJoin ? "Recherche..." : "Continuer"} 
          disabled={code.length < 8 || loadingJoin}
          // ── DEEP LINK QR : logique factorisée dans submitJoin (voir plus haut) ──
          onPress={() => submitJoin()}
        />
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
  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: 18, marginTop: 18 },
  actCoral: {
    flex: 1,
    height: 40,
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
    height: 40,
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
});
