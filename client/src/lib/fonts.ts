export type UiFont =
  | "Inter"
  | "Roboto"
  | "Open Sans"
  | "Poppins"
  | "Montserrat"
  | "Manrope"
  | "Rubik"
  | "Noto Sans"
  | "Noto Serif"
  | "Merriweather"
  | "IBM Plex Sans"
  | "PT Sans"
  | "Comfortaa"
  | "Golos Text"
  | "Exo 2"
  | "Ubuntu"
  | "Source Sans 3";

const GOOGLE_FONTS: Record<UiFont, { url: string; cssFamily: string }> = {
  Inter: {
    url: "https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap&subset=cyrillic",
    cssFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  },
  Roboto: {
    url: "https://fonts.googleapis.com/css2?family=Roboto:wght@100..900&display=swap&subset=cyrillic",
    cssFamily: "'Roboto', -apple-system, BlinkMacSystemFont, sans-serif",
  },
  "Open Sans": {
    url: "https://fonts.googleapis.com/css2?family=Open+Sans:wght@300..800&display=swap&subset=cyrillic",
    cssFamily: "'Open Sans', -apple-system, BlinkMacSystemFont, sans-serif",
  },
  Poppins: {
    url: "https://fonts.googleapis.com/css2?family=Poppins:wght@100..900&display=swap",
    cssFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif",
  },
  Montserrat: {
    url: "https://fonts.googleapis.com/css2?family=Montserrat:wght@100..900&display=swap&subset=cyrillic",
    cssFamily: "'Montserrat', -apple-system, BlinkMacSystemFont, sans-serif",
  },
  Manrope: {
    url: "https://fonts.googleapis.com/css2?family=Manrope:wght@200..800&display=swap&subset=cyrillic",
    cssFamily: "'Manrope', -apple-system, BlinkMacSystemFont, sans-serif",
  },
  Rubik: {
    url: "https://fonts.googleapis.com/css2?family=Rubik:wght@300..900&display=swap&subset=cyrillic",
    cssFamily: "'Rubik', -apple-system, BlinkMacSystemFont, sans-serif",
  },
  "Noto Sans": {
    url: "https://fonts.googleapis.com/css2?family=Noto+Sans:wght@100..900&display=swap&subset=cyrillic",
    cssFamily: "'Noto Sans', -apple-system, BlinkMacSystemFont, sans-serif",
  },
  "Noto Serif": {
    url: "https://fonts.googleapis.com/css2?family=Noto+Serif:wght@200..900&display=swap&subset=cyrillic",
    cssFamily: "'Noto Serif', -apple-system, BlinkMacSystemFont, serif",
  },
  Merriweather: {
    url: "https://fonts.googleapis.com/css2?family=Merriweather:wght@300..900&display=swap&subset=cyrillic",
    cssFamily: "'Merriweather', -apple-system, BlinkMacSystemFont, serif",
  },
  "IBM Plex Sans": {
    url: "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@100..700&display=swap&subset=cyrillic",
    cssFamily: "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif",
  },
  "PT Sans": {
    url: "https://fonts.googleapis.com/css2?family=PT+Sans:wght@400;700&display=swap&subset=cyrillic",
    cssFamily: "'PT Sans', -apple-system, BlinkMacSystemFont, sans-serif",
  },
  Comfortaa: {
    url: "https://fonts.googleapis.com/css2?family=Comfortaa:wght@300..700&display=swap&subset=cyrillic",
    cssFamily: "'Comfortaa', -apple-system, BlinkMacSystemFont, sans-serif",
  },
  "Golos Text": {
    url: "https://fonts.googleapis.com/css2?family=Golos+Text:wght@400..900&display=swap&subset=cyrillic",
    cssFamily: "'Golos Text', -apple-system, BlinkMacSystemFont, sans-serif",
  },
  "Exo 2": {
    url: "https://fonts.googleapis.com/css2?family=Exo+2:wght@100..900&display=swap&subset=cyrillic",
    cssFamily: "'Exo 2', -apple-system, BlinkMacSystemFont, sans-serif",
  },
  Ubuntu: {
    url: "https://fonts.googleapis.com/css2?family=Ubuntu:wght@300..700&display=swap&subset=cyrillic",
    cssFamily: "'Ubuntu', -apple-system, BlinkMacSystemFont, sans-serif",
  },
  "Source Sans 3": {
    url: "https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@200..900&display=swap&subset=cyrillic",
    cssFamily: "'Source Sans 3', -apple-system, BlinkMacSystemFont, sans-serif",
  },
};

function ensureFontLink(url: string) {
  if (typeof document === 'undefined') return;
  const id = 'app-google-font';
  let link = document.getElementById(id) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }
  if (link.href !== url) link.href = url;
}

export function applyUiFont(font: UiFont) {
  const cfg = GOOGLE_FONTS[font];
  if (!cfg) return;
  ensureFontLink(cfg.url);
  try {
    document.documentElement.style.setProperty('--font-sans', cfg.cssFamily);
  } catch {}
}

export function getStoredUiFont(): UiFont | undefined {
  try {
    const v = localStorage.getItem('ui:font') as UiFont | null;
    return (v && (v in GOOGLE_FONTS)) ? v : undefined;
  } catch { return undefined; }
}
