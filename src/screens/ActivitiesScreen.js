import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CoralButton } from '../components/UI';
import { useStore } from '../store';
import { colors } from '../theme';
import { StatusBar } from 'expo-status-bar';


export default function ActivitiesScreen() {
  const { state, updateProfile } = useStore();
  const [asked, setAsked] = useState(state.profile.notifications);
  const insets = useSafeAreaInsets();

  if (!asked) {
    return (
      <SafeAreaView style={[styles.root, { paddingTop: insets.top }]} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>Activités</Text>
        </View>
        <ScrollView 
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + 20 }
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.centerContent}>
            <Text style={styles.emoji}>💬⭐</Text>
            <Text style={styles.h}>Activer les notifications</Text>
            <Text style={styles.p}>
              Ne manquez pas le moment où quelqu'un vous mentionne dans les commentaires, 
              télécharge de nouvelles photos ou réagit à vos photos.
            </Text>
            <View style={styles.buttonContainer}>
              <CoralButton
                title="Activer"
                onPress={() => {
                  updateProfile({ notifications: true });
                  setAsked(true);
                }}
              />
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.root, { paddingTop: insets.top }]} edges={['top']}>
      <StatusBar style='dark' />
      <View style={styles.header}>
        <Text style={styles.title}>Activités</Text>
      </View>
      <ScrollView 
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 20 }
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.centerContent}>
          <Text style={styles.emoji}>💬⭐</Text>
          <Text style={styles.h}>Il n'y a pas encore d'activités</Text>
          <Text style={styles.p}>
            Commencez par mentionner quelqu'un avec @nom dans un commentaire !
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.tealDark,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  h: {
    fontSize: 22,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 16,
    color: colors.tealDark,
  },
  p: {
    textAlign: 'center',
    color: colors.muted,
    marginTop: 10,
    fontSize: 16,
    lineHeight: 22,
  },
  buttonContainer: {
    width: '100%',
    marginTop: 20,
  },
});