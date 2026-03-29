import "react-native-reanimated";
import React, { useEffect } from "react";
import { useFonts } from "expo-font";
import {
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
} from "@expo-google-fonts/nunito";
import { Stack, Redirect } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { SystemBars } from "react-native-edge-to-edge";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useColorScheme } from "react-native";
import {
  DarkTheme,
  DefaultTheme,
  Theme,
  ThemeProvider,
} from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { WidgetProvider } from "@/contexts/WidgetContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  initialRouteName: "(tabs)",
};

function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) return null;

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="auth-popup" options={{ headerShown: false }} />
      <Stack.Screen name="auth-callback" options={{ headerShown: false }} />
      {!user && <Redirect href="/(auth)/login" />}
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  const CustomDefaultTheme: Theme = {
    ...DefaultTheme,
    dark: false,
    colors: {
      primary: '#6C63FF',
      background: '#F8F7FF',
      card: '#FFFFFF',
      text: '#1A1A2E',
      border: 'rgba(108, 99, 255, 0.1)',
      notification: '#FF6B6B',
    },
  };

  const CustomDarkTheme: Theme = {
    ...DarkTheme,
    colors: {
      primary: '#8B84FF',
      background: '#0F0E1A',
      card: '#1A1928',
      text: '#F0EEFF',
      border: 'rgba(108, 99, 255, 0.15)',
      notification: '#FF6B6B',
    },
  };

  return (
    <>
      <StatusBar style="auto" animated />
      <ThemeProvider value={colorScheme === "dark" ? CustomDarkTheme : CustomDefaultTheme}>
        <SafeAreaProvider>
          <WidgetProvider>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <AuthProvider>
                <RootNavigator />
              </AuthProvider>
              <SystemBars style="auto" />
            </GestureHandlerRootView>
          </WidgetProvider>
        </SafeAreaProvider>
      </ThemeProvider>
    </>
  );
}
