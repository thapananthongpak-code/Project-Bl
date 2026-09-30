// One-screen summary of the read → write → read session, laid out for a submission screenshot.
import { useLocalSearchParams } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CHAR_UUID, SERVICE_UUID } from '@/ble/types';
import { Card, GradeReveal, ValueBox, makeStyles } from '@/components/ui';
import { usePalette } from '@/theme';

type Params = {
  device: string;
  deviceId: string;
  first: string;
  written: string;
  result: string;
  grade: string;
  time: string;
  simulated: string;
};

export default function Summary() {
  const params = useLocalSearchParams<Params>();
  const p = usePalette();
  const styles = makeStyles(p);
  const insets = useSafeAreaInsets();

  const steps = [
    { n: 1, label: 'Read', value: params.first || '(not read)' },
    { n: 2, label: 'Write', value: params.written || '(nothing written)' },
    { n: 3, label: 'Read again', value: params.result || '(not read)' },
  ];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
    >
      {params.simulated === '1' && (
        <Text style={styles.demo}>DEMO MODE: simulated device, not a real Bluetooth result.</Text>
      )}

      <Card>
        <Text style={[styles.small, { letterSpacing: 1.2, fontWeight: '700' }]}>BLUETOOTH LE ASSIGNMENT</Text>
        <Text style={styles.title}>Result summary</Text>
        {params.written ? <Text style={styles.text}>👥 {params.written}</Text> : null}
        <Text style={styles.small}>📡 {params.device}  ·  {params.deviceId}</Text>
        {params.time ? <Text style={styles.small}>🕒 {params.time}</Text> : null}
        {params.grade ? <GradeReveal grade={params.grade} revealKey={0} size={60} /> : null}
      </Card>

      <Card title="Steps">
        {steps.map((s) => (
          <View key={s.n} style={{ gap: 6 }}>
            <View style={styles.row}>
              <Text style={styles.stepBadge}>{s.n}</Text>
              <Text style={styles.label}>{s.label}</Text>
            </View>
            <ValueBox text={s.value} placeholder="" />
          </View>
        ))}
      </Card>

      <View style={{ paddingHorizontal: 4, gap: 2 }}>
        <Text style={styles.mono}>Service  {SERVICE_UUID}</Text>
        <Text style={styles.mono}>Char     {CHAR_UUID}</Text>
      </View>
    </ScrollView>
  );
}
