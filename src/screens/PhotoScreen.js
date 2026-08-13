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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  Delete02Icon,
  FavouriteIcon,
  StarIcon,
  Download01Icon,
  SentIcon,
} from '@hugeicons/core-free-icons';
import { colors } from '../theme';
import BackButton from '../components/BackButton';
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
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.top}>
          <BackButton onPress={() => navigation.goBack()} />
          <Text style={styles.author}>Photo</Text>
        </View>
        <View style={styles.center}>
          <Text style={{ color: colors.muted }}>Photo introuvable</Text>
        </View>
      </SafeAreaView>
    );
  }

  const send = () => {
    if (!text.trim()) return;
    addComment(albumId, photoId, text.trim());
    setText('');
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.top}>
          <BackButton onPress={() => navigation.goBack()} />
          <View style={{ flex: 1 }}>
            <Text style={styles.author}>{state.profile.firstName || 'Vous'}</Text>
            <Text style={styles.when}>à l'instant</Text>
          </View>
          <TouchableOpacity style={styles.iconHit} onPress={() => setDel(true)} hitSlop={8}>
            <HugeiconsIcon icon={Delete02Icon} size={22} color={colors.coral} />
          </TouchableOpacity>
        </View>

        <Image source={{ uri: photo.uri }} style={styles.img} resizeMode="contain" />

        <View style={styles.actions}>
          <TouchableOpacity style={styles.act} onPress={() => toggleLike(albumId, photoId)}>
            <HugeiconsIcon
              icon={FavouriteIcon}
              size={24}
              color={photo.liked ? colors.coral : colors.tealDark}
              strokeWidth={photo.liked ? 2.4 : 1.6}
            />
            <Text style={[styles.actLbl, photo.liked && { color: colors.coral }]}>J'aime</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.act}>
            <HugeiconsIcon icon={Download01Icon} size={22} color={colors.tealDark} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.act}
            onPress={() => {
              toggleFavorite(albumId, photoId);
              setTip(false);
            }}
          >
            <HugeiconsIcon
              icon={StarIcon}
              size={24}
              color={photo.favorite ? colors.coral : colors.tealDark}
              strokeWidth={photo.favorite ? 2.4 : 1.6}
            />
          </TouchableOpacity>
        </View>

        {tip && (
          <View style={styles.tip}>
            <Text style={styles.tipTxt}>Touchez l'étoile pour ajouter la photo à vos favoris.</Text>
            <TouchableOpacity onPress={() => setTip(false)}>
              <Text style={styles.tipOk}>OK</Text>
            </TouchableOpacity>
          </View>
        )}

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14, paddingBottom: 8 }}>
          {photo.comments.length === 0 ? (
            <Text style={styles.emptyC}>Soyez le premier à commenter.</Text>
          ) : (
            photo.comments.map((c) => (
              <View key={c.id} style={styles.cmt}>
                <View style={styles.av}>
                  <Text style={styles.avT}>{(c.author || 'V')[0]}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={styles.cmtA}>{c.author}</Text>
                    <Text style={styles.when}>à l'instant</Text>
                  </View>
                  <Text style={styles.cmtB}>{c.text}</Text>
                  <Text style={styles.cmtAct}>J'aime    Répondre</Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>

        <View style={styles.bar}>
          <TextInput
            style={styles.inp}
            placeholder="Commenter ..."
            placeholderTextColor={colors.muted}
            value={text}
            onChangeText={setText}
            onSubmitEditing={send}
            returnKeyType="send"
          />
          <TouchableOpacity style={[styles.send, !text.trim() && { opacity: 0.45 }]} onPress={send}>
            <HugeiconsIcon icon={SentIcon} size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={del} transparent animationType="slide">
        <View style={styles.modal}>
          <View style={styles.sheet}>
            <View style={styles.sheetTop}>
              <View style={{ width: 50 }} />
              <Text style={styles.sheetH}>Supprimer</Text>
              <BackButton variant="close" onPress={() => setDel(false)} />
            </View>
            <View style={styles.delIco}>
              <HugeiconsIcon icon={Delete02Icon} size={28} color={colors.coral} />
            </View>
            <Text style={styles.delT}>Supprimer définitivement ?</Text>
            <Text style={styles.delP}>Cette photo sera retirée pour tous les invités de l'album.</Text>
            <TouchableOpacity
              style={styles.cta}
              onPress={() => {
                deletePhoto(albumId, photoId);
                setDel(false);
                navigation.goBack();
              }}
            >
              <Text style={styles.ctaTxt}>Supprimer</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancel} onPress={() => setDel(false)}>
              <Text style={styles.cancelTxt}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  top: { flexDirection: 'row', alignItems: 'center', paddingRight: 8 },
  author: { fontWeight: '800', fontSize: 16, color: colors.tealDark },
  when: { color: colors.muted, fontSize: 12, marginTop: 1 },
  iconHit: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  img: { width: '100%', height: 320, backgroundColor: colors.tealDeep },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  act: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actLbl: { fontWeight: '700', color: colors.tealDark },
  tip: {
    backgroundColor: colors.tealDark,
    marginHorizontal: 14,
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tipTxt: { color: '#fff', flex: 1, lineHeight: 20 },
  tipOk: { color: colors.coral, fontWeight: '800' },
  emptyC: { textAlign: 'center', color: colors.muted, marginTop: 12 },
  cmt: { flexDirection: 'row', gap: 10, backgroundColor: '#fff', borderRadius: 16, padding: 12, marginBottom: 8 },
  av: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avT: { fontWeight: '800', color: colors.tealDark },
  cmtA: { fontWeight: '800', color: colors.tealDark },
  cmtB: { marginTop: 3, color: '#2A3A3A' },
  cmtAct: { color: colors.muted, fontSize: 12, marginTop: 6 },
  bar: {
    flexDirection: 'row',
    padding: 10,
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: '#E4EEEE',
  },
  inp: {
    flex: 1,
    backgroundColor: colors.light,
    borderRadius: 22,
    paddingHorizontal: 14,
    height: 44,
    color: colors.tealDark,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  modal: { flex: 1, backgroundColor: 'rgba(14,58,62,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingBottom: 24,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  sheetTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetH: { fontWeight: '800', color: colors.tealDark, fontSize: 16 },
  delIco: {
    alignSelf: 'center',
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#FDECEA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  delT: { fontSize: 20, fontWeight: '800', textAlign: 'center', color: colors.tealDark },
  delP: { textAlign: 'center', marginVertical: 8, color: colors.muted, lineHeight: 20 },
  cta: {
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  ctaTxt: { color: '#fff', fontWeight: '700', fontSize: 16 },
  cancel: {
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.light,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  cancelTxt: { fontWeight: '700', color: colors.tealDark },
});
