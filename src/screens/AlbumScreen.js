import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  FlatList,
  Modal,
  Share,
  TextInput,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  PreferenceHorizontalIcon,
  Notification03Icon,
  Menu01Icon,
  GridViewIcon,
  Video01Icon,
  FavouriteIcon,
  Camera01Icon,
  QrCodeIcon,
  Copy01Icon,
  UserMultipleIcon,
  Diamond01Icon,
  ComputerIcon,
  PencilEdit02Icon,
  ArrowRight01Icon,
  Tick02Icon,
  Delete02Icon,
  Logout01Icon,
} from '@hugeicons/core-free-icons';
import { colors } from '../theme';
import { CoralButton, BackButton, Sheet, RightModal, Logo } from '../components/UI';
import { EmptyPhotos, EmptyFavs, EmptyVideos } from '../components/AlbumArt';
import { useStore } from '../store';
import { StatusBar } from 'expo-status-bar';

const TABS = [
  { key: 'all', label: 'Tous', icon: GridViewIcon },
  { key: 'vid', label: 'Vidéos', icon: Video01Icon },
  { key: 'fav', label: 'Favoris', icon: FavouriteIcon },
];

const ORDERS = [
  { key: 'recent', label: 'Les plus récentes en premier' },
  { key: 'oldest', label: 'Les plus anciennes en premier' },
];

export default function AlbumScreen({ route, navigation }) {
  const { id } = route.params;
  const {
    state,
    addPhoto,
    refreshAlbumPhotos,
    deletePhotos,
    renameAlbum,
    deleteAlbum,
    leaveAlbum,
  } = useStore();
  const album = state.albums.find((a) => a.id === id);

  // Retour robuste : sur le web, /album/:id peut être le seul écran
  // de la pile (recharge, lien direct) → goBack() planterait.
  const goBackSafe = () =>
    navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Main');

  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState('all');
  const [uploading, setUploading] = useState(null); // { done, total } | null

  // Filtre
  const [filtre, setFilter] = useState(false);
  const [order, setOrder] = useState('recent');
  const orderDirty = order !== 'recent';

  // Menu / gestion album
  const [menuModal, setMenuModal] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [confirmDeleteAlbum, setConfirmDeleteAlbum] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  // Sélection multiple
  const [selected, setSelected] = useState(null); // null = mode normal
  const selecting = selected !== null;
  const [confirmDeletePhotos, setConfirmDeletePhotos] = useState(false);

  // Feedback copie du code
  const [copied, setCopied] = useState(false);

  // ── SUPABASE ALBUMS : intégration ──
  // Recharge les photos cloud à chaque fois que l'écran reprend le focus.
  useFocusEffect(
    useCallback(() => {
      if (album?.cloud) refreshAlbumPhotos(id);
    }, [id, album?.cloud])
  );
  // ── SUPABASE ALBUMS : fin ──

  // Propriétaire ? (un album local hors-ligne appartient toujours à l'utilisateur)
  const isOwner = !album?.cloud || album?.ownerId === state.user?.id;

  const photos = useMemo(() => {
    if (!album) return [];
    const base = tab === 'fav' ? album.photos.filter((p) => p.favorite) : album.photos;
    return order === 'oldest'
      ? [...base].sort((a, b) => a.createdAt - b.createdAt)
      : [...base].sort((a, b) => b.createdAt - a.createdAt);
  }, [album, tab, order]);

  if (!album) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.top}>
          <BackButton onPress={() => goBackSafe()} />
          <Text style={styles.title}>Album</Text>
        </View>
        <View style={styles.center}>
          <Text style={{ color: colors.muted }}>Album introuvable</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Actions ───────────────────────────────────────────────────────────

  const invite = () =>
    Share.share({
      message: `Rejoins mon album « ${album.name} » sur SharePix. Code : ${album.code}`,
    });

  const copyToClipboard = async () => {
    await Clipboard.setStringAsync(album.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const pick = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], // nouvelle API (MediaTypeOptions est dépréciée)
      quality: 0.8,
      allowsMultipleSelection: true,
    });
    if (res.canceled || !res.assets?.length) return;
    const assets = res.assets;
    setUploading({ done: 0, total: assets.length });
    // Upload séquentiel : progression fiable + pas de saturation réseau
    for (let i = 0; i < assets.length; i++) {
      await addPhoto(id, assets[i].uri);
      setUploading({ done: i + 1, total: assets.length });
    }
    setUploading(null);
  };

  // Sélection
  const enterSelection = (photoId) => setSelected([photoId]);
  const toggleSelect = (photoId) =>
    setSelected((cur) =>
      cur.includes(photoId) ? cur.filter((x) => x !== photoId) : [...cur, photoId]
    );
  const exitSelection = () => setSelected(null);
  const selectAll = () =>
    setSelected(selected.length === photos.length ? [] : photos.map((p) => p.id));

  const confirmDeleteSelected = () => {
    deletePhotos(id, selected);
    setConfirmDeletePhotos(false);
    exitSelection();
  };

  const submitRename = () => {
    if (renameValue.trim()) renameAlbum(id, renameValue);
    setRenameOpen(false);
  };

  const confirmDelete = async () => {
    setConfirmDeleteAlbum(false);
    setMenuModal(false);
    goBackSafe();
    await deleteAlbum(id);
  };

  const confirmLeaveAlbum = async () => {
    setConfirmLeave(false);
    setMenuModal(false);
    goBackSafe();
    await leaveAlbum(id);
  };

  // ── Sous-composants ───────────────────────────────────────────────────

  function Row({ icon, title, hint, onPress, last, danger }) {
    return (
      <TouchableOpacity
        style={[styles.row, last && { borderBottomWidth: 0 }]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <View style={[styles.rowIco, danger && { backgroundColor: '#FDECEA' }]}>
          <HugeiconsIcon icon={icon} size={20} color={danger ? colors.coral : colors.tealDark} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.rowT, danger && { color: colors.coral }]}>{title}</Text>
          {hint ? <Text style={styles.rowH}>{hint}</Text> : null}
        </View>
        <HugeiconsIcon icon={ArrowRight01Icon} size={18} color={colors.muted} />
      </TouchableOpacity>
    );
  }

  const renderPhoto = ({ item }) => {
    const isSel = selecting && selected.includes(item.id);
    return (
      <TouchableOpacity
        style={styles.cell}
        activeOpacity={0.85}
        onPress={() =>
          selecting
            ? toggleSelect(item.id)
            : navigation.navigate('Photo', { albumId: id, photoId: item.id })
        }
        onLongPress={() => !selecting && enterSelection(item.id)}
        delayLongPress={220}
      >
        <Image source={{ uri: item.uri }} style={styles.thumb} />
        {selecting && (
          <View style={[styles.selLayer, isSel && styles.selLayerOn]}>
            <View style={[styles.selDot, isSel && styles.selDotOn]}>
              {isSel && <HugeiconsIcon icon={Tick02Icon} size={13} color="#fff" strokeWidth={3} />}
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // ── Rendu ─────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.top}>
        <BackButton onPress={selecting ? exitSelection : goBackSafe} />
        {selecting ? (
          <>
            <Text style={[styles.title, { flex: 1 }]}>
              {selected.length} sélectionnée{selected.length > 1 ? 's' : ''}
            </Text>
            <TouchableOpacity onPress={selectAll} style={styles.iconBtn} hitSlop={10}>
              <HugeiconsIcon icon={Tick02Icon} size={22} color={colors.tealDark} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => selected.length && setConfirmDeletePhotos(true)}
              style={styles.iconBtn}
              hitSlop={10}
            >
              <HugeiconsIcon
                icon={Delete02Icon}
                size={22}
                color={selected.length ? colors.coral : colors.border}
              />
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.headText}>
              <Text style={styles.title} numberOfLines={1}>
                {album.name}
              </Text>
              <Text style={styles.meta}>
                {album.photos.length} photo{album.photos.length > 1 ? 's' : ''}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setFilter(true)}
              style={styles.iconBtn}
              activeOpacity={0.88}
            >
              <HugeiconsIcon icon={PreferenceHorizontalIcon} size={22} color={colors.tealDark} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => navigation.navigate('Main', { screen: 'Activités' })}
              style={styles.iconBtn}
              hitSlop={10}
            >
              <HugeiconsIcon icon={Notification03Icon} size={22} color={colors.tealDark} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setMenuModal(true)}
              style={styles.iconBtn}
              activeOpacity={0.88}
            >
              <HugeiconsIcon icon={Menu01Icon} size={22} color={colors.tealDark} />
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {TABS.map((t) => {
          const on = tab === t.key;
          return (
            <TouchableOpacity key={t.key} onPress={() => setTab(t.key)} style={styles.tab}>
              <View style={styles.tabInner}>
                <HugeiconsIcon
                  icon={t.icon}
                  size={18}
                  color={on ? colors.teal : colors.muted}
                  strokeWidth={on ? 2.2 : 1.6}
                />
                <Text style={[styles.tabT, on && styles.tabOn]}>{t.label}</Text>
              </View>
              {on ? <View style={styles.line} /> : <View style={styles.lineOff} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Contenu */}
      <View style={styles.contentContainer}>
        {tab === 'vid' ? (
          <View style={styles.center}>
            <EmptyVideos />
            <Text style={styles.emptyH}>Passez à l'Album Premium pour ajouter des vidéos</Text>
            <Text style={styles.emptyP}>
              Dans un Album Premium, chaque membre peut télécharger des vidéos.
            </Text>
            <View style={{ width: '84%', marginTop: 22 }}>
              <CoralButton title="En savoir plus" onPress={() => navigation.navigate('Premium')} />
            </View>
          </View>
        ) : photos.length === 0 ? (
          <View style={styles.center}>
            {tab === 'fav' ? <EmptyFavs /> : <EmptyPhotos />}
            <Text style={styles.emptyH}>
              {tab === 'fav'
                ? "Vous n'avez pas encore enregistré de favoris"
                : "Personne n'a encore téléchargé de photos"}
            </Text>
            {tab !== 'fav' && <Text style={styles.emptyP}>Téléchargez votre première photo.</Text>}
          </View>
        ) : (
          <FlatList
            data={photos}
            numColumns={3}
            keyExtractor={(item) => item.id}
            extraData={[selected, order]}
            contentContainerStyle={{ paddingBottom: 110 + insets.bottom, paddingTop: 4 }}
            renderItem={renderPhoto}
          />
        )}
      </View>

      {/* FAB */}
      {tab !== 'vid' && !selecting && (
        <View style={[styles.fabWrap, { paddingBottom: Math.max(insets.bottom, 38) }]}>
          <TouchableOpacity style={styles.fab} onPress={pick} activeOpacity={0.88}>
            <HugeiconsIcon icon={Camera01Icon} size={22} color="#fff" />
            <Text style={styles.fabTxt}>Ajouter</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Bannière upload avec progression */}
      <Modal visible={!!uploading} transparent animationType="fade">
        <SafeAreaView style={styles.modalContainer}>
          <View style={[styles.banner, { marginTop: insets.top + 10 }]}>
            <Text style={{ color: colors.tealDark, fontWeight: '600' }}>
              {uploading
                ? `Envoi ${uploading.done}/${uploading.total}… Ne fermez pas l'appli.`
                : ''}
            </Text>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Filtre (ordre réellement appliqué) */}
      <Sheet title="Trier les photos" visible={filtre} onClose={() => setFilter(false)}>
        <View style={{ paddingTop: 6 }}>
          <Text style={styles.hint}>
            Les photos sont triées par date d'ajout à l'album.
          </Text>
          <View style={styles.card}>
            {ORDERS.map((o, i) => {
              const on = order === o.key;
              return (
                <TouchableOpacity
                  key={o.key}
                  style={[
                    styles.opt,
                    i === ORDERS.length - 1 && { borderBottomWidth: 0 },
                    on && styles.optOn,
                  ]}
                  onPress={() => setOrder(o.key)}
                >
                  <Text style={[styles.optTxt, on && styles.optTxtOn]}>{o.label}</Text>
                  <View style={[styles.radio, on && styles.radioOn]} />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
        <View style={styles.footerBtn}>
          <CoralButton
            title="Appliquer"
            onPress={() => setFilter(false)}
            color={colors.coral}
          />
        </View>
      </Sheet>

      {/* Suppression multiple */}
      <Sheet
        title="Supprimer"
        visible={confirmDeletePhotos}
        onClose={() => setConfirmDeletePhotos(false)}
      >
        <View style={styles.delIco}>
          <HugeiconsIcon icon={Delete02Icon} size={28} color={colors.coral} />
        </View>
        <Text style={styles.delT}>
          Supprimer {selected?.length || 0} photo{(selected?.length || 0) > 1 ? 's' : ''} ?
        </Text>
        <Text style={styles.delP}>
          {selected?.length > 1 ? 'Elles seront' : 'Elle sera'} retirée
          {selected?.length > 1 ? 's' : ''} pour tous les membres de l'album.
        </Text>
        <TouchableOpacity style={styles.ctaDanger} onPress={confirmDeleteSelected} activeOpacity={0.8}>
          <Text style={styles.ctaTxt}>Supprimer</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.cancel}
          onPress={() => setConfirmDeletePhotos(false)}
          activeOpacity={0.8}
        >
          <Text style={styles.cancelTxt}>Annuler</Text>
        </TouchableOpacity>
      </Sheet>

      {/* Renommer (owner) */}
      <Sheet title="Renommer l'album" visible={renameOpen} onClose={() => setRenameOpen(false)}>
        <View style={styles.renameWrap}>
          <TextInput
            style={styles.renameInput}
            value={renameValue}
            onChangeText={setRenameValue}
            placeholder="Nom de l'album"
            placeholderTextColor={colors.muted}
            maxLength={60}
            autoFocus
          />
          <CoralButton title="Enregistrer" onPress={submitRename} color={colors.coral} />
        </View>
      </Sheet>

      {/* Supprimer l'album (owner) */}
      <Sheet
        title="Supprimer l'album"
        visible={confirmDeleteAlbum}
        onClose={() => setConfirmDeleteAlbum(false)}
      >
        <View style={styles.delIco}>
          <HugeiconsIcon icon={Delete02Icon} size={28} color={colors.coral} />
        </View>
        <Text style={styles.delT}>Supprimer « {album.name} » ?</Text>
        <Text style={styles.delP}>
          L'album et toutes ses photos seront définitivement supprimés pour tous les membres.
        </Text>
        <TouchableOpacity style={styles.ctaDanger} onPress={confirmDelete} activeOpacity={0.8}>
          <Text style={styles.ctaTxt}>Supprimer définitivement</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.cancel}
          onPress={() => setConfirmDeleteAlbum(false)}
          activeOpacity={0.8}
        >
          <Text style={styles.cancelTxt}>Annuler</Text>
        </TouchableOpacity>
      </Sheet>

      {/* Quitter l'album (membre) */}
      <Sheet title="Quitter l'album" visible={confirmLeave} onClose={() => setConfirmLeave(false)}>
        <View style={styles.delIco}>
          <HugeiconsIcon icon={Logout01Icon} size={28} color={colors.coral} />
        </View>
        <Text style={styles.delT}>Quitter « {album.name} » ?</Text>
        <Text style={styles.delP}>
          Vous n'aurez plus accès à cet album. Vous pourrez le rejoindre à nouveau avec le code
          d'invitation.
        </Text>
        <TouchableOpacity style={styles.ctaDanger} onPress={confirmLeaveAlbum} activeOpacity={0.8}>
          <Text style={styles.ctaTxt}>Quitter l'album</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancel} onPress={() => setConfirmLeave(false)} activeOpacity={0.8}>
          <Text style={styles.cancelTxt}>Annuler</Text>
        </TouchableOpacity>
      </Sheet>

      {/* Menu */}
      <RightModal title="Menu" visible={menuModal} onClose={() => setMenuModal(false)}>
        <View style={styles.hero}>
          <View style={styles.heroH}>
            <View style={styles.coverWrap}>
              {album.photos.length > 0 ? (
                <Image source={{ uri: album.photos[0].uri }} style={styles.coverImg} />
              ) : (
                <View style={styles.cover}>
                  <Logo size={12} color="#fff" />
                </View>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>
                {album.name}
              </Text>
              <Text style={styles.meta}>
                {album.photos.length} photo{album.photos.length > 1 ? 's' : ''} · privé
                {album.cloud ? ' · synchronisé' : ' · local'}
              </Text>
            </View>
          </View>

          {isOwner && (
            <TouchableOpacity
              style={styles.edit}
              activeOpacity={0.8}
              onPress={() => {
                setRenameValue(album.name);
                setMenuModal(false);
                setRenameOpen(true);
              }}
            >
              <HugeiconsIcon icon={PencilEdit02Icon} size={16} color={colors.tealDark} />
              <Text style={styles.editTxt}>Renommer l'album</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.card}>
          <Row
            icon={Diamond01Icon}
            title="Album Premium"
            hint="Vidéos et qualité originale"
            onPress={() => {
              setMenuModal(false);
              navigation.navigate('Premium');
            }}
          />
          <Row
            icon={UserMultipleIcon}
            title="Membres"
            hint="Gérer qui a accès"
            onPress={() => {
              setMenuModal(false);
              navigation.navigate('Members', { id: album.id });
            }}
          />
          <Row
            icon={ComputerIcon}
            title="Téléchargement PC"
            hint="Ajouter depuis le navigateur"
            last
            onPress={() => {
              setMenuModal(false);
              navigation.navigate('PcUpload');
            }}
          />
        </View>

        <View style={styles.invite}>
          <Text style={styles.inviteH}>Inviter des amis</Text>
          <Text style={styles.inviteP}>
            Partagez le code d'invitation pour ajouter des membres à cet album.
          </Text>
          <View style={styles.codeRow}>
            <TouchableOpacity style={styles.codeBox} onPress={copyToClipboard} activeOpacity={0.7}>
              <Text style={styles.code}>{album.code}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {copied && <Text style={styles.copiedTxt}>Copié !</Text>}
                <HugeiconsIcon
                  icon={copied ? Tick02Icon : Copy01Icon}
                  size={16}
                  color={colors.teal}
                />
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.inviteBtn} onPress={invite} activeOpacity={0.88}>
              <Text style={styles.inviteBtnTxt}>Inviter</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={styles.qr}
          onPress={() => {
            setMenuModal(false);
            navigation.navigate('QR', { id: album.id });
          }}
        >
          <HugeiconsIcon icon={QrCodeIcon} size={20} color={colors.tealDark} />
          <Text style={styles.qrTxt}>Voir le code QR</Text>
        </TouchableOpacity>

        {/* Zone propriétaire / membre */}
        <View style={[styles.card, { marginTop: 12, marginBottom: 20 }]}>
          {isOwner ? (
            <Row
              icon={Delete02Icon}
              title="Supprimer l'album"
              hint="Définitif, pour tous les membres"
              danger
              last
              onPress={() => setConfirmDeleteAlbum(true)}
            />
          ) : (
            <Row
              icon={Logout01Icon}
              title="Quitter l'album"
              hint="Vous pourrez revenir avec le code"
              last
              onPress={() => setConfirmLeave(true)}
            />
          )}
        </View>
      </RightModal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headText: { flex: 1, marginLeft: 2 },
  title: { fontWeight: '600', fontSize: 18, color: colors.tealDark },
  meta: { color: colors.muted, marginTop: 1, fontSize: 12 },
  contentContainer: { flex: 1 },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderColor: '#E4EEEE',
  },
  tab: { flex: 1, alignItems: 'center', paddingTop: 12 },
  tabInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tabT: { color: colors.muted, fontWeight: '600', fontSize: 13 },
  tabOn: { color: colors.teal },
  line: {
    height: 2.5,
    backgroundColor: colors.teal,
    width: '56%',
    marginTop: 10,
    borderRadius: 2,
  },
  lineOff: { height: 2.5, marginTop: 10 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  emptyH: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    color: colors.tealDark,
    marginTop: 16,
  },
  emptyP: { marginTop: 8, color: colors.muted, textAlign: 'center', fontSize: 15 },

  // Grille + sélection
  cell: { width: '33.33%', aspectRatio: 1, padding: 1.5 },
  thumb: { flex: 1, backgroundColor: '#DDECEC', borderRadius: 4 },
  selLayer: {
    ...StyleSheet.absoluteFillObject,
    margin: 1.5,
    borderRadius: 4,
    backgroundColor: 'rgba(22,78,82,0.12)',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    padding: 6,
  },
  selLayerOn: { backgroundColor: 'rgba(43,163,168,0.30)' },
  selDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selDotOn: { backgroundColor: colors.teal, borderColor: colors.teal },

  fabWrap: { position: 'absolute', left: 48, right: 48, bottom: 30 },
  fab: {
    height: 45,
    borderRadius: 28,
    backgroundColor: colors.coral,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: colors.tealDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  fabTxt: { color: '#fff', fontSize: 17, fontWeight: '600' },
  modalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  banner: {
    backgroundColor: colors.cream,
    padding: 14,
    marginHorizontal: 16,
    borderRadius: 12,
  },

  // Filtre
  section: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.tealDark,
    marginTop: 18,
    paddingHorizontal: 16,
  },
  hint: {
    color: colors.muted,
    marginTop: 6,
    marginBottom: 10,
    paddingHorizontal: 16,
    lineHeight: 20,
  },
  card: { backgroundColor: '#fff', marginHorizontal: 16, borderRadius: 5, overflow: 'hidden' },
  opt: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#E8EEEE',
  },
  optOn: { backgroundColor: '#F3F8F8' },
  optTxt: { fontSize: 15, color: colors.tealDark },
  optTxtOn: { fontWeight: '700' },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: '#B5C4C4',
  },
  radioOn: { borderWidth: 6, borderColor: colors.teal },
  footerBtn: {
    marginTop: 16,
    paddingHorizontal: 30,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },

  // Confirmations
  delIco: {
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
  delT: { fontSize: 20, fontWeight: '600', textAlign: 'center', color: colors.tealDark },
  delP: { textAlign: 'center', marginVertical: 8, color: colors.muted, lineHeight: 20, paddingHorizontal: 16 },
  ctaDanger: {
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginHorizontal: 16,
  },
  ctaTxt: { color: '#fff', fontWeight: '600', fontSize: 16 },
  cancel: {
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.light,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  cancelTxt: { fontWeight: '700', color: colors.tealDark },

  // Renommer
  renameWrap: { padding: 16, gap: 14 },
  renameInput: {
    backgroundColor: colors.light,
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 50,
    color: colors.tealDark,
    fontSize: 16,
    fontWeight: '600',
  },

  // Menu
  hero: { alignItems: 'center', paddingHorizontal: 18, paddingBottom: 8, paddingTop: 16 },
  heroH: { flexDirection: 'row', alignItems: 'center', gap: 12, alignSelf: 'stretch' },
  coverWrap: {},
  cover: {
    width: 60,
    height: 60,
    borderRadius: 22,
    backgroundColor: colors.tealDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverImg: { width: 60, height: 60, borderRadius: 22, backgroundColor: colors.border },
  name: { fontSize: 20, fontWeight: '600', color: colors.tealDark, marginTop: 1 },
  edit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    backgroundColor: '#fff',
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 14,
  },
  editTxt: { fontWeight: '600', color: colors.tealDark },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#E8EEEE',
    gap: 12,
    paddingHorizontal: 16,
  },
  rowIco: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowT: { fontSize: 14, fontWeight: '600', color: colors.tealDark },
  rowH: { color: colors.muted, fontSize: 12, marginTop: 2 },
  invite: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: '#D6EEEE',
  },
  inviteH: { fontWeight: '600', fontSize: 16, color: colors.tealDark },
  inviteP: { marginTop: 3, color: colors.tealDark },
  codeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14, gap: 10 },
  codeBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.light,
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 45,
  },
  code: { fontSize: 16, fontWeight: '600', letterSpacing: 1.2, color: colors.tealDark },
  copiedTxt: { color: colors.teal, fontWeight: '700', fontSize: 12 },
  inviteBtn: {
    backgroundColor: colors.coral,
    height: 40,
    paddingHorizontal: 20,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteBtnTxt: { color: '#fff', fontWeight: '600' },
  qr: {
    marginHorizontal: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#fff',
    borderRadius: 5,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  qrTxt: { fontWeight: '600', color: colors.tealDark, fontSize: 15 },
});
