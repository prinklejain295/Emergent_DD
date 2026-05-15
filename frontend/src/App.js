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
  const [user, setUser] = useState(null);
  const [organization, setOrganization] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    const orgData = localStorage.getItem('organization');
    
    if (token && userData) {
      setIsAuthenticated(true);
      setUser(JSON.parse(userData));
      if (orgData) {
        setOrganization(JSON.parse(orgData));
      }
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

  return (
    <BrowserRouter>
      <div className="App">
        <Toaster position="top-right" />
        {loading ? (
          <div className="flex items-center justify-center min-h-screen bg-white">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-900" />
          </div>
        ) : null}
        {!loading && <Routes>
          <Route
            path="/login"
            element={
              isAuthenticated ? (
                <Navigate to="/" replace />
              ) : (
                <LoginPage onLogin={handleLogin} />
              )
            }
          />
          <Route
            path="/home"
            element={<LandingPage />}
          />
          <Route
            path="/"
            element={
              isAuthenticated ? (
                <Layout user={user} organization={organization} onLogout={handleLogout}>
                  <Dashboard />
                </Layout>
              ) : (
                <LandingPage />
              )
            }
          />
          <Route
            path="/clients"
            element={
              isAuthenticated ? (
                <Layout user={user} organization={organization} onLogout={handleLogout}>
                  <ClientsPage />
                </Layout>
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
          <Route
            path="/client-services"
            element={
              isAuthenticated ? (
                <Layout user={user} organization={organization} onLogout={handleLogout}>
                  <ClientServicesPage />
                </Layout>
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
          <Route
            path="/settings"
            element={
              isAuthenticated ? (
                <Layout user={user} organization={organization} onLogout={handleLogout}>
                  <SettingsPage />
                </Layout>
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
          <Route
            path="/leads"
            element={
              isAuthenticated ? (
                <Layout user={user} organization={organization} onLogout={handleLogout}>
                  <LeadsPage />
                </Layout>
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
          <Route
            path="/reminders"
            element={
              isAuthenticated ? (
                <Layout user={user} organization={organization} onLogout={handleLogout}>
                  <RemindersPage />
                </Layout>
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
          <Route
            path="/calendar"
            element={
              isAuthenticated ? (
                <Layout user={user} organization={organization} onLogout={handleLogout}>
                  <CalendarPage />
                </Layout>
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
          <Route
            path="/timesheet"
            element={
              isAuthenticated ? (
                <Layout user={user} organization={organization} onLogout={handleLogout}>
                  <TimesheetPage />
                </Layout>
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
        </Routes>}
      </div>
    </BrowserRouter>
  );
}

export default App;
