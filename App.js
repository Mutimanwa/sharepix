import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
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
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.coral,
        tabBarInactiveTintColor: '#9A9A9A',
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
      }}
    >
      <Tab.Screen
        name="Accueil"
        component={HomeScreen}
        options={{ tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>⌂</Text> }}
      />
      <Tab.Screen
        name="Activités"
        component={ActivitiesScreen}
        options={{ tabBarIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>🔔</Text> }}
      />
      <Tab.Screen
        name="Profil"
        component={ProfileScreen}
        options={{ tabBarIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>☺</Text> }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <NavigationContainer>
        <StatusBar style="dark" />
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
  );
}
