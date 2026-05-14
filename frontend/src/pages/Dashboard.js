import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { toastMsg } from '../utils/errorLogger';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart, Area,
} from 'recharts';
import {
  Users, Clock, AlertTriangle, CheckCircle2,
  TrendingUp, Banknote, Calendar, ArrowUpRight, X,
} from 'lucide-react';
import { format, addMonths, startOfMonth, isBefore, isAfter, isSameMonth } from 'date-fns';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'https://emergent-dd-2b7s.vercel.app';
const API = `${BACKEND_URL}/api`;
const getAuthHeaders = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

/* ── Color palettes ───────────────────────────────────────────── */
const STATUS_COLORS = {
  'Done':         '#000000',
  'In Progress':  '#444444',
  'Under Review': '#666666',
  'Pending':      '#888888',
  'Washington':   '#000000',
  'Urgent':       '#000000',
  'On Hold':      '#AAAAAA',
  'Not Started':  '#CCCCCC',
};

const FEES_COLORS = {
  'Post Payment':     '#000000',
  'Pre Payment':      '#444444',
  'Pending Payment':  '#222222',
  'Invoiced':         '#666666',
  'Waived':           '#AAAAAA',
  'On Hold':          '#CCCCCC',
};

const STAT_GRADIENTS = [
  { from: '#000000', to: '#000000' },
  { from: '#000000', to: '#000000' },
  { from: '#000000', to: '#000000' },
  { from: '#000000', to: '#000000' },
];

/* ── Custom Tooltip ───────────────────────────────────────────── */
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-[#E5E7EB] rounded-2xl shadow-xl p-3 text-sm min-w-[130px]">
      {label && <p className="font-semibold text-gray-900 mb-1.5">{label}</p>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: p.fill || p.color }} />
          <span className="text-gray-600">{p.name}:</span>
          <span className="font-bold text-gray-800 ml-auto pl-2">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

/* ── Decorative SVG for stat cards ───────────────────────────── */
const CardDeco = ({ type }) => {
  if (type === 'circles') return (
    <svg className="absolute right-3 bottom-3 opacity-20" width="80" height="80" viewBox="0 0 80 80" fill="none">
      <circle cx="60" cy="60" r="40" stroke="white" strokeWidth="2" />
      <circle cx="60" cy="60" r="25" stroke="white" strokeWidth="2" />
      <circle cx="60" cy="60" r="10" fill="white" fillOpacity="0.3" />
    </svg>
  );
  if (type === 'dots') return (
    <svg className="absolute right-3 bottom-3 opacity-20" width="70" height="70" viewBox="0 0 70 70" fill="none">
      {[0,1,2,3].map(row => [0,1,2,3].map(col => (
        <circle key={`${row}-${col}`} cx={col*18+9} cy={row*18+9} r="4" fill="white" />
      )))}
    </svg>
  );
  if (type === 'wave') return (
    <svg className="absolute right-0 bottom-0 opacity-20" width="100" height="60" viewBox="0 0 100 60" fill="none">
      <path d="M0 40 Q25 20 50 40 Q75 60 100 40 L100 60 L0 60 Z" fill="white" />
      <path d="M0 50 Q25 30 50 50 Q75 70 100 50 L100 60 L0 60 Z" fill="white" fillOpacity="0.5" />
    </svg>
  );
  if (type === 'hex') return (
    <svg className="absolute right-3 bottom-3 opacity-20" width="72" height="72" viewBox="0 0 72 72" fill="none">
      <polygon points="36,4 66,20 66,52 36,68 6,52 6,20" stroke="white" strokeWidth="2" />
      <polygon points="36,16 54,26 54,46 36,56 18,46 18,26" stroke="white" strokeWidth="1.5" />
    </svg>
  );
  return null;
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [clients, setClients]   = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [userName, setUserName] = useState('');
  const [showList, setShowList] = useState(null); // 'pending' | 'unbilled' | 'overdue'

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem('user') || '{}');
    setUserName(u.name || '');
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      const [cRes, sRes] = await Promise.all([
        axios.get(`${API}/clients`, getAuthHeaders()),
        axios.get(`${API}/client-services`, getAuthHeaders()),
      ]);
      setClients(Array.isArray(cRes.data) ? cRes.data : []);
      setServices(Array.isArray(sRes.data) ? sRes.data : []);
    } catch (err) {
      toast.error(await toastMsg('Dashboard.fetchAll', err, 'Failed to load dashboard'));
    } finally {
      setLoading(false);
    }
  };

  /* ── Derived stats ────────────────────────────────────────────── */
  const stats = useMemo(() => {
    const now = new Date();
    const pendingList  = services.filter(s => s.status !== 'Done');
    const completed    = services.filter(s => s.status === 'Done');
    const unbilledList = completed.filter(s => s.fees_status !== 'Post Payment');
    const overdueList  = services.filter(s => {
      if (s.status === 'Done') return false;
      const d = s.regulatory_due_date ? new Date(s.regulatory_due_date) : null;
      return d && !isNaN(d) && isBefore(d, now);
    });
    return {
      totalClients:  clients.length,
      pendingCount:  pendingList.length,
      unbilledCount: unbilledList.length,
      overdueCount:  overdueList.length,
      pendingList, unbilledList, overdueList,
    };
  }, [clients, services]);

  /* ── Chart 1: Pending tasks by status (Donut) ────────────────── */
  const pendingByStatus = useMemo(() => {
    const map = {};
    services.filter(s => s.status !== 'Done').forEach(s => {
      const key = s.status || 'Unknown';
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value, color: STATUS_COLORS[name] || '#9CA3AF' }))
      .sort((a, b) => b.value - a.value);
  }, [services]);

  /* ── Chart 2: Completed + billing status (Bar) ────────────────── */
  const completedBilling = useMemo(() => {
    const map = {};
    services.filter(s => s.status === 'Done').forEach(s => {
      const key = s.fees_status || 'Unspecified';
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map)
      .map(([name, count]) => ({ name, count, color: FEES_COLORS[name] || '#9CA3AF' }))
      .sort((a, b) => b.count - a.count);
  }, [services]);

  /* ── Chart 3: Monthly deadlines for next 6 months (Area) ─────── */
  const monthlyDeadlines = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, i) => addMonths(startOfMonth(now), i));
    return months.map(m => {
      const label = format(m, 'MMM yy');
      const internal   = services.filter(s => {
        const d = s.internal_due_date ? new Date(s.internal_due_date) : null;
        return d && !isNaN(d) && isSameMonth(d, m);
      }).length;
      const regulatory = services.filter(s => {
        const d = s.regulatory_due_date ? new Date(s.regulatory_due_date) : null;
        return d && !isNaN(d) && isSameMonth(d, m);
      }).length;
      return { month: label, Internal: internal, Regulatory: regulatory };
    });
  }, [services]);

  /* ── Chart 4: Service status full breakdown (Bar) ────────────── */
  const statusBreakdown = useMemo(() => {
    const map = {};
    services.forEach(s => { const k = s.status || 'Unknown'; map[k] = (map[k] || 0) + 1; });
    return Object.entries(map)
      .map(([name, count]) => ({ name, count, color: STATUS_COLORS[name] || '#9CA3AF' }))
      .sort((a, b) => b.count - a.count);
  }, [services]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900" />
    </div>
  );

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="animate-fade-in space-y-6">

      {/* ── Welcome Banner ──────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl p-7 text-white"
           style={{ background: '#000000' }}>
        {/* Decorative shapes */}
        <svg className="absolute right-0 top-0 opacity-10" width="240" height="160" viewBox="0 0 240 160" fill="none">
          <circle cx="200" cy="-20" r="100" stroke="white" strokeWidth="2" />
          <circle cx="200" cy="-20" r="65"  stroke="white" strokeWidth="1.5" />
          <circle cx="200" cy="-20" r="30"  fill="white" fillOpacity="0.15" />
        </svg>
        <svg className="absolute left-1/2 bottom-0 opacity-10 transform -translate-x-1/2" width="300" height="80" viewBox="0 0 300 80" fill="none">
          <path d="M0 50 Q75 10 150 50 Q225 90 300 50 L300 80 L0 80 Z" fill="white" />
        </svg>
        <div className="relative z-10">
          <p className="text-slate-200 text-sm font-medium mb-1">{greeting} 👋</p>
          <h1 className="text-3xl font-bold mb-1">{userName || 'Welcome back'}</h1>
          <p className="text-slate-200 text-sm">
            {services.length} service{services.length !== 1 ? 's' : ''} tracked · {clients.length} client{clients.length !== 1 ? 's' : ''} · {stats.overdueCount > 0 ? `⚠️ ${stats.overdueCount} overdue` : '✅ No overdue items'}
          </p>
        </div>
      </div>

      {/* ── Stat Cards ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Clients', value: stats.totalClients,   icon: Users,         sub: 'organisations & individuals', deco: 'circles', grad: STAT_GRADIENTS[0], action: () => navigate('/clients') },
          { label: 'Pending Tasks', value: stats.pendingCount,   icon: Clock,         sub: 'services not yet completed',  deco: 'dots',    grad: STAT_GRADIENTS[1], action: () => setShowList('pending') },
          { label: 'Unbilled Work', value: stats.unbilledCount,  icon: Banknote,      sub: 'completed, awaiting payment', deco: 'wave',    grad: STAT_GRADIENTS[2], action: () => setShowList('unbilled') },
          { label: 'Overdue',       value: stats.overdueCount,   icon: AlertTriangle, sub: 'past regulatory deadline',    deco: 'hex',     grad: STAT_GRADIENTS[3], action: () => setShowList('overdue') },
        ].map(({ label, value, icon: Icon, sub, deco, grad, action }, i) => (
          <button key={i} onClick={action}
                  className="relative overflow-hidden rounded-2xl p-5 text-white shadow-lg text-left w-full cursor-pointer group"
                  style={{ background: `linear-gradient(135deg, ${grad.from} 0%, ${grad.to} 100%)` }}>
            <CardDeco type={deco} />
            <div className="relative z-10">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                  <Icon size={20} className="text-white" />
                </div>
                <ArrowUpRight size={16} className="text-white/60 mt-1 group-hover:text-white transition-colors" />
              </div>
              <p className="text-4xl font-extrabold tracking-tight mb-1">{value}</p>
              <p className="font-semibold text-sm text-white/90">{label}</p>
              <p className="text-xs text-white/60 mt-0.5 leading-snug">{sub}</p>
            </div>
          </button>
        ))}
      </div>

      {/* ── List Modal (Pending / Unbilled / Overdue) ────────────── */}
      {showList && (() => {
        const cfg = {
          pending:  { title: 'Pending Tasks',  list: stats.pendingList,  color: '#000000', badge: (s) => s.status || 'Pending' },
          unbilled: { title: 'Unbilled Work',  list: stats.unbilledList, color: '#000000', badge: (s) => s.fees_status || 'Unpaid' },
          overdue:  { title: 'Overdue Items',  list: stats.overdueList,  color: '#000000', badge: (s) => s.regulatory_due_date ? new Date(s.regulatory_due_date).toLocaleDateString('en-GB') : '—' },
        }[showList];
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-overlay"
               style={{ background: 'rgba(0,0,0,0.45)' }}
               onClick={() => setShowList(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col animate-scale-in"
                 onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between p-5 border-b border-gray-100">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{cfg.title}</h3>
                  <p className="text-sm text-gray-500 mt-0.5">{cfg.list.length} item{cfg.list.length !== 1 ? 's' : ''}</p>
                </div>
                <button onClick={() => setShowList(null)} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors">
                  <X size={18} />
                </button>
              </div>
              <div className="overflow-y-auto flex-1 p-3 space-y-2">
                {cfg.list.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                    <CheckCircle2 size={36} className="text-gray-400 mb-2" />
                    <p className="font-medium text-gray-500">Nothing here!</p>
                  </div>
                ) : cfg.list.map((s, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 border border-gray-100 transition-colors">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-800 text-sm truncate">{s.client_name || '—'}</p>
                      <p className="text-xs text-gray-500 truncate mt-0.5">{s.service_category || '—'}{s.assignee ? ` · ${s.assignee}` : ''}</p>
                    </div>
                    <span className="ml-3 text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0"
                          style={{ background: cfg.color + '20', color: cfg.color }}>
                      {cfg.badge(s)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="p-4 border-t border-gray-100">
                <button onClick={() => { setShowList(null); navigate('/client-services'); }}
                        className="w-full py-2.5 rounded-xl text-sm font-semibold bg-gray-900 text-white hover:bg-gray-700 transition-colors">
                  View All Services
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Charts Row 1 ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Pending tasks donut */}
        <div className="card p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 opacity-[0.04]"
               style={{ background: 'radial-gradient(circle, #9CA3AF 0%, transparent 70%)' }} />
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-gray-100">
              <Clock size={18} className="text-gray-700" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 text-base">Pending Tasks</h2>
              <p className="text-xs text-gray-500">{stats.pendingCount} open service{stats.pendingCount !== 1 ? 's' : ''}</p>
            </div>
          </div>

          {pendingByStatus.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-44 text-gray-400">
              <CheckCircle2 size={40} className="text-gray-400 mb-2" />
              <p className="font-medium text-gray-500">All tasks completed!</p>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="55%" height={180}>
                <PieChart>
                  <Pie data={pendingByStatus} cx="50%" cy="50%" innerRadius={45} outerRadius={75}
                       paddingAngle={3} dataKey="value">
                    {pendingByStatus.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {pendingByStatus.map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-xs text-gray-600 flex-1 truncate">{item.name}</span>
                    <span className="text-xs font-bold text-gray-800">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Completed + billing status bar */}
        <div className="card p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 opacity-[0.04]"
               style={{ background: 'radial-gradient(circle, #9CA3AF 0%, transparent 70%)' }} />
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-gray-100">
              <Banknote size={18} className="text-gray-700" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 text-base">Billing Pipeline</h2>
              <p className="text-xs text-gray-500">Completed services by payment status</p>
            </div>
          </div>

          {completedBilling.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-44 text-gray-400">
              <Banknote size={36} className="mb-2 text-gray-300" />
              <p className="text-sm">No completed services yet</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={completedBilling} layout="vertical" barSize={18}
                        margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F3F4F6" />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#6B7280' }} width={100} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: '#F9FAFB' }} />
                <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                  {completedBilling.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Charts Row 2 ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Monthly deadlines area chart — spans 3 cols */}
        <div className="card p-6 lg:col-span-3 relative overflow-hidden">
          <div className="absolute bottom-0 right-0 w-40 h-40 opacity-[0.04]"
               style={{ background: 'radial-gradient(circle, #9CA3AF 0%, transparent 70%)' }} />
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-gray-100">
              <Calendar size={18} className="text-gray-600" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 text-base">Upcoming Deadlines</h2>
              <p className="text-xs text-gray-500">Internal & regulatory due dates — next 6 months</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={monthlyDeadlines} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gradInternal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#000000" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#000000" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradRegulatory" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#555555" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#555555" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
              <YAxis  tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              <Area type="monotone" dataKey="Internal"   stroke="#000000" strokeWidth={2.5} fill="url(#gradInternal)"   dot={{ r: 4, fill: '#000000' }} />
              <Area type="monotone" dataKey="Regulatory" stroke="#555555" strokeWidth={2.5} fill="url(#gradRegulatory)" dot={{ r: 4, fill: '#555555' }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Status breakdown — spans 2 cols */}
        <div className="card p-6 lg:col-span-2 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-24 h-24 opacity-[0.05]"
               style={{ background: 'radial-gradient(circle, #9CA3AF 0%, transparent 70%)' }} />
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-gray-100">
              <TrendingUp size={18} className="text-gray-600" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 text-base">All Services</h2>
              <p className="text-xs text-gray-500">Full status breakdown</p>
            </div>
          </div>
          <div className="space-y-3">
            {statusBreakdown.map((item, i) => {
              const pct = services.length ? Math.round((item.count / services.length) * 100) : 0;
              return (
                <div key={i}>
                  <div className="flex justify-between items-center mb-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-xs text-gray-600">{item.name}</span>
                    </div>
                    <span className="text-xs font-bold text-gray-800">{item.count}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700"
                         style={{ width: `${pct}%`, backgroundColor: item.color }} />
                  </div>
                </div>
              );
            })}
            {statusBreakdown.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8">No services yet</p>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
