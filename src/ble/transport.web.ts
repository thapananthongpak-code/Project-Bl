/// <reference types="web-bluetooth" />
// Browser implementation using the Web Bluetooth API (Chrome / Edge, or Bluefy on iPhone).
// Browsers can't list nearby devices for the page, so the user picks one in the browser's chooser.
import { simulatedBle } from './simulated';
import { CHAR_UUID, SERVICE_UUID, type BleApi } from './types';

const chosen = new Map<string, BluetoothDevice>();
const decoder = new TextDecoder();
const encoder = new TextEncoder();

const bluetooth = () => (typeof navigator !== 'undefined' ? navigator.bluetooth : undefined);
const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));
const asError = (e: unknown) => new Error(errorText(e));

const webBle: BleApi = {
  canScan: false,
  isSimulated: false,

  onStatusChange(cb) {
    const bt = bluetooth();
    if (!bt) {
      cb('unsupported');
      return () => {};
    }
    let active = true;
    const onChange = (e: Event) => cb((e as Event & { value?: boolean }).value === false ? 'off' : 'ready');
    // getAvailability() is missing in some browsers (e.g. Bluefy); assume ready there
    if (typeof bt.getAvailability === 'function') {
      bt.getAvailability().then((ok) => active && cb(ok ? 'ready' : 'off')).catch(() => active && cb('ready'));
      bt.addEventListener('availabilitychanged', onChange);
    } else {
      cb('ready');
    }
    return () => {
      active = false;
      bt.removeEventListener?.('availabilitychanged', onChange);
    };
  },

  async requestPermissions() {
    return true; // the browser asks when the chooser opens
  },

  startScan(_onDevice, onError) {
    onError('Scanning is not available in the browser. Use "Choose device".');
  },

  stopScan() {},

  async chooseDevice() {
    const bt = bluetooth();
    if (!bt) throw new Error('This browser has no Web Bluetooth. Use Chrome or Edge (or Bluefy on iPhone).');
    try {
      const device = await bt.requestDevice({ acceptAllDevices: true, optionalServices: [SERVICE_UUID] });
      chosen.set(device.id, device);
      return { id: device.id, name: device.name ?? 'Unnamed device', rssi: null, hasService: false };
    } catch (e) {
      if (e instanceof DOMException && e.name === 'NotFoundError') return null; // chooser cancelled
      throw asError(e);
    }
  },

  async connect(id, onUnexpectedDisconnect) {
    const device = chosen.get(id);
    if (!device?.gatt) throw new Error('Device is no longer available. Choose it again.');

    let server: BluetoothRemoteGATTServer;
    try {
      server = await device.gatt.connect();
    } catch (e) {
      throw asError(e);
    }

    let ch: BluetoothRemoteGATTCharacteristic | null = null;
    try {
      const service = await server.getPrimaryService(SERVICE_UUID);
      ch = await service.getCharacteristic(CHAR_UUID);
    } catch {
      ch = null; // shown as "characteristic not found" in the UI
    }

    let closing = false;
    const onGone = () => {
      device.removeEventListener('gattserverdisconnected', onGone);
      if (!closing) onUnexpectedDisconnect(null);
    };
    device.addEventListener('gattserverdisconnected', onGone);

    const requireChar = () => {
      if (!ch) throw new Error('Class characteristic not found on this device.');
      return ch;
    };

    return {
      id,
      name: device.name ?? null,
      maxPacketBytes: null, // browsers don't expose the MTU
      charProps: ch ? {
        read: ch.properties.read,
        write: ch.properties.write,
        writeNoResponse: ch.properties.writeWithoutResponse,
        notify: ch.properties.notify || ch.properties.indicate,
      } : null,

      async read() {
        try {
          return decoder.decode(await requireChar().readValue());
        } catch (e) {
          throw asError(e);
        }
      },

      async write(text) {
        const c = requireChar();
        const bytes = encoder.encode(text);
        try {
          if (!c.properties.write && c.properties.writeWithoutResponse) await c.writeValueWithoutResponse(bytes);
          else if (typeof c.writeValueWithResponse === 'function') await c.writeValueWithResponse(bytes);
          else await c.writeValue(bytes); // older browsers
        } catch (e) {
          throw asError(e);
        }
      },

      monitor(onValue, onError) {
        const c = ch;
        if (!c) {
          onError('Class characteristic not found on this device.');
          return () => {};
        }
        const onChange = () => {
          if (c.value) onValue(decoder.decode(c.value));
        };
        c.addEventListener('characteristicvaluechanged', onChange);
        c.startNotifications().catch((e) => onError(errorText(e)));
        return () => {
          c.removeEventListener('characteristicvaluechanged', onChange);
          c.stopNotifications().catch(() => {});
        };
      },

      async disconnect() {
        closing = true;
        device.removeEventListener('gattserverdisconnected', onGone);
        device.gatt?.disconnect();
      },
    };
  },
};

// Open the page with ?demo to try the screens with the simulated device (no Bluetooth needed)
const demo = typeof location !== 'undefined' && new URLSearchParams(location.search).has('demo');
export const ble: BleApi = demo ? simulatedBle : webBle;
