import React, { useState } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { colors } from '../theme';
import { CoralButton, Logo, Sheet, Field } from '../components/UI';
import { useStore } from '../store';

const { width } = Dimensions.get('window');

const slides = [
  {
    title: 'Partagez vos meilleurs moments\navec votre famille et vos amis',
    hint: 'photo',
  },
  {
    title: 'Un accès privé uniquement\npour vos proches',
    hint: 'lock',
  },
  {
    title: 'Rassemblez vos photos et vidéos\nde qualité originale',
    hint: 'grid',
  },
];

export default function OnboardingScreen({ navigation }) {
  const [i, setI] = useState(0);
  const [join, setJoin] = useState(false);
  const [create, setCreate] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [first, setFirst] = useState('');
  const { createAlbum, setOnboarded } = useStore();

  const goHome = () => {
    setOnboarded();
    navigation.replace('Main');
  };

  return (
    <View style={styles.root}>
      <View style={{ alignItems: 'center', marginTop: 28 }}>
        <Logo size={36} />
      </View>
      <Text style={styles.title}>{slides[i].title}</Text>

      <View style={styles.phone}>
        <View style={styles.notch} />
        {i === 0 && (
          <View style={{ padding: 12, flex: 1 }}>
            <Text style={{ textAlign: 'center', fontWeight: '600' }}>Claudine Durant</Text>
            <Text style={{ textAlign: 'center', color: colors.muted, fontSize: 12 }}>01. Juin 2021</Text>
            <View style={styles.hero} />
            <Text style={{ marginTop: 8, fontWeight: '600' }}>Mamie</Text>
            <Text style={{ color: '#444' }}>Une si belle photo d'eux deux. Donnez-leur un bisou!</Text>
          </View>
        )}
        {i === 1 && (
          <View style={{ padding: 16, flex: 1 }}>
            <Text style={{ textAlign: 'center', fontWeight: '600', marginBottom: 12 }}>Membres</Text>
            <Text style={{ fontWeight: '700', marginBottom: 8 }}>Admins</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={styles.av} />
              <View style={styles.av} />
            </View>
            <Text style={{ fontWeight: '700', marginTop: 16, marginBottom: 8 }}>Membres</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {['Claudine', 'Hugo', 'Emma', 'Leonie'].map((n) => (
                <View key={n} style={{ alignItems: 'center', width: 64 }}>
                  <View style={styles.av} />
                  <Text style={{ fontSize: 11, marginTop: 4 }}>{n}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
        {i === 2 && (
          <View style={{ padding: 10, flex: 1 }}>
            <Text style={{ textAlign: 'center', fontWeight: '700' }}>Notre mariage</Text>
            <Text style={{ textAlign: 'center', color: colors.muted, fontSize: 11 }}>300 photos</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 10 }}>
              {Array.from({ length: 9 }).map((_, k) => (
                <View key={k} style={{ width: (width * 0.62) / 3 - 6, height: 64, backgroundColor: ['#c9b8a8', '#8a9aaa', '#d4c2a0'][k % 3], borderRadius: 4 }} />
              ))}
            </View>
          </View>
        )}
      </View>

      <View style={styles.dots}>
        {slides.map((_, k) => (
          <View key={k} style={[styles.dot, i === k && styles.dotOn]} />
        ))}
      </View>

      <View style={{ paddingHorizontal: 22, marginTop: 8 }}>
        <CoralButton
          title="Créez un nouvel album"
          onPress={() => {
            setI(2);
            setCreate(true);
          }}
        />
        <CoralButton title="Utilisez le code d'accès" color={colors.orange} onPress={() => setJoin(true)} />
      </View>

      <Sheet visible={join} onClose={() => setJoin(false)} title="Rejoindre un album">
        <Text style={styles.center}>Entrez le code à 8 chiffres pour rejoindre l'album.</Text>
        <View style={styles.codeRow}>
          {Array.from({ length: 8 }).map((_, k) => (
            <View key={k} style={[styles.box, k === 0 && styles.boxOn]}>
              <Text style={{ fontSize: 18 }}>{code[k] || ''}</Text>
            </View>
          ))}
        </View>
        <Field value={code} onChangeText={(t) => setCode(t.slice(0, 8).toUpperCase())} placeholder="Code" />
        <CoralButton
          title="Continuer"
          disabled={code.length < 8}
          onPress={() => {
            setJoin(false);
            goHome();
          }}
        />
      </Sheet>

      <Sheet visible={create} onClose={() => setCreate(false)} title="Personnalisez votre album">
        <Field label="Nom de l'album" value={name} onChangeText={setName} />
        <Field label="Votre prénom" value={first} onChangeText={setFirst} />
        <Text style={styles.center}>Vous pouvez à nouveau changer les deux.</Text>
        <CoralButton
          title="Créer un album"
          disabled={!name.trim() || !first.trim()}
          onPress={() => {
            createAlbum({ name: name.trim(), firstName: first.trim() });
            setCreate(false);
            goHome();
          }}
        />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  title: {
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
    marginTop: 22,
    lineHeight: 30,
    paddingHorizontal: 24,
  },
  phone: {
    width: width * 0.68,
    height: 320,
    backgroundColor: '#111',
    borderRadius: 28,
    alignSelf: 'center',
    marginTop: 22,
    overflow: 'hidden',
    borderWidth: 8,
    borderColor: '#111',
  },
  notch: { height: 18, backgroundColor: '#111' },
  hero: { height: 150, backgroundColor: '#d7c4b5', borderRadius: 8, marginTop: 8 },
  av: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#d8c4b2' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 14 },
  dot: { width: 7, height: 7, borderRadius: 7, backgroundColor: '#D0D0D0' },
  dotOn: { backgroundColor: '#222' },
  center: { textAlign: 'center', color: '#333', marginVertical: 10, fontSize: 16 },
  codeRow: { flexDirection: 'row', gap: 6, justifyContent: 'center', marginVertical: 12 },
  box: { width: 34, height: 44, borderRadius: 8, backgroundColor: '#F1F1F3', alignItems: 'center', justifyContent: 'center' },
  boxOn: { borderWidth: 1.5, borderColor: '#111', backgroundColor: '#fff' },
});
