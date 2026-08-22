import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  Image,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  Camera01Icon,
  FavouriteIcon,
  UserAdd01Icon,
  SentIcon,
} from '@hugeicons/core-free-icons';
import { CoralButton } from '../components/UI';
import { useStore } from '../store';
import { colors } from '../theme';
import { StatusBar } from 'expo-status-bar';
// ── SUPABASE ALBUMS : intégration ──
import { cloudFetchActivity } from '../services/albums';
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
    text: (a) => `a rejoint l'album`,
  },
  photo_added: {
    icon: Camera01Icon,
    color: colors.coral,
    text: (a) => 'a ajouté une photo',
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
  const [asked, setAsked] = useState(state.profile.notifications);
  const insets = useSafeAreaInsets();

  // ── SUPABASE ALBUMS : intégration ──
  // Flux d'activité : fetch au focus + tirer-pour-rafraîchir.
  const [items, setItems] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await cloudFetchActivity(50);
    // Diagnostic explicite : une erreur RPC/RLS ne doit plus passer inaperçue
    // if (error) {
    //   console.log('📛 activity error:', error.message || error);
    // } else {
    //   console.log(`📋 activity: ${data.length} événement(s)`);
    // }
    if (!error) setItems(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (state.profile.notifications) load();
    }, [load, state.profile.notifications])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };
  // ── SUPABASE ALBUMS : fin ──

  // Porte notifications (inchangée)
  if (!asked) {
    return (
      <SafeAreaView style={[styles.root, { paddingTop: insets.top }]} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>Activités</Text>
        </View>
        <View style={styles.centerContent}>
          <Image
            source={require('../../assets/empty/activity.png')}
            style={{ width: 120, height: 120 }}
          />
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
      </SafeAreaView>
    );
  }

  const renderItem = ({ item }) => {
    const kind = KINDS[item.kind] || KINDS.photo_added;
    return (
      <TouchableOpacity
        style={styles.row}
        activeOpacity={0.75}
        onPress={() => navigation.navigate('Album', { id: item.albumId })}
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
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.root, { paddingTop: insets.top }]} edges={['top']}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.title}>Activités</Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
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
  buttonContainer: { width: '100%', marginTop: 20 },

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
});
