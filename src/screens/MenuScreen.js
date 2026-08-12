import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Share } from 'react-native';
import { colors } from '../theme';
import { CoralButton } from '../components/UI';
import { useStore } from '../store';

export default function MenuScreen({ route, navigation }) {
  const album = useStore().state.albums.find((a) => a.id === route.params.id);
  if (!album) return null;

  return (
    <View style={styles.root}>
      <View style={styles.top}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={{ fontSize: 22 }}>‹</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={{ fontSize: 20 }}>✕</Text>
        </TouchableOpacity>
      </View>
      <Text style={{ fontSize: 24, fontWeight: '800' }}>{album.name}</Text>
      <TouchableOpacity style={styles.edit}>
        <Text>✎  Éditer l'album</Text>
      </TouchableOpacity>

      <Item title="◆  Débloquer l'album Premium" onPress={() => navigation.navigate('Premium')} />
      <Item title="👥  Membres" onPress={() => navigation.navigate('Members', { id: album.id })} />
      <Item title="💻  Téléchargement PC" onPress={() => navigation.navigate('PcUpload')} />

      <View style={styles.invite}>
        <Text style={{ fontWeight: '800', fontSize: 16 }}>Inviter des amis</Text>
        <Text style={{ marginTop: 6, color: '#444' }}>
          Partagez le code d'invitation avec vos amis pour les ajouter comme membres à cet album.
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 10 }}>
          <Text style={{ fontSize: 18, fontWeight: '800', letterSpacing: 1 }}>{album.code}</Text>
          <View style={{ flex: 1 }}>
            <CoralButton
              title="Invitez"
              onPress={() =>
                Share.share({
                  message: `J'utilise l'album "${album.name}" dans l'appli Celebrate. Code: ${album.code}`,
                })
              }
            />
          </View>
        </View>
      </View>
      <TouchableOpacity style={styles.qr} onPress={() => navigation.navigate('QR', { id: album.id })}>
        <Text>▦  Voir le code QR</Text>
      </TouchableOpacity>
    </View>
  );
}

function Item({ title, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.item}>
      <Text style={{ fontSize: 16 }}>{title}</Text>
      <Text>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff', padding: 18 },
  top: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  edit: { alignSelf: 'flex-start', borderWidth: 1, borderColor: '#ddd', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginVertical: 14 },
  item: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#eee' },
  invite: { backgroundColor: colors.peach, borderRadius: 16, padding: 14, marginTop: 24 },
  qr: { borderWidth: 1, borderColor: '#ddd', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 12 },
});
