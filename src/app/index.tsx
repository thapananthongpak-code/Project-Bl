import { Buffer } from 'buffer';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Keyboard, KeyboardAvoidingView, Platform,
  Pressable, ScrollView, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ble } from '@/ble/transport'; // transport.web.ts in the browser
import type { BleStatus, CharProps, Connection, FoundDevice } from '@/ble/types';
import { Btn, Card, Chip, GradeReveal, ValueBox, makeStyles } from '@/components/ui';
import { usePalette } from '@/theme';

const SCAN_SECONDS = 15;
const IS_WEB = Platform.OS === 'web';

type LogKind = 'info' | 'read' | 'write' | 'notify' | 'error';
type LogEntry = { id: number; time: string; kind: LogKind; text: string };

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

// react-native-web's Alert.alert does nothing, so use the browser's alert there
function notify(title: string, message: string) {
  if (IS_WEB) window.alert(`${title}\n\n${message}`);
  else Alert.alert(title, message);
}

function timeNow(): string {
  const d = new Date();
  return [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':');
}

// The device answers e.g. "John Doe  - Your grade is D."
function extractGrade(text: string | null): string | null {
  return text?.match(/[Gg]rade(?:\s+is)?\s*:?\s*([A-F][+-]?)(?![A-Za-z])/)?.[1] ?? null;
}

const STATUS_MESSAGE: Partial<Record<BleStatus, string>> = {
  off: 'Bluetooth is off. Turn it on to find devices.',
  unauthorized: 'Bluetooth permission was denied. Allow it in Settings for this app.',
  unsupported: IS_WEB
    ? 'This browser can’t use Bluetooth. Open this page in Chrome or Edge (on iPhone, use the Bluefy app).'
    : 'This phone does not support Bluetooth LE.',
  resetting: 'Bluetooth is restarting…',
};

export default function Index() {
  const router = useRouter();
  const p = usePalette();
  const styles = makeStyles(p);
  const insets = useSafeAreaInsets();

  const [bleStatus, setBleStatus] = useState<BleStatus>('unknown');
  const [scanning, setScanning] = useState(false);
  const [devices, setDevices] = useState<FoundDevice[]>([]);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [conn, setConn] = useState<Connection | null>(null);
  const [busy, setBusy] = useState<'read1' | 'read3' | 'write' | null>(null);
  const [myName, setMyName] = useState('');
  const [buddyName, setBuddyName] = useState('');
  const [firstRead, setFirstRead] = useState<string | null>(null);
  const [writtenValue, setWrittenValue] = useState<string | null>(null);
  const [resultRead, setResultRead] = useState<string | null>(null);
  const [resultTime, setResultTime] = useState<string | null>(null);
  const [revealKey, setRevealKey] = useState(0);
  const [listening, setListening] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([]);

  const found = useRef(new Map<string, FoundDevice>());
  const scanTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopMonitor = useRef<(() => void) | null>(null);
  const logId = useRef(0);

  const payload = [myName.trim(), buddyName.trim()].filter(Boolean).join(' & ');
  const payloadBytes = Buffer.byteLength(payload, 'utf8');
  const charProps: CharProps | null = conn?.charProps ?? null;
  const maxPacketBytes = conn?.maxPacketBytes ?? null;
  const grade = extractGrade(resultRead);

  function addLog(kind: LogKind, text: string) {
    const entry = { id: ++logId.current, time: timeNow(), kind, text };
    setLog((prev) => [...prev, entry].slice(-40));
  }

  useEffect(() => {
    const unsubscribe = ble.onStatusChange(setBleStatus);
    ble.requestPermissions().then((granted) => {
      if (!granted) addLog('error', 'Bluetooth permission not granted.');
    });
    return () => {
      unsubscribe();
      stopScan();
      stopMonitor.current?.();
    };
  }, []);

  // ---------- 1. Find a device ----------

  function flushDevices() {
    // Devices that advertise the class service go first; otherwise keep discovery order so rows don't jump
    const list = [...found.current.values()];
    setDevices([...list.filter((d) => d.hasService), ...list.filter((d) => !d.hasService)]);
  }

  function stopScan() {
    ble.stopScan();
    if (scanTimer.current) clearTimeout(scanTimer.current);
    if (flushTimer.current) clearInterval(flushTimer.current);
    scanTimer.current = null;
    flushTimer.current = null;
    flushDevices();
    setScanning(false);
  }

  async function startScan() {
    if (!(await ble.requestPermissions())) {
      notify('Permission needed', 'Allow Bluetooth (Nearby devices) permission for this app in Settings.');
      return;
    }
    if (bleStatus !== 'ready') {
      notify('Bluetooth is not ready', STATUS_MESSAGE[bleStatus] ?? 'Turn on Bluetooth and try again.');
      return;
    }
    stopScan();
    found.current.clear();
    setDevices([]);
    setScanning(true);

    ble.startScan(
      (d) => {
        const prev = found.current.get(d.id);
        found.current.set(d.id, { ...d, rssi: d.rssi ?? prev?.rssi ?? null, hasService: d.hasService || !!prev?.hasService });
      },
      (message) => {
        addLog('error', `Scan failed: ${message}`);
        stopScan();
      },
    );
    flushTimer.current = setInterval(flushDevices, 500);
    scanTimer.current = setTimeout(stopScan, SCAN_SECONDS * 1000);
  }

  // Web: the browser shows its own device chooser
  async function chooseDevice() {
    if (bleStatus === 'unsupported') {
      notify('Bluetooth not available', STATUS_MESSAGE.unsupported ?? '');
      return;
    }
    try {
      const d = await ble.chooseDevice();
      if (d) await connect(d);
    } catch (e) {
      addLog('error', errorText(e));
      notify('Could not choose a device', errorText(e));
    }
  }

  // ---------- 2. Connect / disconnect ----------

  function resetSession() {
    stopMonitor.current?.();
    stopMonitor.current = null;
    setListening(false);
    setConn(null);
    setFirstRead(null);
    setWrittenValue(null);
    setResultRead(null);
    setResultTime(null);
  }

  async function connect(target: FoundDevice) {
    stopScan();
    setConnectingId(target.id);
    addLog('info', `Connecting to ${target.name}…`);
    try {
      const c = await ble.connect(target.id, (reason) => {
        resetSession();
        addLog('error', `Connection lost${reason ? `: ${reason}` : ''}. Connect again.`);
        notify('Connection lost', 'The device disconnected. Connect again.');
      });
      resetSession();
      setConn(c);
      addLog('info', `Connected to ${c.name ?? target.name}${c.maxPacketBytes !== null ? ` (MTU ${c.maxPacketBytes + 3})` : ''}`);
      if (!c.charProps) addLog('error', 'Class service/characteristic not found on this device. Is it the right device?');
    } catch (e) {
      addLog('error', `Connection failed: ${errorText(e)}`);
      notify('Connection failed', errorText(e));
    } finally {
      setConnectingId(null);
    }
  }

  async function disconnect() {
    if (!conn) return;
    const c = conn;
    resetSession();
    await c.disconnect();
    addLog('info', 'Disconnected.');
  }

  // ---------- 3. Read ----------

  async function readValue(step: 1 | 3) {
    if (!conn) return;
    setBusy(step === 1 ? 'read1' : 'read3');
    try {
      const text = await conn.read();
      addLog('read', text || '(empty)');
      if (step === 1) {
        setFirstRead(text);
      } else {
        setResultRead(text);
        setResultTime(new Date().toLocaleString());
        setRevealKey((k) => k + 1);
      }
    } catch (e) {
      addLog('error', `Read failed: ${errorText(e)}`);
      notify('Read failed', errorText(e));
    } finally {
      setBusy(null);
    }
  }

  // ---------- 4. Write ----------

  async function writeValue() {
    if (!conn) return;
    if (!myName.trim()) {
      notify('Missing name', 'Enter your name (and your buddy’s name) first.');
      return;
    }
    Keyboard.dismiss();
    setBusy('write');
    try {
      await conn.write(payload);
      setWrittenValue(payload);
      setResultRead(null);
      addLog('write', payload);
      notify('Write success', `"${payload}" was written to the device.\n\nNow do step 3 to read your predicted grade.`);
    } catch (e) {
      addLog('error', `Write failed: ${errorText(e)}`);
      notify('Write failed', errorText(e));
    } finally {
      setBusy(null);
    }
  }

  // ---------- 5. Notifications (optional) ----------

  function toggleNotifications() {
    if (!conn) return;
    if (stopMonitor.current) {
      stopMonitor.current();
      stopMonitor.current = null;
      setListening(false);
      addLog('info', 'Stopped listening for notifications.');
      return;
    }
    stopMonitor.current = conn.monitor(
      (text) => addLog('notify', text),
      (message) => {
        addLog('error', `Notification error: ${message}`);
        stopMonitor.current = null;
        setListening(false);
      },
    );
    setListening(true);
    addLog('info', 'Listening for notifications…');
  }

  // ---------- 6. Summary for submission ----------

  function openSummary() {
    if (!conn || resultRead === null) return;
    router.push({
      pathname: '/summary',
      params: {
        device: conn.name ?? 'Unnamed device',
        deviceId: conn.id,
        first: firstRead ?? '',
        written: writtenValue ?? '',
        result: resultRead,
        grade: grade ?? '',
        time: resultTime ?? '',
        simulated: ble.isSimulated ? '1' : '0',
      },
    });
  }

  // ---------- UI ----------

  const statusMessage = STATUS_MESSAGE[bleStatus];

  return (
    <KeyboardAvoidingView style={styles.flex} behavior="padding">
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        {ble.isSimulated && (
          <Text style={styles.demo}>
            DEMO MODE: this uses a simulated device, not real Bluetooth. Don't submit these screenshots.
            Use the installed app (APK) with the real device.
          </Text>
        )}
        {statusMessage && <Text style={styles.warning}>{statusMessage}</Text>}

        {!conn ? (
          ble.canScan ? (
            <Card title="Find the device" subtitle="Tap Scan, then tap the teacher's device (e.g. “Mobile App 169”).">
              <Btn
                title={scanning ? 'Stop scanning' : 'Scan devices'}
                onPress={scanning ? stopScan : startScan}
                disabled={connectingId !== null}
              />
              {scanning && (
                <View style={styles.row}>
                  <ActivityIndicator color={p.primary} />
                  <Text style={styles.muted}>Scanning… {devices.length} device(s) found</Text>
                </View>
              )}
              {!scanning && devices.length === 0 && <Text style={styles.muted}>No devices yet.</Text>}
              {devices.map((d) => (
                <Pressable
                  key={d.id}
                  onPress={() => connect(d)}
                  disabled={connectingId !== null}
                  style={({ pressed }) => [styles.deviceRow, d.hasService && styles.deviceRowTarget, pressed && styles.pressed]}
                >
                  <View style={styles.flex}>
                    <Text style={styles.deviceName}>{d.name}</Text>
                    <Text style={styles.small}>{d.id}</Text>
                    {d.hasService && <Text style={styles.targetBadge}>Has the class service</Text>}
                  </View>
                  {connectingId === d.id
                    ? <ActivityIndicator color={p.primary} />
                    : d.rssi !== null && <Text style={styles.small}>{d.rssi} dBm</Text>}
                </Pressable>
              ))}
            </Card>
          ) : (
            <Card
              title="Find the device"
              subtitle="Click Choose device, then pick the teacher's device (e.g. “Mobile App 169”) in the browser's popup."
            >
              <Btn title="Choose device" onPress={chooseDevice} disabled={connectingId !== null} loading={connectingId !== null} />
            </Card>
          )
        ) : (
          <>
            <Card>
              <Text style={styles.small}>Connected to</Text>
              <Text style={styles.title}>{conn.name ?? 'Unnamed device'}</Text>
              <Text style={styles.small}>
                {conn.id}{maxPacketBytes !== null && Platform.OS === 'android' ? `  ·  MTU ${maxPacketBytes + 3}` : ''}
              </Text>
              {charProps ? (
                <View style={styles.chips}>
                  {charProps.read && <Chip label="READ" />}
                  {charProps.write && <Chip label="WRITE" />}
                  {charProps.writeNoResponse && <Chip label="WRITE NO RESP" />}
                  {charProps.notify && <Chip label="NOTIFY" />}
                </View>
              ) : (
                <Text style={styles.warning}>Class characteristic not found on this device.</Text>
              )}
              <Btn title="Disconnect" variant="secondary" onPress={disconnect} />
            </Card>

            <Card step={1} title="Read the value">
              <Btn title="Read value" onPress={() => readValue(1)} disabled={busy !== null} loading={busy === 'read1'} />
              <ValueBox text={firstRead} placeholder="Not read yet" />
            </Card>

            <Card step={2} title="Write your names">
              <Text style={styles.label}>Your name</Text>
              <TextInput
                style={styles.input}
                value={myName}
                onChangeText={setMyName}
                placeholder="e.g. Somchai Jaidee"
                placeholderTextColor={p.placeholder}
                autoCapitalize="words"
                maxLength={40}
              />
              <Text style={styles.label}>Buddy's name</Text>
              <TextInput
                style={styles.input}
                value={buddyName}
                onChangeText={setBuddyName}
                placeholder="e.g. Somsri Rakdee"
                placeholderTextColor={p.placeholder}
                autoCapitalize="words"
                maxLength={40}
              />
              {payload !== '' && (
                <Text style={styles.muted}>Will write: “{payload}” ({payloadBytes} bytes)</Text>
              )}
              {maxPacketBytes !== null && payloadBytes > maxPacketBytes && (
                <Text style={styles.warning}>
                  Longer than one BLE packet ({maxPacketBytes} bytes). The device may cut it off, so try shorter names.
                </Text>
              )}
              <Btn title="Write value" onPress={writeValue} disabled={busy !== null} loading={busy === 'write'} />
              {writtenValue !== null && <Text style={styles.success}>✓ Wrote “{writtenValue}”</Text>}
            </Card>

            <Card step={3} title="Read again: predicted grade">
              <Btn
                title="Read value again"
                onPress={() => readValue(3)}
                disabled={busy !== null || writtenValue === null}
                loading={busy === 'read3'}
              />
              {grade && <GradeReveal grade={grade} revealKey={revealKey} />}
              <ValueBox
                text={resultRead}
                placeholder={writtenValue === null ? 'Do step 2 first.' : 'Tap “Read value again”.'}
              />
              {resultRead !== null && (
                <Btn title="View result summary" variant="secondary" onPress={openSummary} />
              )}
            </Card>

            {charProps?.notify && (
              <Card title="Notifications (optional)" subtitle="Get values pushed by the device without tapping Read.">
                <Btn
                  title={listening ? 'Stop listening' : 'Subscribe to notifications'}
                  variant="secondary"
                  onPress={toggleNotifications}
                />
              </Card>
            )}
          </>
        )}

        {log.length > 0 && (
          <Card title="Activity log">
            {log.map((e) => (
              <Text key={e.id} style={styles.logLine}>
                <Text style={styles.logTime}>{e.time} </Text>
                <Text style={[styles.logKind, { color: p.log[e.kind] }]}>{e.kind.toUpperCase()} </Text>
                {e.text}
              </Text>
            ))}
          </Card>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
