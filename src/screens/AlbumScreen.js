import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  FlatList,
  Modal,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '../theme';
import { CoralButton } from '../components/UI';
import { useStore } from '../store';

export default function AlbumScreen({ route, navigation }) {
  const { id } = route.params;
  const { state, addPhoto } = useStore();
  const album = state.albums.find((a) => a.id === id);
  const [tab, setTab] = useState('all');
  const [uploading, setUploading] = useState(false);

  if (!album) {
    return (
      <View style={styles.center}>
        <Text>Album introuvable</Text>
      </View>
    );
  }

  const photos =
    tab === 'fav' ? album.photos.filter((p) => p.favorite) : album.photos;

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
    <View style={styles.root}>
      <View style={styles.top}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={{ fontSize: 22 }}>‹</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={{ fontWeight: '700', fontSize: 18 }}>{album.name}</Text>
          <Text style={{ color: colors.muted }}>{album.photos.length} photos</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('Filters')} style={{ padding: 8 }}>
          <Text>⚙</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('Menu', { id })} style={{ padding: 8 }}>
          <Text>☰</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        {[
          ['all', 'Tous'],
          ['vid', 'Vidéos'],
          ['fav', 'Favoris'],
        ].map(([k, l]) => (
          <TouchableOpacity key={k} onPress={() => setTab(k)} style={styles.tab}>
            <Text style={[styles.tabT, tab === k && styles.tabOn]}>{l}</Text>
            {tab === k && <View style={styles.line} />}
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'vid' ? (
        <View style={styles.center}>
          <Text style={styles.emptyH}>Passez maintenant à l'Album Premium pour ajouter des vidéos</Text>
          <Text style={styles.emptyP}>Dans un Album Premium, chaque membre peut télécharger des vidéos.</Text>
          <Text style={{ marginTop: 12, color: colors.muted }}>par / mois ou par / an</Text>
          <View style={{ width: '80%', marginTop: 24 }}>
            <CoralButton title="apprendre encore plus" onPress={() => navigation.navigate('Premium')} />
          </View>
        </View>
      ) : photos.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyH}>
            {tab === 'fav' ? "Vous n'avez pas encore enregistré de favoris" : "Personne n'a encore téléchargé de photos"}
          </Text>
          {tab !== 'fav' && <Text style={styles.emptyP}>Téléchargez votre première photo.</Text>}
        </View>
      ) : (
        <FlatList
          data={photos}
          numColumns={3}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={{ width: '33.33%', aspectRatio: 1, padding: 1 }}
              onPress={() => navigation.navigate('Photo', { albumId: id, photoId: item.id })}
            >
              <Image source={{ uri: item.uri }} style={{ flex: 1, backgroundColor: '#eee' }} />
            </TouchableOpacity>
          )}
        />
      )}

      {tab !== 'vid' && (
        <View style={styles.fabWrap}>
          <CoralButton title="📷  Ajouter" onPress={pick} />
        </View>
      )}

      <Modal visible={uploading} transparent>
        <View style={styles.banner}>
          <Text style={{ color: '#fff' }}>1 fichier est en cours de téléchargement. Ne fermez pas l'appli.</Text>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F6F6F7' },
  top: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 12 },
  tabs: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#eee' },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  tabT: { color: colors.muted, fontWeight: '600' },
  tabOn: { color: colors.coral },
  line: { height: 2, backgroundColor: colors.coral, width: '50%', marginTop: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  emptyH: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  emptyP: { marginTop: 8, color: colors.muted, textAlign: 'center' },
  fabWrap: { position: 'absolute', left: 40, right: 40, bottom: 24 },
  banner: { marginTop: 80, backgroundColor: '#222', padding: 14, marginHorizontal: 12, borderRadius: 10 },
});
