import type { BaseProfileSettings, Proxy } from '@shared/types'

/**
 * Превращает «Базовые настройки профиля» (зеркало Dolphin) + прокси
 * в payload для PATCH /browser_profiles/{id}.
 *
 * ВАЖНО: в manual-режиме Dolphin требует обязательные значения
 * (webglInfo→vendor+renderer, useragent→value, screen→resolution и т.д.).
 * Если значения нет — безопасно откатываемся на real/auto, иначе API вернёт
 * 403 E_BROWSER_PROFILE_WRONG_PARAMETER «Check the required parameter […]».
 */
export function buildUpdatePayload(
  s: BaseProfileSettings,
  proxy?: Proxy,
  proxyId?: number
): Record<string, unknown> {
  const has = (v?: string): boolean => !!(v && v.trim())

  const payload: Record<string, unknown> = {
    platform: s.platform,
    osVersion: s.osVersion || undefined,
    // Организация: применяем только если заданы (undefined → JSON.stringify их отбросит)
    statusId: s.statusId ?? undefined,
    folderId: s.folderId ?? undefined,

    // manual → нужен value, иначе auto
    useragent: has(s.useragent.value)
      ? { mode: s.useragent.mode, value: s.useragent.value }
      : { mode: s.useragent.mode === 'manual' ? 'auto' : s.useragent.mode },

    // manual → нужен value(число), иначе real
    cpu:
      s.cpu.mode === 'manual' && s.cpu.value
        ? { mode: 'manual', value: s.cpu.value }
        : { mode: 'real' },
    memory:
      s.memory.mode === 'manual' && s.memory.value
        ? { mode: 'manual', value: s.memory.value }
        : { mode: 'real' },

    // manual → нужен resolution, иначе real
    screen:
      s.screen.mode === 'manual' && has(s.screen.resolution)
        ? { mode: 'manual', resolution: s.screen.resolution }
        : { mode: 'real' },

    // manual → нужен value, иначе auto
    timezone:
      s.timezone.mode === 'manual' && has(s.timezone.value)
        ? { mode: 'manual', value: s.timezone.value }
        : { mode: 'auto' },
    locale:
      s.locale.mode === 'manual' && has(s.locale.value)
        ? { mode: 'manual', value: s.locale.value }
        : { mode: 'auto' },

    // manual → нужны lat+lng, иначе auto
    geolocation:
      s.geolocation.mode === 'manual' &&
      s.geolocation.latitude != null &&
      s.geolocation.longitude != null
        ? {
            mode: 'manual',
            latitude: s.geolocation.latitude,
            longitude: s.geolocation.longitude,
            accuracy: s.geolocation.accuracy ?? 100
          }
        : { mode: 'auto' },

    // manual → нужен ipAddress, иначе altered
    webrtc:
      s.webrtc.mode === 'manual' && has(s.webrtc.ipAddress)
        ? { mode: 'manual', ipAddress: s.webrtc.ipAddress }
        : { mode: s.webrtc.mode === 'manual' ? 'altered' : s.webrtc.mode },

    canvas: { mode: s.canvas.mode },
    webgl: { mode: s.webgl.mode },

    // manual → нужны vendor+renderer, иначе real (это была причина 403 webglInfo)
    webglInfo:
      s.webglInfo.mode === 'manual' && has(s.webglInfo.vendor) && has(s.webglInfo.renderer)
        ? { mode: 'manual', vendor: s.webglInfo.vendor, renderer: s.webglInfo.renderer }
        : { mode: 'real' },

    // webgpu: форму записи Dolphin отклоняет как объект (422 validation.array).
    // Временно не отправляем, пока не подтвердим точную форму на живом API.
    // webgpu: { mode: s.webgpu.mode },

    clientRect: { mode: s.clientRect.mode },

    // manual → нужен value, иначе auto (off сохраняем)
    macAddress: macOrDevice(s.macAddress.mode, s.macAddress.value),
    deviceName: macOrDevice(s.deviceName.mode, s.deviceName.value),

    // manual → нужен непустой список, иначе real
    fonts:
      s.fonts.mode === 'manual' && (s.fonts.value?.length ?? 0) > 0
        ? { mode: 'manual', value: s.fonts.value }
        : { mode: 'real' },

    mediaDevices: compact({
      mode: s.mediaDevices.mode,
      audioInputs: s.mediaDevices.audioInputs,
      audioOutputs: s.mediaDevices.audioOutputs,
      videoInputs: s.mediaDevices.videoInputs
    }),

    audio: { mode: s.audio.mode },

    // Dolphin принимает blacklist строкой "3389,5900,..." (как в его же GET)
    ports: {
      mode: s.ports.mode,
      blacklist: (s.ports.blacklist ?? []).join(',')
    },

    doNotTrack: s.doNotTrack,

    args: s.args,

    // ── Флаги. ВНИМАНИЕ: точные ключи этих тумблеров стоит подтвердить на вашем токене.
    hideBrowserName: s.hideBrowserName,
    maskVideoStream: s.maskVideoStream,
    maskCookies: s.maskCookies,
    maskBrowserProfileNameIcon: s.maskBrowserProfileNameIcon
  }

  // Предпочитаем привязку по id сохранённого прокси (чтобы edit-диалог Dolphin его находил).
  if (proxyId != null) {
    payload.proxyId = proxyId
  } else if (proxy) {
    // инлайн-детали с именем: Dolphin создаёт ИМЕНОВАННЫЙ (сохранённый) прокси и привязывает его,
    // тогда edit-диалог находит прокси (без имени он «висячий» → 404).
    payload.proxy = compact({
      name: `${proxy.sheetTitle ?? 'RU'} ${proxy.host}:${proxy.port}`,
      type: proxy.type,
      host: proxy.host,
      port: proxy.port,
      login: proxy.login,
      password: proxy.password
    })
  }

  return payload
}

/** MAC/Device: manual→нужен value; off сохраняем; иначе auto. */
function macOrDevice(mode: string, value?: string): Record<string, unknown> {
  if (mode === 'off') return { mode: 'off' }
  if (mode === 'manual' && value && value.trim()) return { mode: 'manual', value }
  return { mode: 'auto' }
}

/** Убирает undefined/пустые поля, чтобы не слать в API мусор. */
function compact<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue
    if (typeof v === 'string' && v === '') continue
    if (Array.isArray(v) && v.length === 0) continue
    out[k] = v
  }
  return out as T
}
