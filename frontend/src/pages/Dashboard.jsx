import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Users, Bell, Wifi, WifiOff, AlertTriangle, Clock,
  Activity, CheckCircle2, Radio, Wrench, VolumeX,
  BellOff, Snowflake, HelpCircle, Timer, UserCheck,
} from 'lucide-react';
import apiClient from '../api/apiClient.js';

/* ─── Stat card container ─── */
function StatCard({ title, value, icon: Icon, color = 'blue', children }) {
  const colors = {
    blue:   'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
    green:  'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800',
    red:    'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
    slate:  'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
  };
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">{title}</p>
          {value !== undefined && (
            <p className="text-3xl font-bold text-slate-800 dark:text-slate-100 mt-1">{value}</p>
          )}
        </div>
        {Icon && (
          <div className={`p-2.5 rounded-xl border ${colors[color]}`}>
            <Icon size={20} />
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

/* ─── Clickable stat pill (used in Clienti card) ─── */
function StatPill({ icon: Icon, label, value, to, iconColor }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-100 dark:border-slate-700
                 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-200 dark:hover:border-blue-700
                 transition-colors group"
    >
      <Icon size={15} className={iconColor} />
      <span className="text-sm text-slate-500 dark:text-slate-400 flex-1">{label}</span>
      <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 group-hover:text-blue-700 dark:group-hover:text-blue-400">
        {value}
      </span>
    </Link>
  );
}

/* ─── Connectivity donut ─── */
function DonutChart({ online, offline, neverSeen, total }) {
  if (total === 0) return <div className="text-sm text-slate-400 text-center py-4">Nessun dato</div>;

  const onlineP  = Math.round((online  / total) * 100);
  const offlineP = Math.round((offline / total) * 100);
  const neverP   = 100 - onlineP - offlineP;

  const r    = 40;
  const circ = 2 * Math.PI * r;
  let offset = 0;

  const segments = [
    { pct: onlineP,  color: '#10b981' },
    { pct: offlineP, color: '#ef4444' },
    { pct: neverP,   color: '#94a3b8' },
  ];

  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 100 100" className="w-24 h-24 flex-shrink-0 -rotate-90">
        {segments.map((seg, i) => {
          const dash = (seg.pct / 100) * circ;
          const gap  = circ - dash;
          const el   = (
            <circle key={i} cx="50" cy="50" r={r} fill="none"
              stroke={seg.color} strokeWidth="16"
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={-offset}
            />
          );
          offset += dash;
          return el;
        })}
      </svg>
      <div className="space-y-2">
        {[
          { label: 'Online',    count: online,    icon: Wifi,       cls: 'text-emerald-500' },
          { label: 'Offline',   count: offline,   icon: WifiOff,    cls: 'text-red-400' },
          { label: 'Mai visti', count: neverSeen, icon: HelpCircle, cls: 'text-slate-400' },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-2 text-sm">
            <item.icon size={13} className={item.cls} />
            <span className="text-slate-500 dark:text-slate-400">{item.label}</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">{item.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Horizontal bar chart for "Gestiti da" ─── */
const BAR_COLORS = [
  'bg-blue-400', 'bg-emerald-400', 'bg-violet-400',
  'bg-orange-400', 'bg-teal-400', 'bg-pink-400',
];

function OperatorsChart({ list }) {
  if (!list || list.length === 0) return <p className="text-xs text-slate-400">Nessun dato</p>;
  const sorted = [...list].sort((a, b) => b.count - a.count);
  const max    = sorted[0].count;
  return (
    <div className="space-y-1.5">
      {sorted.map((m, i) => (
        <div key={m.userId} className="flex items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400 w-24 truncate flex-shrink-0">{m.userName}</span>
          <div className="flex-1 bg-slate-100 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
            <div
              className={`h-2 rounded-full ${BAR_COLORS[i % BAR_COLORS.length]} transition-all`}
              style={{ width: `${Math.max(4, (m.count / max) * 100)}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 w-8 text-right flex-shrink-0">{m.count}</span>
        </div>
      ))}
    </div>
  );
}

/* ─── Date formatting helpers ─── */
function formatDateShort(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' });
}

/* ─── Quick links definition ─── */
function buildQuickLinks(alarms, customers, connectivity) {
  return [
    {
      label: 'Allarmi da gestire',
      to: '/alarms?filter=unmanaged',
      icon: AlertTriangle,
      count: alarms.unmanaged,
      urgent: alarms.unmanaged > 0,
    },
    {
      label: 'Tutti i clienti',
      to: '/customers',
      icon: Users,
      count: customers.total,
      urgent: false,
    },
    {
      label: 'Messaggi SIA',
      to: '/sia-messages',
      icon: Radio,
      count: null,
      urgent: false,
    },
    {
      label: 'Offline',
      to: '/customers',
      icon: WifiOff,
      count: connectivity.offline,
      urgent: false,
    },
  ];
}

/* ─── Main dashboard ─── */
export default function Dashboard() {
  const queryClient = useQueryClient();

  /* Real-time clock — ticks every second */
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  /* SSE — real-time updates when new alarm/keepalive arrives */
  useEffect(() => {
    const es = new EventSource('/api/events', { withCredentials: true });
    es.addEventListener('alarm', () => {
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['alarms'] });
    });
    es.addEventListener('keepalive', () => {
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    });
    es.onerror = (e) => {
      if (import.meta.env.DEV) console.warn('[SSE] connection error', e);
    };
    return () => es.close();
  }, [queryClient]);

  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['stats'],
    queryFn: async () => (await apiClient.get('/stats')).data,
    refetchInterval: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-red-700 dark:text-red-400">
        Errore nel caricamento delle statistiche: {error.message}
      </div>
    );
  }

  const { customers, connectivity, alarms, lastEvents } = stats;
  const quickLinks = buildQuickLinks(alarms, customers, connectivity);

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Dashboard</h1>
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Activity size={14} />
          {now.toLocaleTimeString('it-IT')}
        </div>
      </div>

      {/* Alarms to manage banner */}
      {alarms.unmanaged > 0 && (
        <Link
          to="/alarms?filter=unmanaged"
          className="flex items-center gap-3 p-4 bg-red-500 text-white rounded-xl shadow hover:bg-red-600 transition-colors"
        >
          <AlertTriangle size={20} className="flex-shrink-0" />
          <div className="flex-1">
            <p className="font-semibold">
              {alarms.unmanaged} {alarms.unmanaged === 1 ? 'allarme da gestire' : 'allarmi da gestire'}
            </p>
            <p className="text-sm text-red-100">Clicca per visualizzarli</p>
          </div>
        </Link>
      )}

      {/* ── Row 1: 3 stat cards + quick-links panel (4 columns) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">

        {/* ── Card: Clienti totali ── */}
        <StatCard title="Clienti totali" value={customers.total} icon={Users} color="blue">
          <div className="space-y-1.5">
            <StatPill icon={Wrench}    label="Collaudati"           value={customers.tested}           to="/customers?filter=tested"           iconColor="text-emerald-500" />
            <StatPill icon={VolumeX}   label="Allarmi silenziati"   value={customers.snoozedEvents}    to="/customers?filter=snoozed-events"   iconColor="text-orange-400" />
            <StatPill icon={BellOff}   label="KeepAlive silenziati" value={customers.snoozedKeepalive} to="/customers?filter=snoozed-keepalive" iconColor="text-orange-400" />
            <StatPill icon={Snowflake} label="Congelati"            value={customers.freezed}          to="/customers?filter=freezed"          iconColor="text-blue-400" />
          </div>
        </StatCard>

        {/* ── Card: Connettività ── */}
        <StatCard title="Connettività" icon={Wifi} color="green">
          <DonutChart
            online={connectivity.online}
            offline={connectivity.offline}
            neverSeen={connectivity.neverSeen}
            total={customers.total}
          />
        </StatCard>

        {/* ── Card: Allarmi ── */}
        <StatCard title="Allarmi ricevuti" value={alarms.total} icon={Bell} color="red">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Activity size={13} className="text-emerald-500 flex-shrink-0" />
              <span className="text-slate-500 dark:text-slate-400 flex-1">Keep-alive</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{alarms.totalKeepalives}</span>
            </div>
            {alarms.avgManageMinutes !== null && (
              <div className="flex items-center gap-2 text-sm">
                <Timer size={13} className="text-blue-400 flex-shrink-0" />
                <span className="text-slate-500 dark:text-slate-400 flex-1">Tempo medio gestione</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{alarms.avgManageMinutes} min</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm">
              <AlertTriangle size={13} className="text-red-400 flex-shrink-0" />
              <Link
                to="/alarms?filter=unmanaged"
                className="text-red-500 hover:text-red-700 flex-1 font-medium"
              >
                Da gestire
              </Link>
              <span className="font-semibold text-red-600">{alarms.unmanaged}</span>
            </div>

            {alarms.managedByUser?.length > 0 && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-1.5 mb-2">
                  <UserCheck size={12} className="text-slate-400" />
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Gestiti da</p>
                </div>
                <OperatorsChart list={alarms.managedByUser} />
              </div>
            )}
          </div>
        </StatCard>

        {/* ── Card: Accesso rapido (2×2 quick-links) ── */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
          <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-3">
            Accesso rapido
          </p>
          <div className="grid grid-cols-2 gap-2">
            {quickLinks.map((item) => (
              <Link
                key={item.label}
                to={item.to}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border
                  text-center text-xs font-medium transition-colors
                  ${item.urgent
                    ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30'
                    : 'bg-slate-50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
              >
                <item.icon size={18} />
                <span className="leading-tight">{item.label}</span>
                {item.count !== null && (
                  <span className={`text-base font-bold ${item.urgent ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-slate-200'}`}>
                    {item.count}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ── Row 2: Ultimi 10 allarmi + Ultimi 10 KeepAlive ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Ultimi 10 allarmi */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Bell size={15} className="text-red-400" />
            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
              Ultimi allarmi
            </p>
          </div>

          {!lastEvents.lastAlarms?.length ? (
            <p className="text-sm text-slate-400 dark:text-slate-500">Nessun allarme ricevuto</p>
          ) : (
            <div className="space-y-0">
              {lastEvents.lastAlarms.map((alarm) => (
                <div
                  key={alarm.id}
                  className="flex items-center gap-2 py-2 border-b border-slate-50 dark:border-slate-700/50 last:border-0"
                >
                  {alarm.code && (
                    <span className="font-mono text-xs bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400
                                     border border-red-200 dark:border-red-800 px-1.5 py-0.5 rounded flex-shrink-0">
                      {alarm.code}
                    </span>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                      {alarm.customer?.customer || alarm.customerId}
                    </p>
                    {(alarm.siaCode?.description || alarm.detail) && (
                      <p className="text-xs text-slate-400 dark:text-slate-500 truncate">
                        {[alarm.siaCode?.description, alarm.detail].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap flex-shrink-0">
                    {formatDateShort(alarm.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Ultimi 10 KeepAlive */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Wifi size={15} className="text-emerald-500" />
            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
              Ultimi KeepAlive
            </p>
          </div>

          {!lastEvents.lastKeepalives?.length ? (
            <p className="text-sm text-slate-400 dark:text-slate-500">Nessun KeepAlive ricevuto</p>
          ) : (
            <div className="space-y-0">
              {lastEvents.lastKeepalives.map((ka) => (
                <div
                  key={ka.customerId}
                  className="flex items-center gap-2 py-2 border-b border-slate-50 dark:border-slate-700/50 last:border-0"
                >
                  {ka.customer?.surveyeCode && (
                    <span className="text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400
                                     border border-blue-200 dark:border-blue-700 px-1.5 py-0.5 rounded font-mono flex-shrink-0">
                      {ka.customer.surveyeCode}
                    </span>
                  )}
                  <p className="flex-1 text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                    {ka.customer?.customer || ka.customerId}
                  </p>
                  <span className="text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap flex-shrink-0">
                    {formatDateShort(ka.updatedAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
