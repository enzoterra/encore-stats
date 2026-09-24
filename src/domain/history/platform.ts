/**
 * Plataformas normalizadas (03-arquitetura, Dataset.cols.platform). A ordem é fixa: o índice
 * no Dataset é a posição neste array, então só acrescente no fim.
 */
export const PLATFORMS = ['android', 'ios', 'desktop', 'web', 'tv', 'other'] as const;

export type PlatformCode = (typeof PLATFORMS)[number];

const PLATFORM_INDEX: Readonly<Record<PlatformCode, number>> = Object.freeze({
  android: 0,
  ios: 1,
  desktop: 2,
  web: 3,
  tv: 4,
  other: 5,
});

export function platformIndex(code: PlatformCode): number {
  return PLATFORM_INDEX[code];
}

// TV vem antes de Android/web: "Partner android_tv …" e "webOS" (LG) são TVs.
const TV = /(^|[^a-z])tv([^a-z]|$)|_tv|tv_|tizen|webos|roku|tvos|fire ?tv/;
const WEB = /web[_ ]?player|^web([^a-z]|$)/;
const ANDROID = /android/;
const IOS = /(^|[^a-z])ios([^a-z]|$)|iphone|ipad|ipod/;
const DESKTOP = /windows|os x|osx|macos|mac os|linux|desktop/;

/**
 * Normaliza o campo `platform` do histórico, que varia muito entre épocas, por exemplo
 * "Android OS 9 API 28 (…)", "iOS 14.4 (iPhone12,1)", "Windows 10 (10.0.19042; x64)",
 * "web_player windows 10;chrome 88", "android", "osx".
 */
export function normalizePlatform(raw: string | null | undefined): PlatformCode {
  if (!raw) return 'other';
  const value = raw.toLowerCase();
  if (TV.test(value)) return 'tv';
  if (WEB.test(value)) return 'web';
  if (ANDROID.test(value)) return 'android';
  if (IOS.test(value)) return 'ios';
  if (DESKTOP.test(value)) return 'desktop';
  return 'other';
}
