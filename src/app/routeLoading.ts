import { flushSync } from 'react-dom';
import type { NavigateFunction, To } from 'react-router-dom';
export const ROUTE_LOADING_EVENT = 'fluxo-publico:route-loading';
export function navigateWithLoading(navigate: NavigateFunction, to: To) {
    flushSync(() => window.dispatchEvent(new Event(ROUTE_LOADING_EVENT)));
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => navigate(to)));
}
