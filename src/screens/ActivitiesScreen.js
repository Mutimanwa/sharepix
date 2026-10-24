import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Linking,
} from 'react-native';
// ── BUG-03 : SafeAreaView depuis react-native-safe-area-context ──
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  Camera01Icon,
  FavouriteIcon,
  UserAdd01Icon,
  Notification03Icon,
  SentIcon,
  Delete02Icon,
  Tick02Icon,
} from '@hugeicons/core-free-icons';
import { BackButton, CoralButton, Sheet } from '../components/UI';
import { useStore } from '../store';
import { colors } from '../theme';
import { StatusBar } from 'expo-status-bar';
// ── SUPABASE ALBUMS : intégration ──
import {
  cloudFetchActivity,
  cloudDismissActivity,
  cloudDismissActivities,
  subscribeActivityChanges,
} from '../services/albums';
// ── SUPABASE PUSH : intégration ──
// Enregistrement du token Expo Push (no-op sur web / Expo Go)
import { registerPushToken, unregisterPushToken } from '../services/push';
// ── SUPABASE PUSH : fin ──
// ── SUPABASE ALBUMS : fin ──

// ── Date relative (FR) ───────────────────────────────────────────────────
function formatAgo(ts) {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `il y a ${d} j`;
  return new Date(ts).toLocaleDateString('fr-FR');
}

// Icône + texte par type d'événement
const KINDS = {
  member_joined: {
    icon: UserAdd01Icon,
    color: colors.teal,
    text: () => `a rejoint l'album`,
  },
  photo_added: {
    icon: Camera01Icon,
    color: colors.coral,
    text: () => 'a ajouté une photo',
  },
  comment_added: {
    icon: SentIcon,
    color: colors.tealDark,
    text: () => 'a commenté une photo',
  },
  photo_liked: {
    icon: FavouriteIcon,
    color: colors.coral,
    text: () => 'a aimé une photo',
  },
};

export default function ActivitiesScreen({ navigation }) {
  const { state, updateProfile } = useStore();
  // Préférence partagée avec Profil : aucun état local qui pourrait diverger.
  const notificationsEnabled = Boolean(state.profile.notifications);
  const insets = useSafeAreaInsets();

  // ── SUPABASE ALBUMS : intégration ──
  // Flux d'activité : fetch au focus + tirer-pour-rafraîchir.
  const [items, setItems] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await cloudFetchActivity(50);
    // Diagnostic explicite : une erreur RPC/RLS ne doit plus passer inaperçue
    if (error) {
      console.log('📛 activity error:', error.message || error);
    } else {
      console.log(`📋 activity: ${data.length} événement(s)`);
    }
    if (!error) setItems(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      // L'inbox Activités reste disponible même si les push système sont coupés.
      load();
      // Realtime : un membre agit sur un album → l'événement apparaît ici
      // sans tirer-pour-rafraîchir. Debounce 500 ms (comme Album/Photo).
      let timer = null;
      const unsubscribe = subscribeActivityChanges(() => {
        clearTimeout(timer);
        timer = setTimeout(load, 500);
      });
      return () => {
        clearTimeout(timer);
        unsubscribe();
      };
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // ── SUPABASE ALBUMS : suppression (masquage pour moi uniquement) ──
  // Une seule activité
  const dismissOne = (item) => {
    cloudDismissActivity(item.id).catch(() => {});
    setItems((cur) => cur.filter((i) => i.id !== item.id));
  };

  // Mode sélection multiple (appui long, comme dans l'album)
  const [selected, setSelected] = useState(null);
  const [confirmDismissActivities, setConfirmDismissActivities] = useState(false);
  const [dismissingActivities, setDismissingActivities] = useState(false);
  const selecting = selected !== null;

  const enterSelection = (id) => setSelected([id]);
  const toggleSelect = (id) =>
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const exitSelection = () => setSelected(null);
  const selectAll = () =>
    setSelected(selected.length === items.length ? [] : items.map((i) => i.id));

  const dismissSelected = async () => {
    if (!selected?.length || dismissingActivities) return;

    setDismissingActivities(true);
    try {
      const { error } = await cloudDismissActivities(selected);
      if (error) throw error;

      const ids = new Set(selected);
      setItems((cur) => cur.filter((item) => !ids.has(item.id)));
      setConfirmDismissActivities(false);
      exitSelection();
    } catch (error) {
      Alert.alert(
        'Masquage impossible',
        error?.message || 'Les activités sélectionnées n’ont pas pu être masquées. Réessayez.'
      );
    } finally {
      setDismissingActivities(false);
    }
  };
  // ── SUPABASE ALBUMS : fin ──

  const enablePush = async () => {
    if (pushBusy) return;
    setPushBusy(true);
    try {
      const token = await registerPushToken();
      if (!token) {
        Alert.alert(
          'Notifications non activées',
          'Autorisez les notifications dans les réglages du téléphone puis réessayez. Les push nécessitent l’application installée sur un appareil.',
          [
            { text: 'Plus tard', style: 'cancel' },
            { text: 'Réglages', onPress: () => Linking.openSettings() },
          ]
        );
        return;
      }
      const saved = await updateProfile({ notifications: true });
      if (!saved) {
        await unregisterPushToken();
        await updateProfile({ notifications: false });
        Alert.alert('Erreur', 'La préférence n’a pas pu être enregistrée. Vérifiez votre connexion.');
      }
    } finally {
      setPushBusy(false);
    }
  };

  const renderEnableBanner = () => (
    <View style={styles.pushBanner}>
      <View style={styles.pushBannerIcon}>
        <HugeiconsIcon icon={Notification03Icon} size={20} color={colors.tealDark} />
      </View>
      <View style={styles.pushBannerCopy}>
        <Text style={styles.pushBannerTitle}>Gardez le fil des albums</Text>
        <Text style={styles.pushBannerText}>
          Recevez une alerte pour les photos, commentaires, réactions et nouveaux membres.
        </Text>
      </View>
      <TouchableOpacity
        style={[styles.pushBannerButton, pushBusy && styles.pushBannerButtonBusy]}
        onPress={enablePush}
        disabled={pushBusy}
        accessibilityRole="button"
      >
        <Text style={styles.pushBannerButtonText}>{pushBusy ? '…' : 'Activer'}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderItem = ({ item }) => {
    const kind = KINDS[item.kind] || KINDS.photo_added;
    const isSel = selecting && selected.includes(item.id);
    return (
      <TouchableOpacity
        style={[styles.row, isSel && styles.rowSel]}
        activeOpacity={0.75}
        onPress={() =>
          selecting ? toggleSelect(item.id) : navigation.navigate('Album', { id: item.albumId })
        }
        onLongPress={() => !selecting && enterSelection(item.id)}
        delayLongPress={220}
      >
        <View style={[styles.iconBubble, { backgroundColor: `${kind.color}1A` }]}>
          <HugeiconsIcon icon={kind.icon} size={20} color={kind.color} />
        </View>
        <View style={styles.rowBody}>
          <Text style={styles.rowText}>
            <Text style={styles.rowActor}>{item.actor}</Text>
            {` ${kind.text(item)} dans `}
            <Text style={styles.rowAlbum}>« {item.albumName} »</Text>
          </Text>
          <Text style={styles.rowWhen}>{formatAgo(item.at)}</Text>
        </View>

        {/* Mode sélection : pastille ; sinon : suppression unitaire */}
        {selecting ? (
          <View style={[styles.selDot, isSel && styles.selDotOn]}>
            {isSel && <HugeiconsIcon icon={Tick02Icon} size={12} color="#fff" strokeWidth={3} />}
          </View>
        ) : (
          <TouchableOpacity
            style={styles.rowDelete}
            onPress={() => dismissOne(item)}
            hitSlop={8}
            activeOpacity={0.7}
          >
            <HugeiconsIcon icon={Delete02Icon} size={16} color={colors.muted} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        {selecting ? (
          <>
            <BackButton variant="close" onPress={exitSelection} />
            <Text style={[styles.title, { flex: 1 }]}>
              {selected.length} sélectionnée{selected.length > 1 ? 's' : ''}
            </Text>
            <TouchableOpacity
              onPress={selectAll}
              style={styles.headerBtn}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={selected.length === items.length ? 'Tout désélectionner' : 'Tout sélectionner'}
            >
              <HugeiconsIcon icon={Tick02Icon} size={21} color={colors.tealDark} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => selected.length && setConfirmDismissActivities(true)}
              style={styles.headerBtn}
              hitSlop={10}
              disabled={!selected.length || dismissingActivities}
              accessibilityRole="button"
              accessibilityLabel={`Masquer ${selected.length} activité${selected.length > 1 ? 's' : ''}`}
            >
              <HugeiconsIcon
                icon={Delete02Icon}
                size={21}
                color={selected.length && !dismissingActivities ? colors.coral : colors.border}
              />
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={[styles.title, { flex: 1 }]}>Activités</Text>
            {items.length > 0 && (
              <TouchableOpacity onPress={() => setSelected([])} hitSlop={10}>
                <Text style={styles.selectLink}>Sélectionner</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        extraData={selected}
        ListFooterComponent={!notificationsEnabled ? renderEnableBanner : null}
        contentContainerStyle={[
          items.length === 0 && styles.content,
          { paddingBottom: insets.bottom + 20 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.teal}
            colors={[colors.teal]}
          />
        }
        ListEmptyComponent={
          <View style={styles.centerContent}>
            <Image
              source={require('../../assets/empty/activity.png')}
              style={{ width: 120, height: 120 }}
            />
            <Text style={styles.h}>Il n'y a pas encore d'activités</Text>
            <Text style={styles.p}>
              Quand un membre rejoint un album, ajoute une photo, commente ou aime,
              l'événement apparaîtra ici.
            </Text>
          </View>
        }
      />

      <Sheet
        title="Masquer des activités"
        visible={confirmDismissActivities}
        onClose={() => !dismissingActivities && setConfirmDismissActivities(false)}
      >
        <View style={styles.dismissIcon}>
          <HugeiconsIcon icon={Delete02Icon} size={28} color={colors.coral} />
        </View>
        <Text style={styles.dismissTitle}>
          Masquer {selected?.length || 0} activité{(selected?.length || 0) > 1 ? 's' : ''} ?
        </Text>
        <Text style={styles.dismissCopy}>
          Ces activités seront masquées uniquement dans votre fil. Les albums, photos et commentaires ne seront pas supprimés.
        </Text>
        <CoralButton
          title={dismissingActivities ? 'Masquage…' : 'Masquer'}
          onPress={dismissSelected}
          disabled={!selected?.length || dismissingActivities}
          color={colors.coral}
        />
        <TouchableOpacity
          style={styles.dismissCancel}
          onPress={() => setConfirmDismissActivities(false)}
          disabled={dismissingActivities}
          activeOpacity={0.8}
        >
          <Text style={styles.dismissCancelText}>Annuler</Text>
        </TouchableOpacity>
      </Sheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  title: { fontSize: 20, fontWeight: '600', color: colors.tealDark },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 28 },
  pushBanner: {
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 8,
    padding: 12,
    borderRadius: 16,
    backgroundColor: colors.light,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pushBannerIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#DDF0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pushBannerCopy: { flex: 1 },
  pushBannerTitle: { color: colors.tealDark, fontSize: 14, fontWeight: '700' },
  pushBannerText: { color: colors.muted, fontSize: 12, lineHeight: 16, marginTop: 2 },
  pushBannerButton: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pushBannerButtonBusy: { opacity: 0.55 },
  pushBannerButtonText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    maxWidth: 420,
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

  // Lignes d'activité
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#E8EEEE',
  },
  iconBubble: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1 },
  rowText: { color: colors.tealDark, fontSize: 14, lineHeight: 20 },
  rowActor: { fontWeight: '800' },
  rowAlbum: { fontWeight: '700', color: colors.teal },
  rowWhen: { color: colors.muted, fontSize: 12, marginTop: 3 },

  // Suppression / sélection
  rowDelete: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowSel: { backgroundColor: colors.light },
  selDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selDotOn: { backgroundColor: colors.teal, borderColor: colors.teal },
  headerBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  dismissIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFF0ED',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 14,
  },
  dismissTitle: {
    color: colors.tealDark,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  dismissCopy: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 18,
  },
  dismissCancel: { alignItems: 'center', paddingVertical: 14 },
  dismissCancelText: { color: colors.tealDark, fontSize: 14, fontWeight: '700' },
  selectLink: { color: colors.teal, fontWeight: '700', fontSize: 14, padding: 6 },
});
