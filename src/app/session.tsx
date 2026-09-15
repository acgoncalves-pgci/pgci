import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { AppUser, Context } from '../domain/model'
import { api } from '../services/api'

interface SessionValue extends Context { users: AppUser[]; user?: AppUser; setUserId: (id: string) => void; setActiveUnitId: (id: string) => void; theme: 'light' | 'dark'; toggleTheme: () => void }
const Session = createContext<SessionValue | null>(null)
export const SessionProvider = ({ children }: { children: ReactNode }) => {
  const [users, setUsers] = useState<AppUser[]>([]); const [userId, setUserIdState] = useState(() => localStorage.getItem('fluxo-publico:user') ?? 'usr-clara'); const [activeUnitId, setActiveUnitId] = useState(() => localStorage.getItem('fluxo-publico:unit') ?? 'u-prot'); const [theme, setTheme] = useState<'light' | 'dark'>(() => localStorage.getItem('fluxo-publico:theme') as 'light' | 'dark' ?? 'light')
  useEffect(() => { const refresh = () => { api.listData().then((db) => setUsers(db.users.filter((u) => u.active))).catch(() => setUsers([])) }; refresh(); window.addEventListener('fluxo-publico:changed', refresh); return () => window.removeEventListener('fluxo-publico:changed', refresh) }, [])
  const setUserId = useCallback((id: string) => { setUserIdState(id); const selected = users.find((u) => u.id === id); if (selected) setActiveUnitId(selected.unitId) }, [users])
  useEffect(() => { localStorage.setItem('fluxo-publico:user', userId) }, [userId]); useEffect(() => { localStorage.setItem('fluxo-publico:unit', activeUnitId) }, [activeUnitId]); useEffect(() => { const root = document.documentElement; localStorage.setItem('fluxo-publico:theme', theme); root.dataset.theme = theme; root.style.colorScheme = theme; root.classList.remove('dark', 'light'); root.classList.add(theme) }, [theme])
  const user = users.find((u) => u.id === userId); const value = useMemo(() => ({ userId, activeUnitId, users, user, setUserId, setActiveUnitId, theme, toggleTheme: () => setTheme((t) => t === 'light' ? 'dark' : 'light') }), [userId, activeUnitId, user, users, theme, setUserId])
  return <Session.Provider value={value}>{children}</Session.Provider>
}
export const useSession = () => { const value = useContext(Session); if (!value) throw new Error('Sessão indisponível'); return value }



