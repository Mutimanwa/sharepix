import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  FlatList,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { colors } from '../theme';

import { CoralButton, Logo, Field } from '../components/UI';
import { ArtShare, ArtPrivate, ArtQuality } from '../components/OnboardingArt';
import CodeBoxes from '../components/CodeBoxes';
import { useStore } from '../store';
import { isSupabaseConfigured } from '../config';
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
  
  // <-- AJOUT des states de chargement
  const [loadingCreate, setLoadingCreate] = useState(false);
  const [loadingJoin, setLoadingJoin] = useState(false);
  
  // <-- AJOUT de joinAlbum dans le destructuring
  const { createAlbum, joinAlbum, setOnboarded, state } = useStore();
  const insets = useSafeAreaInsets();

  const goHome = () => {
    setOnboarded();
    if (isSupabaseConfigured && !state.user) {
      console.log('➡️ Onboarding -> Main (Supabase configured, no user)');
      navigation.replace('Main');
    } else {
      console.log('➡️ Onboarding -> Main');
      navigation.replace('Main');
    }
  };

  const onScroll = (e) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    if (next !== i) setI(next);
  };

  if (join) {
    return (
      <View style={[styles.root, styles.formRoot, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) }]}>
        <StatusBar style="dark" />
        <View style={styles.formHeader}>
          <TouchableOpacity onPress={() => { setJoin(false); setCode(''); }} style={styles.backButton}>
            <Text style={styles.backText}>← Retour</Text>
          </TouchableOpacity>
          <Text style={styles.formHeaderTitle}>Rejoindre un album</Text>
          <View style={styles.headerSpacer} />
        </View>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="always">
            <Text style={styles.formTitle}>Entrez votre code</Text>
            <Text style={styles.center}>Saisissez le code à 8 caractères pour rejoindre l'album.</Text>
            <CodeBoxes value={code} onChange={setCode} autoFocus />
            <CoralButton
              title={loadingJoin ? 'Recherche en cours…' : 'Continuer'}
              disabled={code.length < 8 || loadingJoin}
              onPress={async () => {
                setLoadingJoin(true);
                try {
                  const album = await joinAlbum(code);
                  if (!album) {
                    Alert.alert('Introuvable', "Ce code d'album n'existe pas ou a été supprimé.");
                    return;
                  }
                  setJoin(false);
                  setCode('');
                  goHome();
                } catch (err) {
                  Alert.alert('Erreur', err.message || "Impossible de rejoindre l'album.");
                } finally {
                  setLoadingJoin(false);
                }
              }}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    );
  }

  if (create) {
    return (
      <View style={[styles.root, styles.formRoot, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) }]}>
        <StatusBar style="dark" />
        <View style={styles.formHeader}>
          <TouchableOpacity onPress={() => setCreate(false)} style={styles.backButton}>
            <Text style={styles.backText}>← Retour</Text>
          </TouchableOpacity>
          <Text style={styles.formHeaderTitle}>Créer un album</Text>
          <View style={styles.headerSpacer} />
        </View>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="always">
            <Text style={styles.formTitle}>Personnalisez votre album</Text>
            <Field
              label="Nom de l'album"
              value={name}
              onChangeText={setName}
              keyboardType="default"
              autoCapitalize="sentences"
              returnKeyType="next"
            />
            <Field
              label="Votre prénom"
              value={first}
              onChangeText={setFirst}
              autoCapitalize="words"
              keyboardType="default"
            />
            <Text style={styles.center}>Vous pouvez à nouveau changer les deux.</Text>
            <CoralButton
              title={loadingCreate ? 'Création en cours…' : 'Créer un album'}
              disabled={!name.trim() || !first.trim() || loadingCreate}
              onPress={async () => {
                setLoadingCreate(true);
                try {
                  await createAlbum({ name: name.trim(), firstName: first.trim() });
                  setCreate(false);
                  goHome();
                } catch (err) {
                  Alert.alert('Erreur', err.message || "Impossible de créer l'album.");
                } finally {
                  setLoadingCreate(false);
                }
              }}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    );
  }

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


    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  formRoot: {
    paddingHorizontal: 20,
  },
  formHeader: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 88,
    minHeight: 44,
    justifyContent: 'center',
  },
  backText: {
    color: colors.tealDark,
    fontSize: 15,
    fontWeight: '600',
  },
  formHeaderTitle: {
    flex: 1,
    textAlign: 'center',
    color: colors.tealDark,
    fontSize: 17,
    fontWeight: '700',
  },
  headerSpacer: {
    width: 88,
  },
  formContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 24,
  },
  formTitle: {
    color: colors.tealDark,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
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