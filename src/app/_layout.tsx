import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { usePalette } from "@/theme";

export default function RootLayout() {
  const p = usePalette();
  const base = p.dark ? DarkTheme : DefaultTheme;
  const theme = {
    ...base,
    colors: { ...base.colors, primary: p.primary, background: p.bg, card: p.card, text: p.text, border: p.border },
  };

  return (
    <ThemeProvider value={theme}>
      <StatusBar style={p.dark ? "light" : "dark"} />
      <Stack screenOptions={{ headerTitleStyle: { fontWeight: "700" }, headerTintColor: p.primary }}>
        <Stack.Screen name="index" options={{ title: "BLE Grade Predictor" }} />
        <Stack.Screen name="summary" options={{ title: "Result summary" }} />
      </Stack>
    </ThemeProvider>
  );
}
