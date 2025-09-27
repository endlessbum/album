import type React from 'react';

// Supported chat backgrounds in Settings => Фон чата
export type ChatBackgroundKey =
  | 'none'
  | 'blue'
  | 'green'
  | 'peach'
  | 'pink'
  | 'lightGray'
  | 'dark';

// Order matters for the dropdown. Labels are shown as-is.
export const CHAT_BACKGROUNDS: { key: ChatBackgroundKey; label: string }[] = [
  { key: 'none', label: 'Без фона' },
  { key: 'blue', label: 'Голубой' },
  { key: 'green', label: 'Зелёный' },
  { key: 'peach', label: 'Персиковый' },
  { key: 'pink', label: 'Розовый' },
  { key: 'lightGray', label: 'Светло‑серый' },
  { key: 'dark', label: 'Тёмный' },
];

// Returns only the backgroundImage layer. The caller can add an overlay if needed.
export function getChatBackgroundStyle(key: ChatBackgroundKey): React.CSSProperties | undefined {
  switch (key) {
    case 'none':
      return undefined;
    case 'blue':
      // White to light sky-blue
      return { backgroundImage: 'linear-gradient(135deg, #ffffff 0%, #e9f3ff 35%, #cbe6ff 100%)' };
    case 'green':
      // White to soft mint-green
      return { backgroundImage: 'linear-gradient(135deg, #ffffff 0%, #e9ffe9 35%, #c9f6d7 100%)' };
    case 'peach':
      // White to peach
      return { backgroundImage: 'linear-gradient(135deg, #ffffff 0%, #ffece3 35%, #ffd1bd 100%)' };
    case 'pink':
      // White to pink
      return { backgroundImage: 'linear-gradient(135deg, #ffffff 0%, #ffe9f7 35%, #ffc7ea 100%)' };
    case 'lightGray':
      // White to light gray
      return { backgroundImage: 'linear-gradient(135deg, #ffffff 0%, #f1f1f1 40%, #d9d9d9 100%)' };
    case 'dark':
      // Medium to dark gray
      return { backgroundImage: 'linear-gradient(135deg, #3a3a3a 0%, #2c2c2c 50%, #1f1f1f 100%)' };
    default:
      return undefined;
  }
}
