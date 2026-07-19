import { useState } from 'react'
import { ConfigProvider } from './lib/useConfig'
import { ToastProvider } from './components/toast'
import { ProfilesPage } from './pages/ProfilesPage'
import { BaseSettingsPage } from './pages/BaseSettingsPage'
import { SettingsPage } from './pages/SettingsPage'
import { AdminPage } from './pages/AdminPage'
import { cn } from './lib/cn'

type Tab = 'profiles' | 'base' | 'settings' | 'admin'

const NAV: { id: Tab; label: string; icon: string }[] = [
  { id: 'profiles', label: 'Профили', icon: '▤' },
  { id: 'base', label: 'Базовые настройки', icon: '⚙' },
  { id: 'settings', label: 'Настройки', icon: '⛭' },
  { id: 'admin', label: 'Отладка', icon: '🛠' }
]

export default function App(): JSX.Element {
  const [tab, setTab] = useState<Tab>('profiles')

  return (
    <ConfigProvider>
      <ToastProvider>
        <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-200">
          {/* Sidebar */}
          <aside className="flex w-60 shrink-0 flex-col border-r border-slate-800 bg-slate-900/40">
            <div className="flex items-center gap-2.5 px-5 py-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-lg font-bold text-white shadow-lg shadow-indigo-900/40">
                🐬
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-100">DolphinForge</div>
                <div className="text-[11px] text-slate-500">Пересоздание профилей</div>
              </div>
            </div>

            <nav className="flex-1 space-y-1 px-3 py-2">
              {NAV.map((n) => (
                <button
                  key={n.id}
                  onClick={() => setTab(n.id)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    tab === n.id
                      ? 'bg-indigo-500/15 text-indigo-200'
                      : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                  )}
                >
                  <span className="w-4 text-center">{n.icon}</span>
                  {n.label}
                </button>
              ))}
            </nav>

            <div className="px-5 py-4 text-[11px] leading-relaxed text-slate-600">
              v0.1.0-alpha.2 - DolphinForge by F4rm4ceft
            </div>
          </aside>

          {/* Content */}
          <main className="flex-1 overflow-hidden">
            {tab === 'profiles' && <ProfilesPage />}
            {tab === 'base' && <BaseSettingsPage />}
            {tab === 'settings' && <SettingsPage />}
            {tab === 'admin' && <AdminPage />}
          </main>
        </div>
      </ToastProvider>
    </ConfigProvider>
  )
}
