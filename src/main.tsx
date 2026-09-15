import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { App } from './app/App'
import { SessionProvider } from './app/session'
import { ToastProvider } from './components/ui/ToastProvider'
import './index.css'

const client = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: true } } })
window.addEventListener('storage', (event) => { if (event.key === 'fluxo-publico:database:v1') client.invalidateQueries() })
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><QueryClientProvider client={client}><ToastProvider><SessionProvider><App/></SessionProvider></ToastProvider></QueryClientProvider></React.StrictMode>)
