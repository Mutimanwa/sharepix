import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { colors } from '../theme';

/** Version locale d'un document légal, également utilisée depuis l'inscription. */
export default function LocalDocumentModal({ visible, document, onClose }) {
  if (!document) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
        <StatusBar style="dark" />
        <View style={styles.header}>
          <Text style={styles.headerTitle} numberOfLines={2}>
            {document.title}
          </Text>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Fermer le document"
            style={styles.close}
          >
            <Text style={styles.closeText}>×</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator>
          {document.updatedAt ? <Text style={styles.updated}>{document.updatedAt}</Text> : null}
          {document.intro ? <Text style={styles.intro}>{document.intro}</Text> : null}
          {document.sections.map((section) => (
            <View key={section.title} style={styles.section}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Text style={styles.copy}>{section.body}</Text>
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  header: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerTitle: { flex: 1, color: colors.tealDark, fontWeight: '700', fontSize: 18, paddingRight: 12 },
  close: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: colors.tealDark, fontSize: 30, lineHeight: 34, fontWeight: '300' },
  content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 36 },
  updated: { color: colors.muted, fontSize: 12, marginBottom: 12 },
  intro: { color: colors.tealDark, fontSize: 14, lineHeight: 22, marginBottom: 14 },
  section: { marginTop: 16 },
  sectionTitle: { color: colors.tealDark, fontSize: 15, fontWeight: '700', marginBottom: 6 },
  copy: { color: colors.muted, fontSize: 14, lineHeight: 22 },
});
