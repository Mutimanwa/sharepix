import React from 'react';
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
import { StoreProvider } from './src/store';
import { colors } from './src/theme';
import SplashScreen from './src/screens/SplashScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import HomeScreen from './src/screens/HomeScreen';
import ActivitiesScreen from './src/screens/ActivitiesScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import AlbumScreen from './src/screens/AlbumScreen';
import PhotoScreen from './src/screens/PhotoScreen';
import MenuScreen from './src/screens/MenuScreen';
import {
  FiltersScreen,
  QRScreen,
  MembersScreen,
  PremiumScreen,
  PcUploadScreen,
} from './src/screens/ExtraScreens';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

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
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 6,
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
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <NavigationContainer>
          <StatusBar style="light" />
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Splash" component={SplashScreen} />
            <Stack.Screen name="Onboarding" component={OnboardingScreen} />
            <Stack.Screen name="Main" component={Tabs} />
            <Stack.Screen name="Album" component={AlbumScreen} />
            <Stack.Screen name="Photo" component={PhotoScreen} />
            <Stack.Screen name="Menu" component={MenuScreen} />
            <Stack.Screen name="Filters" component={FiltersScreen} options={{ presentation: 'modal' }} />
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
