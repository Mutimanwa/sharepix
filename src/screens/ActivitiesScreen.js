import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CoralButton } from '../components/UI';
import { useStore } from '../store';
import { colors } from '../theme';

export default function ActivitiesScreen() {
  const { state, updateProfile } = useStore();
  const [asked, setAsked] = useState(state.profile.notifications);

  if (!asked) {
    return (
      <View style={styles.root}>
        <Text style={styles.title}>Activités</Text>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 }}>
          <Text style={{ fontSize: 48 }}>💬⭐</Text>
          <Text style={styles.h}>Activer les notifications</Text>
          <Text style={styles.p}>
            Ne manquez pas le moment où quelqu'un vous mentionne dans les commentaires, télécharge de nouvelles photos ou réagit à vos photos.
          </Text>
          <View style={{ width: '100%', marginTop: 20 }}>
            <CoralButton
              title="Activer"
              onPress={() => {
                updateProfile({ notifications: true });
                setAsked(true);
              }}
            />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Activités</Text>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 }}>
        <Text style={{ fontSize: 48 }}>💬⭐</Text>
        <Text style={styles.h}>Il n'y a pas encore d'activités</Text>
        <Text style={styles.p}>Commencez par mentionner quelqu'un avec @nom dans un commentaire !</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff', paddingTop: 18 },
  title: { fontSize: 28, fontWeight: '800', paddingHorizontal: 20 },
  h: { fontSize: 22, fontWeight: '800', textAlign: 'center', marginTop: 16 },
  p: { textAlign: 'center', color: colors.muted, marginTop: 10, fontSize: 16, lineHeight: 22 },
});
