import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import LoginPage from './pages/LoginPage';
import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard';
import ClientsPage from './pages/ClientsPage';
import ClientServicesPage from './pages/ClientServicesPage';
import LeadsPage from './pages/LeadsPage';
import SettingsPage from './pages/SettingsPage';
import RemindersPage from './pages/RemindersPage';
import CalendarPage from './pages/CalendarPage';
import TimesheetPage from './pages/TimesheetPage';
import Layout from './components/Layout';
import './App.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser]                       = useState(null);
  const [organization, setOrganization]       = useState(null);
  const [loading, setLoading]                 = useState(true);

  useEffect(() => {
    const token    = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    const orgData  = localStorage.getItem('organization');
    if (token && userData) {
      setIsAuthenticated(true);
      setUser(JSON.parse(userData));
      if (orgData) setOrganization(JSON.parse(orgData));
    }
    setLoading(false);
  }, []);

  const handleLogin = (token, userData, orgData) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('organization', JSON.stringify(orgData));
    setIsAuthenticated(true);
    setUser(userData);
    setOrganization(orgData);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('organization');
    setIsAuthenticated(false);
    setUser(null);
    setOrganization(null);
  };

  /* Show blank white screen while reading localStorage — avoids flash */
  if (loading) {
    return <div style={{ minHeight: '100vh', background: '#fff' }} />;
  }

  const Protected = ({ children }) =>
    isAuthenticated
      ? <Layout user={user} organization={organization} onLogout={handleLogout}>{children}</Layout>
      : <Navigate to="/" replace />;

  return (
    <BrowserRouter>
      <Toaster position="top-right" />
      <Routes>
        {/* Public */}
        <Route path="/"     element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LandingPage />} />
        <Route path="/home" element={<LandingPage />} />
        <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage onLogin={handleLogin} />} />

        {/* Protected */}
        <Route path="/dashboard"       element={<Protected><Dashboard /></Protected>} />
        <Route path="/clients"         element={<Protected><ClientsPage /></Protected>} />
        <Route path="/client-services" element={<Protected><ClientServicesPage /></Protected>} />
        <Route path="/settings"        element={<Protected><SettingsPage /></Protected>} />
        <Route path="/leads"           element={<Protected><LeadsPage /></Protected>} />
        <Route path="/reminders"       element={<Protected><RemindersPage /></Protected>} />
        <Route path="/calendar"        element={<Protected><CalendarPage /></Protected>} />
        <Route path="/timesheet"       element={<Protected><TimesheetPage /></Protected>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
