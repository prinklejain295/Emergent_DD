import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Calendar, Bell, LogOut, Menu, X } from 'lucide-react';

export default function Layout({ children, user, onLogout }) {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/clients', icon: Users, label: 'Clients' },
    { path: '/due-dates', icon: Calendar, label: 'Due Dates' },
    { path: '/reminders', icon: Bell, label: 'Reminders' },
    { path: '/calendar', icon: Calendar, label: 'Calendar' }
  ];

  return (
    <div className="min-h-screen flex bg-[#F5F5F4]">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-white/95 backdrop-blur-xl border-r border-[#E5E7EB] fixed left-0 top-0 h-screen flex-col z-40">
        <div className="p-6 border-b border-[#E5E7EB]">
          <h1 className="text-2xl font-bold text-[#064E3B]" style={{ fontFamily: 'Manrope, sans-serif' }}>
            TaxFlow Zen
          </h1>
          <p className="text-sm text-[#6B7280] mt-1">{user?.name}</p>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}
                className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-all ${
                  isActive
                    ? 'bg-[#064E3B] text-white'
                    : 'text-[#6B7280] hover:bg-[#F3F4F6]'
                }`}
              >
                <Icon size={20} />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-[#E5E7EB]">
          <button
            onClick={onLogout}
            data-testid="logout-button"
            className="flex items-center space-x-3 px-4 py-3 w-full rounded-lg text-[#6B7280] hover:bg-[#FEE2E2] hover:text-[#991B1B] transition-all"
          >
            <LogOut size={20} />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-[#E5E7EB] flex items-center justify-between px-4 z-50">
        <h1 className="text-xl font-bold text-[#064E3B]" style={{ fontFamily: 'Manrope, sans-serif' }}>
          TaxFlow Zen
        </h1>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-lg hover:bg-[#F3F4F6]"
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 top-16 bg-white z-40 overflow-y-auto">
          <nav className="p-4 space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-all ${
                    isActive
                      ? 'bg-[#064E3B] text-white'
                      : 'text-[#6B7280] hover:bg-[#F3F4F6]'
                  }`}
                >
                  <Icon size={20} />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onLogout();
              }}
              className="flex items-center space-x-3 px-4 py-3 w-full rounded-lg text-[#6B7280] hover:bg-[#FEE2E2] hover:text-[#991B1B] transition-all"
            >
              <LogOut size={20} />
              <span className="font-medium">Logout</span>
            </button>
          </nav>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 md:ml-64 pt-16 md:pt-0">
        <div className="p-6 md:p-8 lg:p-12 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
