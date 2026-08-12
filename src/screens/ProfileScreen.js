import React from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity, Linking } from 'react-native';
import { Field } from '../components/UI';
import { useStore } from '../store';
import { colors } from '../theme';

function Row({ title, sub, value, onValueChange }) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={styles.rt}>{title}</Text>
        {sub ? <Text style={styles.rs}>{sub}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ true: colors.coral }} />
    </View>
  );
}

export default function ProfileScreen() {
  const { state, updateProfile } = useStore();
  const p = state.profile;

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.head}>
        <Text style={styles.title}>Mon profil</Text>
        <Text style={{ color: colors.coral, fontWeight: '700' }}>Sauvegarder</Text>
      </View>
      <View style={styles.avatar} />
      <Field label="Prénom" value={p.firstName} onChangeText={(firstName) => updateProfile({ firstName })} />
      <Field label="Nom de famille" value={p.lastName} onChangeText={(lastName) => updateProfile({ lastName })} />

      <Row title="Notifications" value={p.notifications} onValueChange={(notifications) => updateProfile({ notifications })} />
      <Row title="Nouvelles Photos" sub="Quand quelqu'un a ajouté des photos" value={p.newPhotos} onValueChange={(newPhotos) => updateProfile({ newPhotos })} />
      <Row title="J'aime" sub="Quand quelqu'un a aimé une de vos photos" value={p.likes} onValueChange={(likes) => updateProfile({ likes })} />
      <Row title="Commentaires" sub="Quand quelqu'un a commenté une photo ou répondu à votre commentaire" value={p.comments} onValueChange={(comments) => updateProfile({ comments })} />

      <View style={styles.help}>
        <Text style={{ fontWeight: '800', fontSize: 16 }}>Avez-vous des questions?</Text>
        <Text style={{ marginTop: 6, color: '#333' }}>Envoyez-nous un e-mail à l'adresse suivante : hello@celebrate.app</Text>
        <TouchableOpacity style={styles.mail} onPress={() => Linking.openURL('mailto:hello@celebrate.app')}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>Ecrire un e-mail</Text>
        </TouchableOpacity>
      </View>

      {['FAQ - Questions Fréquentes', 'Restaurer les achats', 'CGV', 'Sécurité des données', 'Licences', 'Impression', 'Supprimer mon compte'].map((t) => (
        <Text key={t} style={styles.link}>{t}</Text>
      ))}
      <Text style={{ color: colors.muted, marginTop: 16 }}>Version 23.0.0 (100095)</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 18, paddingTop: 12 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '800' },
  avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#F6C7B0', alignSelf: 'center', marginVertical: 16 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  rt: { fontSize: 17, fontWeight: '700' },
  rs: { color: colors.muted, marginTop: 4 },
  help: { backgroundColor: colors.peach, borderRadius: 16, padding: 16, marginVertical: 16 },
  mail: { marginTop: 12, backgroundColor: colors.coral, alignSelf: 'flex-start', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 22 },
  link: { fontSize: 17, paddingVertical: 10 },
});
