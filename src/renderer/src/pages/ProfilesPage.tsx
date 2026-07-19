import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ProfileFacets, ProfileFilters, ProfileListItem } from '@shared/types'
import { Button, Card, Input, Badge, Spinner } from '../components/ui'
import { MultiSelect } from '../components/MultiSelect'
import { CopyModal } from '../components/CopyModal'
import { useToast } from '../components/toast'
import { useConfig } from '../lib/useConfig'

export function ProfilesPage(): JSX.Element {
  const toast = useToast()
  const { config } = useConfig()
  const [facets, setFacets] = useState<ProfileFacets | null>(null)
  const [items, setItems] = useState<ProfileListItem[]>([])
  const [pinnedIds, setPinnedIds] = useState<number[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)

  const [query, setQuery] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [statuses, setStatuses] = useState<string[]>([])
  const [mainWebsites, setMainWebsites] = useState<string[]>([])
  const [users, setUsers] = useState<string[]>([])

  const [copyTarget, setCopyTarget] = useState<ProfileListItem | null>(null)

  const limit = 50
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  const load = useCallback(
    async (p = 1) => {
      setLoading(true)
      try {
        const filters: ProfileFilters = {
          query: query.trim() || undefined,
          tags: tags.length ? tags : undefined,
          statuses: statuses.length ? statuses.map(Number) : undefined,
          mainWebsites: mainWebsites.length ? mainWebsites : undefined,
          users: users.length ? users.map(Number) : undefined,
          page: p,
          limit
        }
        const res = await window.api.listProfiles(filters)
        setItems(res.items)
        setPinnedIds(res.pinnedIds)
        setTotal(res.total)
        setPage(res.page)
      } catch (e) {
        toast('error', (e as Error).message)
      } finally {
        setLoading(false)
      }
    },
    [query, tags, statuses, mainWebsites, users, toast]
  )

  // справочники — один раз
  useEffect(() => {
    window.api
      .getFacets()
      .then(setFacets)
      .catch((e) => toast('error', 'Справочники: ' + e.message))
  }, [toast])

  // дебаунс поиска/фильтров
  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => void load(1), 300)
    return () => clearTimeout(debounceRef.current)
  }, [load])

  const pinnedSet = useMemo(() => new Set(pinnedIds), [pinnedIds])

  const togglePin = async (id: number): Promise<void> => {
    try {
      const list = await window.api.pinProfile(id, !pinnedSet.has(id))
      setPinnedIds(list)
      // пересортировать локально: закреплённые наверх (стабильно)
      setItems((prev) => {
        const set = new Set(list)
        return [...prev].sort((a, b) => Number(set.has(b.id)) - Number(set.has(a.id)))
      })
    } catch (e) {
      toast('error', (e as Error).message)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / limit))
  const hasFilters = query || tags.length || statuses.length || mainWebsites.length || users.length

  const tokenMissing = config != null && !config.dolphin.apiToken

  return (
    <div className="flex h-full flex-col">
      {tokenMissing && (
        <div className="border-b border-amber-500/30 bg-amber-500/10 px-6 py-2.5 text-sm text-amber-200">
          API-токен Dolphin не задан — откройте «Настройки», вставьте токен и нажмите «Проверить
          токен».
        </div>
      )}

      {/* Панель фильтров */}
      <div className="border-b border-slate-800 bg-slate-900/30 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
              ⌕
            </span>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск по имени профиля…"
              className="pl-9"
            />
          </div>
          <Button variant="outline" onClick={() => void load(page)} loading={loading}>
            Обновить
          </Button>
        </div>

        <div className="mt-3 grid grid-cols-4 gap-3">
          <MultiSelect
            label="Тег"
            options={(facets?.tags ?? []).map((t) => ({ value: t, label: t }))}
            selected={tags}
            onChange={setTags}
          />
          <MultiSelect
            label="Статус"
            options={(facets?.statuses ?? []).map((s) => ({ value: String(s.id), label: s.name }))}
            selected={statuses}
            onChange={setStatuses}
          />
          <MultiSelect
            label="Main website"
            options={(facets?.mainWebsites ?? []).map((w) => ({ value: w, label: w }))}
            selected={mainWebsites}
            onChange={setMainWebsites}
          />
          <MultiSelect
            label="Пользователь"
            options={(facets?.users ?? []).map((u) => ({
              value: String(u.id),
              label: u.username ?? `#${u.id}`
            }))}
            selected={users}
            onChange={setUsers}
          />
        </div>
        {hasFilters && (
          <button
            onClick={() => {
              setQuery('')
              setTags([])
              setStatuses([])
              setMainWebsites([])
              setUsers([])
            }}
            className="mt-2 text-xs text-slate-400 hover:text-slate-200"
          >
            Сбросить все фильтры
          </button>
        )}
      </div>

      {/* Список */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {loading && items.length === 0 ? (
          <div className="flex items-center justify-center py-20 text-slate-500">
            <Spinner /> <span className="ml-2">Загрузка…</span>
          </div>
        ) : items.length === 0 ? (
          <div className="py-20 text-center text-slate-500">Профили не найдены</div>
        ) : (
          <div className="space-y-2">
            {items.map((p) => {
              const pinned = pinnedSet.has(p.id)
              return (
                <Card
                  key={p.id}
                  className="flex items-center gap-4 px-4 py-3 transition-colors hover:border-slate-700"
                >
                  <button
                    onClick={() => void togglePin(p.id)}
                    title={pinned ? 'Открепить' : 'Закрепить сверху'}
                    className={pinned ? 'text-amber-400' : 'text-slate-600 hover:text-slate-400'}
                  >
                    {pinned ? '★' : '☆'}
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium text-slate-100">{p.name}</span>
                      {p.status && (
                        <Badge color="indigo">{p.status.name}</Badge>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      {p.mainWebsite && <span>🌐 {p.mainWebsite}</span>}
                      {p.user?.username && <span>👤 {p.user.username}</span>}
                      {p.proxy?.host && <span>🔌 {p.proxy.host}</span>}
                      {p.tags.map((t) => (
                        <Badge key={t}>{t}</Badge>
                      ))}
                    </div>
                  </div>

                  <Button variant="primary" onClick={() => setCopyTarget(p)}>
                    Копировать
                  </Button>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Пагинация */}
      <div className="flex items-center justify-between border-t border-slate-800 px-6 py-3 text-sm text-slate-400">
        <span>
          Всего: {total} · стр. {page}/{totalPages}
        </span>
        <div className="flex gap-2">
          <Button variant="ghost" disabled={page <= 1 || loading} onClick={() => void load(page - 1)}>
            ← Назад
          </Button>
          <Button
            variant="ghost"
            disabled={page >= totalPages || loading}
            onClick={() => void load(page + 1)}
          >
            Вперёд →
          </Button>
        </div>
      </div>

      <CopyModal
        open={!!copyTarget}
        profile={copyTarget}
        onClose={() => setCopyTarget(null)}
        onDone={() => void load(page)}
      />
    </div>
  )
}
