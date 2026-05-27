import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Radio, Trash2 } from 'lucide-react';
import apiClient from '../api/apiClient.js';
import { useAuth } from '../hooks/useAuth.jsx';

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'medium' });
}

export default function SiaMessages() {
  const { user } = useAuth();
  const isManager = user?.type === 'manager';
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [confirmClear, setConfirmClear] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['sia-messages', page],
    queryFn: async () => (await apiClient.get(`/sia-messages?page=${page}`)).data,
  });

  const clearMutation = useMutation({
    mutationFn: () => apiClient.delete('/sia-messages'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sia-messages'] });
      setConfirmClear(false);
      setPage(1);
    },
  });

  const messages = data?.data || [];
  const total = data?.total || 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Radio size={22} className="text-blue-500" />
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Messaggi SIA</h1>
          <span className="text-sm text-slate-400 dark:text-slate-500">({total} totali)</span>
        </div>

        {/* Svuota log — solo manager */}
        {isManager && (
          confirmClear ? (
            <div className="flex gap-2">
              <button
                onClick={() => clearMutation.mutate()}
                disabled={clearMutation.isPending}
                className="px-3 py-1.5 text-xs bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {clearMutation.isPending ? 'Eliminazione...' : 'Conferma svuota'}
              </button>
              <button
                onClick={() => setConfirmClear(false)}
                className="px-3 py-1.5 text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                Annulla
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmClear(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs
                         bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400
                         border border-red-200 dark:border-red-700 rounded-lg
                         hover:bg-red-100 dark:hover:bg-red-900/30 font-medium transition-colors"
            >
              <Trash2 size={13} />
              Svuota log
            </button>
          )
        )}
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3 text-sm text-blue-800 dark:text-blue-300">
        Log completo di tutti i messaggi SIA IP DC09 ricevuti sulla porta TCP 23683.
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Data</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Account</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Tipo</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase">ACK</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Messaggio raw</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                {messages.map((msg) => (
                  <tr key={msg.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 text-sm">
                    <td className="px-4 py-2.5 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {formatDate(msg.createdAt)}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-600 dark:text-slate-400">
                      {msg.customerId}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        msg.messageType === 'SIA-Alarm'
                          ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                          : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                      }`}>
                        {msg.messageType || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {msg.acked
                        ? <span className="text-emerald-500 text-xs">✓</span>
                        : <span className="text-slate-300 dark:text-slate-600 text-xs">—</span>
                      }
                    </td>
                    <td className="px-4 py-2.5 max-w-xs">
                      <code className="text-xs text-slate-500 dark:text-slate-400 break-all line-clamp-2 font-mono">
                        {msg.siaRawMessage}
                      </code>
                    </td>
                  </tr>
                ))}
                {messages.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-slate-400 dark:text-slate-500">
                      Nessun messaggio SIA registrato
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <span className="text-xs text-slate-400 dark:text-slate-500">Pagina {page} — {total} messaggi totali</span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1 text-xs bg-slate-100 dark:bg-slate-700 rounded-lg disabled:opacity-40 hover:bg-slate-200 dark:hover:bg-slate-600"
              >
                ← Prev
              </button>
              <button
                disabled={page * 100 >= total}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1 text-xs bg-slate-100 dark:bg-slate-700 rounded-lg disabled:opacity-40 hover:bg-slate-200 dark:hover:bg-slate-600"
              >
                Next →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
