import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react'
import type { AppConfig } from '@shared/types'

interface ConfigCtx {
  config: AppConfig | null
  loading: boolean
  reload: () => Promise<void>
  save: (patch: Partial<AppConfig>) => Promise<AppConfig>
}

const Ctx = createContext<ConfigCtx>({
  config: null,
  loading: true,
  reload: async () => {},
  save: async () => ({}) as AppConfig
})

export function useConfig(): ConfigCtx {
  return useContext(Ctx)
}

export function ConfigProvider({ children }: { children: ReactNode }): JSX.Element {
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      setConfig(await window.api.getConfig())
    } finally {
      setLoading(false)
    }
  }, [])

  const save = useCallback(async (patch: Partial<AppConfig>) => {
    const next = await window.api.saveConfig(patch)
    setConfig(next)
    return next
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  return <Ctx.Provider value={{ config, loading, reload, save }}>{children}</Ctx.Provider>
}
