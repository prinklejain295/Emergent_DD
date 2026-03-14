import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { TrendingUp, Users, Calendar, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const getAuthHeaders = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
});

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API}/dashboard/stats`, getAuthHeaders());
      setStats(response.data);
    } catch (error) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#064E3B]"></div>
      </div>
    );
  }

  return (
    <div data-testid="dashboard-page">
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-description">Overview of your tax compliance management</p>
      </div>

      {/* Stats Grid - Bento Style */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="card p-6 hover:shadow-lg transition-shadow" data-testid="stat-clients">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-[#D1FAE5] rounded-lg">
              <Users size={24} className="text-[#064E3B]" />
            </div>
          </div>
          <h3 className="text-3xl font-bold text-[#064E3B] mb-1">{stats?.total_clients || 0}</h3>
          <p className="text-sm text-[#6B7280]">Total Clients</p>
        </div>

        <div className="card p-6 hover:shadow-lg transition-shadow" data-testid="stat-due-dates">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-[#DBEAFE] rounded-lg">
              <Calendar size={24} className="text-[#1E40AF]" />
            </div>
          </div>
          <h3 className="text-3xl font-bold text-[#064E3B] mb-1">{stats?.total_due_dates || 0}</h3>
          <p className="text-sm text-[#6B7280]">Total Due Dates</p>
        </div>

        <div className="card p-6 hover:shadow-lg transition-shadow" data-testid="stat-upcoming">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-[#FEF3C7] rounded-lg">
              <TrendingUp size={24} className="text-[#92400E]" />
            </div>
          </div>
          <h3 className="text-3xl font-bold text-[#064E3B] mb-1">{stats?.upcoming_count || 0}</h3>
          <p className="text-sm text-[#6B7280]">Upcoming (30 days)</p>
        </div>

        <div className="card p-6 hover:shadow-lg transition-shadow" data-testid="stat-overdue">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-[#FEE2E2] rounded-lg">
              <AlertCircle size={24} className="text-[#991B1B]" />
            </div>
          </div>
          <h3 className="text-3xl font-bold text-[#EA580C] mb-1">{stats?.overdue_count || 0}</h3>
          <p className="text-sm text-[#6B7280]">Overdue</p>
        </div>
      </div>

      {/* Upcoming Due Dates */}
      <div className="card p-6">
        <h2 className="text-2xl font-bold text-[#064E3B] mb-6" style={{ fontFamily: 'Manrope, sans-serif' }}>
          Upcoming Due Dates
        </h2>
        
        {stats?.upcoming_due_dates?.length === 0 ? (
          <div className="text-center py-12">
            <Calendar size={48} className="mx-auto text-[#9CA3AF] mb-4" />
            <p className="text-[#6B7280]">No upcoming due dates in the next 30 days</p>
          </div>
        ) : (
          <div className="space-y-4">
            {stats?.upcoming_due_dates?.map((dueDate) => (
              <div
                key={dueDate.id}
                data-testid={`due-date-item-${dueDate.id}`}
                className="flex items-center justify-between p-4 bg-[#F9FAFB] rounded-lg border border-[#E5E7EB] hover:border-[#064E3B] transition-all"
              >
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <span className="badge badge-pending">{dueDate.service_type}</span>
                    <h3 className="font-semibold text-[#064E3B]">{dueDate.client?.name}</h3>
                  </div>
                  <p className="text-sm text-[#6B7280]">{dueDate.description}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-[#064E3B]">
                    {format(new Date(dueDate.due_date), 'MMM dd, yyyy')}
                  </p>
                  <p className="text-xs text-[#6B7280] mt-1">
                    {Math.ceil((new Date(dueDate.due_date) - new Date()) / (1000 * 60 * 60 * 24))} days left
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
