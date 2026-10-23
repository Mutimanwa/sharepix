import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { ArrowDown01Icon, ArrowUp01Icon } from '@hugeicons/core-free-icons';
import { colors } from '../theme';

/** Groupe d'informations dépliant, intégré dans l'écran (sans navigateur). */
export default function LocalInfoAccordion({ title, intro, sections, updatedAt, icon, isLast = false }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={!isLast ? styles.divider : undefined}>
      <Pressable
        style={styles.header}
        onPress={() => setExpanded((value) => !value)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
      >
        <View style={styles.heading}>
          {icon ? (
            <View style={styles.leadingIcon}>
              <HugeiconsIcon icon={icon} size={19} color={colors.tealDark} />
            </View>
          ) : null}
          <View style={styles.headingCopy}>
            <Text style={styles.title}>{title}</Text>
            {updatedAt ? <Text style={styles.updated}>{updatedAt}</Text> : null}
          </View>
        </View>
        <HugeiconsIcon
          icon={expanded ? ArrowUp01Icon : ArrowDown01Icon}
          size={19}
          color={colors.teal}
          accessibilityElementsHidden
        />
      </Pressable>

      {expanded ? (
        <View style={styles.body}>
          {intro ? <Text style={styles.intro}>{intro}</Text> : null}
          {sections.map((section) => (
            <View key={section.title} style={styles.section}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Text style={styles.copy}>{section.body}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E6EEEE' },
  header: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  heading: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingRight: 12 },
  leadingIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: '#EAF5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headingCopy: { flex: 1 },
  title: { color: colors.tealDark, fontSize: 15, fontWeight: '600' },
  updated: { color: colors.muted, fontSize: 11, marginTop: 3 },
  body: { paddingBottom: 14, paddingTop: 2 },
  intro: { color: colors.muted, fontSize: 13, lineHeight: 20, marginBottom: 12 },
  section: { marginTop: 10 },
  sectionTitle: { color: colors.tealDark, fontSize: 13, fontWeight: '700', marginBottom: 4 },
  copy: { color: colors.muted, fontSize: 13, lineHeight: 20 },
});
