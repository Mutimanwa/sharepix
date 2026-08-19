import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Share, ScrollView, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  PencilEdit02Icon,
  Diamond01Icon,
  UserMultipleIcon,
  ComputerIcon,
  ArrowRight01Icon,
  QrCodeIcon,
  Copy01Icon,
} from '@hugeicons/core-free-icons';
import { colors } from '../theme';
import { Logo, BackButton, Page } from '../components/UI';
import { useStore } from '../store';
import { StatusBar } from 'expo-status-bar';
import * as Clipboard from 'expo-clipboard'; // Import de l'utilitaire de copie Expo

export default function MenuScreen({ route, navigation }) {
  const album = useStore().state.albums.find((a) => a.id === route.params.id);
  const insets = useSafeAreaInsets();

  if (!album) return null;

  const invite = () =>
    Share.share({
      message: `Rejoins mon album « ${album.name} » sur SharePix. Code : ${album.code}`,
    });

  // Fonction pour copier le code dans le presse-papiers
  const copyToClipboard = async () => {
    await Clipboard.setStringAsync(album.code);
    Alert.instance ? Alert.alert("Copié", "Code d'invitation copié !") : alert("Code d'invitation copié !");
  };

  return (
    <Page style={styles.root} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      
      {/* Header corrigé : Un seul bouton de fermeture/retour et un titre propre */}
      <View style={styles.top}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Options de l'album</Text>
        <BackButton variant="close" onPress={() => navigation.goBack()} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.hero}>
          <View style={styles.cover}>
            <Logo size={12} color="#fff" />
          </View>
          <Text style={styles.name}>{album.name}</Text>
          <Text style={styles.meta}>
            {album.photos.length} photo{album.photos.length > 1 ? 's' : ''} · privé
          </Text>
          <TouchableOpacity style={styles.edit} activeOpacity={0.8}>
            <HugeiconsIcon icon={PencilEdit02Icon} size={16} color={colors.tealDark} />
            <Text style={styles.editTxt}>Éditer l'album</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Row
            icon={Diamond01Icon}
            title="Album Premium"
            hint="Vidéos et qualité originale"
            onPress={() => navigation.navigate('Premium')}
          />
          <Row
            icon={UserMultipleIcon}
            title="Membres"
            hint="Gérer qui a accès"
            onPress={() => navigation.navigate('Members', { id: album.id })}
          />
          <Row
            icon={ComputerIcon}
            title="Téléchargement PC"
            hint="Ajouter depuis le navigateur"
            last
            onPress={() => navigation.navigate('PcUpload')}
          />
        </View>

        <View style={styles.invite}>
          <Text style={styles.inviteH}>Inviter des amis</Text>
          <Text style={styles.inviteP}>
            Partagez le code d'invitation pour ajouter des membres à cet album.
          </Text>
          <View style={styles.codeRow}>
            {/* Rendre le codeBox cliquable pour copier directement */}
            <TouchableOpacity style={styles.codeBox} onPress={copyToClipboard} activeOpacity={0.7}>
              <Text style={styles.code}>{album.code}</Text>
              <HugeiconsIcon icon={Copy01Icon} size={16} color={colors.teal} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.inviteBtn} onPress={invite} activeOpacity={0.88}>
              <Text style={styles.inviteBtnTxt}>Invitez</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={styles.qr} onPress={() => navigation.navigate('QR', { id: album.id })}>
          <HugeiconsIcon icon={QrCodeIcon} size={20} color={colors.tealDark} />
          <Text style={styles.qrTxt}>Voir le code QR</Text>
        </TouchableOpacity>
      </ScrollView>
    </Page>
  );
}

function Row({ icon, title, hint, onPress, last }) {
  return (
    <TouchableOpacity style={[styles.row, last && { borderBottomWidth: 0 }]} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.rowIco}>
        <HugeiconsIcon icon={icon} size={20} color={colors.tealDark} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowT}>{title}</Text>
        {hint ? <Text style={styles.rowH}>{hint}</Text> : null}
      </View>
      <HugeiconsIcon icon={ArrowRight01Icon} size={18} color={colors.muted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.tealDark,
  },
  hero: { alignItems: 'center', paddingHorizontal: 18, paddingBottom: 8, paddingTop: 16 },
  cover: {
    width: 88,
    height: 88,
    borderRadius: 22,
    backgroundColor: colors.tealDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontSize: 26, fontWeight: '600', color: colors.tealDark, marginTop: 12 },
  meta: { color: colors.muted, marginTop: 4 },
  edit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#fff',
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 14,
  },
  editTxt: { fontWeight: '600', color: colors.tealDark },
  card: {
    marginHorizontal: 16,
    marginTop: 18,
    borderRadius: 18,
    paddingHorizontal: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E8EEEE',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#E8EEEE',
    gap: 12,
  },
  rowIco: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowT: { fontSize: 16, fontWeight: '600', color: colors.tealDark },
  rowH: { color: colors.muted, fontSize: 12, marginTop: 2 },
  invite: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#D6EEEE',
  },
  inviteH: { fontWeight: '800', fontSize: 16, color: colors.tealDark },
  inviteP: { marginTop: 6, color: '#4A5C5C', lineHeight: 20 },
  codeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14, gap: 10 },
  codeBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.light,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
  },
  code: { fontSize: 16, fontWeight: '800', letterSpacing: 1.2, color: colors.tealDark },
  inviteBtn: {
    backgroundColor: colors.coral,
    height: 48,
    paddingHorizontal: 20,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteBtnTxt: { color: '#fff', fontWeight: '700' },
  qr: {
    marginHorizontal: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  qrTxt: { fontWeight: '700', color: colors.tealDark, fontSize: 15 },
});