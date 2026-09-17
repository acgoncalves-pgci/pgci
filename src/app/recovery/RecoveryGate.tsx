import { useState } from 'react';
import type { ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ErrorBox } from '../../components/ui/Feedback';
import { api } from '../../services/api';
import { resetDb } from '../../storage/database';
export function RecoveryGate({ children }: {
    children: ReactNode;
}) {
    const queryClient = useQueryClient();
    const { error } = useQuery({ queryKey: ['storage-integrity'], queryFn: api.listData, retry: false });
    const [recovering, setRecovering] = useState(false);
    const [recovered, setRecovered] = useState(false);
    const [recoveryError, setRecoveryError] = useState<unknown>();
    const restore = async () => { setRecovering(true); setRecoveryError(undefined); try {
        await resetDb();
        queryClient.clear();
        window.dispatchEvent(new Event('fluxo-publico:changed'));
        await queryClient.fetchQuery({ queryKey: ['storage-integrity'], queryFn: api.listData });
        setRecovered(true);
    }
    catch (reason) {
        setRecoveryError(reason);
    }
    finally {
        setRecovering(false);
    } };
    if (!error || recovered)
        return <>{children}</>;
    return <main className="grid min-h-screen place-items-center bg-slate-100 p-5 dark:bg-slate-950"><section className="panel w-full max-w-xl p-7"><span className="grid h-11 w-11 place-items-center rounded-full bg-amber-100 text-xl">!</span><h1 className="mt-5 text-2xl font-bold">Recuperação necessária</h1><p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">Os dados locais desta demonstração estão incompatíveis ou corrompidos. Para continuar, restaure a base de demonstração. Esta ação substitui somente os dados deste navegador.</p>{Boolean(recoveryError) && <div className="mt-4"><ErrorBox error={recoveryError}/></div>}<div className="mt-6 flex justify-end"><button className="btn-primary" disabled={recovering} onClick={() => void restore()}>{recovering ? 'Restaurando…' : 'Restaurar demonstração'}</button></div></section></main>;
}
