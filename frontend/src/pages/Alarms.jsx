import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  CheckCircle2, Search, Circle,
  AlertTriangle,
} from 'lucide-react';
import apiClient from '../api/apiClient.js';

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' });
}

const SEVERITY = {
  BA: 'text-red-600 bg-red-50 border border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
  FA: 'text-orange-600 bg-orange-50 border border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800',
  PA: 'text-red-600 bg-red-50 border border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
  HA: 'text-red-600 bg-red-50 border border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
  MA: 'text-purple-600 bg-purple-50 border border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800',
  AT: 'text-yellow-600 bg-yellow-50 border border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800',
};

/* ─── Filter definitions for alarms ─── */
const ALARM_FILTERS = [
  {
    key: 'unmanaged',
    icon: AlertTriangle,
    label: 'Da gestire',
    iconCls: 'text-red-500',
    activeCls: 'bg-red-500 text-white border-red-500',
    tooltip: 'Mostra solo allarmi non ancora gestiti',
    serverEndpoint: '/alarms/unmanaged', // use dedicated endpoint
    predicate: null, // handled server-side
  },
  {
    key: 'managed',
    icon: CheckCircle2,
    label: 'Gestiti',
    iconCls: 'text-emerald-500',
    activeCls: 'bg-emerald-500 text-white border-emerald-500',
    tooltip: 'Mostra solo allarmi già gestiti',
    predicate: (a) => !!a.managedBy,
  },
];

function AlarmRow({ alarm, onManage }) {
  const codeColor = alarm.code
    ? SEVERITY[alarm.code] || 'text-slate-600 bg-slate-100 border border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600'
    : 'text-slate-400 bg-slate-50 border border-slate-100 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700';

  return (
    <tr className={`hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors ${!alarm.managedBy ? 'bg-blue-50/20 dark:bg-blue-900/10' : ''}`}>

      {/* ── Col 1: gestito (con tooltip) ── */}
      <td className="px-4 py-3 text-center">
        {alarm.managedBy ? (
          <div className="relative inline-block group/tip">
            <CheckCircle2 size={16} className="text-emerald-500 mx-auto cursor-default" />
            <div className="
              pointer-events-none absolute left-6 top-1/2 -translate-y-1/2 z-50
              invisible opacity-0 group-hover/tip:visible group-hover/tip:opacity-100
              transition-opacity duration-150
              bg-slate-800 text-white text-xs rounded-lg px-2.5 py-1.5
              whitespace-nowrap shadow-lg
            ">
              <span className="font-medium">{alarm.managedByUser?.name || `Utente #${alarm.managedBy}`}</span>
              <span className="text-slate-400 ml-1.5">—</span>
              <span className="ml-1.5 text-slate-300">{formatDate(alarm.updatedAt)}</span>
              <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-slate-800" />
            </div>
          </div>
        ) : (
          <Circle size={16} className="text-slate-300 dark:text-slate-600 mx-auto" />
        )}
      </td>

      {/* ── Col 2: codice ── */}
      <td className="px-4 py-3">
        <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-mono font-bold ${codeColor}`}>
          {alarm.code || '—'}
        </span>
      </td>

      {/* ── Col 3: segnalazione ── */}
      <td className="px-4 py-3 max-w-[260px]">
        <p className="text-sm text-slate-700 dark:text-slate-300 leading-snug">
          {alarm.siaCode?.description || '—'}
        </p>
        {alarm.detail && (
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 leading-snug">{alarm.detail}</p>
        )}
      </td>

      {/* ── Col 4: cliente ── */}
      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-1 mb-0.5">
          <span className="font-mono text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded">
            {alarm.customerId}
          </span>
          {alarm.customer?.surveyeCode && (
            <span className="text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-700 px-1.5 py-0.5 rounded font-mono">
              {alarm.customer.surveyeCode}
            </span>
          )}
        </div>
        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
          {alarm.customer?.customer || '—'}
        </p>
        {alarm.customer?.address && (
          <p className="text-xs text-slate-400 dark:text-slate-500 truncate max-w-[200px]">
            {alarm.customer.address}
          </p>
        )}
      </td>

      {/* ── Col 5: data ── */}
      <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap hidden lg:table-cell">
        {formatDate(alarm.createdAt)}
      </td>

      {/* ── Col 6: azione ── */}
      <td className="px-4 py-3">
        {!alarm.managedBy && (
          <button
            onClick={() => onManage(alarm.id)}
            className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-500 hover:bg-emerald-600 rounded-lg transition-colors whitespace-nowrap"
          >
            Gestisci
          </button>
        )}
      </td>
    </tr>
  );
}

export default function Alarms({ mode = 'all' }) {
  const { customerId } = useParams();
  const queryClient = useQueryClient();

  const [searchParams, setSearchParams] = useSearchParams();
  const urlFilter = searchParams.get('filter') || '';

  const [search, setSearch] = useState('');
  const [year, setYear] = useState('');
  const [page, setPage] = useState(1);
  const [activeFilter, setActiveFilter] = useState(urlFilter);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 2021 }, (_, i) => currentYear - i);

  /* Toggle filter */
  const toggleFilter = (key) => {
    const next = activeFilter === key ? '' : key;
    setActiveFilter(next);
    setPage(1);
    if (next) setSearchParams({ filter: next });
    else setSearchParams({});
  };

  /* Determine query based on mode + filter */
  let queryKey, queryFn;

  if (mode === 'customer' && customerId) {
    queryKey = ['alarms', 'customer', customerId];
    queryFn = async () => (await apiClient.get(`/alarms/customer/${customerId}`)).data;
  } else if (activeFilter === 'unmanaged') {
    queryKey = ['alarms', 'unmanaged'];
    queryFn = async () => (await apiClient.get('/alarms/unmanaged')).data;
  } else {
    queryKey = ['alarms', 'all', year, page];
    queryFn = async () => {
      const params = new URLSearchParams({ page });
      if (year) params.set('year', year);
      return (await apiClient.get(`/alarms?${params}`)).data;
    };
  }

  /* SSE — real-time updates when a new alarm arrives */
  useEffect(() => {
    const es = new EventSource('/api/events', { withCredentials: true });
    es.addEventListener('alarm', () => {
      queryClient.invalidateQueries({ queryKey: ['alarms'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    });
    es.onerror = (e) => {
      if (import.meta.env.DEV) console.warn('[SSE] connection error', e);
    };
    return () => es.close();
  }, [queryClient]);

  const { data, isLoading } = useQuery({ queryKey, queryFn, refetchInterval: 30_000 });

  const isPaginated = mode === 'all' && activeFilter !== 'unmanaged';
  const rawAlarms = isPaginated ? (data?.data || []) : (data || []);
  const total     = isPaginated ? (data?.total || 0) : rawAlarms.length;

  const manageMutation = useMutation({
    mutationFn: (id) => apiClient.post(`/alarms/${id}/manage`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alarms'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });

  const manageAllMutation = useMutation({
    mutationFn: () => apiClient.post(`/alarms/customer/${customerId}/manage-all`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alarms'] }),
  });

  /* Apply client-side filter + text search */
  const filterDef = ALARM_FILTERS.find((f) => f.key === activeFilter);
  const filtered = rawAlarms.filter((a) => {
    // Client-side predicate filter (skip for 'unmanaged' — already server-filtered)
    if (filterDef?.predicate && activeFilter !== 'unmanaged') {
      if (!filterDef.predicate(a)) return false;
    }
    // Text search
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      a.code?.toLowerCase().includes(s) ||
      a.detail?.toLowerCase().includes(s) ||
      a.siaCode?.description?.toLowerCase().includes(s) ||
      a.customerId?.toLowerCase().includes(s) ||
      a.customer?.customer?.toLowerCase().includes(s) ||
      a.customer?.surveyeCode?.toLowerCase().includes(s) ||
      a.customer?.address?.toLowerCase().includes(s)
    );
  });

  const titles = {
    all:      'Allarmi',
    customer: `Allarmi — ${customerId}`,
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{titles[mode] || 'Allarmi'}</h1>
        <div className="flex items-center gap-2">
          {mode === 'customer' && customerId && (
            <button
              onClick={() => manageAllMutation.mutate()}
              disabled={manageAllMutation.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-emerald-500 hover:bg-emerald-600 rounded-xl transition-colors"
            >
              Gestisci tutti
            </button>
          )}
          {mode === 'all' && (
            <select
              value={year}
              onChange={(e) => { setYear(e.target.value); setPage(1); }}
              className="px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-xl text-sm
                         bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300
                         focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              <option value="">Tutti gli anni</option>
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Filter pills + search (only in 'all' mode) */}
      {mode === 'all' && (
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-48">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cerca per codice, segnalazione, cliente, indirizzo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600
                         rounded-xl text-sm text-slate-700 dark:text-slate-300
                         focus:outline-none focus:ring-2 focus:ring-blue-300 placeholder:text-slate-400"
            />
          </div>

          {/* Filter pills */}
          <div className="flex flex-wrap gap-1.5">
            {ALARM_FILTERS.map((f) => {
              const active = activeFilter === f.key;
              return (
                <div key={f.key} className="relative group/tooltip">
                  <button
                    onClick={() => toggleFilter(f.key)}
                    className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl border text-xs font-medium
                                transition-all whitespace-nowrap
                                ${active
                                  ? f.activeCls
                                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-500'}`}
                  >
                    <f.icon size={13} className={active ? 'text-white' : f.iconCls} />
                    <span className="hidden sm:inline">{f.label}</span>
                  </button>
                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-30
                                  invisible group-hover/tooltip:visible opacity-0 group-hover/tooltip:opacity-100
                                  transition-all duration-150
                                  bg-slate-800 text-white text-xs rounded-lg px-3 py-1.5
                                  whitespace-nowrap shadow-xl pointer-events-none">
                    {f.tooltip}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Search bar only for customer mode */}
      {mode === 'customer' && (
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cerca per codice, segnalazione, cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600
                       rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>
      )}

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
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase w-10">✓</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Codice</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Segnalazione</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Cliente</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase hidden lg:table-cell">Data</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Azione</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-slate-400 dark:text-slate-500">
                      Nessun allarme trovato
                    </td>
                  </tr>
                ) : (
                  filtered.map((alarm) => (
                    <AlarmRow
                      key={alarm.id}
                      alarm={alarm}
                      onManage={(id) => manageMutation.mutate(id)}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer / pagination */}
          <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {filtered.length} allarmi{isPaginated && ` (totale: ${total})`}
            </span>
            {isPaginated && (
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="px-3 py-1 text-xs bg-slate-100 dark:bg-slate-700 rounded-lg disabled:opacity-40 hover:bg-slate-200 dark:hover:bg-slate-600"
                >
                  ← Prev
                </button>
                <span className="px-3 py-1 text-xs text-slate-500 dark:text-slate-400">Pag. {page}</span>
                <button
                  disabled={page * 100 >= total}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1 text-xs bg-slate-100 dark:bg-slate-700 rounded-lg disabled:opacity-40 hover:bg-slate-200 dark:hover:bg-slate-600"
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
