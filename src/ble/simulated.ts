// Fake device used where real Bluetooth isn't available (Expo Go), so the screens can be tried out.
// It behaves like the teacher's device: "Enter your name" -> write a name -> "<name> - Your grade is X."
import type { BleApi, FoundDevice } from './types';

const DEVICES: FoundDevice[] = [
  { id: 'SIM-00:00:00:00:01:69', name: 'Mobile App 169 (simulated)', rssi: -52, hasService: true },
  { id: 'SIM-00:00:00:00:00:02', name: 'Other device (simulated)', rssi: -80, hasService: false },
];
const GRADES = ['A', 'B+', 'B', 'C+', 'C', 'D'];

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let scanTimers: ReturnType<typeof setTimeout>[] = [];

export const simulatedBle: BleApi = {
  canScan: true,
  isSimulated: true,

  onStatusChange(cb) {
    cb('ready');
    return () => {};
  },

  async requestPermissions() {
    return true;
  },

  startScan(onDevice) {
    scanTimers = DEVICES.map((d, i) => setTimeout(() => onDevice(d), 600 + i * 700));
  },

  stopScan() {
    scanTimers.forEach(clearTimeout);
    scanTimers = [];
  },

  async chooseDevice() {
    return null;
  },

  async connect(id) {
    await wait(800);
    const device = DEVICES.find((d) => d.id === id);
    if (!device?.hasService) {
      return {
        id,
        name: device?.name ?? null,
        maxPacketBytes: 182,
        charProps: null,
        read: () => Promise.reject(new Error('Class characteristic not found on this device.')),
        write: () => Promise.reject(new Error('Class characteristic not found on this device.')),
        monitor: () => () => {},
        disconnect: async () => {},
      };
    }

    let value = 'Enter your name';
    return {
      id,
      name: device.name,
      maxPacketBytes: 182,
      charProps: { read: true, write: true, writeNoResponse: false, notify: false },
      async read() {
        await wait(300);
        return value;
      },
      async write(text) {
        await wait(300);
        value = `${text} - Your grade is ${GRADES[Math.floor(Math.random() * GRADES.length)]}.`;
      },
      monitor: () => () => {},
      disconnect: async () => {},
    };
  },
};
