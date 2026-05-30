import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Plus, Trash2, VolumeX, Volume2, BellOff, Bell, Snowflake,
  Sun, Wrench, Wifi, WifiOff, Search, AlertTriangle,
  ChevronUp, ChevronDown, ChevronsUpDown,
  ChevronLeft, ChevronRight, Pencil,
} from 'lucide-react';
import apiClient from '../api/apiClient.js';
import { useAuth } from '../hooks/useAuth.jsx';

/* ─── Status badge colors ─── */
const STATUS_COLORS = {
  'Anno di Prova': 'bg-blue-100 text-blue-700',
  'Abbonato':      'bg-emerald-100 text-emerald-700',
  'Interrotto':    'bg-red-100 text-red-700',
};

const STATUS_ORDER = { 'Abbonato': 0, 'Anno di Prova': 1, 'Interrotto': 2 };

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('it-IT');
}

/* ─── Filter definitions ─── */
const FILTERS = [
  {
    key: 'tested',
    icon: Wrench,
    label: 'Collaudati',
    iconCls: 'text-emerald-600',
    activeCls: 'bg-emerald-500 text-white border-emerald-500',
    tooltip: 'Mostra solo i clienti già collaudati',
    predicate: (c) => !!c.testedAt,
  },
  {
    key: 'untested',
    icon: Wrench,
    label: 'Non collaudati',
    iconCls: 'text-red-400',
    activeCls: 'bg-red-500 text-white border-red-500',
    tooltip: 'Mostra solo i clienti non ancora collaudati',
    predicate: (c) => !c.testedAt,
  },
  {
    key: 'online',
    icon: Wifi,
    label: 'Online',
    iconCls: 'text-emerald-500',
    activeCls: 'bg-emerald-500 text-white border-emerald-500',
    tooltip: 'Mostra solo i clienti con pannello online',
    predicate: (c) => c.isAlive,
  },
  {
    key: 'snoozed-events',
    icon: VolumeX,
    label: 'Allarmi silenziati',
    iconCls: 'text-orange-400',
    activeCls: 'bg-orange-500 text-white border-orange-500',
    tooltip: 'Mostra solo i clienti con allarmi silenziati',
    predicate: (c) => c.isAlarmsSnoozed,
  },
  {
    key: 'snoozed-keepalive',
    icon: BellOff,
    label: 'KeepAlive silenziati',
    iconCls: 'text-orange-400',
    activeCls: 'bg-orange-500 text-white border-orange-500',
    tooltip: 'Mostra solo i clienti con keep-alive silenziato',
    predicate: (c) => c.isAliveSnoozed,
  },
  {
    key: 'freezed',
    icon: Snowflake,
    label: 'Congelati',
    iconCls: 'text-blue-400',
    activeCls: 'bg-blue-500 text-white border-blue-500',
    tooltip: 'Mostra solo i clienti congelati',
    predicate: (c) => !!c.freezedAt,
  },
];

/* ─── Sortable column header ─── */
function Th({ label, sortKey, currentKey, currentDir, onSort, className = '' }) {
  const active = currentKey === sortKey;
  const Icon   = active
    ? currentDir === 'asc' ? ChevronUp : ChevronDown
    : ChevronsUpDown;
  return (
    <th
      onClick={() => onSort(sortKey)}
      className={`px-4 py-3 text-xs font-semibold text-slate-400 uppercase cursor-pointer select-none
                  hover:text-slate-600 dark:hover:text-slate-300 transition-colors group ${className}`}
    >
      <div className="flex items-center gap-1">
        {label}
        <Icon size={12} className={`flex-shrink-0 ${active ? 'opacity-100 text-blue-500' : 'opacity-0 group-hover:opacity-60'}`} />
      </div>
    </th>
  );
}

/* ─── Single customer row ─── */
function CustomerRow({ customer, onAction, onEdit, isManager }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isOnline = customer.isAlive;

  const testedTooltip = customer.testedAt
    ? [
        `Collaudato il ${formatDate(customer.testedAt)}`,
        customer.testedByName ? `da ${customer.testedByName}` : null,
      ].filter(Boolean).join(' ')
    : 'Non ancora collaudato';

  return (
    <tr className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
      {/* Connessione */}
      <td className="px-4 py-3 text-center">
        {isOnline
          ? <Wifi size={16} className="text-emerald-500 mx-auto" title="Online" />
          : <WifiOff size={16} className="text-slate-300 mx-auto" title="Offline" />}
      </td>

      {/* Account */}
      <td className="px-4 py-3">
        <Link
          to={`/alarms/customer/${customer.account}`}
          className="font-mono text-sm text-blue-600 hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
          title="Vedi allarmi di questo cliente"
        >
          {customer.account}
        </Link>
      </td>

      {/* Cliente + surveyeCode badge */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <div className="flex items-baseline gap-1.5 flex-wrap flex-1 min-w-0">
            <p className="font-medium text-slate-800 dark:text-slate-200 text-sm">{customer.customer}</p>
            <span className="text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-700 px-1.5 py-0.5 rounded font-mono whitespace-nowrap">
              {customer.surveyeCode || '—'}
            </span>
          </div>
          {isManager && (
            <button
              onClick={() => onEdit(customer)}
              className="p-1 text-slate-300 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors flex-shrink-0"
              title="Modifica cliente"
            >
              <Pencil size={12} />
            </button>
          )}
        </div>
        <p className="text-xs text-slate-400 truncate max-w-[240px] mt-0.5">{customer.address}</p>
      </td>

      {/* Stato abbonamento */}
      <td className="px-4 py-3">
        <span
          className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap
                      ${STATUS_COLORS[customer.stato] || 'bg-slate-100 text-slate-600'}`}
        >
          {customer.stato}
        </span>
      </td>

      {/* Scadenza */}
      <td className="px-4 py-3 text-xs text-slate-500 hidden xl:table-cell">
        {formatDate(customer.scadenza)}
      </td>

      {/* Collaudo — verde/rosso */}
      <td className="px-4 py-3 text-center hidden lg:table-cell">
        <div className="relative group/tested inline-block">
          <Wrench
            size={15}
            className={customer.testedAt ? 'text-emerald-500' : 'text-red-300'}
          />
          {/* Tooltip */}
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-20
                          hidden group-hover/tested:block
                          bg-slate-800 text-white text-xs rounded-lg px-2.5 py-1.5
                          whitespace-nowrap shadow-lg pointer-events-none">
            {testedTooltip}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
          </div>
        </div>
      </td>

      {/* Flags */}
      <td className="px-4 py-3">
        <div className="flex gap-1">
          {customer.isAlarmsSnoozed && <VolumeX size={14} className="text-orange-400" title="Allarmi silenziati" />}
          {customer.isAliveSnoozed  && <BellOff  size={14} className="text-orange-400" title="Keep-alive silenziato" />}
          {customer.freezedAt       && <Snowflake size={14} className="text-blue-400"   title="Congelato" />}
        </div>
      </td>

      {/* Azioni */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <Link
            to={`/alarms/customer/${customer.account}`}
            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
            title="Vedi allarmi"
          >
            <AlertTriangle size={14} />
          </Link>

          {/* Collauda — solo se non ancora collaudato */}
          {!customer.testedAt && (
            <button
              onClick={() => onAction(customer.id, 'tested')}
              className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
              title="Segna come collaudato"
            >
              <Wrench size={14} />
            </button>
          )}

          {!customer.isAlarmsSnoozed
            ? <button onClick={() => onAction(customer.id, 'mute-events')}   className="p-1.5 text-slate-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg" title="Silenzia allarmi"><VolumeX size={14} /></button>
            : <button onClick={() => onAction(customer.id, 'unmute-events')} className="p-1.5 text-orange-500 hover:text-slate-400 hover:bg-slate-50 rounded-lg"  title="Riattiva allarmi"><Volume2 size={14} /></button>}

          {!customer.isAliveSnoozed
            ? <button onClick={() => onAction(customer.id, 'mute-keepalive')}   className="p-1.5 text-slate-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg" title="Silenzia keep-alive"><BellOff size={14} /></button>
            : <button onClick={() => onAction(customer.id, 'unmute-keepalive')} className="p-1.5 text-orange-500 hover:text-slate-400 hover:bg-slate-50 rounded-lg"  title="Riattiva keep-alive"><Bell size={14} /></button>}

          {!customer.freezedAt
            ? <button onClick={() => onAction(customer.id, 'freeze')}   className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg" title="Congela"><Snowflake size={14} /></button>
            : <button onClick={() => onAction(customer.id, 'unfreeze')} className="p-1.5 text-blue-500 hover:text-slate-400 hover:bg-slate-50 rounded-lg"   title="Scongela"><Sun size={14} /></button>}

          {isManager && (
            confirmDelete ? (
              <div className="flex gap-1">
                <button
                  onClick={() => { onAction(customer.id, 'delete'); setConfirmDelete(false); }}
                  className="px-2 py-1 text-xs bg-red-500 text-white rounded-lg hover:bg-red-600"
                >Conferma</button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-2 py-1 text-xs bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200"
                >Annulla</button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                title="Elimina"
              >
                <Trash2 size={14} />
              </button>
            )
          )}
        </div>
      </td>
    </tr>
  );
}

/* ─── Page sizes ─── */
const PAGE_SIZES = [
  { label: '25',    value: 25 },
  { label: '50',    value: 50 },
  { label: '100',   value: 100 },
  { label: 'Tutti', value: 0 },
];

/* ─── Main page ─── */
export default function Customers() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isManager = user?.type === 'manager';

  // Read initial filter from URL ?filter= param
  const [searchParams, setSearchParams] = useSearchParams();
  const urlFilter = searchParams.get('filter') || '';
  const urlSearch = searchParams.get('search') || '';

  const [search,      setSearch]      = useState(urlSearch);
  const [activeFilter, setActiveFilter] = useState(urlFilter);
  const [sortKey,     setSortKey]     = useState('customer');
  const [sortDir,     setSortDir]     = useState('asc');
  const [page,        setPage]        = useState(1);
  const [pageSize,    setPageSize]    = useState(25);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [editForm, setEditForm] = useState({ customer: '', address: '', surveyeCode: '' });

  // Always load ALL customers — filtering is done client-side
  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => (await apiClient.get('/customers')).data,
    refetchInterval: 60_000,
  });

  const mutation = useMutation({
    mutationFn: async ({ id, action }) =>
      action === 'delete'
        ? apiClient.delete(`/customers/${id}`)
        : apiClient.post(`/customers/${id}/${action}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });

  const editMutation = useMutation({
    mutationFn: ({ id, data }) => apiClient.patch(`/customers/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setEditingCustomer(null);
    },
  });

  const handleAction = (id, action) => mutation.mutate({ id, action });

  const handleEdit = (customer) => {
    setEditForm({ customer: customer.customer, address: customer.address || '', surveyeCode: customer.surveyeCode || '' });
    setEditingCustomer(customer);
  };

  /* Toggle filter — single active at a time */
  const toggleFilter = (key) => {
    const next = activeFilter === key ? '' : key;
    setActiveFilter(next);
    setPage(1);
    if (next) setSearchParams({ filter: next });
    else setSearchParams({});
  };

  /* Sort */
  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
    setPage(1);
  };

  /* 1. Text search across ALL fields */
  const searched = useMemo(() => {
    if (!search) return customers;
    const s = search.toLowerCase();
    return customers.filter(c =>
      c.account?.toLowerCase().includes(s) ||
      c.customer?.toLowerCase().includes(s) ||
      c.surveyeCode?.toLowerCase().includes(s) ||
      c.address?.toLowerCase().includes(s) ||
      c.stato?.toLowerCase().includes(s)
    );
  }, [customers, search]);

  /* 2. Active filter */
  const filterDef = FILTERS.find(f => f.key === activeFilter);
  const filtered = useMemo(() => {
    if (!filterDef) return searched;
    return searched.filter(filterDef.predicate);
  }, [searched, filterDef]);

  /* 3. Sort */
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let va = a[sortKey], vb = b[sortKey];
      if (sortKey === 'stato') {
        va = STATUS_ORDER[va] ?? 99;
        vb = STATUS_ORDER[vb] ?? 99;
      } else if (['scadenza', 'testedAt'].includes(sortKey)) {
        va = va ? new Date(va).getTime() : 0;
        vb = vb ? new Date(vb).getTime() : 0;
      } else if (sortKey === 'isAlive') {
        va = va ? 1 : 0;
        vb = vb ? 1 : 0;
      } else {
        va = (va ?? '').toString().toLowerCase();
        vb = (vb ?? '').toString().toLowerCase();
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ?  1 : -1;
      return 0;
    });
  }, [filtered, sortKey, sortDir]);

  /* 4. Paginate */
  const totalPages = pageSize === 0 ? 1 : Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage   = Math.min(page, totalPages);
  const paginated  = pageSize === 0 ? sorted : sorted.slice((safePage - 1) * pageSize, safePage * pageSize);
  const firstItem  = pageSize === 0 ? 1 : (safePage - 1) * pageSize + 1;
  const lastItem   = pageSize === 0 ? sorted.length : Math.min(safePage * pageSize, sorted.length);

  const handleSearch = (val) => { setSearch(val); setPage(1); };
  const handlePageSize = (val) => { setPageSize(val); setPage(1); };

  const sp = { currentKey: sortKey, currentDir: sortDir, onSort: handleSort };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Clienti</h1>
        {isManager && (
          <Link
            to="/customers/add"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-sm transition-colors"
          >
            <Plus size={16} />
            Nuovo cliente
          </Link>
        )}
      </div>

      {/* Search + filter row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cerca per nome, account, codice, indirizzo, stato..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-300 placeholder:text-slate-400"
          />
        </div>

        {/* Filter pills */}
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map(f => {
            const active = activeFilter === f.key;
            return (
              <div key={f.key} className="relative group/tooltip">
                <button
                  onClick={() => toggleFilter(f.key)}
                  className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl border text-xs font-medium
                              transition-all whitespace-nowrap
                              ${active
                                ? f.activeCls
                                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-300'}`}
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

      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                  <Th label="⚡"       sortKey="isAlive"  {...sp} className="text-center w-10" />
                  <Th label="Account"  sortKey="account"  {...sp} />
                  <Th label="Cliente"  sortKey="customer" {...sp} />
                  <Th label="Stato"    sortKey="stato"    {...sp} />
                  <Th label="Scadenza" sortKey="scadenza" {...sp} className="hidden xl:table-cell" />
                  <Th label="Coll."    sortKey="testedAt" {...sp} className="hidden lg:table-cell" />
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Flag</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-400 uppercase">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                      {search || activeFilter ? 'Nessun risultato per i filtri applicati' : 'Nessun cliente'}
                    </td>
                  </tr>
                ) : (
                  paginated.map((customer) => (
                    <CustomerRow
                      key={customer.id}
                      customer={customer}
                      onAction={handleAction}
                      onEdit={handleEdit}
                      isManager={isManager}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer: count + paginator */}
          <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <span>
                {sorted.length === 0
                  ? '0 clienti'
                  : pageSize === 0
                    ? `${sorted.length} clienti`
                    : `${firstItem}–${lastItem} di ${sorted.length}`}
                {(search || activeFilter) && customers.length !== sorted.length && (
                  <span className="text-slate-400"> (filtrati su {customers.length})</span>
                )}
              </span>
              <span className="text-slate-300">|</span>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">Mostra</span>
                <div className="flex rounded-lg overflow-hidden border border-slate-200 dark:border-slate-600 divide-x divide-slate-200 dark:divide-slate-600">
                  {PAGE_SIZES.map(({ label, value }) => (
                    <button
                      key={value}
                      onClick={() => handlePageSize(value)}
                      className={`px-2.5 py-1 text-xs font-medium transition-colors
                        ${pageSize === value ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPage(1)}
                  disabled={safePage === 1}
                  className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Prima pagina"
                >
                  <ChevronLeft size={14} className="inline" /><ChevronLeft size={14} className="inline -ml-2" />
                </button>
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                  className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={14} />
                </button>
                <div className="flex gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                    .reduce((acc, p, idx, arr) => {
                      if (idx > 0 && p - arr[idx - 1] > 1) acc.push('…');
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((p, idx) =>
                      p === '…'
                        ? <span key={`e${idx}`} className="px-1.5 py-1 text-slate-300">…</span>
                        : <button
                            key={p}
                            onClick={() => setPage(p)}
                            className={`min-w-[28px] h-7 rounded text-xs font-medium transition-colors
                              ${p === safePage ? 'bg-blue-600 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400'}`}
                          >{p}</button>
                    )
                  }
                </div>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                  className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight size={14} />
                </button>
                <button
                  onClick={() => setPage(totalPages)}
                  disabled={safePage === totalPages}
                  className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Ultima pagina"
                >
                  <ChevronRight size={14} className="inline" /><ChevronRight size={14} className="inline -ml-2" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Edit customer modal ─── */}
      {editingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl p-6 w-full max-w-sm mx-4 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Modifica cliente</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Account: <span className="font-mono">{editingCustomer.account}</span> — il numero non verrà modificato.
              </p>
            </div>
            {editMutation.error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-400">
                {editMutation.error.response?.data?.error || 'Errore durante la modifica'}
              </div>
            )}
            <div className="space-y-3">
              {[
                { label: 'Nome Cliente',   key: 'customer',   placeholder: 'Es. Mario Rossi',  required: true },
                { label: 'Indirizzo',      key: 'address',    placeholder: 'Via Roma 1, Milano' },
                { label: 'Codice Surveye', key: 'surveyeCode', placeholder: 'CCOMXYYYZZZ',     required: true },
              ].map(({ label, key, placeholder, required }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {label}{required && <span className="text-red-500 ml-0.5">*</span>}
                  </label>
                  <input
                    type="text"
                    value={editForm[key]}
                    onChange={(e) => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-xl text-sm
                               bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200
                               focus:outline-none focus:ring-2 focus:ring-blue-300 placeholder:text-slate-400"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setEditingCustomer(null)}
                className="flex-1 py-2 text-sm font-medium text-slate-600 dark:text-slate-400
                           bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={() => editMutation.mutate({ id: editingCustomer.id, data: editForm })}
                disabled={!editForm.customer || !editForm.surveyeCode || editMutation.isPending}
                className="flex-1 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700
                           rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {editMutation.isPending ? 'Salvataggio...' : 'Salva'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
