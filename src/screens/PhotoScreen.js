import React, { useEffect, useMemo, useRef, useState } from 'react';

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
  Dimensions,
} from 'react-native';

import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

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


// ---------------------------------------------------------
// DIMENSIONS
// ---------------------------------------------------------

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } =
  Dimensions.get('window');

const IMAGE_HEIGHT = SCREEN_HEIGHT * 0.70;


// ---------------------------------------------------------
// TIP GLOBAL
// ---------------------------------------------------------

let globalHasSeenTip = false;


// ---------------------------------------------------------
// SCREEN
// ---------------------------------------------------------

export default function PhotoScreen({ route, navigation }) {
  const { albumId, photoId } = route.params;

  const {
    state,
    toggleLike,
    toggleFavorite,
    addComment,
    deletePhoto,
  } = useStore();

  const insets = useSafeAreaInsets();

  // -------------------------------------------------------
  // REFS
  // -------------------------------------------------------

  const photoListRef = useRef(null);
  const commentInputRef = useRef(null);


  // -------------------------------------------------------
  // ALBUM / PHOTOS
  // -------------------------------------------------------

  const album = state.albums.find(
    (a) => a.id === albumId
  );

  const photos = album?.photos || [];

  const initialIndex = photos.findIndex(
    (p) => p.id === photoId
  );


  // -------------------------------------------------------
  // STATE
  // -------------------------------------------------------

  const [currentIndex, setCurrentIndex] = useState(
    initialIndex >= 0 ? initialIndex : 0
  );

  const [text, setText] = useState('');

  const [del, setDel] = useState(false);

  const [tip, setTip] = useState(
    !globalHasSeenTip
  );

  // Commentaires likés localement
  const [likedComments, setLikedComments] = useState({});

  // Commentaire auquel on répond
  const [replyTo, setReplyTo] = useState(null);

  // Réponses locales
  const [localReplies, setLocalReplies] = useState({});


  // -------------------------------------------------------
  // CURRENT PHOTO
  // -------------------------------------------------------

  const currentPhoto = photos[currentIndex];


  // -------------------------------------------------------
  // RESET RESPONSE WHEN PHOTO CHANGES
  // -------------------------------------------------------

  useEffect(() => {
    setReplyTo(null);
    setText('');
    setLikedComments({});
  }, [currentIndex]);


  // -------------------------------------------------------
  // INVALID PHOTO
  // -------------------------------------------------------

  if (
    !album ||
    photos.length === 0 ||
    initialIndex === -1
  ) {
    return (
      <SafeAreaView
        style={styles.root}
        edges={['top', 'bottom']}
      >
        <StatusBar style="dark" />

        <View style={styles.top}>
          <BackButton
            onPress={() => navigation.goBack()}
          />

          <Text style={styles.author}>
            Photo
          </Text>
        </View>

        <View style={styles.center}>
          <Image
            source={require('../../assets/empty/photo.png')}
            style={{
              width: 120,
              height: 120,
              marginBottom: 12,
            }}
          />

          <Text style={{ color: colors.muted }}>
            Photo ou album introuvable
          </Text>
        </View>
      </SafeAreaView>
    );
  }


  // -------------------------------------------------------
  // COMMENT SEND
  // -------------------------------------------------------

  const send = () => {
    const value = text.trim();

    if (!value || !currentPhoto) {
      return;
    }

    // -----------------------------------------------------
    // RESPONSE
    // -----------------------------------------------------

    if (replyTo) {
      const reply = {
        id: `reply-${Date.now()}`,
        author:
          state.profile.firstName || 'Vous',
        text: value,
        parentId: replyTo.id,
      };

      setLocalReplies((prev) => ({
        ...prev,

        [replyTo.id]: [
          ...(prev[replyTo.id] || []),
          reply,
        ],
      }));

      setReplyTo(null);
      setText('');

      Keyboard.dismiss();

      return;
    }


    // -----------------------------------------------------
    // NORMAL COMMENT
    // -----------------------------------------------------

    addComment(
      albumId,
      currentPhoto.id,
      value
    );

    setText('');

    Keyboard.dismiss();
  };


  // -------------------------------------------------------
  // DISMISS TIP
  // -------------------------------------------------------

  const dismissTip = () => {
    setTip(false);
    globalHasSeenTip = true;
  };


  // -------------------------------------------------------
  // LIKE COMMENT
  // -------------------------------------------------------

  const toggleCommentLike = (commentId) => {
    setLikedComments((prev) => ({
      ...prev,

      [commentId]: !prev[commentId],
    }));
  };


  // -------------------------------------------------------
  // REPLY COMMENT
  // -------------------------------------------------------

  const handleReply = (comment) => {
    setReplyTo(comment);

    setTimeout(() => {
      commentInputRef.current?.focus();
    }, 100);
  };


  // -------------------------------------------------------
  // CANCEL REPLY
  // -------------------------------------------------------

  const cancelReply = () => {
    setReplyTo(null);
    setText('');
    Keyboard.dismiss();
  };


  // -------------------------------------------------------
  // PHOTO LAYOUT
  // -------------------------------------------------------

  const getItemLayout = (_, index) => ({
    length: SCREEN_WIDTH,
    offset: SCREEN_WIDTH * index,
    index,
  });


  // -------------------------------------------------------
  // PHOTO ITEM
  // -------------------------------------------------------

  const renderImageItem = ({
    item,
  }) => {
    return (
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: item.uri }}
          style={styles.img}
          resizeMode="contain"
        />
      </View>
    );
  };


  // -------------------------------------------------------
  // COMMENT DATA
  // -------------------------------------------------------

  const comments = currentPhoto.comments || [];


  // -------------------------------------------------------
  // COMMENT ITEM
  // -------------------------------------------------------

  const renderComment = ({
    item: comment,
  }) => {
    const isLiked =
      !!likedComments[comment.id];

    const replies =
      localReplies[comment.id] || [];

    return (
      <View style={styles.commentBlock}>

        {/* COMMENTAIRE PRINCIPAL */}

        <View style={styles.cmt}>

          {/* AVATAR */}

          <View style={styles.av}>
            <Text style={styles.avT}>
              {(comment.author || 'V')[0].toUpperCase()}
            </Text>
          </View>


          {/* CONTENT */}

          <View style={styles.commentBody}>

            {/* HEADER */}

            <View style={styles.cmtHeader}>

              <Text style={styles.cmtA}>
                {comment.author || 'Vous'}
              </Text>

              <Text style={styles.when}>
                à l'instant
              </Text>

            </View>


            {/* TEXT */}

            <Text style={styles.cmtB}>
              {comment.text}
            </Text>


            {/* ACTIONS */}

            <View style={styles.cmtActions}>

              {/* LIKE */}

              <TouchableOpacity
                onPress={() =>
                  toggleCommentLike(comment.id)
                }
                hitSlop={8}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.cmtAct,
                    isLiked &&
                      styles.cmtActLiked,
                  ]}
                >
                  {isLiked
                    ? 'J’aime ♥'
                    : 'J’aime'}
                </Text>
              </TouchableOpacity>


              {/* REPLY */}

              <TouchableOpacity
                onPress={() =>
                  handleReply(comment)
                }
                hitSlop={8}
                activeOpacity={0.7}
              >
                <Text style={styles.cmtAct}>
                  Répondre
                </Text>
              </TouchableOpacity>

            </View>

          </View>

        </View>


        {/* -------------------------------------------------
            REPLIES
        ------------------------------------------------- */}

        {replies.length > 0 && (
          <View style={styles.replies}>

            {replies.map((reply) => (
              <View
                key={reply.id}
                style={styles.reply}
              >

                <View style={styles.replyLine} />

                <View style={styles.replyAvatar}>
                  <Text
                    style={styles.replyAvatarText}
                  >
                    {(reply.author || 'V')[0].toUpperCase()}
                  </Text>
                </View>

                <View style={styles.replyBody}>

                  <Text style={styles.replyAuthor}>
                    {reply.author}
                  </Text>

                  <Text style={styles.replyText}>
                    {reply.text}
                  </Text>

                </View>

              </View>
            ))}

          </View>
        )}

      </View>
    );
  };


  // -------------------------------------------------------
  // HEADER OF COMMENTS LIST
  // -------------------------------------------------------

  const renderHeader = () => {
    return (
      <>

        {/* -----------------------------------------------
            PHOTO CAROUSEL
        ------------------------------------------------ */}

        <FlatList
          ref={photoListRef}
          data={photos}
          renderItem={renderImageItem}
          keyExtractor={(item) => item.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialIndex}
          getItemLayout={getItemLayout}
          nestedScrollEnabled
          decelerationRate="fast"

          onMomentumScrollEnd={(event) => {

            const newIndex = Math.round(
              event.nativeEvent.contentOffset.x /
                SCREEN_WIDTH
            );

            if (
              newIndex !== currentIndex &&
              newIndex >= 0 &&
              newIndex < photos.length
            ) {
              setCurrentIndex(newIndex);

              dismissTip();
            }
          }}
        />


        {/* -----------------------------------------------
            PAGINATION
        ------------------------------------------------ */}

        <View style={styles.pagination}>

          <Text style={styles.paginationText}>
            {currentIndex + 1} / {photos.length}
          </Text>

        </View>


        {/* -----------------------------------------------
            ACTIONS
        ------------------------------------------------ */}

        {currentPhoto && (
          <View style={styles.actions}>

            {/* LIKE PHOTO */}

            <TouchableOpacity
              style={styles.act}
              onPress={() =>
                toggleLike(
                  albumId,
                  currentPhoto.id
                )
              }
              activeOpacity={0.7}
            >

              <HugeiconsIcon
                icon={FavouriteIcon}
                size={24}
                color={
                  currentPhoto.liked
                    ? colors.coral
                    : colors.tealDark
                }
                strokeWidth={
                  currentPhoto.liked
                    ? 2.4
                    : 1.6
                }
              />

              <Text
                style={[
                  styles.actLbl,
                  currentPhoto.liked && {
                    color: colors.coral,
                  },
                ]}
              >
                J'aime
              </Text>

            </TouchableOpacity>


            {/* RIGHT ACTIONS */}

            <View
              style={{
                flexDirection: 'row',
                gap: 16,
              }}
            >

              {/* DOWNLOAD */}

              <TouchableOpacity
                style={styles.actIcon}
                activeOpacity={0.7}
              >

                <HugeiconsIcon
                  icon={Download01Icon}
                  size={22}
                  color={colors.tealDark}
                />

              </TouchableOpacity>


              {/* FAVORITE */}

              <TouchableOpacity
                style={styles.actIcon}
                onPress={() => {

                  toggleFavorite(
                    albumId,
                    currentPhoto.id
                  );

                  dismissTip();

                }}
                activeOpacity={0.7}
              >

                <HugeiconsIcon
                  icon={StarIcon}
                  size={24}
                  color={
                    currentPhoto.favorite
                      ? colors.coral
                      : colors.tealDark
                  }
                  strokeWidth={
                    currentPhoto.favorite
                      ? 2.4
                      : 1.6
                  }
                />

              </TouchableOpacity>

            </View>

          </View>
        )}


        {/* -----------------------------------------------
            TIP
        ------------------------------------------------ */}

        {tip && (
          <View style={styles.tip}>

            <Text style={styles.tipTxt}>
              Touchez l'étoile pour ajouter
              la photo à vos favoris.
            </Text>

            <TouchableOpacity
              onPress={dismissTip}
              hitSlop={8}
            >
              <Text style={styles.tipOk}>
                OK
              </Text>
            </TouchableOpacity>

          </View>
        )}


        {/* -----------------------------------------------
            COMMENTS TITLE
        ------------------------------------------------ */}

        <View style={styles.commentsTitleRow}>

          <Text style={styles.commentsTitle}>
            Commentaires
          </Text>

          <View style={styles.commentsCount}>
            <Text style={styles.commentsCountText}>
              {comments.length}
            </Text>
          </View>

        </View>

      </>
    );
  };


  // -------------------------------------------------------
  // EMPTY COMMENTS
  // -------------------------------------------------------

  const renderEmptyComments = () => {

    if (comments.length > 0) {
      return null;
    }

    return (
      <View style={styles.emptyComments}>

        <Image
          source={require('../../assets/empty/comment.png')}
          style={{
            width: 100,
            height: 100,
            marginBottom: 12,
          }}
        />

        <Text style={styles.emptyH}>
          Aucun commentaire pour le moment
        </Text>

        <Text style={styles.emptyC}>
          Soyez le premier à commenter.
        </Text>

      </View>
    );
  };


  // -------------------------------------------------------
  // FOOTER / COMMENT INPUT
  // -------------------------------------------------------

  const renderCommentInput = () => {

    return (
      <View
        style={[
          styles.bar,
          {
            paddingBottom:
              Math.max(insets.bottom),
          },
        ]}
      >

        {/* REPLY INDICATOR */}

        {replyTo && (
          <View style={styles.replyIndicator}>

            <View style={{ flex: 1 }}>

              <Text
                style={styles.replyIndicatorLabel}
              >
                Réponse à
              </Text>

              <Text
                style={styles.replyIndicatorName}
                numberOfLines={1}
              >
                {replyTo.author}
              </Text>

            </View>

            <TouchableOpacity
              onPress={cancelReply}
              hitSlop={10}
            >
              <Text style={styles.replyCancel}>
                ✕
              </Text>
            </TouchableOpacity>

          </View>
        )}


        {/* INPUT ROW */}

        <View style={styles.inputRow}>

          <TextInput
            ref={commentInputRef}
            style={styles.inp}
            placeholder={
              replyTo
                ? `Répondre à ${replyTo.author}...`
                : 'Écrire un commentaire...'
            }
            placeholderTextColor={colors.muted}
            value={text}
            onChangeText={setText}
            onSubmitEditing={send}
            returnKeyType="send"
            multiline={false}
            blurOnSubmit={false}
          />

          <TouchableOpacity
            style={[
              styles.send,
              !text.trim() && {
                opacity: 0.45,
              },
            ]}
            onPress={send}
            disabled={!text.trim()}
            activeOpacity={0.7}
          >

            <HugeiconsIcon
              icon={SentIcon}
              size={20}
              color="#fff"
            />

          </TouchableOpacity>

        </View>

      </View>
    );
  };


  // -------------------------------------------------------
  // MAIN
  // -------------------------------------------------------

  return (
    <SafeAreaView
      style={styles.root}
      edges={['top', 'bottom']}
    >

      <StatusBar style="dark" />


      {/* -----------------------------------------------
          HEADER
      ------------------------------------------------ */}

      <View style={styles.top}>

        <BackButton
          onPress={() => navigation.goBack()}
        />

        <View style={{ flex: 1 }}>

          <Text style={styles.author}>
            {state.profile.firstName || 'Vous'}
          </Text>

          <Text style={styles.when}>
            à l'instant
          </Text>

        </View>


        {/* DELETE */}

        <TouchableOpacity
          style={styles.iconHit}
          onPress={() => setDel(true)}
          hitSlop={8}
        >

          <HugeiconsIcon
            icon={Delete02Icon}
            size={22}
            color={colors.coral}
          />

        </TouchableOpacity>

      </View>


      {/* -----------------------------------------------
          CONTENT
      ------------------------------------------------ */}

      <KeyboardAvoidingView
        style={styles.mainContent}
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : 'height'
        }
      >

        <FlatList
          data={comments}
          keyExtractor={(item) => item.id}
          renderItem={renderComment}

          ListHeaderComponent={renderHeader}

          ListEmptyComponent={
            renderEmptyComments
          }

          showsVerticalScrollIndicator={false}

          keyboardShouldPersistTaps="handled"

          keyboardDismissMode={
            Platform.OS === 'ios'
              ? 'interactive'
              : 'on-drag'
          }

          nestedScrollEnabled

          contentContainerStyle={{
            paddingBottom: 100,
          }}

          extraData={{
            likedComments,
            localReplies,
          }}
        />

      </KeyboardAvoidingView>


      {/* -----------------------------------------------
          COMMENT INPUT
      ------------------------------------------------ */}

      {renderCommentInput()}


      {/* -----------------------------------------------
          DELETE MODAL
      ------------------------------------------------ */}

      <Modal
        visible={del}
        transparent
        animationType="slide"
        onRequestClose={() => setDel(false)}
      >

        <View style={[styles.modal ,{paddingBottom: insets.bottom}]}>

          <View style={styles.sheet}>

            {/* HEADER */}

            <View style={styles.sheetTop}>

              <View
                style={{
                  width: 50,
                }}
              />

              <Text style={styles.sheetH}>
                Supprimer
              </Text>

              <BackButton
                variant="close"
                onPress={() =>
                  setDel(false)
                }
              />

            </View>


            {/* ICON */}

            <View style={styles.delIco}>

              <HugeiconsIcon
                icon={Delete02Icon}
                size={28}
                color={colors.coral}
              />

            </View>


            {/* TITLE */}

            <Text style={styles.delT}>
              Supprimer définitivement ?
            </Text>


            {/* DESCRIPTION */}

            <Text style={styles.delP}>
              Cette photo sera retirée pour
              tous les invités de l'album.
            </Text>


            {/* DELETE */}

            <TouchableOpacity
              style={styles.cta}
              onPress={() => {

                if (currentPhoto) {
                  deletePhoto(
                    albumId,
                    currentPhoto.id
                  );
                }

                setDel(false);

                navigation.goBack();

              }}
              activeOpacity={0.8}
            >

              <Text style={styles.ctaTxt}>
                Supprimer
              </Text>

            </TouchableOpacity>


            {/* CANCEL */}

            <TouchableOpacity
              style={styles.cancel}
              onPress={() => setDel(false)}
              activeOpacity={0.8}
            >

              <Text style={styles.cancelTxt}>
                Annuler
              </Text>

            </TouchableOpacity>

          </View>

        </View>

      </Modal>

    </SafeAreaView>
  );
}


// =========================================================
// STYLES
// =========================================================

const styles = StyleSheet.create({

  root: {
    flex: 1,
  },


  mainContent: {
    flex: 1,
  },


  // -------------------------------------------------------
  // HEADER
  // -------------------------------------------------------

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


  // -------------------------------------------------------
  // IMAGE
  // -------------------------------------------------------

  imageContainer: {
    width: SCREEN_WIDTH,
    height: IMAGE_HEIGHT,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },


  img: {
    width: '100%',
    height: '100%',
  },


  // -------------------------------------------------------
  // PAGINATION
  // -------------------------------------------------------

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


  // -------------------------------------------------------
  // ACTIONS
  // -------------------------------------------------------

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


  actIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },


  actLbl: {
    fontWeight: '700',
    color: colors.tealDark,
  },


  // -------------------------------------------------------
  // TIP
  // -------------------------------------------------------

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


  // -------------------------------------------------------
  // COMMENTS TITLE
  // -------------------------------------------------------

  commentsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 20,
    paddingBottom: 10,
    gap: 8,
  },


  commentsTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.tealDark,
  },


  commentsCount: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 7,
    backgroundColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },


  commentsCountText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },


  // -------------------------------------------------------
  // EMPTY COMMENTS
  // -------------------------------------------------------

  emptyComments: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 30,
  },


  emptyH: {
    fontWeight: '600',
    color: colors.tealDark,
    fontSize: 16,
    marginBottom: 4,
    textAlign: 'center',
  },


  emptyC: {
    textAlign: 'center',
    color: colors.muted,
    fontSize: 15,
  },


  // -------------------------------------------------------
  // COMMENT
  // -------------------------------------------------------

  commentBlock: {
    paddingHorizontal: 14,
  },


  cmt: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,

    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
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


  commentBody: {
    flex: 1,
    minWidth: 0,
  },


  cmtHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },


  cmtA: {
    flex: 1,
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
    gap: 18,
    marginTop: 7,
  },


  cmtAct: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },


  cmtActLiked: {
    color: colors.coral,
  },


  // -------------------------------------------------------
  // REPLIES
  // -------------------------------------------------------

  replies: {
    marginLeft: 46,
    marginBottom: 8,
  },


  reply: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },


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


  replyAvatarText: {
    color: colors.tealDark,
    fontSize: 11,
    fontWeight: '800',
  },


  replyBody: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 9,
  },


  replyAuthor: {
    color: colors.tealDark,
    fontSize: 12,
    fontWeight: '800',
  },


  replyText: {
    color: '#2A3A3A',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },


  // -------------------------------------------------------
  // INPUT
  // -------------------------------------------------------

  bar: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E4EEEE',
    paddingHorizontal: 10,
    paddingTop: 8,
  },


  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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


  // -------------------------------------------------------
  // REPLY INDICATOR
  // -------------------------------------------------------

  replyIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.light,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 7,
  },


  replyIndicatorLabel: {
    color: colors.muted,
    fontSize: 11,
  },


  replyIndicatorName: {
    color: colors.tealDark,
    fontWeight: '800',
    fontSize: 13,
    marginTop: 1,
  },


  replyCancel: {
    color: colors.muted,
    fontSize: 18,
    paddingHorizontal: 5,
  },


  // -------------------------------------------------------
  // CENTER
  // -------------------------------------------------------

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },


  // -------------------------------------------------------
  // DELETE MODAL
  // -------------------------------------------------------

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