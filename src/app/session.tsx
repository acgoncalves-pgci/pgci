import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { AppUser, Context } from '../domain/model';
import { api } from '../services/api';

export type AppearancePalette = {
    accent: string;
    sidebarColor: string;
    headerColor: string;
    backgroundColor: string;
};
export type AppearanceSettings = AppearancePalette & {
    darkAccent: string;
    darkSidebarColor: string;
    darkHeaderColor: string;
    darkBackgroundColor: string;
    font: 'inter' | 'roboto' | 'system';
    zoom: number;
    sidebar: 'compact' | 'expanded';
};

const APPEARANCE_KEY = 'fluxo-publico:appearance';
export const lightAppearanceColors: AppearancePalette = { accent: '#17628b', sidebarColor: '#dce8ee', headerColor: '#dce8ee', backgroundColor: '#ffffff' };
export const darkAppearanceColors: AppearancePalette = { accent: '#2a95c5', sidebarColor: '#0f2935', headerColor: '#11202b', backgroundColor: '#020617' };
export const defaultAppearance: AppearanceSettings = {
    ...lightAppearanceColors,
    darkAccent: darkAppearanceColors.accent,
    darkSidebarColor: darkAppearanceColors.sidebarColor,
    darkHeaderColor: darkAppearanceColors.headerColor,
    darkBackgroundColor: darkAppearanceColors.backgroundColor,
    font: 'inter',
    zoom: 100,
    sidebar: 'expanded',
};
const fontStacks: Record<AppearanceSettings['font'], string> = {
    inter: "'Inter', ui-sans-serif, system-ui, sans-serif",
    roboto: "'Roboto', ui-sans-serif, system-ui, sans-serif",
    system: 'ui-sans-serif, system-ui, sans-serif',
};
const validColor = (value: unknown, fallback: string) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : fallback;
const contrastColor = (hex: string) => {
    const value = hex.replace('#', '');
    const [red, green, blue] = [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16) / 255);
    const luminance = .2126 * red + .7152 * green + .0722 * blue;
    return luminance > .58 ? '#0f172a' : '#f8fafc';
};
const readAppearance = (): AppearanceSettings => {
    try {
        const saved = JSON.parse(localStorage.getItem(APPEARANCE_KEY) ?? '{}') as Partial<AppearanceSettings>;
        const hasDarkPalette = [saved.darkAccent, saved.darkSidebarColor, saved.darkHeaderColor, saved.darkBackgroundColor].every((color) => typeof color === 'string');
        const legacyUsesDarkPreset = !hasDarkPalette && (Object.keys(darkAppearanceColors) as Array<keyof AppearancePalette>).every((key) => saved[key]?.toLowerCase() === darkAppearanceColors[key]);
        return {
            ...defaultAppearance,
            ...saved,
            accent: validColor(legacyUsesDarkPreset ? undefined : saved.accent, defaultAppearance.accent),
            sidebarColor: validColor(legacyUsesDarkPreset ? undefined : saved.sidebarColor, defaultAppearance.sidebarColor),
            headerColor: validColor(legacyUsesDarkPreset ? undefined : saved.headerColor, defaultAppearance.headerColor),
            backgroundColor: validColor(legacyUsesDarkPreset ? undefined : saved.backgroundColor, defaultAppearance.backgroundColor),
            darkAccent: validColor(saved.darkAccent, defaultAppearance.darkAccent),
            darkSidebarColor: validColor(saved.darkSidebarColor, defaultAppearance.darkSidebarColor),
            darkHeaderColor: validColor(saved.darkHeaderColor, defaultAppearance.darkHeaderColor),
            darkBackgroundColor: validColor(saved.darkBackgroundColor, defaultAppearance.darkBackgroundColor),
            zoom: Math.min(120, Math.max(80, Number(saved.zoom) || defaultAppearance.zoom)),
        };
    } catch {
        return defaultAppearance;
    }
};
interface SessionValue extends Context {
    users: AppUser[];
    user?: AppUser;
    setUserId: (id: string) => void;
    setActiveUnitId: (id: string) => void;
    scopeUnitId: string;
    setScopeUnitId: (id: string) => void;
    theme: 'light' | 'dark';
    setTheme: (theme: 'light' | 'dark') => void;
    toggleTheme: () => void;
    appearance: AppearanceSettings;
    setAppearance: (settings: AppearanceSettings) => void;
}
const Session = createContext<SessionValue | null>(null);
export const SessionProvider = ({ children }: { children: ReactNode }) => {
    const [users, setUsers] = useState<AppUser[]>([]);
    const [userId, setUserIdState] = useState(() => localStorage.getItem('fluxo-publico:user') ?? 'usr-clara');
    const [activeUnitId, setActiveUnitId] = useState(() => localStorage.getItem('fluxo-publico:unit') ?? 'u-prot');
    const [scopeUnitId, setScopeUnitId] = useState(() => localStorage.getItem('fluxo-publico:scope-unit') ?? 'ALL');
    const [theme, setTheme] = useState<'light' | 'dark'>(() => localStorage.getItem('fluxo-publico:theme') as 'light' | 'dark' ?? 'light');
    const [appearance, setAppearance] = useState<AppearanceSettings>(readAppearance);
    useEffect(() => { const refresh = () => { api.listData().then((db) => setUsers(db.users.filter((u) => u.active))).catch(() => setUsers([])); }; refresh(); window.addEventListener('fluxo-publico:changed', refresh); return () => window.removeEventListener('fluxo-publico:changed', refresh); }, []);
    const setUserId = useCallback((id: string) => { setUserIdState(id); const selected = users.find((u) => u.id === id); if (selected) { setActiveUnitId(selected.unitId); setScopeUnitId('ALL'); } }, [users]);
    useEffect(() => { localStorage.setItem('fluxo-publico:user', userId); }, [userId]);
    useEffect(() => { localStorage.setItem('fluxo-publico:unit', activeUnitId); }, [activeUnitId]);
    useEffect(() => { localStorage.setItem('fluxo-publico:scope-unit', scopeUnitId); }, [scopeUnitId]);
    useEffect(() => { const root = document.documentElement; localStorage.setItem('fluxo-publico:theme', theme); root.dataset.theme = theme; root.style.colorScheme = theme; root.classList.remove('dark', 'light'); root.classList.add(theme); }, [theme]);
    useEffect(() => {
        const root = document.documentElement;
        const colors: AppearancePalette = theme === 'dark'
            ? { accent: appearance.darkAccent, sidebarColor: appearance.darkSidebarColor, headerColor: appearance.darkHeaderColor, backgroundColor: appearance.darkBackgroundColor }
            : appearance;
        localStorage.setItem(APPEARANCE_KEY, JSON.stringify(appearance));
        root.style.setProperty('--ui-accent', colors.accent);
        root.style.setProperty('--ui-sidebar-bg', colors.sidebarColor);
        root.style.setProperty('--ui-header-bg', colors.headerColor);
        root.style.setProperty('--ui-page-bg', colors.backgroundColor);
        root.style.setProperty('--ui-sidebar-fg', contrastColor(colors.sidebarColor));
        root.style.setProperty('--ui-header-fg', contrastColor(colors.headerColor));
        root.style.setProperty('--ui-page-fg', contrastColor(colors.backgroundColor));
        root.style.setProperty('--ui-font', fontStacks[appearance.font]);
        root.style.setProperty('--ui-zoom', String(appearance.zoom / 100));
    }, [appearance, theme]);
    const toggleTheme = useCallback(() => {
        setTheme((current) => current === 'light' ? 'dark' : 'light');
    }, []);
    const user = users.find((u) => u.id === userId);
    const value = useMemo(() => ({ userId, activeUnitId, scopeUnitId, users, user, setUserId, setActiveUnitId, setScopeUnitId, theme, setTheme, toggleTheme, appearance, setAppearance }), [userId, activeUnitId, scopeUnitId, user, users, theme, setUserId, toggleTheme, appearance]);
    return <Session.Provider value={value}>{children}</Session.Provider>;
};
export const useSession = () => { const value = useContext(Session); if (!value) throw new Error('Sessão indisponível'); return value; };