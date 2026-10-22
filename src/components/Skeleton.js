// ── SQUELETTES DE CHARGEMENT : intégration ─────────────────────────────
// Bloc animé (pulsation) pour tout contenu qui charge : grilles de photos,

import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";

// couvertures, avatars… Couleur adaptable (viewer Photo = fond noir).
/**
 * @param {{ width?: number|string, height?: number|string, radius?: number,
 *           color?: string, style?: any }} props
 */
export function Skeleton({ width = '100%', height = 16, radius = 8, color = '#E2EEEE', style = {} }) {
  const opacity = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: false }),
        Animated.timing(opacity, { toValue: 0.45, duration: 700, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return (
    <Animated.View
      style={[{ width, height, borderRadius: radius, backgroundColor: color, opacity }, style]}
    />
  );
}

/**
 * Image « progressive » : squelette tant que les octets ne sont pas arrivés,
 * puis fondu. Conçue pour les URLs signées (bucket privé).
 *
 * ── CORRECTIF BUG-01 ──────────────────────────────────────────────────
 * Avant : le cycle repartait à chaque changement d'`uri`. Or les URLs
 * signées étaient régénérées à chaque refresh Realtime → toutes les images
 * repassaient en squelette et retéléchargeaient en boucle.
 *
 * Maintenant :
 *  - l'identité de la photo est `storagePath` (stable), pas l'URL (rotative) ;
 *  - une rotation d'URL sur une image déjà affichée ne provoque AUCUN clignotement ;
 *  - une rotation d'URL sur une image en échec déclenche une nouvelle tentative ;
 *  - un échec définitif affiche un état visible au lieu d'un squelette infini.
 *
 * ── COMPLÉMENT (rechargement au swipe) ────────────────────────────────
 * Une liste virtualisée démonte les cellules éloignées puis les remonte au
 * retour. Comme l'état React repart de zéro, l'image repassait par le
 * squelette et par le fondu à CHAQUE remontage, même si les octets étaient
 * déjà en cache. On mémorise donc les identités déjà affichées pour la
 * session : une image connue s'affiche directement, sans squelette ni fondu.
 */
const ALREADY_LOADED = new Set();

export function ProgressiveImage({
  uri,
  storagePath,
  style = {},
  radius,
  color = '#E2EEEE',
  resizeMode = 'cover',
  showErrorText = false,
  ...imgProps
}) {
  // Identité stable : le chemin Storage ne change jamais, l'URL signée si.
  const identity = storagePath || uri || '';
  // Image déjà affichée une fois dans la session → état final dès le premier
  // rendu (pas une seule image de squelette au remontage de la cellule).
  const alreadyLoaded = !!identity && ALREADY_LOADED.has(identity);

  const [loaded, setLoaded] = useState(alreadyLoaded);
  const [failed, setFailed] = useState(false);
  const fade = useRef(new Animated.Value(alreadyLoaded ? 1 : 0)).current;

  // Nouvelle photo → on repart de zéro. Photo déjà affichée → on reprend
  // directement à l'état final (ni squelette, ni fondu au remontage).
  useEffect(() => {
    if (identity && ALREADY_LOADED.has(identity)) {
      setLoaded(true);
      setFailed(false);
      fade.setValue(1);
      return;
    }
    setLoaded(false);
    setFailed(false);
    fade.setValue(0);
  }, [identity, fade]);

  // Même photo mais URL renouvelée : on retente seulement si on avait échoué.
  useEffect(() => {
    setFailed((wasFailed) => (wasFailed ? false : wasFailed));
  }, [uri]);

  const flatStyle = StyleSheet.flatten(style) || {};
  const borderRadius = radius ?? flatStyle.borderRadius ?? 0;

  return (
    <View style={[style, { overflow: 'hidden', borderRadius, backgroundColor: 'transparent' }]}>
      {!loaded && !failed && (
        <Skeleton
          width="100%"
          height="100%"
          radius={0}
          color={color}
          style={{ position: 'absolute', top: 0, left: 0 }}
        />
      )}

      {uri ? (
        <Animated.Image
          key={identity}
          source={{ uri }}
          resizeMode={resizeMode}
          style={{ width: '100%', height: '100%', opacity: fade }}
          onLoad={() => {
            const wasKnown = !!identity && ALREADY_LOADED.has(identity);
            if (identity) ALREADY_LOADED.add(identity);
            setLoaded(true);
            setFailed(false);
            if (wasKnown) {
              // Déjà connue : aucun fondu, l'image est là tout de suite.
              fade.setValue(1);
            } else {
              Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: false }).start();
            }
          }}
          onError={() => {
            setFailed(true);
            setLoaded(false);
          }}
          {...imgProps}
        />
      ) : null}

      {failed && (
        <View style={styles.failedBox} pointerEvents="none">
          {showErrorText ? (
            <Text style={styles.failedText} numberOfLines={2}>
              Image indisponible
            </Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  failedBox: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  failedText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#8A9A9C',
    textAlign: 'center',
    paddingHorizontal: 4,
  },
});
// ── SQUELETTES : fin ──
