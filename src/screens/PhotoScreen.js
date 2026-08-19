import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
  Dimensions,
  ScrollView,
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

// Récupération des dimensions de l'écran pour l'image
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const IMAGE_HEIGHT = SCREEN_HEIGHT * 0.70; // L'image prend 70% de l'écran

// Variable globale pour suivre si le tip a déjà été affiché durant la session
let globalHasSeenTip = false;

export default function PhotoScreen({ route, navigation }) {
  const { albumId, photoId } = route.params;
  const { state, toggleLike, toggleFavorite, addComment, deletePhoto } = useStore();
  const insets = useSafeAreaInsets();
  const inputRef = useRef(null);
  const scrollViewRef = useRef(null);

  // 1. Gestion du carousel (Swipe)
  const album = state.albums.find((a) => a.id === albumId);
  const photos = album?.photos || [];
  const initialIndex = photos.findIndex((p) => p.id === photoId);
  
  const [currentIndex, setCurrentIndex] = useState(initialIndex >= 0 ? initialIndex : 0);
  const [text, setText] = useState('');
  const [del, setDel] = useState(false);
  const [tip, setTip] = useState(!globalHasSeenTip);

  // La photo actuellement affichée
  const currentPhoto = photos[currentIndex];

  // Scroll automatique vers le bas quand un nouveau commentaire est ajouté
  useEffect(() => {
    if (scrollViewRef.current && currentPhoto?.comments?.length > 0) {
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [currentPhoto?.comments?.length]);

  if (!album || photos.length === 0 || initialIndex === -1) {
    return (
      <SafeAreaView style={[styles.root, { paddingTop: insets.top }]} edges={['top']}>
        <StatusBar style="dark" />
        <View style={styles.top}>
          <BackButton onPress={() => navigation.goBack()} />
          <Text style={styles.author}>Photo</Text>
        </View>
        <View style={styles.center}>
          <Image source={require('../../assets/empty/photo.png')} style={{ width: 120, height: 120, marginBottom: 12 }} />
          <Text style={{ color: colors.muted }}>Photo ou album introuvable</Text>
        </View>
      </SafeAreaView>
    );
  }

  const send = () => {
    if (!text.trim() || !currentPhoto) return;
    addComment(albumId, currentPhoto.id, text.trim());
    setText('');
    Keyboard.dismiss();
  };

  const dismissTip = () => {
    setTip(false);
    globalHasSeenTip = true;
  };

  // Configuration pour que le FlatList horizontal démarre sur la bonne photo
  const getItemLayout = (_, index) => ({
    length: SCREEN_WIDTH,
    offset: SCREEN_WIDTH * index,
    index,
  });

  const renderImageItem = ({ item }) => (
    <View style={styles.imageContainer}>
      <Image source={{ uri: item.uri }} style={styles.img} resizeMode="contain" />
    </View>
  );

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      
      {/* Header Fixe */}
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

      {/* Le KeyboardAvoidingView englobe le contenu scrollable et la barre de saisie */}
      <KeyboardAvoidingView 
        style={styles.mainContent} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={{ flex: 1 }}>
            
            {/* ScrollView principal unifié pour tout le contenu central */}
            <ScrollView
              ref={scrollViewRef}
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingBottom: 24 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* 2. Carousel d'images (Swipe Horizontal) */}
              <FlatList
                data={photos}
                renderItem={renderImageItem}
                keyExtractor={(item) => item.id}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                initialScrollIndex={initialIndex}
                getItemLayout={getItemLayout}
                onMomentumScrollEnd={(event) => {
                  const newIndex = Math.round(
                    event.nativeEvent.contentOffset.x / SCREEN_WIDTH
                  );
                  if (newIndex !== currentIndex && newIndex >= 0 && newIndex < photos.length) {
                    setCurrentIndex(newIndex);
                    dismissTip(); // Cache le tip dès qu'on swipe
                  }
                }}
              />

              {/* Indicateur de position (ex: 1 / 5) */}
              <View style={styles.pagination}>
                <Text style={styles.paginationText}>
                  {currentIndex + 1} / {photos.length}
                </Text>
              </View>

              {/* Actions Fixes */}
              {currentPhoto && (
                <View style={styles.actions}>
                  <TouchableOpacity style={styles.act} onPress={() => toggleLike(albumId, currentPhoto.id)}>
                    <HugeiconsIcon
                      icon={FavouriteIcon}
                      size={24}
                      color={currentPhoto.liked ? colors.coral : colors.tealDark}
                      strokeWidth={currentPhoto.liked ? 2.4 : 1.6}
                    />
                    <Text style={[styles.actLbl, currentPhoto.liked && { color: colors.coral }]}>J'aime</Text>
                  </TouchableOpacity>
                  <View style={{ flexDirection: 'row', gap: 16 }}>
                    <TouchableOpacity style={styles.act}>
                      <HugeiconsIcon icon={Download01Icon} size={22} color={colors.tealDark} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.act}
                      onPress={() => {
                        toggleFavorite(albumId, currentPhoto.id);
                        dismissTip();
                      }}
                    >
                      <HugeiconsIcon
                        icon={StarIcon}
                        size={24}
                        color={currentPhoto.favorite ? colors.coral : colors.tealDark}
                        strokeWidth={currentPhoto.favorite ? 2.4 : 1.6}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Tip (Apparaît une seule fois) */}
              {tip && (
                <View style={styles.tip}>
                  <Text style={styles.tipTxt}>Touchez l'étoile pour ajouter la photo à vos favoris.</Text>
                  <TouchableOpacity onPress={dismissTip}>
                    <Text style={styles.tipOk}>OK</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Zone de commentaires intégrée au défilement principal */}
              {currentPhoto && (
                <View style={styles.commentsContent}>
                  {currentPhoto.comments && currentPhoto.comments.length > 0 ? (
                    currentPhoto.comments.map((c) => (
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
                  ) : (
                    <View style={styles.emptyComments}>
                      <Image source={require('../../assets/empty/comment.png')} style={{ width: 100, height: 100, marginBottom: 12 }} />
                      <Text style={styles.emptyH}>Aucun commentaire pour le moment</Text>
                      <Text style={styles.emptyC}>Soyez le premier à commenter.</Text>
                    </View>
                  )}
                </View>
              )}
            </ScrollView>

            {/* Barre de saisie fixe en bas */}
            <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom) }]}>
              <TextInput
                ref={inputRef}
                style={styles.inp}
                placeholder="Écrire un commentaire..."
                placeholderTextColor={colors.muted}
                value={text}
                onChangeText={setText}
                onSubmitEditing={send}
                returnKeyType="send"
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
                if (currentPhoto) deletePhoto(albumId, currentPhoto.id);
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
  mainContent: {
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
  imageContainer: {
    width: SCREEN_WIDTH,
    height: IMAGE_HEIGHT,
    backgroundColor: colors.cream, 
    alignItems: 'center',
    justifyContent: 'center',
  },
  img: {
    width: '100%',
    height: '100%',
  },
  pagination: {
    alignItems: 'center',
    paddingVertical: 6,
    backgroundColor: colors.cream,
  },
  paginationText: {
    color: colors.tealDark,
    fontSize: 12,
    fontWeight: '600',
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
    backgroundColor: colors.border,
    marginHorizontal: 14,
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tipTxt: {
    color: colors.tealDark,
    flex: 1,
    lineHeight: 20,
  },
  tipOk: {
    color: colors.tealDark,
    fontWeight: '600',
  },
  commentsContent: {
    paddingHorizontal: 14,
    paddingTop: 8,
  },
  emptyComments: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  emptyH: {
    fontWeight: '600',
    color: colors.tealDark,
    fontSize: 16,
    marginBottom: 4,
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
    paddingVertical: 15,
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
  modal: {
    flex: 1,
    backgroundColor: 'rgba(14,58,62,0.45)',
    justifyContent: 'flex-end',
    paddingBottom: Platform.OS === 'ios' ? 0 : 40,
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
    fontWeight: '600',
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
    fontWeight: '600',
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
    fontWeight: '600',
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