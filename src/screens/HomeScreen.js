import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../theme';
import { CoralButton, Field, Logo, OutlinePill, Sheet } from '../components/UI';
import CodeBoxes from '../components/CodeBoxes';
import { useStore } from '../store';

const suggestions = [
  { title: 'Votre album de vacances', sub: 'Partagez vos meilleurs moments de vacances', bg: '#D6F0F1' },
  { title: 'Fête de famille', sub: 'Rassemblez les meilleurs souvenirs', bg: '#F8E3DE' },
  { title: 'La 1ère année', sub: 'Immortalisez le premier rire', bg: '#E4F4F4' },
  { title: 'Moments spéciaux', sub: 'Pour les moments spéciaux de la vie', bg: '#FDE8E4' },
];

export default function HomeScreen() {
  const nav = useNavigation();
  const { state, createAlbum } = useStore();
  const [create, setCreate] = useState(false);
  const [join, setJoin] = useState(false);
  const [name, setName] = useState('');
  const [first, setFirst] = useState(state.profile.firstName);
  const [code, setCode] = useState('');

  return (
    <View style={styles.root}>
      <Logo size={34} />
      <View style={styles.row}>
        <OutlinePill title="Nouvel album" icon="+" onPress={() => setCreate(true)} />
        <OutlinePill title="Rejoindre" icon="⊕" onPress={() => setJoin(true)} />
      </View>
      <Text style={styles.h}>Conserver de nouveaux souvenirs</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 110 }}>
        {suggestions.map((s) => (
          <TouchableOpacity key={s.title} style={[styles.card, { backgroundColor: s.bg }]} onPress={() => { setName(s.title); setCreate(true); }}>
            <Text style={{ fontSize: 18 }}>＋</Text>
            <Text style={{ fontWeight: '700', marginTop: 6 }}>{s.title}</Text>
            <Text style={{ color: '#555', fontSize: 13 }}>{s.sub}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <Text style={[styles.h, { marginTop: 18 }]}>Mes albums</Text>
      <ScrollView>
        {state.albums.length === 0 && (
          <Text style={{ color: colors.muted }}>Aucun album pour le moment.</Text>
        )}
        {state.albums.map((a) => (
          <TouchableOpacity key={a.id} style={{ marginBottom: 18 }} onPress={() => nav.navigate('Album', { id: a.id })}>
            <View style={styles.cover}>
              {a.photos[0] ? null : <Logo size={56} />}
            </View>
            <Text style={{ fontSize: 18, fontWeight: '600', marginTop: 8 }}>{a.name}</Text>
            <Text style={{ color: colors.muted }}>{a.photos.length} photo{a.photos.length > 1 ? 's' : ''}</Text>
          </TouchableOpacity>
        ))}
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
      <Sheet visible={join} onClose={() => setJoin(false)} title="Rejoindre un album">
        <Text style={{ textAlign: 'center', marginBottom: 12 }}>Entrez le code à 8 chiffres pour rejoindre l'album.</Text>
          {join ? <CodeBoxes value={code} onChange={setCode} /> : null}
        <CoralButton title="Continuer" disabled={code.length < 8} onPress={() => setJoin(false)} />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 18, paddingTop: 12 },
  row: { flexDirection: 'row', gap: 10, marginVertical: 16 },
  h: { fontSize: 20, fontWeight: '700', marginBottom: 10 },
  card: { width: 240, borderRadius: 16, padding: 14, marginRight: 12 },
  cover: {
    height: 170,
    borderRadius: 16,
    backgroundColor: '#FDE8E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverLogo: { fontFamily: 'Georgia', fontStyle: 'italic', fontSize: 28, color: colors.coral },
});
