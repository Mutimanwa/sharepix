import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  FlatList,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  PreferenceHorizontalIcon,
  Notification03Icon,
  Menu01Icon,
  GridViewIcon,
  Video01Icon,
  FavouriteIcon,
  Camera01Icon,
} from '@hugeicons/core-free-icons';
import { colors } from '../theme';
import { CoralButton } from '../components/UI';
import { EmptyPhotos, EmptyFavs, EmptyVideos } from '../components/AlbumArt';
import BackButton from '../components/BackButton';
import { useStore } from '../store';

const TABS = [
  { key: 'all', label: 'Tous', icon: GridViewIcon },
  { key: 'vid', label: 'Vidéos', icon: Video01Icon },
  { key: 'fav', label: 'Favoris', icon: FavouriteIcon },
];

export default function AlbumScreen({ route, navigation }) {
  const { id } = route.params;
  const { state, addPhoto } = useStore();
  const album = state.albums.find((a) => a.id === id);
  const [tab, setTab] = useState('all');
  const [uploading, setUploading] = useState(false);

  if (!album) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.top}>
          <BackButton onPress={() => navigation.goBack()} />
          <Text style={styles.title}>Album</Text>
        </View>
        <View style={styles.center}>
          <Text>Album introuvable</Text>
        </View>
      </SafeAreaView>
    );
  }

  const photos = tab === 'fav' ? album.photos.filter((p) => p.favorite) : album.photos;

  const pick = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsMultipleSelection: true,
    });
    if (res.canceled) return;
    setUploading(true);
    setTimeout(() => {
      res.assets.forEach((a) => addPhoto(id, a.uri));
      setUploading(false);
    }, 700);
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.top}>
        <BackButton onPress={() => navigation.goBack()} />
        <View style={styles.headText}>
          <Text style={styles.title} numberOfLines={1}>{album.name}</Text>
          <Text style={styles.meta}>
            {album.photos.length} photo{album.photos.length > 1 ? 's' : ''}
          </Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('Filters')} style={styles.iconBtn} hitSlop={10}>
          <HugeiconsIcon icon={PreferenceHorizontalIcon} size={22} color={colors.tealDark} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('Main', { screen: 'Activités' })} style={styles.iconBtn} hitSlop={10}>
          <HugeiconsIcon icon={Notification03Icon} size={22} color={colors.tealDark} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('Menu', { id })} style={styles.iconBtn} hitSlop={10}>
          <HugeiconsIcon icon={Menu01Icon} size={22} color={colors.tealDark} />
        </TouchableOpacity>
      </View>

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

      {tab === 'vid' ? (
        <View style={styles.center}>
          <EmptyVideos />
          <Text style={styles.emptyH}>Passez à l'Album Premium pour ajouter des vidéos</Text>
          <Text style={styles.emptyP}>Dans un Album Premium, chaque membre peut télécharger des vidéos.</Text>
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
          contentContainerStyle={{ paddingBottom: 100 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.cell}
              onPress={() => navigation.navigate('Photo', { albumId: id, photoId: item.id })}
            >
              <Image source={{ uri: item.uri }} style={styles.thumb} />
            </TouchableOpacity>
          )}
        />
      )}

      {tab !== 'vid' && (
        <View style={styles.fabWrap}>
          <TouchableOpacity style={styles.fab} onPress={pick} activeOpacity={0.88}>
            <HugeiconsIcon icon={Camera01Icon} size={22} color="#fff" />
            <Text style={styles.fabTxt}>Ajouter</Text>
          </TouchableOpacity>
        </View>
      )}

      <Modal visible={uploading} transparent animationType="fade">
        <View style={styles.banner}>
          <Text style={{ color: '#fff', fontWeight: '600' }}>
            Téléchargement en cours. Ne fermez pas l'appli.
          </Text>
        </View>
      </Modal>
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
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headText: { flex: 1, marginLeft: 2 },
  title: { fontWeight: '800', fontSize: 18, color: colors.tealDark },
  meta: { color: colors.muted, marginTop: 1 },
  tabs: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#E4EEEE' },
  tab: { flex: 1, alignItems: 'center', paddingTop: 12 },
  tabInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tabT: { color: colors.muted, fontWeight: '600' },
  tabOn: { color: colors.teal },
  line: { height: 2.5, backgroundColor: colors.teal, width: '56%', marginTop: 10, borderRadius: 2 },
  lineOff: { height: 2.5, marginTop: 10 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  emptyH: { fontSize: 20, fontWeight: '800', textAlign: 'center', color: colors.tealDark, marginTop: 16 },
  emptyP: { marginTop: 8, color: colors.muted, textAlign: 'center', fontSize: 15 },
  cell: { width: '33.33%', aspectRatio: 1, padding: 1.5 },
  thumb: { flex: 1, backgroundColor: '#DDECEC', borderRadius: 4 },
  fabWrap: { position: 'absolute', left: 48, right: 48, bottom: 28 },
  fab: {
    height: 54,
    borderRadius: 28,
    backgroundColor: colors.coral,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  fabTxt: { color: '#fff', fontSize: 17, fontWeight: '700' },
  banner: {
    marginTop: 88,
    backgroundColor: colors.tealDark,
    padding: 14,
    marginHorizontal: 16,
    borderRadius: 12,
  },
});
