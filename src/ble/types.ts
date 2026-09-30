// UUIDs of the teacher's device
export const SERVICE_UUID = 'aee04821-1973-4e1f-a590-e84b10d580e7';
export const CHAR_UUID = 'cde07b1a-889b-44b7-a99f-c888dddac729';

export type BleStatus = 'unknown' | 'ready' | 'off' | 'unauthorized' | 'unsupported' | 'resetting';

export type FoundDevice = { id: string; name: string; rssi: number | null; hasService: boolean };

export type CharProps = { read: boolean; write: boolean; writeNoResponse: boolean; notify: boolean };

export interface Connection {
  id: string;
  name: string | null;
  /** Largest value that fits in one BLE packet, when the platform tells us */
  maxPacketBytes: number | null;
  /** null when the class service/characteristic isn't on this device */
  charProps: CharProps | null;
  read(): Promise<string>;
  write(text: string): Promise<void>;
  /** Returns a function that stops listening */
  monitor(onValue: (text: string) => void, onError: (message: string) => void): () => void;
  disconnect(): Promise<void>;
}

export interface BleApi {
  /** true: the app scans and lists devices itself. false (web): the browser shows its own device chooser */
  canScan: boolean;
  /** true when using the in-app fake device (Expo Go has no Bluetooth module) */
  isSimulated: boolean;
  onStatusChange(cb: (status: BleStatus) => void): () => void;
  requestPermissions(): Promise<boolean>;
  startScan(onDevice: (device: FoundDevice) => void, onError: (message: string) => void): void;
  stopScan(): void;
  /** Web only: opens the browser's chooser. Resolves null if the user cancels */
  chooseDevice(): Promise<FoundDevice | null>;
  /** Errors are thrown as Error with a readable message */
  connect(id: string, onUnexpectedDisconnect: (reason: string | null) => void): Promise<Connection>;
}
