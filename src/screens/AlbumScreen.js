import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  FlatList,
  Modal,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  Share
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { HugeiconsIcon } from "@hugeicons/react-native";
import {
  PreferenceHorizontalIcon,
  Notification03Icon,
  Menu01Icon,
  GridViewIcon,
  Video01Icon,
  FavouriteIcon,
  Camera01Icon,
  QrCodeIcon,
  Copy01Icon,
  UserMultipleIcon,
  Diamond01Icon,
  ComputerIcon,
  PencilEdit02Icon,
  ArrowRight01Icon,
} from "@hugeicons/core-free-icons";
import { colors } from "../theme";
import { CoralButton, BackButton, Sheet, Logo } from "../components/UI";
import { EmptyPhotos, EmptyFavs, EmptyVideos } from "../components/AlbumArt";
import { useStore } from "../store";
import { StatusBar } from "expo-status-bar";
import { ScrollView } from "react-native";
import * as Clipboard from 'expo-clipboard'; 

const TABS = [
  { key: "all", label: "Tous", icon: GridViewIcon },
  { key: "vid", label: "Vidéos", icon: Video01Icon },
  { key: "fav", label: "Favoris", icon: FavouriteIcon },
];

// Donnees de filtre
const ORDERS = [
  { key: "recent", label: "Le plus récent en premier" },
  { key: "oldest", label: "Le plus ancien en premier" },
  { key: "upload", label: "Dernier téléchargement" },
];

const GROUPS = [
  { key: "all", label: "Toutes les photos" },
  { key: "month", label: "Mois" },
  { key: "day", label: "Journée" },
  { key: "hour", label: "Heure" },
];

// Menu
   const invite = () =>
     Share.share({
       message: `Rejoins mon album « ${album.name} » sur SharePix. Code : ${album.code}`,
     });
    
  const copyToClipboard = async () => {
    await Clipboard.setStringAsync(album.code);
    Alert.instance ? Alert.alert("Copié", "Code d'invitation copié !") : alert("Code d'invitation copié !");
  };

export default function AlbumScreen({ route, navigation }) {
  const { id } = route.params;
  const { state, addPhoto } = useStore();
  const album = state.albums.find((a) => a.id === id);
  const [tab, setTab] = useState("all");
  const [uploading, setUploading] = useState(false);
  const insets = useSafeAreaInsets();
  // Filtre states
  const [filtre, setFilter] = useState(false);
  const [order, setOrder] = useState("recent");
  const [group, setGroup] = useState("all");
  const dirty = order !== "recent" || group !== "all";

  // Menu state 
  const [menuModal ,setMenuModal] = useState(false);

  if (!album) {
    return (
      <SafeAreaView
        style={[styles.root, { paddingTop: insets.top }]}
        edges={["top"]}
      >
        <View style={styles.top}>
          <BackButton onPress={() => navigation.goBack()} />
          <Text style={styles.title}>Album</Text>
        </View>
        <View style={styles.center}>
          <Text>Album introuvable</Text>
        </View>
      </SafeAreaView>
    );
  }

  const photos =
    tab === "fav" ? album.photos.filter((p) => p.favorite) : album.photos;

  const pick = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsMultipleSelection: true,
    });
    if (res.canceled) return;
    setUploading(true);
    setTimeout(() => {
      res.assets.forEach((a) => addPhoto(id, a.uri));
      setUploading(false);
    }, 700);
  };

  // Row pour le menu
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

  return (
    <SafeAreaView
      style={[styles.root, { paddingTop: insets.top }]}
      edges={["top"]}
    >
      <StatusBar style="dark" />
      {/* Header */}
      <View style={styles.top}>
        <BackButton onPress={() => navigation.goBack()} />
        <View style={styles.headText}>
          <Text style={styles.title} numberOfLines={1}>
            {album.name}
          </Text>
          <Text style={styles.meta}>
            {album.photos.length} photo{album.photos.length > 1 ? "s" : ""}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => setFilter(true)}
          style={styles.iconBtn}
          activeOpacity={0.88}
        >
          <HugeiconsIcon
            icon={PreferenceHorizontalIcon}
            size={22}
            color={colors.tealDark}
          />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => navigation.navigate("Main", { screen: "Activités" })}
          style={styles.iconBtn}
          hitSlop={10}
        >
          <HugeiconsIcon
            icon={Notification03Icon}
            size={22}
            color={colors.tealDark}
          />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setMenuModal(true)}
          style={styles.iconBtn}
          activeOpacity={0.88}
        >
          <HugeiconsIcon icon={Menu01Icon} size={22} color={colors.tealDark} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {TABS.map((t) => {
          const on = tab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              onPress={() => setTab(t.key)}
              style={styles.tab}
            >
              <View style={styles.tabInner}>
                <HugeiconsIcon
                  icon={t.icon}
                  size={18}
                  color={on ? colors.teal : colors.muted}
                  strokeWidth={on ? 2.2 : 1.6}
                />
                <Text style={[styles.tabT, on && styles.tabOn]}>{t.label}</Text>
              </View>
              {on ? (
                <View style={styles.line} />
              ) : (
                <View style={styles.lineOff} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Content */}
      <View style={styles.contentContainer}>
        {tab === "vid" ? (
          <View style={styles.center}>
            <EmptyVideos />
            <Text style={styles.emptyH}>
              Passez à l'Album Premium pour ajouter des vidéos
            </Text>
            <Text style={styles.emptyP}>
              Dans un Album Premium, chaque membre peut télécharger des vidéos.
            </Text>
            <View style={{ width: "84%", marginTop: 22 }}>
              <CoralButton
                title="En savoir plus"
                onPress={() => navigation.navigate("Premium")}
              />
            </View>
          </View>
        ) : photos.length === 0 ? (
          <View style={styles.center}>
            {tab === "fav" ? <EmptyFavs /> : <EmptyPhotos />}
            <Text style={styles.emptyH}>
              {tab === "fav"
                ? "Vous n'avez pas encore enregistré de favoris"
                : "Personne n'a encore téléchargé de photos"}
            </Text>
            {tab !== "fav" && (
              <Text style={styles.emptyP}>
                Téléchargez votre première photo.
              </Text>
            )}
          </View>
        ) : (
          <FlatList
            data={photos}
            numColumns={3}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{
              paddingBottom: 100 + insets.bottom,
              paddingTop: 4,
            }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.cell}
                onPress={() =>
                  navigation.navigate("Photo", {
                    albumId: id,
                    photoId: item.id,
                  })
                }
              >
                <Image source={{ uri: item.uri }} style={styles.thumb} />
              </TouchableOpacity>
            )}
          />
        )}
      </View>

      {/* FAB Button - avec padding bottom pour éviter la tab bar */}
      {tab !== "vid" && (
        <View
          style={[
            styles.fabWrap,
            { paddingBottom: Math.max(insets.bottom, 38) },
          ]}
        >
          <TouchableOpacity
            style={styles.fab}
            onPress={pick}
            activeOpacity={0.88}
          >
            <HugeiconsIcon icon={Camera01Icon} size={22} color="#fff" />
            <Text style={styles.fabTxt}>Ajouter</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Upload Banner */}
      <Modal visible={uploading} transparent animationType="fade">
        <SafeAreaView style={styles.modalContainer}>
          <View style={[styles.banner, { marginTop: insets.top + 10 }]}>
            <Text style={{ color: colors.tealDark, fontWeight: "600" }}>
              Téléchargement en cours. Ne fermez pas l'appli.
            </Text>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Filtre */}
      <Sheet title="Filtre" visible={filtre} onClose={() => setFilter(false)}>
        <View>
          <Text style={styles.section}>Ordre</Text>
          <Text style={styles.hint}>
            Toutes les photos et vidéos sont automatiquement triées par heure de
            capture.
          </Text>
          <View style={styles.card}>
            {ORDERS.map((o, i) => {
              const on = order === o.key;
              return (
                <TouchableOpacity
                  key={o.key}
                  style={[
                    styles.opt,
                    i === ORDERS.length - 1 && { borderBottomWidth: 0 },
                    on && styles.optOn,
                  ]}
                  onPress={() => setOrder(o.key)}
                >
                  <Text style={[styles.optTxt, on && styles.optTxtOn]}>
                    {o.label}
                  </Text>
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
                <TouchableOpacity
                  key={g.key}
                  style={[styles.chip, on && styles.chipOn]}
                  onPress={() => setGroup(g.key)}
                >
                  <Text
                    style={{
                      color: on ? "#fff" : colors.tealDark,
                      fontWeight: "700",
                    }}
                  >
                    {g.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.footerBtn}>
          <CoralButton
            title="Appliquer"
            onPress={() => navigation.goBack()}
            disabled={!dirty}
            color={dirty ? colors.coral : "#D5D8D8"}
          />
        </View>
      </Sheet>

      {/* Menu */}
      <RightModal title="Menu" visible={menuModal} onClose={()=> setMenuModal(false)} >
        <View style={styles.hero}>
          <View style={styles.heroH}>
            <View style={styles.cover}>
            <Logo size={12} color="#fff" />
          </View>
          <View>
            <Text style={styles.name}>{album.name}</Text>
          <Text style={styles.meta}>
            {album.photos.length} photo{album.photos.length > 1 ? "s" : ""} ·
            privé
          </Text>
          </View>
          </View>
          
          <TouchableOpacity style={styles.edit} activeOpacity={0.8}>
            <HugeiconsIcon
              icon={PencilEdit02Icon}
              size={16}
              color={colors.tealDark}
            />
            <Text style={styles.editTxt}>Éditer l'album</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Row
            icon={Diamond01Icon}
            title="Album Premium"
            hint="Vidéos et qualité originale"
            onPress={() => {
              setMenuModal(false);
              navigation.navigate("Premium")
            }}
          />
          <Row
            icon={UserMultipleIcon}
            title="Membres"
            hint="Gérer qui a accès"
            onPress={() => {
              setMenuModal(false);
              navigation.navigate("Members", { id: album.id })
            }}
          />
          <Row
            icon={ComputerIcon}
            title="Téléchargement PC"
            hint="Ajouter depuis le navigateur"
            last
            onPress={() => {
              setMenuModal(false);
              navigation.navigate("PcUpload");}}
          />
        </View>

        <View style={styles.invite}>
          <Text style={styles.inviteH}>Inviter des amis</Text>
          <Text style={styles.inviteP}>
            Partagez le code d'invitation pour ajouter des membres à cet album.
          </Text>
          <View style={styles.codeRow}>
            {/* Rendre le codeBox cliquable pour copier directement */}
            <TouchableOpacity
              style={styles.codeBox}
              onPress={copyToClipboard}
              activeOpacity={0.7}
            >
              <Text style={styles.code}>{album.code}</Text>
              <HugeiconsIcon icon={Copy01Icon} size={16} color={colors.teal} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.inviteBtn}
              onPress={invite}
              activeOpacity={0.88}
            >
              <Text style={styles.inviteBtnTxt}>Invitez</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={styles.qr}
          onPress={
            () => {
            setMenuModal(false)
            navigation.navigate("QR", { id: album.id });
            
          }}>
          <HugeiconsIcon icon={QrCodeIcon} size={20} color={colors.tealDark} />
          <Text style={styles.qrTxt}>Voir le code QR</Text>
        </TouchableOpacity>
      </RightModal>
      
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  top: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headText: {
    flex: 1,
    marginLeft: 2,
  },
  title: {
    fontWeight: "600",
    fontSize: 18,
    color: colors.tealDark,
  },
  meta: {
    color: colors.muted,
    marginTop: 1,
    fontSize: 12,
  },
  contentContainer: {
    flex: 1,
  },
  tabs: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderColor: "#E4EEEE",
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingTop: 12,
  },
  tabInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  tabT: {
    color: colors.muted,
    fontWeight: "600",
    fontSize: 13,
  },
  tabOn: {
    color: colors.teal,
  },
  line: {
    height: 2.5,
    backgroundColor: colors.teal,
    width: "56%",
    marginTop: 10,
    borderRadius: 2,
  },
  lineOff: {
    height: 2.5,
    marginTop: 10,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
  },
  emptyH: {
    fontSize: 20,
    fontWeight: "600",
    textAlign: "center",
    color: colors.tealDark,
    marginTop: 16,
  },
  emptyP: {
    marginTop: 8,
    color: colors.muted,
    textAlign: "center",
    fontSize: 15,
  },
  cell: {
    width: "33.33%",
    aspectRatio: 1,
    padding: 1.5,
  },
  thumb: {
    flex: 1,
    backgroundColor: "#DDECEC",
    borderRadius: 4,
  },
  fabWrap: {
    position: "absolute",
    left: 48,
    right: 48,
    bottom: 30,
  },
  fab: {
    height: 45,
    borderRadius: 28,
    backgroundColor: colors.coral,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: colors.tealDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  fabTxt: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "600",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  banner: {
    backgroundColor: colors.cream,
    padding: 14,
    marginHorizontal: 16,
    borderRadius: 12,
  },

  // Filtres
  headTitle: { fontWeight: "600", fontSize: 18, color: colors.tealDark },
  section: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.tealDark,
    marginTop: 18,
    paddingHorizontal: 16,
  },
  hint: {
    color: colors.muted,
    marginTop: 6,
    marginBottom: 10,
    paddingHorizontal: 16,
    lineHeight: 20,
  },
  hintCenter: {
    color: colors.muted,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },
  card: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    borderRadius: 5,
    overflow: "hidden",
  },
  opt: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#E8EEEE",
  },
  optOn: { backgroundColor: "#F3F8F8" },
  optTxt: { fontSize: 15, color: colors.tealDark },
  optTxtOn: { fontWeight: "700" },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: "#B5C4C4",
  },
  radioOn: { borderWidth: 6, borderColor: colors.teal },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
    marginTop: 12,
  },
  chip: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  chipOn: { backgroundColor: colors.tealDark, borderColor: colors.tealDark },
  footerBtn: {
    marginTop: 10,
    paddingHorizontal: 30,
    paddingBottom: 12,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
  },

  // Menu
  hero: { alignItems: 'center', paddingHorizontal: 18, paddingBottom: 8, paddingTop: 16 },
   cover: {
    width: 60,
    height: 60,
    borderRadius: 22,
    backgroundColor: colors.tealDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontSize: 20, fontWeight: '600', color: colors.tealDark, marginTop: 1 },
  edit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    backgroundColor: '#fff',
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 14,
    width: 150
  },
  editTxt: { fontWeight: '600', color: colors.tealDark },
   row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    // paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#E8EEEE',
    gap: 12,
  },

  rowT: { fontSize: 13, fontWeight: '600', color: colors.tealDark },
  rowH: { color: colors.muted, fontSize: 12, marginTop: 2 },
  invite: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,  
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: '#D6EEEE',
  },
  inviteH: { fontWeight: '600', fontSize: 16, color: colors.tealDark },
  inviteP: { marginTop: 3, color: colors.tealDark },
  codeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14, gap: 10 },
  codeBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.light,
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 45,
  },
  code: { fontSize: 16, fontWeight: '600', letterSpacing: 1.2, color: colors.tealDark },
  inviteBtn: {
    backgroundColor: colors.coral,
    height: 40,
    paddingHorizontal: 20,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteBtnTxt: { color: '#fff', fontWeight: '600'},
  qr: {
    marginHorizontal: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#fff',
    borderRadius: 5,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 30 
  },
  qrTxt: { fontWeight: '600', color: colors.tealDark, fontSize: 15 },
});
