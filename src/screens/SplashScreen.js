import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from '../theme';
import { CameraMark, Logo } from '../components/UI';

export default function SplashScreen({ navigation }) {
  useEffect(() => {
    const t = setTimeout(() => navigation.replace('Onboarding'), 1600);
    return () => clearTimeout(t);
  }, [navigation]);

  return (
    <View style={styles.root}>
      <View style={{ flex: 1 }} />
      <CameraMark size={88} />
      <Logo size={48} color="#fff" />
      <View style={styles.dots}>
        <View style={[styles.dot, { opacity: 1 }]} />
        <View style={[styles.dot, { opacity: 0.35 }]} />
      </View>
      <Text style={styles.h}>Un petit instant</Text>
      <Text style={styles.p}>En pleine décoration ...</Text>
      <View style={{ flex: 1 }} />
      <Text style={styles.help}>Vous avez besoin d'aide ?</Text>
      <TouchableOpacity>
        <Text style={styles.link}>Contactez-nous</Text>
      </TouchableOpacity>
      <View style={{ height: 48 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.coral, alignItems: 'center' },
  dots: { flexDirection: 'row', gap: 8, marginTop: 28, marginBottom: 18 },
  dot: { width: 8, height: 8, borderRadius: 8, backgroundColor: '#fff' },
  h: { color: '#fff', fontSize: 22, fontWeight: '700' },
  p: { color: '#fff', fontSize: 16, marginTop: 6, opacity: 0.95 },
  help: { color: '#fff', fontSize: 16, opacity: 0.95 },
  link: { color: '#fff', fontSize: 17, fontWeight: '700', textDecorationLine: 'underline', marginTop: 6 },
});
