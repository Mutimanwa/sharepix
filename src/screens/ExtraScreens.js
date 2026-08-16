import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Share, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Rect } from 'react-native-svg';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  Download01Icon,
  UserMultipleIcon,
  Diamond01Icon,
  Video01Icon,
  Image01Icon,
  ComputerIcon,
  QrCodeIcon,
  Tick02Icon,
} from '@hugeicons/core-free-icons';
import { colors } from '../theme';
import { BackButton, CoralButton, SmallButton, Page } from '../components/UI';
import { useStore } from '../store';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

const ORDERS = [
  { key: 'recent', label: 'Le plus récent en premier' },
  { key: 'oldest', label: 'Le plus ancien en premier' },
  { key: 'upload', label: 'Dernier téléchargement' },
];

const GROUPS = [
  { key: 'all', label: 'Toutes les photos' },
  { key: 'month', label: 'Mois' },
  { key: 'day', label: 'Journée' },
  { key: 'hour', label: 'Heure' },
];

function ScreenHead({ title, onBack, right }) {
  return (
    <View style={styles.head}>
      <BackButton onPress={onBack} />
      <Text style={styles.headTitle}>{title}</Text>
      {right || <View style={{ width: 44 }} />}
    </View>
  );
}

function QrMark({ size = 196 }) {
  const cells = [
    [1, 1, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 1],
    [1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1],
    [1, 0, 0, 0, 1, 0, 1, 1, 1, 0, 0, 0, 1],
    [1, 1, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1, 1],
    [0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
    [1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0],
    [0, 1, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0, 1],
    [1, 1, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1],
    [1, 0, 0, 0, 1, 1, 0, 1, 1, 0, 0, 0, 1],
    [1, 0, 1, 0, 1, 0, 1, 1, 0, 0, 1, 0, 1],
    [1, 0, 0, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0],
    [1, 1, 1, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1],
  ];
  const gap = size / 13;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Rect width={size} height={size} rx={16} fill="#fff" />
      {cells.map((row, y) =>
        row.map((v, x) =>
          v ? (
            <Rect
              key={`${x}-${y}`}
              x={x * gap + 2}
              y={y * gap + 2}
              width={gap - 2}
              height={gap - 2}
              rx={1.2}
              fill={colors.tealDeep}
            />
          ) : null
        )
      )}
    </Svg>
  );
}

export function FiltersScreen({ navigation }) {
  const [order, setOrder] = useState('recent');
  const [group, setGroup] = useState('all');
  const dirty = order !== 'recent' || group !== 'all';
  const insets = useSafeAreaInsets();

  return (
    <Page style={[styles.root , {paddingTop: insets.top , paddingBottom: insets.bottom }]} edges={['top']}>
      <View style={styles.head}>
        <BackButton variant="close" onPress={() => navigation.goBack()} />
        <Text style={styles.headTitle}>Filtre</Text>
        <TouchableOpacity
          onPress={() => {
            setOrder('recent');
            setGroup('all');
          }}
          disabled={!dirty}
          style={{ width: 88, alignItems: 'flex-end', paddingRight: 8 }}
        >
          <Text style={[styles.reset, !dirty && { opacity: 0.3 }]}>Réinitialiser</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={{ paddingBottom: 20 }} 
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.section}>Ordre</Text>
        <Text style={styles.hint}>Toutes les photos et vidéos sont automatiquement triées par heure de capture.</Text>
        <View style={styles.card}>
          {ORDERS.map((o, i) => {
            const on = order === o.key;
            return (
              <TouchableOpacity
                key={o.key}
                style={[styles.opt, i === ORDERS.length - 1 && { borderBottomWidth: 0 }, on && styles.optOn]}
                onPress={() => setOrder(o.key)}
              >
                <Text style={[styles.optTxt, on && styles.optTxtOn]}>{o.label}</Text>
                <View style={[styles.radio, on && styles.radioOn]} />
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.section}>Grouper</Text>
        <View style={styles.chips}>
          {GROUPS.map((g) => {
            const on = group === g.key;
            return (
              <TouchableOpacity key={g.key} style={[styles.chip, on && styles.chipOn]} onPress={() => setGroup(g.key)}>
                <Text style={{ color: on ? '#fff' : colors.tealDark, fontWeight: '700' }}>{g.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.footerBtn}>
        <CoralButton
          title="Appliquer"
          onPress={() => navigation.goBack()}
          disabled={!dirty}
          color={dirty ? colors.coral : '#D5D8D8'}
        />
      </View>
    </Page>
  );
}

export function QRScreen({ route, navigation }) {
  const album = useStore().state.albums.find((a) => a.id === route.params.id);
  return (
    <Page style={styles.root} edges={['top']}>
      <ScreenHead title="Code QR" onBack={() => navigation.goBack()} />
      <View style={styles.qrContainer}>
        <View style={styles.qrCard}>
          <QrMark />
        </View>
        <Text style={styles.albumName}>{album?.name}</Text>
        <Text style={styles.hintCenter}>Ce code QR mène directement à l'album SharePix</Text>
        <CoralButton
          title="Enregistrer comme image"
          onPress={() => {}}
          style={{ marginTop: 22 }}
        />
      </View>
    </Page>
  );
}

export function MembersScreen({ route, navigation }) {
  const album = useStore().state.albums.find((a) => a.id === route.params.id);
  return (
    <Page style={styles.root} edges={['top']}>
      <ScreenHead title="Membres" onBack={() => navigation.goBack()} />
      <View style={styles.membersContainer}>
        <View style={styles.emptyCard}>
          <View style={styles.iconBubble}>
            <HugeiconsIcon icon={UserMultipleIcon} size={32} color={colors.teal} />
          </View>
          <Text style={styles.emptyH}>Pas encore de membres</Text>
          <Text style={styles.hintCenter}>
            Partagez le code d'invitation pour ajouter vos proches à « {album?.name} ».
          </Text>
          <View style={styles.codeBox}>
            <Text style={styles.code}>{album?.code}</Text>
          </View>
          <CoralButton
            title="Inviter"
            onPress={() =>
              Share.share({
                message: `Rejoins mon album « ${album?.name} » sur SharePix. Code : ${album?.code}`,
              })
            }
            style={{ marginTop: 16 }}
          />
        </View>
      </View>
    </Page>
  );
}

export function PremiumScreen({ navigation }) {
  const perks = [
    { icon: Video01Icon, title: 'Vidéos illimitées', hint: 'Chaque membre peut déposer des films' },
    { icon: Image01Icon, title: 'Qualité originale', hint: 'Aucun recadrage, aucun tassement' },
    { icon: Diamond01Icon, title: 'Espace étendu', hint: 'Plus de souvenirs, plus longtemps' },
  ];
  return (
    <Page style={styles.root} edges={['top']}>
      <ScreenHead title="Album Premium" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <View style={styles.hero}>
          <View style={styles.cover}>
            <HugeiconsIcon icon={Diamond01Icon} size={36} color="#fff" />
          </View>
          <Text style={styles.albumName}>Passez à Premium</Text>
          <Text style={styles.hintCenter}>Vidéos, qualité originale et plus d'espace pour vos événements.</Text>
        </View>
        <View style={styles.card}>
          {perks.map((p, i) => (
            <View key={p.title} style={[styles.perk, i === perks.length - 1 && { borderBottomWidth: 0 }]}>
              <View style={styles.rowIco}>
                <HugeiconsIcon icon={p.icon} size={20} color={colors.tealDark} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowT}>{p.title}</Text>
                <Text style={styles.rowH}>{p.hint}</Text>
              </View>
              <HugeiconsIcon icon={Tick02Icon} size={18} color={colors.teal} />
            </View>
          ))}
        </View>
        <View style={styles.warn}>
          <Text style={styles.warnT}>Le Play Store n'est pas disponible pour le moment. Réessayez plus tard.</Text>
        </View>
      </ScrollView>
    </Page>
  );
}

export function PcUploadScreen({ navigation }) {
  return (
    <Page style={styles.root} edges={['top']}>
      <ScreenHead title="Téléchargement PC" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <Text style={styles.lead}>
          Ajoutez photos et vidéos à l'album depuis le navigateur de votre ordinateur.
        </Text>
        <View style={styles.stepCard}>
          <View style={styles.n}><Text style={styles.nTxt}>1</Text></View>
          <HugeiconsIcon icon={ComputerIcon} size={28} color={colors.teal} />
          <Text style={styles.stepT}>Ouvrez web.sharepix.app</Text>
          <Text style={styles.rowH}>Sur l'ordinateur, dans votre navigateur.</Text>
        </View>
        <View style={styles.stepCard}>
          <View style={styles.n}><Text style={styles.nTxt}>2</Text></View>
          <HugeiconsIcon icon={QrCodeIcon} size={28} color={colors.coral} />
          <Text style={styles.stepT}>Scannez le QR affiché</Text>
          <Text style={styles.rowH}>Tenez le téléphone devant l'écran pour lier l'album.</Text>
        </View>
        <CoralButton
          title="Scanner le QR code"
          onPress={() => {}}
        />
      </ScrollView>
    </Page>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headTitle: { fontWeight: '600', fontSize: 18, color: colors.tealDark },
  reset: { color: colors.coral, fontWeight: '700' },
  section: { fontSize: 18, fontWeight: '600', color: colors.tealDark, marginTop: 18, paddingHorizontal: 16 },
  hint: { color: colors.muted, marginTop: 6, marginBottom: 10, paddingHorizontal: 16, lineHeight: 20 },
  hintCenter: { color: colors.muted, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 18,
    overflow: 'hidden',
  },
  opt: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#E8EEEE',
  },
  optOn: { backgroundColor: '#F3F8F8' },
  optTxt: { fontSize: 15, color: colors.tealDark },
  optTxtOn: { fontWeight: '700' },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: '#B5C4C4' },
  radioOn: { borderWidth: 6, borderColor: colors.teal },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, marginTop: 12 },
  chip: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  chipOn: { backgroundColor: colors.tealDark, borderColor: colors.tealDark },
  footerBtn: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  qrContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    marginTop: 12,
  },
  qrCard: {
    backgroundColor: '#fff',
    padding: 18,
    borderRadius: 24,
    shadowColor: '#164E52',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  albumName: { fontSize: 22, fontWeight: '700', marginTop: 18, color: colors.tealDark, textAlign: 'center' },
  membersContainer: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 24,
    alignItems: 'center',
  },
  iconBubble: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: colors.light,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyH: { fontSize: 22, fontWeight: '800', textAlign: 'center', color: colors.tealDark },
  codeBox: {
    marginTop: 16,
    backgroundColor: colors.light,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  code: { fontWeight: '800', letterSpacing: 1.4, color: colors.tealDark, fontSize: 16 },
  hero: { alignItems: 'center', marginBottom: 18 },
  cover: {
    width: 84,
    height: 84,
    borderRadius: 24,
    backgroundColor: colors.tealDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  perk: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#E8EEEE',
  },
  rowIco: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowT: { fontSize: 16, fontWeight: '700', color: colors.tealDark },
  rowH: { color: colors.muted, fontSize: 12, marginTop: 2 },
  warn: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginTop: 16 },
  warnT: { textAlign: 'center', color: colors.tealDark, lineHeight: 22 },
  lead: { fontSize: 16, lineHeight: 23, color: colors.tealDark, marginBottom: 14 },
  stepCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 18,
    marginBottom: 12,
  },
  n: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.light,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  nTxt: { fontWeight: '800', color: colors.tealDark },
  stepT: { fontWeight: '800', fontSize: 16, color: colors.tealDark, marginTop: 8 },
});