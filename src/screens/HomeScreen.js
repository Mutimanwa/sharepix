import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../theme';
import { CoralButton, Field, Logo, Sheet } from '../components/UI';
import CodeBoxes from '../components/CodeBoxes';
import { IconVacances, IconFamille, IconBebe, IconSpecial } from '../components/HomeArt';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { Add01Icon, UserAdd01Icon } from '@hugeicons/core-free-icons';
import { useStore } from '../store';

const suggestions = [
  { title: 'Vacances', sub: 'Vos plus beaux voyages', bg: '#D6F0F1', Icon: IconVacances },
  { title: 'Famille', sub: 'Retrouvailles et fêtes', bg: '#F8E3DE', Icon: IconFamille },
  { title: '1ère année', sub: 'Les premiers rires', bg: '#E4F4F4', Icon: IconBebe },
  { title: 'Moments clés', sub: 'Les instants uniques', bg: '#FDE8E4', Icon: IconSpecial },
];

export default function HomeScreen() {
  const nav = useNavigation();
  const { state, createAlbum } = useStore();
  const [create, setCreate] = useState(false);
  const [join, setJoin] = useState(false);
  const [name, setName] = useState('');
  const [first, setFirst] = useState(state.profile.firstName);
  const [code, setCode] = useState('');
  const hello = state.profile.firstName ? `Bonjour, ${state.profile.firstName}` : 'Bonjour';

  return (
    <View style={styles.root}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 28 }}>
        <View style={styles.header}>
          <Logo size={46} />
           <Text style={styles.sub}>Vos souvenirs, en un seul endroit</Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.actCoral} onPress={() => setCreate(true)} activeOpacity={0.88}>
            <HugeiconsIcon icon={Add01Icon} size={22} color="#fff" strokeWidth={2} />
            <Text style={styles.actTitle}>Ajouter</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actTeal}
            onPress={() => {
              setCode('');
              setJoin(true);
            }}
            activeOpacity={0.88}
          >
            <HugeiconsIcon icon={UserAdd01Icon} size={22} color="#fff" strokeWidth={2} />
            <Text style={styles.actTitle}>Rejoindre</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.h}>Idées d’albums</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 8 }}>
          {suggestions.map((s) => {
            const Ico = s.Icon;
            return (
              <TouchableOpacity
                key={s.title}
                style={[styles.idea, { backgroundColor: s.bg }]}
                onPress={() => {
                  setName(s.title);
                  setCreate(true);
                }}
              >
                <Ico />
                <Text style={styles.ideaT}>{s.title}</Text>
                <Text style={styles.ideaS}>{s.sub}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.rowHead}>
          <Text style={styles.h}>Mes albums</Text>
          <Text style={styles.count}>{state.albums.length}</Text>
        </View>

        {state.albums.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyT}>Aucun album pour le moment</Text>
            <Text style={styles.emptyS}>Créez le premier ou rejoignez un proche.</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {state.albums.map((a) => (
              <TouchableOpacity key={a.id} style={styles.album} onPress={() => nav.navigate('Album', { id: a.id })}>
                <View style={styles.cover}>
                  {a.photos[0] ? (
                    <Image source={{ uri: a.photos[0].uri }} style={styles.coverImg} />
                  ) : (
                    <Logo size={48} />
                  )}
                </View>
                <Text style={styles.albumName} numberOfLines={1}>{a.name}</Text>
                <Text style={styles.albumMeta}>
                  {a.photos.length} photo{a.photos.length > 1 ? 's' : ''}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      <Sheet visible={create} onClose={() => setCreate(false)} title="Personnalisez votre album">
        <Field label="Nom de l'album" value={name} onChangeText={setName} />
        <Field label="Votre prénom" value={first} onChangeText={setFirst} />
        <Text style={{ textAlign: 'center', marginBottom: 10 }}>Vous pouvez à nouveau changer les deux.</Text>
        <CoralButton
          title="Créer un album"
          disabled={!name.trim()}
          onPress={() => {
            const alb = createAlbum({ name: name.trim(), firstName: first.trim() });
            setCreate(false);
            nav.navigate('Album', { id: alb.id });
          }}
        />
      </Sheet>
      <Sheet
        visible={join}
        onClose={() => {
          setJoin(false);
          setCode('');
        }}
        title="Rejoindre un album"
      >
        <Text style={{ textAlign: 'center' }}>Entrez le code à 8 caractères pour rejoindre l'album.</Text>
        {join ? <CodeBoxes value={code} onChange={setCode} /> : null}
        <CoralButton title="Continuer" disabled={code.length < 8} onPress={() => setJoin(false)} />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  header: {
    flexDirection: 'flex',
    justifyContent: 'space-center',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 14,
  },
  hello: { fontSize: 24, fontWeight: '800', color: colors.tealDark },
  sub: { color: colors.muted, marginTop: 4, fontSize: 14 },
  actions: { flexDirection: 'row', gap: 12, paddingHorizontal: 18, marginTop: 18 },
  actCoral: {
    flex: 1,
    backgroundColor: colors.coral,
    borderRadius: 20,
    padding: 16,
    minHeight: 112,
  },
  actTeal: {
    flex: 1,
    backgroundColor: colors.tealDark,
    borderRadius: 20,
    padding: 16,
    minHeight: 112,
  },
  actPlus: { color: '#fff', fontSize: 22, fontWeight: '700' },
  actTitle: { color: '#fff', fontSize: 17, fontWeight: '800', marginTop: 10 },
  actHint: { color: 'rgba(255,255,255,0.8)', marginTop: 4, fontSize: 13 },
  h: { fontSize: 18, fontWeight: '800', color: colors.tealDark, paddingHorizontal: 18, marginTop: 22, marginBottom: 12 },
  idea: {
    width: 148,
    borderRadius: 20,
    padding: 14,
    marginLeft: 18,
  },
  ideaT: { fontWeight: '800', marginTop: 8, color: colors.tealDark, fontSize: 16 },
  ideaS: { color: '#5A6E6F', marginTop: 4, fontSize: 12 },
  rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: 18 },
  count: {
    marginTop: 10,
    backgroundColor: colors.teal,
    color: '#fff',
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    fontWeight: '700',
  },
  empty: {
    marginHorizontal: 18,
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 22,
    alignItems: 'center',
  },
  emptyT: { fontWeight: '700', color: colors.tealDark },
  emptyS: { color: colors.muted, marginTop: 6, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12 },
  album: { width: '50%', padding: 6 },
  cover: {
    height: 140,
    borderRadius: 18,
    backgroundColor: colors.tealDeep,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  coverImg: { width: '100%', height: '100%' },
  albumName: { fontSize: 16, fontWeight: '700', marginTop: 8, color: colors.tealDark, paddingHorizontal: 4 },
  albumMeta: { color: colors.muted, paddingHorizontal: 4, marginTop: 2 },
});
