import { useEffect, useState, ReactNode } from 'react'
import type { BaseProfileSettings, Organization, Platform } from '@shared/types'
import { Card, Field, Input, Select, Combo, Segmented, Toggle, Button } from '../components/ui'
import { useConfig } from '../lib/useConfig'
import { useToast } from '../components/toast'

const TIMEZONES = [
  'Europe/Moscow',
  'Europe/Kyiv',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Warsaw',
  'America/New_York',
  'America/Los_Angeles',
  'America/Chicago',
  'Asia/Dubai',
  'Asia/Almaty',
  'Asia/Tokyo'
]
const LOCALES = [
  'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
  'en-US,en;q=0.9',
  'uk-UA,uk;q=0.9,ru;q=0.8,en;q=0.7',
  'de-DE,de;q=0.9,en;q=0.8',
  'pl-PL,pl;q=0.9,en;q=0.8',
  'es-ES,es;q=0.9,en;q=0.8'
]

// Версии ОС по платформам (как в Dolphin)
const OS_VERSIONS: Record<Platform, string[]> = {
  windows: ['11', '10', '8.1', '8', '7'],
  macos: ['15', '14', '13', '12', '11', '10.15'],
  linux: ['']
}

const SCREEN_PRESETS = [
  '1920x1080',
  '1366x768',
  '1536x864',
  '1440x900',
  '1600x900',
  '1280x720',
  '1280x800',
  '1280x1024',
  '1024x768',
  '1360x768',
  '1280x768',
  '1152x864',
  '1400x1050',
  '1680x1050',
  '1600x1200',
  '1920x1200',
  '1920x1440',
  '2048x1152',
  '2560x1080',
  '2560x1440',
  '2560x1600',
  '3440x1440',
  '3840x2160'
]

const WEBGL_PAIRS: { vendor: string; renderer: string }[] = [
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1650 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1060 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
  { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
  { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
  { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)' },
  { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon RX 580 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
  { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon RX 6600 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
  { vendor: 'Google Inc. (AMD)', renderer: 'ANGLE (AMD, AMD Radeon(TM) Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)' }
]
const WEBGL_VENDORS = [...new Set(WEBGL_PAIRS.map((p) => p.vendor))]
const WEBGL_RENDERERS = WEBGL_PAIRS.map((p) => p.renderer)

function genMac(): string {
  return [...Array(6)]
    .map(() => Math.floor(Math.random() * 256).toString(16).padStart(2, '0'))
    .join(':')
    .toUpperCase()
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

/** Секция-карточка с заголовком. */
function Section({ title, children }: { title: string; children: ReactNode }): JSX.Element {
  return (
    <Card className="p-5">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-indigo-300">{title}</h3>
      <div className="grid grid-cols-2 gap-x-6 gap-y-4">{children}</div>
    </Card>
  )
}

/** Строка «режим (Segmented) + значение (+ опц. кнопка генерации)». */
function ModeRow<M extends string>({
  label,
  mode,
  modes,
  onMode,
  children,
  onGenerate,
  locked,
  lockedNote
}: {
  label: string
  mode: M
  modes: { value: M; label: string }[]
  onMode: (m: M) => void
  children?: ReactNode
  onGenerate?: () => void
  locked?: boolean
  lockedNote?: string
}): JSX.Element {
  return (
    <div className="col-span-2 grid grid-cols-2 items-start gap-6 border-b border-slate-800/60 pb-4 last:border-0">
      <div>
        <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
          {label}
          {onGenerate && !locked && (
            <button
              type="button"
              onClick={onGenerate}
              title="Сгенерировать"
              className="rounded-md border border-slate-700 px-1.5 py-0.5 text-xs text-slate-400 hover:bg-slate-800 hover:text-indigo-300"
            >
              ↻
            </button>
          )}
        </div>
        <div className="mt-2">
          {locked ? (
            <span className="text-xs text-amber-300/80">{lockedNote}</span>
          ) : (
            <Segmented value={mode} options={modes} onChange={onMode} />
          )}
        </div>
      </div>
      <div className="pt-1">{locked ? null : children}</div>
    </div>
  )
}

export function BaseSettingsPage(): JSX.Element {
  const { config, save } = useConfig()
  const toast = useToast()
  const [s, setS] = useState<BaseProfileSettings | null>(null)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [org, setOrg] = useState<Organization | null>(null)

  useEffect(() => {
    if (config) setS(config.baseSettings)
  }, [config])

  useEffect(() => {
    window.api
      .getOrganization()
      .then(setOrg)
      .catch(() => setOrg({ folders: [], statuses: [] }))
  }, [])

  if (!s) return <div className="p-6 text-slate-500">Загрузка настроек…</div>

  const set = <K extends keyof BaseProfileSettings>(
    key: K,
    patch: Partial<BaseProfileSettings[K]> | BaseProfileSettings[K]
  ): void => {
    setS((prev) => {
      if (!prev) return prev
      const cur = prev[key]
      const next =
        typeof cur === 'object' && cur !== null && !Array.isArray(cur)
          ? { ...(cur as object), ...(patch as object) }
          : (patch as BaseProfileSettings[K])
      return { ...prev, [key]: next }
    })
    setDirty(true)
  }

  const onSave = async (): Promise<void> => {
    if (!s) return
    setSaving(true)
    try {
      await save({ baseSettings: s })
      setDirty(false)
      toast('success', 'Базовые настройки сохранены')
    } catch (e) {
      toast('error', (e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const num = (v: string): number | undefined => (v === '' ? undefined : Number(v))

  // ↻ генераторы
  const genUa = async (): Promise<void> => {
    const row = await window.api.csvSample()
    if (!row) return toast('error', 'CSV не подключён (Настройки)')
    set('useragent', { mode: 'manual', value: row.user_agent })
  }
  const genDevice = async (): Promise<void> => {
    const row = await window.api.csvSample()
    if (!row) return toast('error', 'CSV не подключён (Настройки)')
    set('deviceName', { mode: 'manual', value: row.device_name })
  }
  const genMacBtn = (): void => set('macAddress', { mode: 'manual', value: genMac() })
  const genScreen = (): void => set('screen', { mode: 'manual', resolution: pick(SCREEN_PRESETS) })
  const genWebgl = (): void => {
    const p = pick(WEBGL_PAIRS)
    set('webglInfo', { mode: 'manual', vendor: p.vendor, renderer: p.renderer })
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/30 px-6 py-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Базовые настройки профиля</h2>
          <p className="text-xs text-slate-500">
            Зеркало настроек Dolphin (в том же порядке). Применяются к каждому клону.
          </p>
        </div>
        <Button variant="primary" onClick={onSave} loading={saving} disabled={!dirty}>
          Сохранить
        </Button>
      </div>

      <div className="flex-1 space-y-5 overflow-auto px-6 py-5">
        {/* ── Рандомизация из CSV (отдельно на каждый параметр) ── */}
        <Card className="border-indigo-500/30 bg-indigo-500/5 p-5">
          <div className="mb-3 text-sm font-semibold text-slate-100">Рандомизация из CSV</div>
          <p className="mb-4 text-xs text-slate-400">
            Отдельный флаг на каждый параметр. Включённый параметр берётся из CSV (без повторов),
            а его ручной выбор ниже блокируется. Файл и статус пула — в «Настройки».
          </p>
          <div className="grid grid-cols-3 gap-4">
            <Toggle
              checked={s.randomizeUa}
              onChange={(v) => set('randomizeUa', v as never)}
              label="User-Agent"
            />
            <Toggle
              checked={s.randomizeMac}
              onChange={(v) => set('randomizeMac', v as never)}
              label="MAC-адрес"
            />
            <Toggle
              checked={s.randomizeDevice}
              onChange={(v) => set('randomizeDevice', v as never)}
              label="Device Name"
            />
          </div>
        </Card>

        {/* ── Организация ── */}
        <Section title="Организация">
          <Field label="Папка" className="col-span-1">
            <Select
              value={s.folderId ?? ''}
              onChange={(e) => set('folderId', e.target.value === '' ? null : Number(e.target.value))}
            >
              <option value="">— не задавать —</option>
              {org?.folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Статус" className="col-span-1">
            <Select
              value={s.statusId ?? ''}
              onChange={(e) => set('statusId', e.target.value === '' ? null : Number(e.target.value))}
            >
              <option value="">— не задавать —</option>
              {org?.statuses.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name}
                </option>
              ))}
            </Select>
          </Field>
        </Section>

        {/* ── Операционная система ── */}
        <Section title="Операционная система">
          <Field label="Platform / OS" className="col-span-1">
            <Select
              value={s.platform}
              onChange={(e) => {
                const p = e.target.value as Platform
                set('platform', p)
                set('osVersion', OS_VERSIONS[p][0])
              }}
            >
              <option value="windows">Windows</option>
              <option value="macos">macOS</option>
              <option value="linux">Linux</option>
            </Select>
          </Field>
          <Field label="Версия ОС" className="col-span-1">
            <Select value={s.osVersion} onChange={(e) => set('osVersion', e.target.value)}>
              {OS_VERSIONS[s.platform].map((v) => (
                <option key={v} value={v}>
                  {v === '' ? '—' : v}
                </option>
              ))}
            </Select>
          </Field>
        </Section>

        {/* ── User-Agent ── */}
        <Section title="User-Agent">
          <ModeRow
            label="User-Agent"
            mode={s.useragent.mode}
            modes={[
              { value: 'auto', label: 'Auto' },
              { value: 'manual', label: 'Manual' }
            ]}
            onMode={(m) => set('useragent', { mode: m })}
            onGenerate={genUa}
            locked={s.randomizeUa}
            lockedNote="Берётся из CSV (рандомизация включена)"
          >
            {s.useragent.mode === 'manual' && (
              <Input
                placeholder="Mozilla/5.0 …"
                value={s.useragent.value ?? ''}
                onChange={(e) => set('useragent', { value: e.target.value })}
              />
            )}
          </ModeRow>
        </Section>

        {/* ── Отпечатки (порядок Dolphin: WebRTC → Canvas → WebGL → WebGL Info → WebGPU → Client Rects) ── */}
        <Section title="Отпечатки (fingerprint)">
          <ModeRow
            label="WebRTC"
            mode={s.webrtc.mode}
            modes={[
              { value: 'altered', label: 'Altered' },
              { value: 'real', label: 'Real' },
              { value: 'manual', label: 'Manual' },
              { value: 'udpDisabled', label: 'Без UDP' }
            ]}
            onMode={(m) => set('webrtc', { mode: m })}
          >
            {s.webrtc.mode === 'manual' && (
              <Input
                placeholder="Публичный IP"
                value={s.webrtc.ipAddress ?? ''}
                onChange={(e) => set('webrtc', { ipAddress: e.target.value })}
              />
            )}
          </ModeRow>

          <ModeRow
            label="Canvas"
            mode={s.canvas.mode}
            modes={[
              { value: 'noise', label: 'Noise' },
              { value: 'real', label: 'Real' },
              { value: 'off', label: 'Off' }
            ]}
            onMode={(m) => set('canvas', { mode: m })}
          />

          <ModeRow
            label="WebGL Image"
            mode={s.webgl.mode}
            modes={[
              { value: 'noise', label: 'Noise' },
              { value: 'real', label: 'Real' },
              { value: 'off', label: 'Off' }
            ]}
            onMode={(m) => set('webgl', { mode: m })}
          />

          <ModeRow
            label="WebGL Info"
            mode={s.webglInfo.mode}
            modes={[
              { value: 'manual', label: 'Manual' },
              { value: 'real', label: 'Real' }
            ]}
            onMode={(m) => set('webglInfo', { mode: m })}
            onGenerate={genWebgl}
          >
            {s.webglInfo.mode === 'manual' && (
              <div className="grid grid-cols-1 gap-2">
                <Combo
                  options={WEBGL_VENDORS}
                  placeholder="Unmasked vendor"
                  value={s.webglInfo.vendor ?? ''}
                  onChange={(v) => set('webglInfo', { vendor: v })}
                />
                <Combo
                  options={WEBGL_RENDERERS}
                  placeholder="Unmasked renderer"
                  value={s.webglInfo.renderer ?? ''}
                  onChange={(v) => set('webglInfo', { renderer: v })}
                />
              </div>
            )}
          </ModeRow>

          <ModeRow
            label="WebGPU"
            mode={s.webgpu.mode}
            modes={[
              { value: 'manual', label: 'Based on WebGL' },
              { value: 'real', label: 'Real' },
              { value: 'off', label: 'Off' }
            ]}
            onMode={(m) => set('webgpu', { mode: m })}
          />

          <ModeRow
            label="Client Rects"
            mode={s.clientRect.mode}
            modes={[
              { value: 'noise', label: 'Noise' },
              { value: 'real', label: 'Real' },
              { value: 'off', label: 'Off' }
            ]}
            onMode={(m) => set('clientRect', { mode: m })}
          />

          <ModeRow
            label="Audio (AudioContext)"
            mode={s.audio.mode}
            modes={[
              { value: 'noise', label: 'Noise' },
              { value: 'real', label: 'Real' },
              { value: 'off', label: 'Off' }
            ]}
            onMode={(m) => set('audio', { mode: m })}
          />
        </Section>

        {/* ── Локаль и геолокация ── */}
        <Section title="Локаль и геолокация">
          <ModeRow
            label="Timezone"
            mode={s.timezone.mode}
            modes={[
              { value: 'auto', label: 'Auto (по IP)' },
              { value: 'manual', label: 'Manual' }
            ]}
            onMode={(m) => set('timezone', { mode: m })}
          >
            {s.timezone.mode === 'manual' && (
              <Combo
                options={TIMEZONES}
                placeholder="Europe/Moscow"
                value={s.timezone.value ?? ''}
                onChange={(v) => set('timezone', { value: v })}
              />
            )}
          </ModeRow>

          <ModeRow
            label="Language"
            mode={s.locale.mode}
            modes={[
              { value: 'auto', label: 'Auto (по IP)' },
              { value: 'manual', label: 'Manual' }
            ]}
            onMode={(m) => set('locale', { mode: m })}
          >
            {s.locale.mode === 'manual' && (
              <Combo
                options={LOCALES}
                placeholder="ru-RU,ru;q=0.9,en-US;q=0.8"
                value={s.locale.value ?? ''}
                onChange={(v) => set('locale', { value: v })}
              />
            )}
          </ModeRow>

          <ModeRow
            label="Geolocation"
            mode={s.geolocation.mode}
            modes={[
              { value: 'auto', label: 'Auto (по IP)' },
              { value: 'manual', label: 'Manual' }
            ]}
            onMode={(m) => set('geolocation', { mode: m })}
          >
            {s.geolocation.mode === 'manual' && (
              <div className="grid grid-cols-3 gap-2">
                <Input
                  placeholder="lat"
                  value={s.geolocation.latitude ?? ''}
                  onChange={(e) => set('geolocation', { latitude: num(e.target.value) })}
                />
                <Input
                  placeholder="lng"
                  value={s.geolocation.longitude ?? ''}
                  onChange={(e) => set('geolocation', { longitude: num(e.target.value) })}
                />
                <Input
                  placeholder="accuracy"
                  value={s.geolocation.accuracy ?? ''}
                  onChange={(e) => set('geolocation', { accuracy: num(e.target.value) })}
                />
              </div>
            )}
          </ModeRow>
        </Section>

        {/* ── Оборудование ── */}
        <Section title="Оборудование">
          <ModeRow
            label="CPU (ядра)"
            mode={s.cpu.mode}
            modes={[
              { value: 'real', label: 'Real' },
              { value: 'manual', label: 'Manual' }
            ]}
            onMode={(m) => set('cpu', { mode: m })}
          >
            {s.cpu.mode === 'manual' && (
              <Select value={s.cpu.value ?? 4} onChange={(e) => set('cpu', { value: Number(e.target.value) })}>
                {[2, 4, 6, 8, 12, 16].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </Select>
            )}
          </ModeRow>

          <ModeRow
            label="Memory / RAM (ГБ)"
            mode={s.memory.mode}
            modes={[
              { value: 'real', label: 'Real' },
              { value: 'manual', label: 'Manual' }
            ]}
            onMode={(m) => set('memory', { mode: m })}
          >
            {s.memory.mode === 'manual' && (
              <Select value={s.memory.value ?? 8} onChange={(e) => set('memory', { value: Number(e.target.value) })}>
                {[2, 4, 8, 16, 32].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </Select>
            )}
          </ModeRow>

          <ModeRow
            label="Screen (разрешение)"
            mode={s.screen.mode}
            modes={[
              { value: 'real', label: 'Real' },
              { value: 'manual', label: 'Manual' }
            ]}
            onMode={(m) => set('screen', { mode: m })}
            onGenerate={genScreen}
          >
            {s.screen.mode === 'manual' && (
              <Combo
                options={SCREEN_PRESETS}
                placeholder="1920x1080"
                value={s.screen.resolution ?? ''}
                onChange={(v) => set('screen', { resolution: v })}
              />
            )}
          </ModeRow>

          <ModeRow
            label="Media Devices"
            mode={s.mediaDevices.mode}
            modes={[
              { value: 'real', label: 'Real' },
              { value: 'manual', label: 'Manual' }
            ]}
            onMode={(m) => set('mediaDevices', { mode: m })}
          >
            {s.mediaDevices.mode === 'manual' && (
              <div className="grid grid-cols-3 gap-2">
                <Input
                  placeholder="Микрофоны"
                  value={s.mediaDevices.audioInputs ?? ''}
                  onChange={(e) => set('mediaDevices', { audioInputs: num(e.target.value) })}
                />
                <Input
                  placeholder="Динамики"
                  value={s.mediaDevices.audioOutputs ?? ''}
                  onChange={(e) => set('mediaDevices', { audioOutputs: num(e.target.value) })}
                />
                <Input
                  placeholder="Камеры"
                  value={s.mediaDevices.videoInputs ?? ''}
                  onChange={(e) => set('mediaDevices', { videoInputs: num(e.target.value) })}
                />
              </div>
            )}
          </ModeRow>
        </Section>

        {/* ── Устройство ── */}
        <Section title="Устройство">
          <ModeRow
            label="MAC-адрес"
            mode={s.macAddress.mode}
            modes={[
              { value: 'auto', label: 'Auto' },
              { value: 'manual', label: 'Manual' },
              { value: 'off', label: 'Off' }
            ]}
            onMode={(m) => set('macAddress', { mode: m })}
            onGenerate={genMacBtn}
            locked={s.randomizeMac}
            lockedNote="Берётся из CSV (рандомизация включена)"
          >
            {s.macAddress.mode === 'manual' && (
              <Input
                placeholder="00:1A:2B:3C:4D:5E"
                value={s.macAddress.value ?? ''}
                onChange={(e) => set('macAddress', { value: e.target.value })}
              />
            )}
          </ModeRow>

          <ModeRow
            label="Device Name"
            mode={s.deviceName.mode}
            modes={[
              { value: 'auto', label: 'Auto' },
              { value: 'manual', label: 'Manual' },
              { value: 'off', label: 'Off' }
            ]}
            onMode={(m) => set('deviceName', { mode: m })}
            onGenerate={genDevice}
            locked={s.randomizeDevice}
            lockedNote="Берётся из CSV (рандомизация включена)"
          >
            {s.deviceName.mode === 'manual' && (
              <Input
                placeholder="DESKTOP-XXXX"
                value={s.deviceName.value ?? ''}
                onChange={(e) => set('deviceName', { value: e.target.value })}
              />
            )}
          </ModeRow>

          <ModeRow
            label="Fonts"
            mode={s.fonts.mode}
            modes={[
              { value: 'real', label: 'Real (auto)' },
              { value: 'manual', label: 'Manual' }
            ]}
            onMode={(m) => set('fonts', { mode: m })}
          >
            {s.fonts.mode === 'manual' && (
              <Input
                placeholder="Arial, Verdana, Tahoma (через запятую)"
                value={(s.fonts.value ?? []).join(', ')}
                onChange={(e) =>
                  set('fonts', {
                    value: e.target.value
                      .split(',')
                      .map((x) => x.trim())
                      .filter(Boolean)
                  })
                }
              />
            )}
          </ModeRow>
        </Section>

        {/* ── Сеть и прочее ── */}
        <Section title="Сеть и прочее">
          <ModeRow
            label="Ports"
            mode={s.ports.mode}
            modes={[
              { value: 'protect', label: 'Protect' },
              { value: 'real', label: 'Real' }
            ]}
            onMode={(m) => set('ports', { mode: m })}
          >
            {s.ports.mode === 'protect' && (
              <Input
                placeholder="Blacklist портов: 3389, 5900"
                value={(s.ports.blacklist ?? []).join(', ')}
                onChange={(e) =>
                  set('ports', {
                    blacklist: e.target.value
                      .split(',')
                      .map((x) => parseInt(x.trim(), 10))
                      .filter((n) => !Number.isNaN(n))
                  })
                }
              />
            )}
          </ModeRow>

          <div className="col-span-2 flex items-center justify-between border-b border-slate-800/60 pb-4">
            <div className="text-sm font-medium text-slate-200">Do Not Track</div>
            <Toggle checked={s.doNotTrack} onChange={(v) => set('doNotTrack', v as never)} />
          </div>

          <Field label="Аргументы запуска" className="col-span-2">
            <Input
              placeholder="--disable-gpu --lang=ru (через пробел)"
              value={s.args.join(' ')}
              onChange={(e) => set('args', e.target.value.split(/\s+/).filter(Boolean) as never)}
            />
          </Field>
        </Section>

        {/* ── Флаги ── */}
        <Section title="Флаги">
          <div className="col-span-1">
            <Toggle
              checked={s.hideBrowserName}
              onChange={(v) => set('hideBrowserName', v as never)}
              label="Скрыть название в браузере"
            />
          </div>
          <div className="col-span-1">
            <Toggle
              checked={s.maskVideoStream}
              onChange={(v) => set('maskVideoStream', v as never)}
              label="Подмена видеопотока"
            />
          </div>
          <div className="col-span-1">
            <Toggle
              checked={s.maskCookies}
              onChange={(v) => set('maskCookies', v as never)}
              label="Подмена куки"
            />
          </div>
          <div className="col-span-1">
            <Toggle
              checked={s.maskBrowserProfileNameIcon}
              onChange={(v) => set('maskBrowserProfileNameIcon', v as never)}
              label="Подменять имя и значок БП"
            />
          </div>
        </Section>

        <p className="pb-4 text-center text-[11px] text-slate-600">
          Порядок и режимы полей повторяют настройки профиля DolphinAnty.
        </p>
      </div>
    </div>
  )
}
