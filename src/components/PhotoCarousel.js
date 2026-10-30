// @ts-check
// ── CARROUSEL PHOTO (écran détail) : correctif du rechargement d'image ────
//
// ── CE QUI N'ALLAIT PAS ────────────────────────────────────────────────
// 1. Le carrousel était une FlatList horizontale déclarée DANS le
//    `ListHeaderComponent` de la FlatList verticale des commentaires. Or
//    `renderHeader()` était appelée à chaque rendu de l'écran : chaque
//    frappe au clavier, chaque like, chaque refresh Realtime recréait
//    l'arbre du carrousel.
// 2. `windowSize={3}` + `removeClippedSubviews` (actif par défaut sur
//    Android) : dès qu'on s'éloignait d'une page, sa cellule était
//    DÉMONTÉE. On revient dessus → remontage → l'état « chargé » de
//    <ProgressiveImage> repartait de zéro → squelette + fondu de 220 ms +
//    retéléchargement. D'où « l'image charge à chaque fois » et « ça crache
//    quand on swipe ».
// 3. Avant l'intégration d'expo-image, le cache suivait l'URL signée :
//    une URL renouvelée à l'ouverture = une nouvelle clé = nouveaux octets.
//
// ── CE QUE FAIT CE COMPOSANT ───────────────────────────────────────────
// a. `React.memo` + comparaison STRUCTURELLE : un refresh qui ne change ni
//    l'identifiant ni l'URL d'une photo ne re-rend pas le carrousel. Un
//    like ou un commentaire ne touche donc plus jamais les images.
// b. `expo-image` utilise `storagePath` comme `cacheKey` stable et
//    `cachePolicy="memory-disk"` : les URL signées peuvent tourner sans
//    invalider le cache disque, y compris après fermeture de l'app.
// c. Fenêtre de rendu large + `removeClippedSubviews={false}` : les pages
//    voisines restent montées, le swipe est instantané.
// d. `transition={0}` et un registre de session (`ALREADY_LOADED`) : une
//    photo déjà vue ne réaffiche jamais de squelette, même remontée.
// e. Largeur mesurée par `onLayout` : l'index de page n'est plus calculé
//    avec la largeur d'écran théorique (dérive sur écran pivoté).

import React, { memo, useCallback, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, View, Dimensions, Image as RNImage } from 'react-native';
import { Skeleton } from './Skeleton';

// expo-image apporte le cache disque explicite (`cachePolicy`) et la clé de
// recyclage. C'est un MODULE NATIF : un APK construit avant son ajout ne le
// contient pas. On le charge de façon défensive pour retomber sur <Image> de
// React Native au lieu de faire planter l'écran photo sur les anciens binaires.
let ExpoImage = null;
try {
   
  const mod = require('expo-image');
  ExpoImage = mod?.Image || null;
} catch (e) {
  ExpoImage = null;
}

const { width: FALLBACK_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
export const IMAGE_HEIGHT = SCREEN_HEIGHT * 0.7;

// Identifiants des photos déjà affichées au moins une fois dans la session.
// Sert uniquement à éviter de réafficher un squelette sur une image connue.
const ALREADY_LOADED = new Set();

// ── Une page du carrousel ───────────────────────────────────────────────
function CarouselPage({ photo, width, height }) {
  const known = ALREADY_LOADED.has(photo.id);
  const [ready, setReady] = useState(known);
  const [failed, setFailed] = useState(false);

  const handleLoad = () => {
    ALREADY_LOADED.add(photo.id);
    if (!ready) setReady(true);
    if (failed) setFailed(false);
  };

  return (
    <View style={[styles.page, { width, height }]}>
      {!ready && !failed ? (
        <Skeleton width="100%" height="100%" radius={0} color="#2A2A2A" />
      ) : null}

      {photo.uri ? (
        ExpoImage ? (
          <ExpoImage
            source={{
              uri: photo.uri,
              // L'URL signée change à chaque session; le storage_path, lui,
              // reste stable. Il permet de réutiliser le cache disque même
              // après fermeture complète de l'application.
              cacheKey: photo.storagePath || photo.id,
            }}
            // Clé de recyclage : expo-image garde la bonne image sur la
            // bonne cellule quand la liste réutilise une page.
            recyclingKey={photo.id}
            // Les octets restent sur le disque : remonter une cellule ne
            // redéclenche aucun téléchargement.
            cachePolicy="memory-disk"
            // Aucun fondu : un remontage ne doit pas produire de clignotement.
            transition={0}
            contentFit="contain"
            style={styles.image}
            onLoad={handleLoad}
            onError={() => {
              setFailed(true);
              setReady(false);
            }}
            accessibilityLabel="Photo de l'album"
          />
        ) : (
          <RNImage
            source={{ uri: photo.uri }}
            resizeMode="contain"
            // Pas de fondu à l'affichage (Android) : rien ne doit clignoter.
            fadeDuration={0}
            style={styles.image}
            onLoad={handleLoad}
            onError={() => {
              setFailed(true);
              setReady(false);
            }}
            accessibilityLabel="Photo de l'album"
          />
        )
      ) : null}

      {failed ? (
        <View style={styles.failed} pointerEvents="none">
          <Text style={styles.failedText}>Image indisponible</Text>
        </View>
      ) : null}
    </View>
  );
}

// ── Carrousel ───────────────────────────────────────────────────────────
function PhotoCarouselBase({ photos, initialIndex = 0, onIndexChange, onInteract }) {
  const [width, setWidth] = useState(FALLBACK_WIDTH);
  const listRef = useRef(null);
  const currentRef = useRef(initialIndex);
  const didInitialScroll = useRef(false);
  // Tant que la position initiale n'est pas atteinte, les événements de
  // scroll transitoires (offset 0 avant l'application de
  // `initialScrollIndex`) sont ignorés : sinon l'UI annonçait « 1 / n »
  // et refermait l'astuce favorites avant de revenir sur la bonne photo.
  const initialApplied = useRef(initialIndex <= 0);

  const handleLayout = useCallback((event) => {
    const next = Math.round(event.nativeEvent.layout.width);
    setWidth((prev) => (Math.abs(prev - next) > 1 ? next : prev));
  }, []);

  // Source de vérité de la page courante : la position réelle de défilement.
  // (`onViewableItemsChanged` peut annoncer la page 0 pendant le scroll
  // initial vers `initialScrollIndex`, ce qui faisait « revenir » l'UI.)
  const handleScroll = useCallback(
    (event) => {
      if (!width) return;
      const offset = event.nativeEvent.contentOffset.x;

      if (!initialApplied.current) {
        const target = initialIndex * width;
        if (Math.abs(offset - target) > width / 2) return;
        initialApplied.current = true;
      }

      const index = Math.round(offset / width);
      if (index === currentRef.current) return;
      if (index < 0 || index >= photos.length) return;
      currentRef.current = index;
      onIndexChange?.(index);
    },
    [width, photos.length, onIndexChange, initialIndex]
  );

  const handleBeginDrag = useCallback(() => {
    // L'utilisateur prend la main : on accepte la position réelle.
    initialApplied.current = true;
    onInteract?.();
  }, [onInteract]);

  const renderItem = useCallback(
    ({ item }) => <CarouselPage photo={item} width={width} height={IMAGE_HEIGHT} />,
    [width]
  );

  return (
    <View onLayout={handleLayout}>
      <FlatList
        ref={listRef}
        horizontal
        data={photos}
        keyExtractor={(p) => p.id}
        renderItem={renderItem}
        pagingEnabled
        disableIntervalMomentum
        directionalLockEnabled
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={initialIndex}
        getItemLayout={(_, index) => ({
          length: width,
          offset: width * index,
          index,
        })}
        // Les voisines restent montées : plus de remontage au swipe.
        initialNumToRender={3}
        windowSize={7}
        maxToRenderPerBatch={3}
        removeClippedSubviews={false}
        scrollEventThrottle={32}
        onScroll={handleScroll}
        onScrollBeginDrag={handleBeginDrag}
        // Filet de sécurité : si le scroll initial échoue (cellule pas encore
        // mesurée), on force la position au lieu de laisser la page 0.
        // `initialScrollIndex` reste la seule source de vérité au montage :
        // forcer l'offset ailleurs provoquerait justement le retour en arrière.
        onScrollToIndexFailed={() => {
          if (didInitialScroll.current) return;
          didInitialScroll.current = true;
          listRef.current?.scrollToOffset({
            offset: Math.max(0, initialIndex) * width,
            animated: false,
          });
        }}
      />
    </View>
  );
}

// Signature stable d'une liste de photos : identité + URL.
// Un refresh Realtime qui ne touche pas aux images produit la même
// signature → `memo` annule le rendu → aucune image n'est retouchée.
function signature(photos) {
  const list = photos || [];
  let out = '';
  for (let i = 0; i < list.length; i += 1) {
    const p = list[i];
    out += `${p.id}:${p.uri || ''}|`;
  }
  return out;
}

function areEqual(prev, next) {
  if (prev.initialIndex !== next.initialIndex) return false;
  if (prev.photos === next.photos) return true;
  if (prev.photos.length !== next.photos.length) return false;
  return signature(prev.photos) === signature(next.photos);
}

export default memo(PhotoCarouselBase, areEqual);

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: { width: '100%', height: '100%' },
  failed: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  failedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8A9A9C',
  },
});
