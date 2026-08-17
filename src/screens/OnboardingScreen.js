import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { colors } from '../theme';
import { CoralButton, Logo, Sheet, Field, FullPage } from '../components/UI';
import { ArtShare, ArtPrivate, ArtQuality } from '../components/OnboardingArt';
import CodeBoxes from '../components/CodeBoxes';
import { useStore } from '../store';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

const { width } = Dimensions.get('window');

const slides = [
  {
    key: 'share',
    title: 'Partagez vos meilleurs moments avec votre famille et vos amis',
    Art: ArtShare,
  },
  {
    key: 'private',
    title: 'Un accès privé uniquement pour vos proches',
    Art: ArtPrivate,
  },
  {
    key: 'quality',
    title: 'Rassemblez vos photos et vidéos de qualité originale',
    Art: ArtQuality,
  },
];

export default function OnboardingScreen({ navigation }) {
  const list = useRef(null);
  const [i, setI] = useState(0);
  const [join, setJoin] = useState(false);
  const [create, setCreate] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [first, setFirst] = useState('');
  const { createAlbum, setOnboarded } = useStore();
  const insets = useSafeAreaInsets();

  const goHome = () => {
    setOnboarded();
    navigation.replace('Main');
  };

  const onScroll = (e) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    if (next !== i) setI(next);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <StatusBar style='dark' />
      <View style={styles.brand}>
        <Logo size={44} />
      </View>

      <FlatList
        ref={list}
        data={slides}
        keyExtractor={(item) => item.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        renderItem={({ item }) => {
          const Art = item.Art;
          return (
            <View style={styles.page}>
              <View style={styles.artWrap}>
                <Art size={Math.min(300, width - 64)} />
              </View>
              <Text style={styles.title}>{item.title}</Text>
            </View>
          );
        }}
      />

      <View style={styles.dots}>
        {slides.map((s, k) => (
          <TouchableOpacity
            key={s.key}
            onPress={() => {
              list.current?.scrollToIndex({ index: k, animated: true });
              setI(k);
            }}
          >
            <View style={[styles.dot, i === k && styles.dotOn]} />
          </TouchableOpacity>
        ))}
      </View>

      <View style={[styles.actions, { paddingBottom: Math.max(insets.bottom, 28) }]}>
        <CoralButton title="Créez un nouvel album" onPress={() => setCreate(true)} />
        <CoralButton
          title="Utilisez le code d'accès"
          color={colors.teal}
          onPress={() => setJoin(true)}
        />
      </View>

      {/* Sheets avec SafeArea intégré */}
      <Sheet
        visible={join}
        onClose={() => {
          setJoin(false);
          setCode('');
        }}
        title="Rejoindre un album"
        useSafeArea={true}
      >
        <Text style={styles.center}>Entrez le code à 8 caractères pour rejoindre l'album.</Text>
        {join ? <CodeBoxes value={code} onChange={setCode} /> : null}
        <CoralButton
          title="Continuer"
          disabled={code.length < 8}
          onPress={() => {
            setJoin(false);
            setCode('');
            goHome();
          }}
        />
      </Sheet>

      <Sheet
        visible={create}
        onClose={() => setCreate(false)}
        title="Personnalisez votre album"
        useSafeArea={true}
      >
        <Field 
          label="Nom de l'album" 
          value={name} 
          onChangeText={setName}
          autoFocus
        />
        <Field 
          label="Votre prénom" 
          value={first} 
          onChangeText={setFirst}
        />
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
  root: {
    flex: 1,

  },
  brand: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  page: {
    width,
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingTop: 8,
  },
  artWrap: {
    marginTop: 100,
    marginBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 30,
    color: colors.tealDark,
    paddingHorizontal: 8,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginVertical: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 8,
    backgroundColor: '#C5D8D8',
  },
  dotOn: {
    backgroundColor: colors.teal,
    width: 22,
  },
  actions: {
    paddingHorizontal: 22,
    paddingTop: 4,
  },
  center: {
    textAlign: 'center',
    color: '#333',
    marginVertical: 10,
    fontSize: 16,
  },
});