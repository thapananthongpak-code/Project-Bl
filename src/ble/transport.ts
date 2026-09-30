// Android / iOS implementation (react-native-ble-plx). The web version is transport.web.ts.
import { Buffer } from 'buffer';
import { PermissionsAndroid, Platform } from 'react-native';
import { BleError, BleErrorCode, BleManager, State, type Device } from 'react-native-ble-plx';
import { simulatedBle } from './simulated';
import { CHAR_UUID, SERVICE_UUID, type BleApi, type BleStatus } from './types';

// Throws in Expo Go, which doesn't include the BLE native module
function createManager(): BleManager | null {
  try {
    return new BleManager();
  } catch {
    return null;
  }
}
const maybeManager = createManager();
// nativeBle is only used when maybeManager exists (see the export at the bottom)
const manager = maybeManager as BleManager;
const REQUESTED_MTU = 185; // Android only; iOS negotiates the MTU by itself

// BLE values travel as Base64 strings in react-native-ble-plx
const decode = (base64: string | null) => Buffer.from(base64 ?? '', 'base64').toString('utf8');
const encode = (text: string) => Buffer.from(text, 'utf8').toString('base64');

function errorText(e: unknown): string {
  if (e instanceof BleError) return e.reason ? `${e.message} (${e.reason})` : e.message;
  return e instanceof Error ? e.message : String(e);
}
const asError = (e: unknown) => new Error(errorText(e));

const STATUS: Record<State, BleStatus> = {
  [State.Unknown]: 'unknown',
  [State.Resetting]: 'resetting',
  [State.Unsupported]: 'unsupported',
  [State.Unauthorized]: 'unauthorized',
  [State.PoweredOff]: 'off',
  [State.PoweredOn]: 'ready',
};

async function requestPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true; // iOS asks via Info.plist on first use
  if (Platform.Version >= 31) { // Android 12+
    const result = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    ]);
    return Object.values(result).every((r) => r === PermissionsAndroid.RESULTS.GRANTED);
  }
  // Android 11 or lower needs location permission to scan
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

async function connectAndDiscover(id: string): Promise<Device> {
  try {
    const connected = await manager.connectToDevice(id, { requestMTU: REQUESTED_MTU, timeout: 10000 });
    // Services and characteristics must be discovered before reading or writing
    return await connected.discoverAllServicesAndCharacteristics();
  } catch (e) {
    manager.cancelDeviceConnection(id).catch(() => {});
    throw asError(e);
  }
}

const nativeBle: BleApi = {
  canScan: true,
  isSimulated: false,

  onStatusChange(cb) {
    const sub = manager.onStateChange((s) => cb(STATUS[s]), true);
    return () => sub.remove();
  },

  requestPermissions,

  startScan(onDevice, onError) {
    manager.startDeviceScan(null, null, (error, d) => {
      if (error) {
        onError(errorText(error));
        return;
      }
      const name = d?.name ?? d?.localName;
      if (!d || !name) return;
      onDevice({
        id: d.id,
        name,
        rssi: d.rssi,
        hasService: d.serviceUUIDs?.some((u) => u.toLowerCase() === SERVICE_UUID) ?? false,
      });
    });
  },

  stopScan() {
    manager.stopDeviceScan();
  },

  async chooseDevice() {
    return null; // the app lists scanned devices itself
  },

  async connect(id, onUnexpectedDisconnect) {
    const d = await connectAndDiscover(id);
    const chars = await d.characteristicsForService(SERVICE_UUID).catch(() => []);
    const ch = chars.find((c) => c.uuid.toLowerCase() === CHAR_UUID);

    let closing = false;
    const disconnectSub = d.onDisconnected((err) => {
      disconnectSub.remove();
      if (!closing) onUnexpectedDisconnect(err ? errorText(err) : null);
    });

    return {
      id: d.id,
      name: d.name,
      maxPacketBytes: d.mtu - 3,
      charProps: ch ? {
        read: ch.isReadable,
        write: ch.isWritableWithResponse,
        writeNoResponse: ch.isWritableWithoutResponse,
        notify: ch.isNotifiable || ch.isIndicatable,
      } : null,

      async read() {
        try {
          const c = await manager.readCharacteristicForDevice(d.id, SERVICE_UUID, CHAR_UUID);
          return decode(c.value);
        } catch (e) {
          throw asError(e);
        }
      },

      async write(text) {
        try {
          // Write Request (with response) unless the characteristic only supports Write Command
          if (ch && !ch.isWritableWithResponse && ch.isWritableWithoutResponse) {
            await manager.writeCharacteristicWithoutResponseForDevice(d.id, SERVICE_UUID, CHAR_UUID, encode(text));
          } else {
            await manager.writeCharacteristicWithResponseForDevice(d.id, SERVICE_UUID, CHAR_UUID, encode(text));
          }
        } catch (e) {
          throw asError(e);
        }
      },

      monitor(onValue, onError) {
        const sub = manager.monitorCharacteristicForDevice(d.id, SERVICE_UUID, CHAR_UUID, (error, c) => {
          if (error) {
            const code = error.errorCode;
            if (code !== BleErrorCode.OperationCancelled && code !== BleErrorCode.DeviceDisconnected) {
              onError(errorText(error));
            }
            return;
          }
          if (c?.value) onValue(decode(c.value));
        });
        return () => sub.remove();
      },

      async disconnect() {
        closing = true;
        disconnectSub.remove();
        await manager.cancelDeviceConnection(d.id).catch(() => {});
      },
    };
  },
};

// Expo Go has no BLE module: fall back to a simulated device so the screens can still be tried
export const ble: BleApi = maybeManager ? nativeBle : simulatedBle;
