import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Calendar, Bell, LogOut, Menu, X, ClipboardList, Target, Settings, Clock } from 'lucide-react';

export default function Layout({ children, user, organization, onLogout }) {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { path: '/',                icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/clients',         icon: Users,           label: 'Clients'   },
    { path: '/client-services', icon: ClipboardList,   label: 'Services'  },
    { path: '/leads',           icon: Target,          label: 'Leads'     },
    { path: '/reminders',       icon: Bell,            label: 'Reminders' },
    { path: '/calendar',        icon: Calendar,        label: 'Calendar'  },
    { path: '/timesheet',       icon: Clock,           label: 'Timesheet' },
  ];

  const SidebarContent = ({ onLinkClick }) => (
    <>
      {/* Logo */}
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center space-x-3 mb-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xl font-bold shadow-lg"
               style={{ background: '#000000' }}>
            D
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">DueDate</h1>
        </div>
        <p className="text-slate-300 text-sm font-medium truncate">{organization?.name || '—'}</p>
        <p className="text-slate-400 text-xs mt-0.5 truncate">{user?.name}</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(({ path, icon: Icon, label }) => {
          const active = location.pathname === path;
          return (
            <Link
              key={path}
              to={path}
              onClick={onLinkClick}
              data-testid={`nav-${label.toLowerCase().replace(' ', '-')}`}
              className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${
                active
                  ? 'bg-white/12 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-white/8'
              }`}
            >
              <Icon size={19} className={active ? 'text-slate-200' : ''} />
              <span>{label}</span>
              {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-slate-300" />}
            </Link>
          );
        })}
      </nav>

      {/* Settings + Logout */}
      <div className="p-4 border-t border-white/10 space-y-1">
        <Link
          to="/settings"
          onClick={onLinkClick}
          className={`flex items-center space-x-3 px-4 py-3 w-full rounded-xl transition-all font-medium text-sm ${
            location.pathname === '/settings'
              ? 'bg-white/12 text-white'
              : 'text-slate-400 hover:text-white hover:bg-white/8'
          }`}
        >
          <Settings size={19} />
          <span>Settings</span>
        </Link>
        <button
          onClick={onLogout}
          data-testid="logout-button"
          className="flex items-center space-x-3 px-4 py-3 w-full rounded-xl text-slate-400 hover:text-white hover:bg-red-500/20 transition-all font-medium text-sm"
        >
          <LogOut size={19} />
          <span>Logout</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex bg-[#F9FAFB]">

      {/* ── Desktop Sidebar ──────────────────────────────────────── */}
      <aside className="hidden md:flex w-64 fixed left-0 top-0 h-screen flex-col z-40 animate-slide-in"
             style={{ background: '#000000' }}>
        <SidebarContent onLinkClick={undefined} />
      </aside>

      {/* ── Mobile Header ────────────────────────────────────────── */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 flex items-center justify-between px-4 z-50"
           style={{ background: '#000000' }}>
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-lg font-bold"
               style={{ background: '#000000' }}>
            D
          </div>
          <h1 className="text-xl font-bold text-white">DueDate</h1>
        </div>
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-lg hover:bg-white/10 text-white transition-colors">
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* ── Mobile Menu ──────────────────────────────────────────── */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 top-16 z-40 overflow-y-auto animate-fade-in flex flex-col"
             style={{ background: 'linear-gradient(180deg, #0F172A 0%, #1E293B 100%)' }}>
          <SidebarContent onLinkClick={() => setMobileMenuOpen(false)} />
        </div>
      )}

      {/* ── Main Content ─────────────────────────────────────────── */}
      <main className="flex-1 md:ml-64 pt-16 md:pt-0 relative z-10">
        <div className="p-6 md:p-8 lg:p-12 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
