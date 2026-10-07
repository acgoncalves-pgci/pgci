import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { AppUser, Context } from '../domain/model';
import { api } from '../services/api';
import { demoLoginUser, demoSessionUsers } from '../lib/demoAuth';
import { readableAccentColor, readableTextColor } from '../lib/colorContrast';

export type AppearancePalette = {
    accent: string;
    sidebarColor: string;
    headerColor: string;
    backgroundColor: string;
    footerColor: string;
};
export type AppearanceSettings = AppearancePalette & {
    darkAccent: string;
    darkSidebarColor: string;
    darkHeaderColor: string;
    darkBackgroundColor: string;
    darkFooterColor: string;
    font: 'inter' | 'roboto' | 'poppins' | 'montserrat' | 'sora' | 'system';
    fontSize: 'default' | 'large' | 'very-large' | 'extra-large';
    cardRadius: 'square' | 'subtle' | 'default' | 'medium' | 'rounded' | 'pill';
    zoom: number;
    sidebar: 'compact' | 'expanded';
};

const APPEARANCE_KEY = 'fluxo-publico:appearance';
export const lightAppearanceColors: AppearancePalette = { accent: '#17628b', sidebarColor: '#dce8ee', headerColor: '#dce8ee', backgroundColor: '#ffffff', footerColor: '#303030' };
export const darkAppearanceColors: AppearancePalette = { accent: '#2a95c5', sidebarColor: '#0f2935', headerColor: '#11202b', backgroundColor: '#020617', footerColor: '#0f2935' };
export const defaultAppearance: AppearanceSettings = {
    ...lightAppearanceColors,
    darkAccent: darkAppearanceColors.accent,
    darkSidebarColor: darkAppearanceColors.sidebarColor,
    darkHeaderColor: darkAppearanceColors.headerColor,
    darkBackgroundColor: darkAppearanceColors.backgroundColor,
    darkFooterColor: darkAppearanceColors.footerColor,
    font: 'inter',
    fontSize: 'default',
    cardRadius: 'default',
    zoom: 100,
    sidebar: 'expanded',
};
const fontStacks: Record<AppearanceSettings['font'], string> = {
    inter: "'Inter', ui-sans-serif, system-ui, sans-serif",
    roboto: "'Roboto', ui-sans-serif, system-ui, sans-serif",
    poppins: "'Poppins', ui-sans-serif, system-ui, sans-serif",
    montserrat: "'Montserrat', ui-sans-serif, system-ui, sans-serif",
    sora: "'Sora', ui-sans-serif, system-ui, sans-serif",
    system: 'ui-sans-serif, system-ui, sans-serif',
};
const validColor = (value: unknown, fallback: string) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : fallback;
const readAppearance = (): AppearanceSettings => {
    try {
        const saved = JSON.parse(localStorage.getItem(APPEARANCE_KEY) ?? '{}') as Partial<AppearanceSettings>;
        const hasDarkPalette = [saved.darkAccent, saved.darkSidebarColor, saved.darkHeaderColor, saved.darkBackgroundColor].every((color) => typeof color === 'string');
        const legacyUsesDarkPreset = !hasDarkPalette && (['accent', 'sidebarColor', 'headerColor', 'backgroundColor'] as const).every((key) => saved[key]?.toLowerCase() === darkAppearanceColors[key]);
        const legacy = saved as Partial<AppearanceSettings> & { footerBackgroundColor?: string };
        return {
            ...defaultAppearance,
            ...saved,
            accent: validColor(legacyUsesDarkPreset ? undefined : saved.accent, defaultAppearance.accent),
            sidebarColor: validColor(legacyUsesDarkPreset ? undefined : saved.sidebarColor, defaultAppearance.sidebarColor),
            headerColor: validColor(legacyUsesDarkPreset ? undefined : saved.headerColor, defaultAppearance.headerColor),
            backgroundColor: validColor(legacyUsesDarkPreset ? undefined : saved.backgroundColor, defaultAppearance.backgroundColor),
            footerColor: validColor(saved.footerColor ?? legacy.footerBackgroundColor, defaultAppearance.footerColor),
            darkAccent: validColor(saved.darkAccent, defaultAppearance.darkAccent),
            darkSidebarColor: validColor(saved.darkSidebarColor, defaultAppearance.darkSidebarColor),
            darkHeaderColor: validColor(saved.darkHeaderColor, defaultAppearance.darkHeaderColor),
            darkBackgroundColor: validColor(saved.darkBackgroundColor, defaultAppearance.darkBackgroundColor),
            darkFooterColor: validColor(saved.darkFooterColor ?? legacy.footerBackgroundColor, defaultAppearance.darkFooterColor),
            font: saved.font && saved.font in fontStacks ? saved.font : defaultAppearance.font,
            fontSize: ['default', 'large', 'very-large', 'extra-large'].includes(saved.fontSize ?? '') ? saved.fontSize! : defaultAppearance.fontSize,
            cardRadius: ['square', 'subtle', 'default', 'medium', 'rounded', 'pill'].includes(saved.cardRadius ?? '') ? saved.cardRadius! : defaultAppearance.cardRadius,
            zoom: Math.min(120, Math.max(80, Number(saved.zoom) || defaultAppearance.zoom)),
        };
    } catch {
        return defaultAppearance;
    }
};
interface SessionValue extends Context {
    authenticated: boolean;
    sessionLoading: boolean;
    signIn: (email: string, password: string) => Promise<void>;
    signOut: () => void;
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
    const [userId, setUserIdState] = useState(() => localStorage.getItem('fluxo-publico:user') ?? '');
    const [sessionLoading, setSessionLoading] = useState(true);
    const [activeUnitId, setActiveUnitId] = useState(() => localStorage.getItem('fluxo-publico:unit') ?? 'u-prot');
    const [scopeUnitId, setScopeUnitId] = useState(() => localStorage.getItem('fluxo-publico:scope-unit') ?? 'ALL');
    const [theme, setTheme] = useState<'light' | 'dark'>(() => localStorage.getItem('fluxo-publico:theme') as 'light' | 'dark' ?? 'light');
    const [appearance, setAppearance] = useState<AppearanceSettings>(readAppearance);
    useEffect(() => { let active = true; const refresh = () => { api.listData().then((db) => { if (active) setUsers(demoSessionUsers(db)); }).catch(() => { if (active) setUsers([]); }).finally(() => { if (active) setSessionLoading(false); }); }; refresh(); window.addEventListener('fluxo-publico:changed', refresh); return () => { active = false; window.removeEventListener('fluxo-publico:changed', refresh); }; }, []);
    const setUserId = useCallback((id: string) => { setUserIdState(id); const selected = users.find((u) => u.id === id); if (selected) { setActiveUnitId(selected.unitId); setScopeUnitId('ALL'); } }, [users]);
    useEffect(() => { if (userId) localStorage.setItem('fluxo-publico:user', userId); else localStorage.removeItem('fluxo-publico:user'); }, [userId]);
    const signIn = useCallback(async (email: string, password: string) => {
        const db = await api.listData();
        const selected = demoLoginUser(db, email, password);
        setUsers(demoSessionUsers(db));
        setUserIdState(selected.id);
        setActiveUnitId(selected.unitId);
        setScopeUnitId('ALL');
    }, []);
    const signOut = useCallback(() => { setUserIdState(''); setScopeUnitId('ALL'); localStorage.removeItem('fluxo-publico:user'); }, []);
    useEffect(() => { localStorage.setItem('fluxo-publico:unit', activeUnitId); }, [activeUnitId]);
    useEffect(() => { localStorage.setItem('fluxo-publico:scope-unit', scopeUnitId); }, [scopeUnitId]);
    useEffect(() => { const root = document.documentElement; localStorage.setItem('fluxo-publico:theme', theme); root.dataset.theme = theme; root.style.colorScheme = theme; root.classList.remove('dark', 'light'); root.classList.add(theme); }, [theme]);
    useEffect(() => {
        const root = document.documentElement;
        const colors: AppearancePalette = theme === 'dark'
            ? { accent: appearance.darkAccent, sidebarColor: appearance.darkSidebarColor, headerColor: appearance.darkHeaderColor, backgroundColor: appearance.darkBackgroundColor, footerColor: appearance.darkFooterColor }
            : appearance;
        localStorage.setItem(APPEARANCE_KEY, JSON.stringify(appearance));
        root.style.setProperty('--ui-accent', colors.accent);
        root.style.setProperty('--ui-accent-fg', readableTextColor(colors.accent));
        root.style.setProperty('--ui-accent-text', readableAccentColor(colors.accent, colors.backgroundColor));
        root.style.setProperty('--ui-sidebar-bg', colors.sidebarColor);
        root.style.setProperty('--ui-header-bg', colors.headerColor);
        root.style.setProperty('--ui-page-bg', colors.backgroundColor);
        root.style.setProperty('--ui-sidebar-fg', readableTextColor(colors.sidebarColor));
        root.style.setProperty('--ui-header-fg', readableTextColor(colors.headerColor));
        root.style.setProperty('--ui-page-fg', readableTextColor(colors.backgroundColor));
        root.style.setProperty('--ui-footer-bg', colors.footerColor);
        root.style.setProperty('--ui-footer-fg', readableTextColor(colors.footerColor));
        root.style.setProperty('--ui-font', fontStacks[appearance.font]);
        root.style.setProperty('--ui-font-scale', String(({ default: 1, large: 1.125, 'very-large': 1.25, 'extra-large': 1.375 } as const)[appearance.fontSize]));
        root.style.setProperty('--ui-card-radius', ({ square: '0', subtle: '.375rem', default: '.75rem', medium: '1rem', rounded: '1.5rem', pill: '2rem' } as const)[appearance.cardRadius]);
        root.style.setProperty('--ui-zoom', String(appearance.zoom / 100));
    }, [appearance, theme]);
    const toggleTheme = useCallback(() => {
        setTheme((current) => current === 'light' ? 'dark' : 'light');
    }, []);
    const user = users.find((u) => u.id === userId);
    const authenticated = Boolean(user);
    const value = useMemo(() => ({ authenticated, sessionLoading, signIn, signOut, userId, activeUnitId, scopeUnitId, users, user, setUserId, setActiveUnitId, setScopeUnitId, theme, setTheme, toggleTheme, appearance, setAppearance }), [authenticated, sessionLoading, signIn, signOut, userId, activeUnitId, scopeUnitId, user, users, theme, setUserId, toggleTheme, appearance]);
    return <Session.Provider value={value}>{children}</Session.Provider>;
};
export const useSession = () => { const value = useContext(Session); if (!value) throw new Error('Sessão indisponível'); return value; };
