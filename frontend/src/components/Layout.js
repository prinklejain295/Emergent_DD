import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Calendar, Bell, LogOut, Menu, X } from 'lucide-react';

export default function Layout({ children, user, organization, onLogout }) {
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
    <div className="min-h-screen flex bg-[#FAFAFA]">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-black fixed left-0 top-0 h-screen flex-col z-40 animate-slide-in">
        <div className="p-6 border-b border-gray-800">
          <div className="flex items-center space-x-3 mb-3">
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-black text-xl font-bold">
              D
            </div>
            <h1 className="text-2xl font-bold text-white">
              DueDate
            </h1>
          </div>
          <p className="text-sm text-gray-400">{organization?.name || 'Loading...'}</p>
          <p className="text-xs text-gray-500 mt-1">{user?.name}</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}
                className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-all font-medium ${
                  isActive
                    ? 'bg-white text-black'
                    : 'text-gray-400 hover:text-white hover:bg-gray-900'
                }`}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-800">
          <button
            onClick={onLogout}
            data-testid="logout-button"
            className="flex items-center space-x-3 px-4 py-3 w-full rounded-lg text-gray-400 hover:text-white hover:bg-red-900/20 transition-all font-medium"
          >
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-black flex items-center justify-between px-4 z-50">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-black text-lg font-bold">
            D
          </div>
          <h1 className="text-xl font-bold text-white">
            DueDate
          </h1>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-lg hover:bg-gray-900 text-white"
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
