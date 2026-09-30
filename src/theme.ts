import { useColorScheme } from 'react-native';

export type Palette = {
  dark: boolean;
  bg: string;
  card: string;
  border: string;
  text: string;
  muted: string;
  primary: string;
  onPrimary: string;
  primarySoft: string;
  valueBg: string;
  valueText: string;
  inputBorder: string;
  placeholder: string;
  chipBg: string;
  chipText: string;
  success: string;
  warnBg: string;
  warnText: string;
  demoBg: string;
  demoText: string;
  log: Record<'time' | 'info' | 'read' | 'write' | 'notify' | 'error', string>;
  grade: Record<'A' | 'B' | 'C' | 'D', string>;
};

const light: Palette = {
  dark: false,
  bg: '#f4f5fb',
  card: '#ffffff',
  border: '#e4e6f1',
  text: '#0f1222',
  muted: '#5b6178',
  primary: '#5b4cf0',
  onPrimary: '#ffffff',
  primarySoft: '#eeebff',
  valueBg: '#f1efff',
  valueText: '#26206b',
  inputBorder: '#cfd3e4',
  placeholder: '#98a0b8',
  chipBg: '#eceef6',
  chipText: '#3b4160',
  success: '#15803d',
  warnBg: '#fef3c7',
  warnText: '#92400e',
  demoBg: '#fee2e2',
  demoText: '#991b1b',
  log: { time: '#98a0b8', info: '#5b6178', read: '#0e7490', write: '#6d28d9', notify: '#c2410c', error: '#dc2626' },
  grade: { A: '#16a34a', B: '#2563eb', C: '#d97706', D: '#dc2626' },
};

const dark: Palette = {
  dark: true,
  bg: '#0e1020',
  card: '#171a2e',
  border: '#262a44',
  text: '#eef0ff',
  muted: '#9aa0bd',
  primary: '#7c6cff',
  onPrimary: '#ffffff',
  primarySoft: '#221f45',
  valueBg: '#1f1c3d',
  valueText: '#dcd8ff',
  inputBorder: '#343a5c',
  placeholder: '#6b7194',
  chipBg: '#262a44',
  chipText: '#c9cdea',
  success: '#4ade80',
  warnBg: '#3a2a0a',
  warnText: '#fcd34d',
  demoBg: '#3b1414',
  demoText: '#fca5a5',
  log: { time: '#6b7194', info: '#9aa0bd', read: '#22d3ee', write: '#a78bfa', notify: '#fb923c', error: '#f87171' },
  grade: { A: '#4ade80', B: '#60a5fa', C: '#fbbf24', D: '#f87171' },
};

export function usePalette(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
}

/** Colour for a grade like "A", "B+", "C-", "F" */
export function gradeColor(p: Palette, grade: string): string {
  const letter = grade[0];
  if (letter === 'A' || letter === 'B' || letter === 'C') return p.grade[letter];
  return p.grade.D;
}
