import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Dimensions,
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
import * as FileSystem from 'expo-file-system/legacy'; // API classique (downloadAsync) conservée par Expo
import * as Sharing from 'expo-sharing';
import { colors } from '../theme';
import { useStore } from '../store';
// ── SUPABASE ALBUMS : intégration ──
import { subscribeAlbumChanges } from '../services/albums';
// ── SUPABASE ALBUMS : fin ──
import { StatusBar } from 'expo-status-bar';
import { BackButton, Sheet } from '../components/UI';

// ── Dimensions ───────────────────────────────────────────────────────────
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const IMAGE_HEIGHT = SCREEN_HEIGHT * 0.7;

// Astuce favoris (module-level : une seule fois par session)
let globalHasSeenTip = false;

// ── Date relative (FR) ───────────────────────────────────────────────────
function formatAgo(ts) {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `il y a ${d} j`;
  return new Date(ts).toLocaleDateString('fr-FR');
}

export default function PhotoScreen({ route, navigation }) {
  const { albumId, photoId } = route.params;
  const {
    state,
    toggleLike,
    toggleFavorite,
    addComment,
    deletePhoto,
    refreshAlbumPhotos, // ── SUPABASE ALBUMS : intégration ──
  } = useStore();
  const insets = useSafeAreaInsets();

  const carouselRef = useRef(null);
  const commentInputRef = useRef(null);

  const album = state.albums.find((a) => a.id === albumId);
  const photos = album?.photos || [];
  const initialIndex = Math.max(0, photos.findIndex((p) => p.id === photoId));

  // Retour robuste : /photo/:albumId/:photoId peut être le seul écran
  // de la pile sur le web (recharge, lien direct).
  const goBackSafe = () =>
    navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Main');

  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [text, setText] = useState('');
  const [del, setDel] = useState(false);
  const [tip, setTip] = useState(!globalHasSeenTip);
  const [likedComments, setLikedComments] = useState({});
  const [replyTo, setReplyTo] = useState(null);
  const [localReplies, setLocalReplies] = useState({});
  const [downloading, setDownloading] = useState(false);

  // Garde-fou si la liste rétrécit (suppression, synchro)
  const safeIndex = Math.min(currentIndex, Math.max(photos.length - 1, 0));
  const currentPhoto = photos[safeIndex];

  useEffect(() => {
    setReplyTo(null);
    setText('');
    setLikedComments({});
  }, [safeIndex]);

  // ── SUPABASE ALBUMS : intégration ──
  // Abonnement Realtime tant que la photo est à l'écran :
  // commentaire / like / nouvelle photo d'un autre membre -> refresh.
  const refreshRef = useRef(refreshAlbumPhotos);
  refreshRef.current = refreshAlbumPhotos;

  useEffect(() => {
    if (!album?.cloud) return undefined;
    let timer = null;
    const unsubscribe = subscribeAlbumChanges(albumId, () => {
      clearTimeout(timer);
      timer = setTimeout(() => refreshRef.current(albumId), 500);
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [albumId, album?.cloud]);
  // ── SUPABASE ALBUMS : fin ──

  // ── Album/photo introuvable ────────────────────────────────────────────
  if (!album || photos.length === 0 || initialIndex < 0) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <StatusBar style="dark" />
        <View style={styles.top}>
          <BackButton onPress={() => goBackSafe()} />
          <Text style={styles.author}>Photo</Text>
        </View>
        <View style={styles.center}>
          <Image
            source={require('../../assets/empty/photo.png')}
            style={{ width: 120, height: 120, marginBottom: 12 }}
          />
          <Text style={{ color: colors.muted }}>Photo ou album introuvable</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Actions ────────────────────────────────────────────────────────────

  const send = () => {
    const value = text.trim();
    if (!value || !currentPhoto) return;

    if (replyTo) {
      const reply = {
        id: `reply-${Date.now()}`,
        author: state.profile.firstName || 'Vous',
        text: value,
        parentId: replyTo.id,
      };
      setLocalReplies((prev) => ({
        ...prev,
        [replyTo.id]: [...(prev[replyTo.id] || []), reply],
      }));
      setReplyTo(null);
      setText('');
      Keyboard.dismiss();
      return;
    }

    addComment(albumId, currentPhoto.id, value);
    setText('');
    Keyboard.dismiss();
  };

  const dismissTip = () => {
    setTip(false);
    globalHasSeenTip = true;
  };

  const toggleCommentLike = (commentId) =>
    setLikedComments((prev) => ({ ...prev, [commentId]: !prev[commentId] }));

  const handleReply = (comment) => {
    setReplyTo(comment);
    setTimeout(() => commentInputRef.current?.focus(), 100);
  };

  const cancelReply = () => {
    setReplyTo(null);
    setText('');
    Keyboard.dismiss();
  };

  const download = async () => {
    if (!currentPhoto || downloading) return;
    // Sur le web : ouverture dans un nouvel onglet (sauvegarde native)
    if (Platform.OS === 'web') {
      window.open(currentPhoto.uri, '_blank');
      return;
    }
    try {
      setDownloading(true);
      const target = `${FileSystem.cacheDirectory}sharepix-${currentPhoto.id}.jpg`;
      const { uri } = await FileSystem.downloadAsync(currentPhoto.uri, target);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri);
      }
    } catch (e) {
      console.log('Download error:', e);
    } finally {
      setDownloading(false);
    }
  };

  const confirmDelete = () => {
    deletePhoto(albumId, currentPhoto.id);
    setDel(false);
    goBackSafe();
  };

  const comments = currentPhoto?.comments || [];

  // ── Commentaires ───────────────────────────────────────────────────────

  const renderComment = ({ item: comment }) => {
    const isLiked = !!likedComments[comment.id];
    const replies = localReplies[comment.id] || [];

    return (
      <View style={styles.commentBlock}>
        <View style={styles.cmt}>
          <View style={styles.av}>
            <Text style={styles.avT}>{(comment.author || 'V')[0].toUpperCase()}</Text>
          </View>
          <View style={styles.commentBody}>
            <View style={styles.cmtHeader}>
              <Text style={styles.cmtA}>{comment.author || 'Vous'}</Text>
              <Text style={styles.when}>{formatAgo(comment.createdAt)}</Text>
            </View>
            <Text style={styles.cmtB}>{comment.text}</Text>
            <View style={styles.cmtActions}>
              <TouchableOpacity
                onPress={() => toggleCommentLike(comment.id)}
                hitSlop={8}
                activeOpacity={0.7}
              >
                <Text style={[styles.cmtAct, isLiked && styles.cmtActLiked]}>
                  {isLiked ? 'J’aime ♥' : 'J’aime'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleReply(comment)} hitSlop={8} activeOpacity={0.7}>
                <Text style={styles.cmtAct}>Répondre</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {replies.length > 0 && (
          <View style={styles.replies}>
            {replies.map((reply) => (
              <View key={reply.id} style={styles.reply}>
                <View style={styles.replyLine} />
                <View style={styles.replyAvatar}>
                  <Text style={styles.replyAvatarText}>
                    {(reply.author || 'V')[0].toUpperCase()}
                  </Text>
                </View>
                <View style={styles.replyBody}>
                  <Text style={styles.replyAuthor}>{reply.author}</Text>
                  <Text style={styles.replyText}>{reply.text}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  // ── En-tête de la liste (photo + actions + titre commentaires) ────────

  const renderHeader = () => (
    <>
      {/* Carrousel : FlatList paginée, position initiale garantie */}
      <FlatList
        ref={carouselRef}
        horizontal
        data={photos}
        keyExtractor={(p) => p.id}
        pagingEnabled
        disableIntervalMomentum // une photo à la fois, pas de dérives
        directionalLockEnabled // pas de conflit avec le scroll vertical
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={initialIndex}
        initialNumToRender={Math.min(initialIndex + 2, photos.length)}
        windowSize={3}
        maxToRenderPerBatch={2}
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
        onMomentumScrollEnd={(event) => {
          const newIndex = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
          if (newIndex !== safeIndex && newIndex >= 0 && newIndex < photos.length) {
            setCurrentIndex(newIndex);
            dismissTip();
          }
        }}
        renderItem={({ item: photo }) => (
          <View style={styles.imageContainer}>
            <Image source={{ uri: photo.uri }} style={styles.img} resizeMode="contain" />
          </View>
        )}
      />

      {/* Pagination */}
      <View style={styles.pagination}>
        <Text style={styles.paginationText}>
          {safeIndex + 1} / {photos.length}
        </Text>
      </View>

      {/* Actions */}
      {currentPhoto && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.act}
            onPress={() => toggleLike(albumId, currentPhoto.id)}
            activeOpacity={0.7}
          >
            <HugeiconsIcon
              icon={FavouriteIcon}
              size={24}
              color={currentPhoto.liked ? colors.coral : colors.tealDark}
              strokeWidth={currentPhoto.liked ? 2.4 : 1.6}
            />
            <Text style={[styles.actLbl, currentPhoto.liked && { color: colors.coral }]}>
              J'aime
            </Text>
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', gap: 16 }}>
            <TouchableOpacity
              style={styles.actIcon}
              onPress={download}
              disabled={downloading}
              activeOpacity={0.7}
            >
              <HugeiconsIcon
                icon={Download01Icon}
                size={22}
                color={downloading ? colors.border : colors.tealDark}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actIcon}
              onPress={() => {
                toggleFavorite(albumId, currentPhoto.id);
                dismissTip();
              }}
              activeOpacity={0.7}
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

      {/* Astuce favoris */}
      {tip && (
        <View style={styles.tip}>
          <Text style={styles.tipTxt}>
            Touchez l'étoile pour ajouter la photo à vos favoris.
          </Text>
          <TouchableOpacity onPress={dismissTip} hitSlop={8}>
            <Text style={styles.tipOk}>OK</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Titre commentaires */}
      <View style={styles.commentsTitleRow}>
        <Text style={styles.commentsTitle}>Commentaires</Text>
        <View style={styles.commentsCount}>
          <Text style={styles.commentsCountText}>{comments.length}</Text>
        </View>
      </View>
    </>
  );

  const renderEmptyComments = () =>
    comments.length === 0 ? (
      <View style={styles.emptyComments}>
        <Image
          source={require('../../assets/empty/comment.png')}
          style={{ width: 100, height: 100, marginBottom: 12 }}
        />
        <Text style={styles.emptyH}>Aucun commentaire pour le moment</Text>
        <Text style={styles.emptyC}>Soyez le premier à commenter.</Text>
      </View>
    ) : null;

  // ── Barre de saisie ────────────────────────────────────────────────────

  const renderCommentInput = () => (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {replyTo && (
        <View style={styles.replyIndicator}>
          <View style={{ flex: 1 }}>
            <Text style={styles.replyIndicatorLabel}>Réponse à</Text>
            <Text style={styles.replyIndicatorName} numberOfLines={1}>
              {replyTo.author}
            </Text>
          </View>
          <TouchableOpacity onPress={cancelReply} hitSlop={10}>
            <Text style={styles.replyCancel}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.inputRow}>
        <TextInput
          ref={commentInputRef}
          style={styles.inp}
          placeholder={
            replyTo ? `Répondre à ${replyTo.author}...` : 'Écrire un commentaire...'
          }
          placeholderTextColor={colors.muted}
          value={text}
          onChangeText={setText}
          onSubmitEditing={send}
          returnKeyType="send"
          blurOnSubmit={false}
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
  );

  // ── Rendu ──────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.top}>
        <BackButton onPress={() => goBackSafe()} />
        <View style={{ flex: 1 }}>
          <Text style={styles.author}>{album.name}</Text>
          <Text style={styles.when}>{formatAgo(currentPhoto?.createdAt)}</Text>
        </View>
        <TouchableOpacity style={styles.iconHit} onPress={() => setDel(true)} hitSlop={8}>
          <HugeiconsIcon icon={Delete02Icon} size={22} color={colors.coral} />
        </TouchableOpacity>
      </View>

      {/* Contenu */}
      <KeyboardAvoidingView
        style={styles.mainContent}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <FlatList
          data={comments}
          keyExtractor={(item) => item.id}
          renderItem={renderComment}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmptyComments}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          style={{ flex: 1 }}
          extraData={{ likedComments, localReplies, safeIndex, photos }}
        />

        {renderCommentInput()}
      </KeyboardAvoidingView>

      {/* Confirmation suppression */}
      <Sheet visible={del} onClose={() => setDel(false)} title="Supprimer">
        <View style={styles.delIco}>
          <HugeiconsIcon icon={Delete02Icon} size={28} color={colors.coral} />
        </View>
        <Text style={styles.delT}>Supprimer définitivement ?</Text>
        <Text style={styles.delP}>
          Cette photo sera retirée pour tous les invités de l'album.
        </Text>
        <TouchableOpacity style={styles.cta} onPress={confirmDelete} activeOpacity={0.8}>
          <Text style={styles.ctaTxt}>Supprimer</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancel} onPress={() => setDel(false)} activeOpacity={0.8}>
          <Text style={styles.cancelTxt}>Annuler</Text>
        </TouchableOpacity>
      </Sheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  mainContent: { flex: 1 },

  top: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  author: { fontWeight: '800', fontSize: 16, color: colors.tealDark },
  when: { color: colors.muted, fontSize: 12, marginTop: 1 },
  iconHit: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },

  imageContainer: {
    width: SCREEN_WIDTH,
    height: IMAGE_HEIGHT,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  img: { width: '100%', height: '100%' },

  pagination: { alignItems: 'center', paddingVertical: 2 },
  paginationText: { color: colors.tealDark, fontSize: 12, fontWeight: '600' },

  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  act: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  actLbl: { fontWeight: '700', color: colors.tealDark },

  tip: {
    backgroundColor: colors.cream,
    marginHorizontal: 14,
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tipTxt: { color: colors.tealDark, flex: 1, lineHeight: 20 },
  tipOk: { color: colors.tealDark, fontWeight: '600' },

  commentsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 20,
    paddingBottom: 10,
    gap: 8,
  },
  commentsTitle: { fontSize: 18, fontWeight: '600', color: colors.tealDark },
  commentsCount: {
    minWidth: 15,
    height: 15,
    borderRadius: 12,
    backgroundColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentsCountText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  emptyComments: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 30,
  },
  emptyH: { fontWeight: '600', color: colors.tealDark, fontSize: 16, marginBottom: 4, textAlign: 'center' },
  emptyC: { textAlign: 'center', color: colors.muted, fontSize: 15 },

  commentBlock: { paddingHorizontal: 14 },
  cmt: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: colors.light,
    borderRadius: 5,
    padding: 12,
    marginBottom: 8,
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  av: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderColor: colors.teal,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avT: { fontWeight: '800', color: colors.tealDark },
  commentBody: { flex: 1, minWidth: 0 },
  cmtHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  cmtA: { flex: 1, fontWeight: '700', color: colors.tealDark, fontSize: 14 },
  cmtB: { marginTop: 3, color: '#2A3A3A', fontSize: 14, lineHeight: 20 },
  cmtActions: { flexDirection: 'row', gap: 18, marginTop: 7 },
  cmtAct: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  cmtActLiked: { color: colors.coral },

  replies: { marginLeft: 46, marginBottom: 8 },
  reply: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  replyLine: {
    width: 2,
    minHeight: 36,
    backgroundColor: colors.border,
    marginRight: 8,
    borderRadius: 2,
  },
  replyAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.light,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  replyAvatarText: { color: colors.tealDark, fontSize: 11, fontWeight: '800' },
  replyBody: { flex: 1, backgroundColor: colors.light, borderRadius: 5, padding: 9 },
  replyAuthor: { color: colors.tealDark, fontSize: 12, fontWeight: '800' },
  replyText: { color: '#2A3A3A', fontSize: 13, lineHeight: 18, marginTop: 2 },

  bar: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E4EEEE',
    paddingHorizontal: 10,
    paddingTop: 8,
  },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
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

  replyIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.light,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 7,
  },
  replyIndicatorLabel: { color: colors.muted, fontSize: 11 },
  replyIndicatorName: { color: colors.tealDark, fontWeight: '800', fontSize: 13, marginTop: 1 },
  replyCancel: { color: colors.muted, fontSize: 18, paddingHorizontal: 5 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

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
  delP: { textAlign: 'center', marginVertical: 8, color: colors.muted, lineHeight: 20 },
  cta: {
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  ctaTxt: { color: '#fff', fontWeight: '600', fontSize: 16 },
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
