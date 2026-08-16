import React, { useState, useRef, useEffect } from 'react';
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
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  Delete02Icon,
  FavouriteIcon,
  StarIcon,
  Download01Icon,
  SentIcon,
} from '@hugeicons/core-free-icons';
import { colors } from '../theme';
import { useStore } from '../store';
import { StatusBar } from 'expo-status-bar';
import { BackButton } from '../components/UI';

export default function PhotoScreen({ route, navigation }) {
  const { albumId, photoId } = route.params;
  const { state, toggleLike, toggleFavorite, addComment, deletePhoto } = useStore();
  const album = state.albums.find((a) => a.id === albumId);
  const photo = album?.photos.find((p) => p.id === photoId);
  const [text, setText] = useState('');
  const [del, setDel] = useState(false);
  const [tip, setTip] = useState(true);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef(null);
  const inputRef = useRef(null);

  // Gérer l'ouverture/fermeture du clavier
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardVisible(true)
    );
    const keyboardDidHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardVisible(false)
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  if (!photo) {
    return (
      <SafeAreaView style={[styles.root, { paddingTop: insets.top }]} edges={['top']}>
        <StatusBar style="dark" />
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
    // Fermer le clavier après l'envoi
    Keyboard.dismiss();
  };

  const handleFocus = () => {
    // Scroll vers le bas quand l'input est focus
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 300);
  };

  return (
    <SafeAreaView style={[styles.root, { paddingTop: insets.top ,paddingBottom: 100 + insets.bottom}]} edges={['top']}>
      <StatusBar style="dark" />
      
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={{ flex: 1 }}>
            {/* Header */}
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

            {/* Image */}
            <Image source={{ uri: photo.uri }} style={styles.img} resizeMode="contain" />

            {/* Actions */}
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

            {/* Tip */}
            {tip && (
              <View style={styles.tip}>
                <Text style={styles.tipTxt}>Touchez l'étoile pour ajouter la photo à vos favoris.</Text>
                <TouchableOpacity onPress={() => setTip(false)}>
                  <Text style={styles.tipOk}>OK</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Comments Section - avec ScrollView pour les commentaires */}
            <ScrollView
              ref={scrollViewRef}
              style={styles.commentsContainer}
              contentContainerStyle={[
                styles.commentsContent,
                { paddingBottom: keyboardVisible ? 120 : 80 }
              ]}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
            >
              {photo.comments.length === 0 ? (
                <View style={styles.emptyComments}>
                  <Text style={styles.emptyC}>Soyez le premier à commenter.</Text>
                </View>
              ) : (
                photo.comments.map((c) => (
                  <View key={c.id} style={styles.cmt}>
                    <View style={styles.av}>
                      <Text style={styles.avT}>{(c.author || 'V')[0]}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.cmtHeader}>
                        <Text style={styles.cmtA}>{c.author}</Text>
                        <Text style={styles.when}>à l'instant</Text>
                      </View>
                      <Text style={styles.cmtB}>{c.text}</Text>
                      <View style={styles.cmtActions}>
                        <Text style={styles.cmtAct}>J'aime</Text>
                        <Text style={styles.cmtAct}>Répondre</Text>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>

            {/* Input Bar - avec padding dynamique pour le clavier */}
            <View style={[
              styles.bar,
              { 
                paddingBottom: keyboardVisible 
                  ? Math.max(insets.bottom + 10, 10) 
                  : Math.max(insets.bottom, 10)
              }
            ]}>
              <TextInput
                ref={inputRef}
                style={styles.inp}
                placeholder="Écrire un commentaire..."
                placeholderTextColor={colors.muted}
                value={text}
                onChangeText={setText}
                onSubmitEditing={send}
                returnKeyType="send"
                onFocus={handleFocus}
                multiline={false}
              />
              <TouchableOpacity 
                style={[styles.send, !text.trim() && { opacity: 0.45 }]} 
                onPress={send}
                disabled={!text.trim()}
                activeOpacity={0.7}
              >
                <HugeiconsIcon icon={SentIcon} size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>

      {/* Modal de suppression */}
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
  root: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  author: {
    fontWeight: '800',
    fontSize: 16,
    color: colors.tealDark,
  },
  when: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 1,
  },
  iconHit: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  img: {
    width: '100%',
    height: 320,
    backgroundColor: colors.tealDeep,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  act: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actLbl: {
    fontWeight: '700',
    color: colors.tealDark,
  },
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
  tipTxt: {
    color: '#fff',
    flex: 1,
    lineHeight: 20,
  },
  tipOk: {
    color: colors.coral,
    fontWeight: '800',
  },
  commentsContainer: {
    flex: 1,
  },
  commentsContent: {
    paddingHorizontal: 14,
    paddingTop: 8,
  },
  emptyComments: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  emptyC: {
    textAlign: 'center',
    color: colors.muted,
    fontSize: 15,
  },
  cmt: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  av: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avT: {
    fontWeight: '800',
    color: colors.tealDark,
  },
  cmtHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cmtA: {
    fontWeight: '800',
    color: colors.tealDark,
    fontSize: 14,
  },
  cmtB: {
    marginTop: 3,
    color: '#2A3A3A',
    fontSize: 14,
    lineHeight: 20,
  },
  cmtActions: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 6,
  },
  cmtAct: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  bar: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 10,
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E4EEEE',
  },
  inp: {
    flex: 1,
    backgroundColor: colors.light,
    borderRadius: 22,
    paddingHorizontal: 16,
    height: 44,
    color: colors.tealDark,
    fontSize: 15,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Modal Styles
  modal: {
    flex: 1,
    backgroundColor: 'rgba(14,58,62,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingBottom: 24,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  sheetTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  sheetH: {
    fontWeight: '800',
    color: colors.tealDark,
    fontSize: 16,
  },
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
  delT: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    color: colors.tealDark,
  },
  delP: {
    textAlign: 'center',
    marginVertical: 8,
    color: colors.muted,
    lineHeight: 20,
  },
  cta: {
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  ctaTxt: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  cancel: {
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.light,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  cancelTxt: {
    fontWeight: '700',
    color: colors.tealDark,
  },
});