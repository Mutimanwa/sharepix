import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Share } from 'react-native';
import { colors } from '../theme';
import { CoralButton } from '../components/UI';
import { useStore } from '../store';

export function FiltersScreen({ navigation }) {
  return (
    <View style={styles.sheetPage}>
      <View style={styles.head}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text>✕</Text>
        </TouchableOpacity>
        <Text style={{ fontWeight: '700', fontSize: 18 }}>Filtre</Text>
        <Text style={{ color: colors.coral }}>Réinitialiser</Text>
      </View>
      <Text style={styles.h}>Ordre</Text>
      <Text style={styles.p}>Toutes les photos et vidéos sont automatiquement triées par heure de capture.</Text>
      {['Le plus récent en premier', 'Le plus ancien en premier', 'Dernier téléchargement'].map((t, i) => (
        <View key={t} style={[styles.opt, i === 0 && styles.optOn]}>
          <Text>{t}</Text>
          <View style={[styles.radio, i === 0 && styles.radioOn]} />
        </View>
      ))}
      <Text style={styles.h}>Grouper</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {['Toutes les photos', 'Mois', 'Journée', 'Heure'].map((t, i) => (
          <View key={t} style={[styles.chip, i === 0 && styles.chipOn]}>
            <Text style={{ color: i === 0 ? '#fff' : '#111' }}>{t}</Text>
          </View>
        ))}
      </View>
      <View style={{ marginTop: 24 }}>
        <CoralButton title="Appliquer" disabled onPress={() => navigation.goBack()} />
      </View>
    </View>
  );
}

export function QRScreen({ route, navigation }) {
  const album = useStore().state.albums.find((a) => a.id === route.params.id);
  return (
    <View style={styles.page}>
      <View style={styles.head}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text>‹</Text>
        </TouchableOpacity>
        <Text style={{ fontWeight: '700', fontSize: 18 }}>Code QR</Text>
        <View style={{ width: 16 }} />
      </View>
      <View style={{ alignItems: 'center', marginTop: 40 }}>
        <View style={styles.qrBox} />
        <Text style={{ fontSize: 20, fontWeight: '700', marginTop: 16 }}>{album?.name}</Text>
        <Text style={{ color: colors.muted, marginTop: 6 }}>Ce code QR mène directement à l'album</Text>
        <View style={{ width: '80%', marginTop: 20 }}>
          <CoralButton title="↓  Enregistrer comme image" onPress={() => {}} />
        </View>
      </View>
    </View>
  );
}

export function MembersScreen({ route, navigation }) {
  const album = useStore().state.albums.find((a) => a.id === route.params.id);
  return (
    <View style={styles.page}>
      <View style={styles.head}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text>‹</Text>
        </TouchableOpacity>
        <Text style={{ fontWeight: '700', fontSize: 18 }}>Membres</Text>
        <View style={{ width: 16 }} />
      </View>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ fontSize: 22, fontWeight: '800', textAlign: 'center' }}>
          Malheureusement, l'album n'a pas encore de membres
        </Text>
        <Text style={{ textAlign: 'center', color: colors.muted, marginTop: 10 }}>
          Partagez le code d'invitation avec vos amis pour les ajouter comme membres à votre album.
        </Text>
        <View style={{ width: '80%', marginTop: 20 }}>
          <CoralButton
            title="Invitez"
            onPress={() =>
              Share.share({
                message: `J'utilise l'album "${album?.name}" dans l'appli. Code: ${album?.code}`,
              })
            }
          />
        </View>
      </View>
    </View>
  );
}

export function PremiumScreen({ navigation }) {
  return (
    <View style={[styles.page, { backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' }]}>
      <View style={[styles.head, { position: 'absolute', top: 8, left: 0, right: 0 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text>‹</Text>
        </TouchableOpacity>
        <Text style={{ fontWeight: '700' }}>Album Premium</Text>
        <View style={{ width: 16 }} />
      </View>
      <Text style={{ textAlign: 'center', paddingHorizontal: 32, fontSize: 16 }}>
        Le Play Store n'est pas disponible à cet instant. Veuillez réessayer plus tard.
      </Text>
    </View>
  );
}

export function PcUploadScreen({ navigation }) {
  return (
    <View style={styles.page}>
      <View style={styles.head}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text>‹</Text>
        </TouchableOpacity>
        <Text style={{ fontWeight: '700', fontSize: 18 }}>Téléchargement PC</Text>
        <View style={{ width: 16 }} />
      </View>
      <Text style={{ padding: 16, fontSize: 16, lineHeight: 22 }}>
        Avec l'aide de notre Téléchargement PC, vous pouvez facilement ajouter des photos et des vidéos à l'album via le navigateur web de votre ordinateur.
      </Text>
      <Text style={{ paddingHorizontal: 16, fontWeight: '700' }}>Et c'est aussi simple que cela :</Text>
      <View style={styles.step}>
        <Text style={styles.n}>1.</Text>
        <Text style={{ marginTop: 40, fontWeight: '600' }}>web.celebrate.app</Text>
      </View>
      <Text style={{ paddingHorizontal: 16 }}>Ouvrir web.celebrate.app sur votre ordinateur.</Text>
      <View style={styles.step}>
        <Text style={styles.n}>2.</Text>
        <Text style={{ marginTop: 20 }}>Scannez le QR affiché à l'écran.</Text>
      </View>
      <View style={{ padding: 16 }}>
        <CoralButton title="Scanner le QR code" onPress={() => {}} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#fff' },
  sheetPage: { flex: 1, backgroundColor: '#fff', padding: 16 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12 },
  h: { fontSize: 18, fontWeight: '800', marginTop: 16 },
  p: { color: colors.muted, marginVertical: 8 },
  opt: { borderWidth: 1, borderColor: '#ddd', borderRadius: 12, padding: 14, marginVertical: 6, flexDirection: 'row', justifyContent: 'space-between' },
  optOn: { borderColor: '#111', borderWidth: 2 },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: '#aaa' },
  radioOn: { borderWidth: 6, borderColor: '#111' },
  chip: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  chipOn: { backgroundColor: '#111', borderColor: '#111' },
  qrBox: { width: 200, height: 200, backgroundColor: '#111' },
  step: { margin: 16, borderWidth: 1, borderColor: '#F0D0C4', borderRadius: 12, height: 140, backgroundColor: colors.peach, padding: 12 },
  n: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#fff', textAlign: 'center', lineHeight: 28, fontWeight: '700' },
});
