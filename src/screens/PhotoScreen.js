import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
} from 'react-native';
import { colors } from '../theme';
import { CoralButton } from '../components/UI';
import { useStore } from '../store';

export default function PhotoScreen({ route, navigation }) {
  const { albumId, photoId } = route.params;
  const { state, toggleLike, toggleFavorite, addComment, deletePhoto } = useStore();
  const album = state.albums.find((a) => a.id === albumId);
  const photo = album?.photos.find((p) => p.id === photoId);
  const [text, setText] = useState('');
  const [del, setDel] = useState(false);
  const [tip, setTip] = useState(true);

  if (!photo) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text>Photo introuvable</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.top}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={{ fontSize: 22 }}>‹</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={{ fontWeight: '700' }}>{state.profile.firstName || 'Vous'}</Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>il y a quelques secondes</Text>
        </View>
        <TouchableOpacity onPress={() => setDel(true)}>
          <Text style={{ fontSize: 18 }}>🗑</Text>
        </TouchableOpacity>
      </View>
      <Image source={{ uri: photo.uri }} style={styles.img} resizeMode="contain" />
      <View style={styles.actions}>
        <TouchableOpacity onPress={() => toggleLike(albumId, photoId)}>
          <Text style={{ fontSize: 22 }}>{photo.liked ? '♥' : '♡'}</Text>
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', gap: 16 }}>
          <Text style={{ fontSize: 20 }}>↓</Text>
          <TouchableOpacity onPress={() => toggleFavorite(albumId, photoId)}>
            <Text style={{ fontSize: 20 }}>{photo.favorite ? '★' : '☆'}</Text>
          </TouchableOpacity>
        </View>
      </View>
      {tip && (
        <View style={styles.tip}>
          <Text style={{ color: '#fff', flex: 1 }}>Cliquez sur l'étoile pour ajouter la photo à vos moments préférés.</Text>
          <TouchableOpacity onPress={() => setTip(false)}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>OK</Text>
          </TouchableOpacity>
        </View>
      )}
      <ScrollView style={{ paddingHorizontal: 14 }}>
        {photo.comments.map((c) => (
          <View key={c.id} style={styles.cmt}>
            <Text style={{ fontWeight: '700' }}>{c.author}</Text>
            <Text>{c.text}</Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>J'aime   Répondre</Text>
          </View>
        ))}
      </ScrollView>
      <View style={styles.bar}>
        <TextInput
          style={styles.inp}
          placeholder="Commenter ..."
          value={text}
          onChangeText={setText}
        />
        <TouchableOpacity
          style={styles.send}
          onPress={() => {
            if (!text.trim()) return;
            addComment(albumId, photoId, text.trim());
            setText('');
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '700' }}>➤</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={del} transparent animationType="slide">
        <View style={styles.modal}>
          <View style={styles.sheet}>
            <Text style={{ fontSize: 20, fontWeight: '800', textAlign: 'center' }}>Supprimer définitivement ?</Text>
            <Text style={{ textAlign: 'center', marginVertical: 10, color: '#444' }}>
              Êtes-vous sur ? Ce sera supprimé pour tous les invités.
            </Text>
            <CoralButton
              title="Supprimer"
              onPress={() => {
                deletePhoto(albumId, photoId);
                setDel(false);
                navigation.goBack();
              }}
            />
            <CoralButton title="Annuler" color="#F1F1F3" textColor="#111" onPress={() => setDel(false)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  top: { flexDirection: 'row', alignItems: 'center', padding: 12 },
  img: { width: '100%', height: 320, backgroundColor: '#111' },
  actions: { flexDirection: 'row', justifyContent: 'space-between', padding: 14 },
  tip: { backgroundColor: '#222', marginHorizontal: 12, padding: 12, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  cmt: { backgroundColor: '#F3F3F4', borderRadius: 12, padding: 10, marginVertical: 6 },
  bar: { flexDirection: 'row', padding: 10, alignItems: 'center', gap: 8 },
  inp: { flex: 1, backgroundColor: '#F1F1F3', borderRadius: 22, paddingHorizontal: 14, height: 44 },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.coral, alignItems: 'center', justifyContent: 'center' },
  modal: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
});
