import { useEffect, useRef, type ReactNode } from 'react';
import { ActivityIndicator, Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { gradeColor, usePalette, type Palette } from '@/theme';

export function useStyles() {
  return makeStyles(usePalette());
}

export function Card({ step, title, subtitle, children }: {
  step?: number; title?: string; subtitle?: string; children: ReactNode;
}) {
  const s = useStyles();
  return (
    <View style={s.card}>
      {title && (
        <View style={s.row}>
          {step !== undefined && <Text style={s.stepBadge}>{step}</Text>}
          <Text style={s.cardTitle}>{title}</Text>
        </View>
      )}
      {subtitle && <Text style={s.muted}>{subtitle}</Text>}
      {children}
    </View>
  );
}

export function Btn({ title, onPress, disabled, loading, variant = 'primary' }: {
  title: string; onPress: () => void; disabled?: boolean; loading?: boolean; variant?: 'primary' | 'secondary';
}) {
  const p = usePalette();
  const s = makeStyles(p);
  const secondary = variant === 'secondary';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [s.btn, secondary && s.btnSecondary, disabled && s.btnDisabled, pressed && s.pressed]}
    >
      {loading
        ? <ActivityIndicator color={secondary ? p.primary : p.onPrimary} />
        : <Text style={[s.btnText, secondary && s.btnTextSecondary]}>{title}</Text>}
    </Pressable>
  );
}

export function ValueBox({ text, placeholder }: { text: string | null; placeholder: string }) {
  const s = useStyles();
  return (
    <View style={s.valueBox}>
      {text === null
        ? <Text style={s.muted}>{placeholder}</Text>
        : <Text style={s.valueText} selectable>{text || '(empty value)'}</Text>}
    </View>
  );
}

export function Chip({ label }: { label: string }) {
  return <Text style={useStyles().chip}>{label}</Text>;
}

/** Big grade letter that pops in. Change `revealKey` to replay the animation. */
export function GradeReveal({ grade, revealKey, size = 96 }: { grade: string; revealKey: number; size?: number }) {
  const p = usePalette();
  const s = makeStyles(p);
  const scale = useRef(new Animated.Value(0.2)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const color = gradeColor(p, grade);

  useEffect(() => {
    const useNativeDriver = Platform.OS !== 'web';
    scale.setValue(0.2);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 4, tension: 70, useNativeDriver }),
      Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver }),
    ]).start();
  }, [revealKey, scale, opacity]);

  const circle = size * 1.5;
  return (
    <View style={s.gradeBox}>
      <Animated.View
        style={[
          s.gradeCircle,
          { width: circle, height: circle, borderRadius: circle / 2, borderColor: color, opacity, transform: [{ scale }] },
        ]}
      >
        <Text style={[s.gradeLetter, { color, fontSize: size, lineHeight: size * 1.15 }]}>{grade}</Text>
      </Animated.View>
      <Text style={s.gradeCaption}>Predicted grade</Text>
    </View>
  );
}

export function makeStyles(p: Palette) {
  return StyleSheet.create({
    flex: { flex: 1 },
    screen: { flex: 1, backgroundColor: p.bg },
    content: { padding: 16, gap: 12, width: '100%', maxWidth: 600, alignSelf: 'center' },
    row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    card: {
      backgroundColor: p.card, borderRadius: 16, padding: 16, gap: 10, borderWidth: 1, borderColor: p.border,
      ...(p.dark ? {} : { shadowColor: '#1f1a5c', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 1 }),
    },
    cardTitle: { fontSize: 17, fontWeight: '700', color: p.text },
    stepBadge: {
      width: 26, height: 26, borderRadius: 13, backgroundColor: p.primary, color: p.onPrimary,
      textAlign: 'center', lineHeight: 26, fontWeight: '700', overflow: 'hidden',
    },
    title: { fontSize: 20, fontWeight: '700', color: p.text },
    label: { fontSize: 14, fontWeight: '600', color: p.text },
    text: { fontSize: 15, color: p.text },
    muted: { fontSize: 14, color: p.muted },
    small: { fontSize: 12, color: p.muted },
    success: { fontSize: 14, color: p.success, fontWeight: '600' },
    warning: { backgroundColor: p.warnBg, color: p.warnText, padding: 12, borderRadius: 10, fontSize: 14, overflow: 'hidden' },
    demo: {
      backgroundColor: p.demoBg, color: p.demoText, padding: 12, borderRadius: 10, fontSize: 14,
      fontWeight: '700', overflow: 'hidden',
    },
    btn: { backgroundColor: p.primary, borderRadius: 12, paddingVertical: 13, alignItems: 'center', minHeight: 48 },
    btnSecondary: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: p.primary },
    btnDisabled: { opacity: 0.4 },
    btnText: { color: p.onPrimary, fontSize: 15, fontWeight: '700', letterSpacing: 0.3 },
    btnTextSecondary: { color: p.primary },
    pressed: { opacity: 0.7 },
    deviceRow: {
      flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14,
      backgroundColor: p.bg, borderRadius: 12, borderWidth: 1, borderColor: p.border,
    },
    deviceRowTarget: { borderColor: p.primary, backgroundColor: p.primarySoft },
    deviceName: { fontSize: 16, fontWeight: '600', color: p.text },
    targetBadge: { fontSize: 12, color: p.primary, fontWeight: '700', marginTop: 2 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    chip: {
      fontSize: 11, fontWeight: '700', color: p.chipText, backgroundColor: p.chipBg,
      paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, overflow: 'hidden',
    },
    input: {
      borderWidth: 1, borderColor: p.inputBorder, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
      fontSize: 16, color: p.text, backgroundColor: p.card,
    },
    valueBox: { backgroundColor: p.valueBg, borderRadius: 10, padding: 12, minHeight: 46, justifyContent: 'center' },
    valueText: { fontSize: 16, color: p.valueText, textAlign: 'center' },
    gradeBox: { alignItems: 'center', paddingVertical: 8, gap: 6 },
    gradeCircle: { alignItems: 'center', justifyContent: 'center', borderWidth: 6 },
    gradeLetter: { fontWeight: '800' },
    gradeCaption: { fontSize: 13, color: p.muted },
    logLine: { fontSize: 13, color: p.text, fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }) },
    logTime: { color: p.log.time },
    logKind: { fontWeight: '700' },
    mono: { fontSize: 11, color: p.muted, fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }) },
    divider: { height: 1, backgroundColor: p.border },
  });
}
