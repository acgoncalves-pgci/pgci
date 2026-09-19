import { flushSync } from 'react-dom';
import type { NavigateFunction, To } from 'react-router-dom';

export const ROUTE_LOADING_EVENT = 'fluxo-publico:route-loading';
const ROUTE_EXIT_DURATION = 180;

export function navigateWithLoading(navigate: NavigateFunction, to: To) {
    flushSync(() => window.dispatchEvent(new Event(ROUTE_LOADING_EVENT)));
    window.setTimeout(() => navigate(to), ROUTE_EXIT_DURATION);
}