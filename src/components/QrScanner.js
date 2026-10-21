import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, BackHandler, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { QrCodeIcon } from '@hugeicons/core-free-icons';
import { colors } from '../theme';

/**
 * Scanner QR global.
 *
 * Pourquoi ce composant existe (BUG scanner invisible) : le scanner était rendu
 * à l'intérieur de `AlbumScreen`, en `position: absolute` dans l'arbre de
 * l'écran. Selon le conteneur parent (SafeArea, stack, clipping, ordre de
 * dessin Android), l'overlay se retrouvait réduit à une bande en bas de
 * l'écran. Ici il est monté **une seule fois à la racine de l'app**
 * (voir App.js), donc :
 *   • il couvre toujours la fenêtre entière (absoluteFill sur la racine) ;
 *   • il passe au-dessus de la tab bar, du header et de tout écran ;
 *   • la caméra reste dans la fenêtre principale (pas de <Modal> native :
 *     la SurfaceView d'expo-camera ne s'y attache pas sur Android → écran noir).
 */
const QrScannerContext = createContext(null);

export function useQrScanner() {
  const ctx = useContext(QrScannerContext);
  if (!ctx) {
    throw new Error('useQrScanner doit être utilisé dans <QrScannerProvider>.');
  }
  return ctx;
}

export function QrScannerProvider({ children }) {
  const [permission, requestPermission] = useCameraPermissions();
  // `session` : null = fermé. Sinon { onScan } où onScan(data) renvoie true
  // quand le code a été accepté (l'overlay se ferme) et false sinon.
  const [session, setSession] = useState(null);

  const close = useCallback(() => setSession(null), []);

  const openScanner = useCallback(
    async ({ onScan } = {}) => {
      if (!permission?.granted) {
        const res = await requestPermission();
        if (!res.granted) return false;
      }
      setSession({ onScan });
      return true;
    },
    [permission, requestPermission]
  );

  const value = useMemo(() => ({ openScanner, closeScanner: close }), [openScanner, close]);

  return (
    <QrScannerContext.Provider value={value}>
      <View style={styles.host}>
        {children}
        {session ? (
          <ScannerOverlay
            onClose={close}
            onScan={session.onScan}
            permissionGranted={Boolean(permission?.granted)}
            requestPermission={requestPermission}
          />
        ) : null}
      </View>
    </QrScannerContext.Provider>
  );
}

function ScannerOverlay({ onClose, onScan, permissionGranted, requestPermission }) {
  const insets = useSafeAreaInsets();
  const handled = useRef(false);
  const [error, setError] = useState(null);

  // Bouton retour Android : ferme le scanner (même comportement qu'avant).
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [onClose]);

  const handleBarcodeScanned = ({ data }) => {
    if (handled.current || !data) return;
    handled.current = true;
    const accepted = onScan?.(data);
    if (accepted) {
      onClose();
    } else {
      // Code non reconnu : on laisse le scanner ouvert et on peut rescanner.
      handled.current = false;
    }
  };

  return (
    <View style={styles.modal}>
      {permissionGranted ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={handleBarcodeScanned}
          onMountError={(e) => setError(e?.message || 'Caméra indisponible.')}
        />
      ) : null}

      {/* Voile sombre au-dessus de la caméra, avec une fenêtre au centre */}
      <View style={styles.veil} pointerEvents="none" />

      <View
        style={[
          styles.overlay,
          { paddingTop: insets.top + 14, paddingBottom: Math.max(insets.bottom, 20) + 22 },
        ]}
        pointerEvents="box-none"
      >
        <View style={styles.header}>
          <View style={styles.titleWrap}>
            <HugeiconsIcon icon={QrCodeIcon} size={20} color="#fff" />
            <Text style={styles.title}>Scanner un QR</Text>
          </View>
          <TouchableOpacity
            style={styles.close}
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Fermer le scanner"
          >
            <Text style={styles.closeText}>×</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.center}>
          {permissionGranted ? (
            <>
              <Text style={styles.hint}>Placez le QR code dans le cadre</Text>
              <View style={styles.frame}>
                <View style={[styles.corner, styles.cornerTL]} />
                <View style={[styles.corner, styles.cornerTR]} />
                <View style={[styles.corner, styles.cornerBL]} />
                <View style={[styles.corner, styles.cornerBR]} />
              </View>
              <Text style={styles.subHint}>
                {error || 'Le scan se fait automatiquement'}
              </Text>
            </>
          ) : (
            <View style={styles.permission}>
              <HugeiconsIcon icon={QrCodeIcon} size={42} color="#fff" />
              <Text style={styles.permissionTitle}>Accès à la caméra requis</Text>
              <Text style={styles.permissionText}>
                Autorisez la caméra pour scanner le QR d’une invitation SharePix.
              </Text>
              <TouchableOpacity
                style={styles.permissionButton}
                onPress={() => requestPermission()}
                activeOpacity={0.85}
              >
                <Text style={styles.permissionButtonText}>Autoriser la caméra</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={{ height: 1 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { flex: 1 },
  modal: {
    ...StyleSheet.absoluteFillObject,
    // Fond opaque : même si la caméra tarde à démarrer, l'écran ne laisse
    // jamais voir l'app derrière (cause du « scanner invisible »).
    backgroundColor: '#000',
    zIndex: 9999,
    elevation: Platform.OS === 'android' ? 30 : 9999,
  },
  veil: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titleWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { color: '#fff', fontSize: 17, fontWeight: '700' },
  close: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  closeText: { color: '#fff', fontSize: 26, lineHeight: 30, fontWeight: '300' },
  center: { alignItems: 'center', justifyContent: 'center' },
  hint: { color: '#fff', fontSize: 15, marginBottom: 18, fontWeight: '600' },
  frame: { width: 240, height: 240 },
  corner: { position: 'absolute', width: 34, height: 34, borderColor: colors.teal },
  cornerTL: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 10 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 10 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 10 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 10 },
  subHint: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 18, textAlign: 'center' },
  permission: { alignItems: 'center', paddingHorizontal: 10 },
  permissionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 14,
    textAlign: 'center',
  },
  permissionText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  permissionButton: {
    marginTop: 20,
    backgroundColor: colors.teal,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 24,
  },
  permissionButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
