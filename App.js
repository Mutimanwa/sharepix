import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { HugeiconsIcon } from '@hugeicons/react-native';
import {
  Home01Icon,
  Notification03Icon,
  UserCircle02Icon,
} from '@hugeicons/core-free-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { StoreProvider } from './src/store';
import { colors } from './src/theme';
import SplashScreen from './src/screens/SplashScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import AuthScreen from './src/screens/AuthScreen';
import HomeScreen from './src/screens/HomeScreen';
import ActivitiesScreen from './src/screens/ActivitiesScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import AlbumScreen from './src/screens/AlbumScreen';
import PhotoScreen from './src/screens/PhotoScreen';
import MenuScreen from './src/screens/MenuScreen';
import {
  QRScreen,
  MembersScreen,
  PremiumScreen,
  PcUploadScreen,
} from './src/screens/ExtraScreens';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// ── Configuration du Deep Linking ──
// ── DEEP LINK QR : intégration ──
const prefixes = ['sharepix://', 'https://sharepix.app'];
// Sur le web, l'origine courante est aussi un prefix valide : permet de
// tester les liens directement dans le navigateur
// (ex. http://localhost:8081/join?code=ABCDEFGH).
if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
  prefixes.push(window.location.origin);
}
// ── DEEP LINK QR : fin ──
const linking = {
  prefixes,
  config: {
    screens: {
      Splash: 'splash',
      Onboarding: 'onboarding',
      Auth: 'auth',
      // ── DEEP LINK QR : sharepix://join?code=XXXXXXXX → onglet Accueil
      // (HomeScreen ouvre la feuille "Rejoindre" pré-remplie + auto-submit) ──
      Main: {
        screens: {
          Accueil: 'join',
        },
      },
      // ── DEEP LINK QR : fin ──
      Album: 'album/:id',
      Photo: 'photo/:albumId/:photoId',
      Menu: 'menu/:id',
      QR: 'qr/:id',
      Members: 'members/:id',
      Premium: 'premium',
      PcUpload: 'pc-upload',
    },
  },
  // Fonction pour obtenir l'URL initiale
  async getInitialURL() {
    const url = await Linking.getInitialURL();
    console.log('Initial URL:', url);
    return url;
  },
  // Fonction pour écouter les changements d'URL
  subscribe(listener) {
    const onReceiveURL = ({ url }) => {
      console.log('URL received:', url);
      listener(url);
    };
    const subscription = Linking.addEventListener('url', onReceiveURL);
    return () => {
      subscription.remove();
    };
  },
};

function Tabs() {
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.teal,
        tabBarInactiveTintColor: '#9A9A9A',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E4EEEE',
          height: 52 + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 1),
          paddingTop: 1,
        },
      }}
    >
      <Tab.Screen
        name="Accueil"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ color, focused }) => (
            <HugeiconsIcon icon={Home01Icon} size={22} color={color} strokeWidth={focused ? 2.2 : 1.6} />
          ),
        }}
      />
      <Tab.Screen
        name="Activités"
        component={ActivitiesScreen}
        options={{
          tabBarIcon: ({ color, focused }) => (
            <HugeiconsIcon icon={Notification03Icon} size={22} color={color} strokeWidth={focused ? 2.2 : 1.6} />
          ),
        }}
      />
      <Tab.Screen
        name="Profil"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ color, focused }) => (
            <HugeiconsIcon icon={UserCircle02Icon} size={22} color={color} strokeWidth={focused ? 2.2 : 1.6} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  // ── Gestion des deep links OAuth ──
  useEffect(() => {
    // Fonction pour traiter les URLs reçues
    const handleDeepLink = async ({ url }) => {
      console.log('App received deep link:', url);
      
      if (!url) return;
      
      // Vérifier si c'est un callback OAuth
      if (url.includes('access_token') || url.includes('refresh_token')) {
        console.log('OAuth callback detected at app level');
        
        // Extraire les tokens de l'URL
        const params = new URLSearchParams(url.split('?')[1]);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        
        if (accessToken && refreshToken) {
          console.log('OAuth tokens found, session will be restored');
          
          // Un délai permet à Supabase de traiter les tokens
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // La session sera récupérée par le StoreProvider
          // via restoreSession() dans SplashScreen
        }
      }
      
      // Gérer les autres deep links (ex: invitation)
      if (url.includes('/album/')) {
        // Extraire l'ID de l'album pour navigation ultérieure
        const match = url.match(/\/album\/([^/?]+)/);
        if (match) {
          console.log('Album ID from deep link:', match[1]);
          // Navigation sera gérée par le router
        }
      }
    };

    // Écouter les deep links
    const subscription = Linking.addEventListener('url', handleDeepLink);

    // Vérifier les liens initiaux (quand l'app est lancée depuis un lien)
    Linking.getInitialURL().then((url) => {
      if (url) {
        console.log('🔗 Initial URL on app start:', url);
        handleDeepLink({ url });
      }
    });

    // Nettoyer l'écouteur
    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <StoreProvider>
        <NavigationContainer linking={linking}>
          <StatusBar style="light" />
          <Stack.Navigator 
            screenOptions={{ 
              headerShown: false,
              contentStyle: { backgroundColor: colors.cream },
            }}
          >
            <Stack.Screen name="Splash" component={SplashScreen} />
            <Stack.Screen name="Onboarding" component={OnboardingScreen} />
            <Stack.Screen name="Auth" component={AuthScreen} />
            <Stack.Screen name="Main" component={Tabs} />
            <Stack.Screen name="Album" component={AlbumScreen} />
            <Stack.Screen name="Photo" component={PhotoScreen} />
            <Stack.Screen name="Menu" component={MenuScreen} />
            <Stack.Screen name="QR" component={QRScreen} />
            <Stack.Screen name="Members" component={MembersScreen} />
            <Stack.Screen name="Premium" component={PremiumScreen} />
            <Stack.Screen name="PcUpload" component={PcUploadScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      </StoreProvider>
    </SafeAreaProvider>
  );
}