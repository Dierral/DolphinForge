import type { AppConfig, BaseProfileSettings } from './types'

/** Дефолтные «Базовые настройки профиля» — безопасный пресет, ближе всего к auto/real Dolphin. */
export const DEFAULT_BASE_SETTINGS: BaseProfileSettings = {
  platform: 'windows',
  osVersion: '10',
  randomizeUa: false,
  randomizeMac: false,
  randomizeDevice: false,
  folderId: null,
  statusId: null,
  useragent: { mode: 'auto' },
  cpu: { mode: 'real' },
  memory: { mode: 'real' },
  screen: { mode: 'real' },
  timezone: { mode: 'auto' },
  locale: { mode: 'auto' },
  geolocation: { mode: 'auto' },
  webrtc: { mode: 'altered' },
  canvas: { mode: 'noise' },
  webgl: { mode: 'noise' },
  webglInfo: { mode: 'real', vendor: '', renderer: '' },
  webgpu: { mode: 'manual' },
  clientRect: { mode: 'noise' },
  macAddress: { mode: 'auto' },
  deviceName: { mode: 'auto' },
  fonts: { mode: 'real', value: [] },
  mediaDevices: { mode: 'real' },
  audio: { mode: 'noise' },
  ports: {
    mode: 'protect',
    blacklist: [
      3389, 5900, 5800, 7070, 6568, 5938, 63333, 5901, 5902, 5903, 5950, 5931, 5939, 6039, 5944,
      6040, 5279, 2112
    ]
  },
  doNotTrack: false,
  args: [],
  hideBrowserName: false,
  maskVideoStream: false,
  maskCookies: false,
  maskBrowserProfileNameIcon: false
}

export const DEFAULT_CONFIG: AppConfig = {
  dolphin: {
    apiToken: '',
    baseUrl: 'https://dolphin-anty-api.com'
  },
  google: {
    serviceAccountPath: '',
    spreadsheetId: ''
  },
  departments: {
    1: { sheetTitle: '624', proxyHeader: 'SOCKS5 RU', headerRows: 1 },
    2: { sheetTitle: '726', proxyHeader: 'SOCKS5 RU', headerRows: 1 },
    3: { sheetTitle: '859', proxyHeader: 'SOCKS5 RU', headerRows: 1 }
  },
  randomization: { csvPath: '' },
  pinnedProfileIds: [],
  baseSettings: DEFAULT_BASE_SETTINGS
}
