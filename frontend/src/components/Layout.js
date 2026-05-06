import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Calendar, Bell, LogOut, Menu, X, ClipboardList } from 'lucide-react';

export default function Layout({ children, user, organization, onLogout }) {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { path: '/',                icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/clients',         icon: Users,           label: 'Clients'   },
    { path: '/client-services', icon: ClipboardList,   label: 'Services'  },
    { path: '/reminders',       icon: Bell,            label: 'Reminders' },
    { path: '/calendar',        icon: Calendar,        label: 'Calendar'  },
  ];

  const SidebarContent = ({ onLinkClick }) => (
    <>
      {/* Logo */}
      <div className="p-6 border-b border-purple-800/40">
        <div className="flex items-center space-x-3 mb-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xl font-bold shadow-lg"
               style={{ background: 'linear-gradient(135deg, #A855F7 0%, #EC4899 100%)' }}>
            D
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">DueDate</h1>
        </div>
        <p className="text-purple-300 text-sm font-medium truncate">{organization?.name || '—'}</p>
        <p className="text-purple-400 text-xs mt-0.5 truncate">{user?.name}</p>
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
                  ? 'bg-white/15 text-white shadow-sm backdrop-blur-sm'
                  : 'text-purple-300 hover:text-white hover:bg-white/10'
              }`}
            >
              <Icon size={19} className={active ? 'text-purple-200' : ''} />
              <span>{label}</span>
              {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-purple-300" />}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-purple-800/40">
        <button
          onClick={onLogout}
          data-testid="logout-button"
          className="flex items-center space-x-3 px-4 py-3 w-full rounded-xl text-purple-300 hover:text-white hover:bg-red-500/20 transition-all font-medium text-sm"
        >
          <LogOut size={19} />
          <span>Logout</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex bg-[#F5F3FF]">

      {/* ── Global decorative watermarks ─────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        {/* Large gradient blob — top right */}
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full opacity-[0.06]"
             style={{ background: 'radial-gradient(circle, #7C3AED 0%, transparent 70%)' }} />
        {/* Medium blob — bottom left */}
        <div className="absolute -bottom-32 -left-32 w-80 h-80 rounded-full opacity-[0.05]"
             style={{ background: 'radial-gradient(circle, #A855F7 0%, transparent 70%)' }} />
        {/* Small accent — center right */}
        <div className="absolute top-1/2 -right-16 w-48 h-48 rounded-full opacity-[0.04]"
             style={{ background: 'radial-gradient(circle, #EC4899 0%, transparent 70%)' }} />
        {/* Dot grid */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.025]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="dotgrid" x="0" y="0" width="28" height="28" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.5" fill="#7C3AED" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dotgrid)" />
        </svg>
        {/* Decorative ring — mid left */}
        <div className="absolute top-1/3 -left-20 w-64 h-64 rounded-full border-2 border-purple-400/10" />
        <div className="absolute top-1/3 -left-12 w-48 h-48 rounded-full border border-purple-400/10" />
      </div>

      {/* ── Desktop Sidebar ──────────────────────────────────────── */}
      <aside className="hidden md:flex w-64 fixed left-0 top-0 h-screen flex-col z-40 animate-slide-in"
             style={{ background: 'linear-gradient(180deg, #4C1D95 0%, #5B21B6 50%, #4C1D95 100%)' }}>
        <SidebarContent onLinkClick={undefined} />
      </aside>

      {/* ── Mobile Header ────────────────────────────────────────── */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 flex items-center justify-between px-4 z-50"
           style={{ background: 'linear-gradient(90deg, #4C1D95 0%, #6D28D9 100%)' }}>
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-lg font-bold"
               style={{ background: 'linear-gradient(135deg, #A855F7 0%, #EC4899 100%)' }}>
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
             style={{ background: 'linear-gradient(180deg, #4C1D95 0%, #5B21B6 100%)' }}>
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
