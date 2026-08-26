// ── SQUELETTES DE CHARGEMENT : intégration ─────────────────────────────
// Bloc animé (pulsation) pour tout contenu qui charge : grilles de photos,

import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";

// couvertures, avatars… Couleur adaptable (viewer Photo = fond noir).
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

// Image « progressive » : affiche un squelette tant que les octets ne sont
// pas arrivés, puis révèle l'image en fondu. Conçue pour les URLs signées
// (bucket privé) — quand l'uri change (URL régénérée), le cycle repart.
export function ProgressiveImage({
  uri,
  style = {},
  radius,
  color = '#E2EEEE',
  resizeMode = 'cover',
  ...imgProps
}) {
  const [loaded, setLoaded] = useState(false);
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setLoaded(false);
    fade.setValue(0);
  }, [uri, fade]);

  const flatStyle = StyleSheet.flatten(style) || {};
  const borderRadius = radius ?? flatStyle.borderRadius ?? 0;

  return (
    <View style={[style, { overflow: 'hidden', borderRadius, backgroundColor: 'transparent' }]}>
      {!loaded && (
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
          source={{ uri }}
          resizeMode={resizeMode}
          style={{ width: '100%', height: '100%', opacity: fade }}
          onLoad={() => {
            setLoaded(true);
            Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: false }).start();
          }}
          {...imgProps}
        />
      ) : null}
    </View>
  );
}
// ── SQUELETTES : fin ──