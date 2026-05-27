import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, Bell, Radio, LogOut,
  Menu, BellRing, BellOff, Sun, Moon,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth.jsx';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { useNotification } from '../contexts/NotificationContext.jsx';

const NAV_ITEMS = [
  { label: 'Dashboard',    to: '/dashboard',    icon: LayoutDashboard },
  { label: 'Clienti',      to: '/customers',    icon: Users },
  { label: 'Allarmi',      to: '/alarms',       icon: Bell },
  { label: 'Messaggi SIA', to: '/sia-messages', icon: Radio, managerOnly: true },
];

/* ─── Sidebar nav link ─── */
function SideLink({ item, collapsed, onClick }) {
  return (
    <NavLink
      to={item.to}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors
         ${collapsed ? 'justify-center' : ''}
         ${isActive
           ? 'bg-blue-600 text-white shadow-sm'
           : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700'}`
      }
      title={collapsed ? item.label : undefined}
    >
      <item.icon size={18} className="flex-shrink-0" />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </NavLink>
  );
}

/* ─── Generic icon button in sidebar bottom area ─── */
function SideAction({ icon: Icon, label, onClick, collapsed, colorClass = '' }) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`flex items-center gap-3 w-full px-3 py-2 rounded-xl text-sm transition-colors
        ${collapsed ? 'justify-center' : ''}
        text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white
        hover:bg-slate-100 dark:hover:bg-slate-700 ${colorClass}`}
    >
      <Icon size={18} className="flex-shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </button>
  );
}

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const { dark, toggle: toggleTheme } = useTheme();
  const { status: notifStatus, subscribe, unsubscribe } = useNotification();

  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('sidebar-collapsed') === 'true'; } catch { return false; }
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  /* Persist sidebar collapsed state */
  useEffect(() => {
    try { localStorage.setItem('sidebar-collapsed', String(collapsed)); } catch {}
  }, [collapsed]);

  /* Close mobile sidebar on route change */
  const location = useLocation();
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const sideWidth = collapsed ? 'w-14' : 'w-56';

  /* Notification bell handler */
  const handleNotifToggle = () => {
    if (notifStatus === 'subscribed') unsubscribe();
    else if (notifStatus === 'not-subscribed') subscribe();
  };

  const NotifIcon = notifStatus === 'subscribed' ? BellRing : BellOff;

  /* ─── Sidebar content (shared between desktop and mobile) ─── */
  const sidebarContent = (
    <div className="flex flex-col h-full">

      {/* Top: logo + collapse toggle — entire area is clickable */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        title={collapsed ? 'Espandi menu' : 'Comprimi menu'}
        className={`border-b border-slate-200 dark:border-slate-700 flex items-center flex-shrink-0
          w-full text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors
          ${collapsed ? 'justify-center px-2 py-5' : 'px-4 py-5 gap-2'}`}
      >
        <img
          src="/favicon.svg"
          alt="SSM"
          className="w-8 h-8 rounded-lg object-contain bg-white flex-shrink-0"
        />
        {!collapsed && (
          <span className="font-semibold text-slate-900 dark:text-white text-sm flex-1 truncate">
            Surveye<strong className="font-black">SSM</strong>
          </span>
        )}
      </button>

      {/* Nav items */}
      <nav className={`flex-1 pt-4 pb-2 space-y-1 overflow-y-auto ${collapsed ? 'px-1' : 'px-3'}`}>
        {NAV_ITEMS.filter(item => !item.managerOnly || user?.type === 'manager').map((item) => (
          <SideLink
            key={item.to}
            item={item}
            collapsed={collapsed}
            onClick={() => setMobileOpen(false)}
          />
        ))}
      </nav>

      {/* Bottom: user info + actions */}
      <div className={`border-t border-slate-200 dark:border-slate-700 py-3 flex-shrink-0 ${collapsed ? 'px-1' : 'px-3'}`}>

        {/* Username (only when expanded) */}
        {!collapsed && user && (
          <div className="px-3 py-2 mb-1">
            <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">{user.name}</p>
            {user.type === 'manager' && (
              <p className="text-xs text-slate-500 dark:text-slate-400">Manager</p>
            )}
          </div>
        )}

        {/* Notification bell — yellow icon when active, slate when inactive */}
        {notifStatus !== 'unsupported' && (
          <button
            onClick={handleNotifToggle}
            disabled={notifStatus === 'loading'}
            title={notifStatus === 'subscribed' ? 'Disattiva notifiche' : 'Attiva notifiche push'}
            className={`flex items-center gap-3 w-full px-3 py-2 rounded-xl text-sm transition-colors
              ${collapsed ? 'justify-center' : ''}
              ${notifStatus === 'subscribed'
                ? 'text-yellow-500 dark:text-yellow-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700'}
              disabled:opacity-40`}
          >
            <NotifIcon size={18} className="flex-shrink-0" />
            {!collapsed && (
              <span className="truncate">
                {notifStatus === 'subscribed' ? 'Notifiche attive' : 'Attiva notifiche push'}
              </span>
            )}
          </button>
        )}

        {/* Theme toggle */}
        <SideAction
          icon={dark ? Sun : Moon}
          label={dark ? 'Tema chiaro' : 'Tema scuro'}
          onClick={toggleTheme}
          collapsed={collapsed}
        />

        {/* Logout */}
        <SideAction
          icon={LogOut}
          label="Esci"
          onClick={logout}
          collapsed={collapsed}
          colorClass="hover:text-red-500 dark:hover:text-red-400"
        />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">

      {/* ── Desktop sidebar ───────────────────────────────────────── */}
      <aside
        className={`
          hidden md:flex flex-col fixed inset-y-0 left-0 z-40
          bg-white dark:bg-slate-800
          border-r border-slate-200 dark:border-slate-700
          transition-all duration-200 ease-in-out
          ${sideWidth}
        `}
      >
        {sidebarContent}
      </aside>

      {/* ── Mobile sidebar overlay ────────────────────────────────── */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative z-50 flex flex-col w-56 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* ── Main content area ─────────────────────────────────────── */}
      <div className={`flex flex-col min-h-screen transition-all duration-200 ${collapsed ? 'md:pl-14' : 'md:pl-56'}`}>

        {/* Mobile top bar */}
        <div className="md:hidden sticky top-0 z-30 h-14 flex items-center gap-3 px-4
                        bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <img src="/favicon.svg" className="w-6 h-6 rounded bg-white object-contain" alt="logo" />
            <span className="text-sm font-semibold text-slate-800 dark:text-white">
              Surveye<strong className="font-black">SSM</strong>
            </span>
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-3">
          <div className="max-w-7xl mx-auto px-4 text-center text-xs text-slate-400 dark:text-slate-500">
            SurveyeSSM v2 — Developed by Stefano Venturini 2026
          </div>
        </footer>
      </div>
    </div>
  );
}
