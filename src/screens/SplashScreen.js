import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { colors } from '../theme';

const LOGO = require('../../assets/sharepix-logo.png');

export default function SplashScreen({ navigation }) {
  const pop = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const ring = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;
  const d1 = useRef(new Animated.Value(0)).current;
  const d2 = useRef(new Animated.Value(0)).current;
  const d3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(pop, {
        toValue: 1,
        friction: 5,
        tension: 80,
        useNativeDriver: true,
      }),
      Animated.timing(fadeIn, {
        toValue: 1,
        duration: 420,
        useNativeDriver: true,
      }),
    ]).start();

    const loopPulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loopPulse.start();

    const wave = (val, delay) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, {
            toValue: 1,
            duration: 1600,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(val, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      );
    const w1 = wave(ring, 0);
    const w2 = wave(ring2, 700);
    w1.start();
    w2.start();

    const bounce = (val, delay) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, {
            toValue: 1,
            duration: 280,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(val, {
            toValue: 0,
            duration: 280,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      );
    const b1 = bounce(d1, 0);
    const b2 = bounce(d2, 140);
    const b3 = bounce(d3, 280);
    b1.start();
    b2.start();
    b3.start();

    const t = setTimeout(() => navigation.replace('Onboarding'), 2800);
    return () => {
      clearTimeout(t);
      loopPulse.stop();
      w1.stop();
      w2.stop();
      b1.stop();
      b2.stop();
      b3.stop();
    };
  }, [navigation, pop, pulse, ring, ring2, fadeIn, d1, d2, d3]);

  const logoScale = Animated.multiply(
    pop.interpolate({ inputRange: [0, 1], outputRange: [0.28, 1] }),
    pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] })
  );

  const makeRingStyle = (val) => ({
    transform: [{ scale: val.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.85] }) }],
    opacity: val.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.45, 0.28, 0] }),
  });

  const dotY = (val) => ({
    transform: [{ translateY: val.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) }],
    opacity: val.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
  });

  return (
    <View style={styles.root}>
      <View style={styles.center}>
        <View style={styles.stage}>
          <Animated.View style={[styles.ring, makeRingStyle(ring)]} />
          <Animated.View style={[styles.ring, styles.ringAlt, makeRingStyle(ring2)]} />
          <Animated.Image
            source={LOGO}
            style={[styles.logo, { transform: [{ scale: logoScale }] }]}
            resizeMode="contain"
          />
        </View>

        <Animated.View style={[styles.loader, { opacity: fadeIn }]}>
          <Animated.View style={[styles.dot, dotY(d1)]} />
          <Animated.View style={[styles.dot, styles.dotCoral, dotY(d2)]} />
          <Animated.View style={[styles.dot, dotY(d3)]} />
        </Animated.View>
      </View>

      <Animated.View style={[styles.footer, { opacity: fadeIn }]}>
        <Text style={styles.by}>Created by</Text>
        <Text style={styles.restart}>RESTART</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.tealDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { alignItems: 'center', justifyContent: 'center' },
  stage: {
    width: 260,
    height: 260,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 168,
    height: 168,
    borderRadius: 168,
    borderWidth: 2,
    borderColor: colors.teal,
  },
  ringAlt: { borderColor: colors.coral },
  logo: { width: 176, height: 176 },
  loader: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
    height: 20,
    alignItems: 'flex-end',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 8,
    backgroundColor: colors.teal,
  },
  dotCoral: { backgroundColor: colors.coral },
  footer: { position: 'absolute', bottom: 52, alignItems: 'center' },
  by: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  restart: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 4,
    marginTop: 4,
  },
});
