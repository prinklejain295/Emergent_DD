import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import {
  Clock, Plus, Trash2, X, Search, Download,
  Users, BarChart2, List, Timer, TrendingUp, Coffee,
} from 'lucide-react';
import { toastMsg } from '../utils/errorLogger';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'https://emergent-dd-2b7s.vercel.app';
const API = `${BACKEND_URL}/api`;
const getAuthHeaders = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

const fmtDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  return isNaN(dt) ? d : dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const fmtMins = (m) => {
  const n = parseInt(m) || 0;
  if (n < 60) return `${n}m`;
  return `${Math.floor(n / 60)}h ${n % 60}m`;
};

const today = () => new Date().toISOString().split('T')[0];

const INTERNAL_CLIENT = 'Internal / Admin';

const INTERNAL_ACTIVITIES = [
  'Team Meeting', 'One-on-One', 'Training / Learning',
  'Business Development', 'Admin Tasks', 'Strategy / Planning', 'Other',
];

const EMPTY_FORM = {
  client_name: '', service_category: '', minutes: '', date: today(), notes: '', user_name: '',
};

/* ── Gradient palette for summary bars ─────────────────────── */
const BAR_COLORS = [
  '#000000','#222222','#444444','#666666','#000000',
  '#222222','#444444','#000000','#333333','#555555',
];

export default function TimesheetPage() {
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = ['admin', 'manager'].includes(currentUser.role);

  const [entries, setEntries]       = useState([]);
  const [clientsList, setClientsList] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [tab, setTab]               = useState('entries');
  const [showModal, setShowModal]   = useState(false);
  const [modalType, setModalType]   = useState('client'); // 'client' | 'internal'
  const [form, setForm]             = useState(EMPTY_FORM);
  const [customClient, setCustomClient] = useState('');  // when "Other" is selected
  const [saving, setSaving]         = useState(false);

  /* Filters */
  const [search, setSearch]               = useState('');
  const [filterEmployee, setFilterEmployee] = useState('all');
  const [filterClient, setFilterClient]   = useState('all');
  const [dateFrom, setDateFrom]           = useState('');
  const [dateTo, setDateTo]               = useState('');

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      const [tsRes, clRes] = await Promise.all([
        axios.get(`${API}/timesheets`, getAuthHeaders()),
        axios.get(`${API}/clients`, getAuthHeaders()),
      ]);
      setEntries(Array.isArray(tsRes.data) ? tsRes.data : []);
      setClientsList(Array.isArray(clRes.data) ? clRes.data.map(c => c.name).filter(Boolean) : []);
    } catch (err) {
      toast.error(await toastMsg('Timesheet.fetch', err, 'Failed to load timesheets'));
    } finally { setLoading(false); }
  };

  const resolvedClient = form.client_name === '__other__' ? customClient : form.client_name;

  const openClientModal = () => {
    setModalType('client');
    setForm(EMPTY_FORM);
    setCustomClient('');
    setShowModal(true);
  };

  const openInternalModal = () => {
    setModalType('internal');
    setForm({ ...EMPTY_FORM, client_name: INTERNAL_CLIENT });
    setCustomClient('');
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const clientName = resolvedClient.trim();
    if (!clientName) { toast.error('Client name is required'); return; }
    if (!form.user_name.trim()) { toast.error('Your name is required'); return; }
    if (!form.minutes || parseInt(form.minutes) <= 0) { toast.error('Enter valid minutes'); return; }
    setSaving(true);
    try {
      const serviceCategory = (modalType === 'internal' && form.service_category === 'Other')
        ? customClient || 'Other'
        : form.service_category;
      await axios.post(`${API}/timesheets`, {
        ...form,
        client_name:      clientName,
        service_category: serviceCategory,
        user_name:        form.user_name.trim(),
        minutes:          parseInt(form.minutes),
      }, getAuthHeaders());
      toast.success('Time logged');
      setShowModal(false);
      setForm(EMPTY_FORM);
      setCustomClient('');
      fetchAll();
    } catch (err) {
      toast.error(await toastMsg('Timesheet.save', err, 'Failed to log time'));
    } finally { setSaving(false); }
  };

  const handleDelete = async (entry) => {
    if (!window.confirm('Delete this timesheet entry?')) return;
    try {
      await axios.delete(`${API}/timesheets/${entry.Id}`, getAuthHeaders());
      toast.success('Entry deleted');
      fetchAll();
    } catch (err) {
      toast.error(await toastMsg('Timesheet.delete', err, 'Failed to delete'));
    }
  };

  /* ── Derived data ───────────────────────────────────────────── */
  const employees = useMemo(() => ['all', ...new Set(entries.map(e => e.user_name).filter(Boolean))], [entries]);
  const clients   = useMemo(() => ['all', ...new Set(entries.map(e => e.client_name).filter(Boolean))], [entries]);

  const filtered = useMemo(() => entries.filter(e => {
    const q = search.toLowerCase();
    if (q && !`${e.client_name} ${e.user_name} ${e.service_category}`.toLowerCase().includes(q)) return false;
    if (filterEmployee !== 'all' && e.user_name !== filterEmployee) return false;
    if (filterClient   !== 'all' && e.client_name !== filterClient) return false;
    if (dateFrom && e.date < dateFrom) return false;
    if (dateTo   && e.date > dateTo)   return false;
    return true;
  }), [entries, search, filterEmployee, filterClient, dateFrom, dateTo]);

  const totalMins = useMemo(() => filtered.reduce((s, e) => s + (parseInt(e.minutes) || 0), 0), [filtered]);

  /* ── Summary: time per client ───────────────────────────────── */
  const clientSummary = useMemo(() => {
    const map = {};
    entries.forEach(e => {
      const key = e.client_name || 'Unknown';
      if (!map[key]) map[key] = { client: key, total: 0, employees: new Set() };
      map[key].total += parseInt(e.minutes) || 0;
      if (e.user_name) map[key].employees.add(e.user_name);
    });
    return Object.values(map)
      .sort((a, b) => b.total - a.total)
      .map(r => ({ ...r, employees: [...r.employees] }));
  }, [entries]);

  const maxMins = useMemo(() => Math.max(...clientSummary.map(r => r.total), 1), [clientSummary]);

  /* ── Export ─────────────────────────────────────────────────── */
  const exportExcel = () => {
    const rows = filtered.map(e => ({
      Date:             e.date || '',
      Employee:         e.user_name || '',
      Client:           e.client_name || '',
      'Service / Task': e.service_category || '',
      Minutes:          parseInt(e.minutes) || 0,
      Hours:            ((parseInt(e.minutes) || 0) / 60).toFixed(2),
      Notes:            e.notes || '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Timesheets');
    XLSX.writeFile(wb, `timesheets_${today()}.xlsx`);
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900" />
    </div>
  );

  return (
    <div className="animate-fade-in space-y-6">

      {/* ── Header ────────────────────────────────────────────── */}
      <div className="page-header flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="page-title">Timesheets</h1>
          <p className="page-description">Track time spent per client across the team</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={exportExcel} className="btn-secondary flex items-center gap-2 text-sm py-2 px-4">
            <Download size={15} /> Export
          </button>
          <button onClick={openInternalModal}
                  className="flex items-center gap-2 text-sm py-2 px-4 rounded-xl font-semibold border-2 border-gray-200 bg-white text-gray-700 hover:border-gray-400 hover:bg-gray-50 transition-all">
            <Coffee size={15} /> Log Internal Time
          </button>
          <button onClick={openClientModal} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Log Time
          </button>
        </div>
      </div>

      {/* ── Summary cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Entries',     value: entries.length,                    icon: List,      color: '#000000' },
          { label: 'Total Hours',       value: fmtMins(entries.reduce((s,e) => s+(parseInt(e.minutes)||0),0)), icon: Timer, color: '#000000' },
          { label: 'Clients Served',    value: new Set(entries.map(e=>e.client_name)).size,  icon: Users,     color: '#000000' },
          { label: 'Team Members',      value: new Set(entries.map(e=>e.user_name)).size,    icon: TrendingUp,color: '#000000' },
        ].map(({ label, value, icon: Icon, color }, i) => (
          <div key={i} className="card p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                 style={{ background: color + '18' }}>
              <Icon size={22} style={{ color }} />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-gray-900">{value}</p>
              <p className="text-xs text-gray-500 font-medium mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Tabs ──────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {[
          { key: 'entries', label: 'Entries',  icon: List      },
          { key: 'summary', label: 'By Client', icon: BarChart2 },
        ].map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    tab === key ? 'bg-gray-900 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-200'
                  }`}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* ── ENTRIES TAB ───────────────────────────────────────── */}
      {tab === 'entries' && (
        <>
          {/* Filters */}
          <div className="card p-4 flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[180px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="Search client, employee, task…" className="input-field pl-8 h-9 text-sm"
                     value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            {isAdmin && (
              <select className="input-field h-9 text-sm w-44" value={filterEmployee} onChange={e => setFilterEmployee(e.target.value)}>
                <option value="all">All Employees</option>
                {employees.filter(e => e !== 'all').map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            )}
            <select className="input-field h-9 text-sm w-44" value={filterClient} onChange={e => setFilterClient(e.target.value)}>
              <option value="all">All Clients</option>
              {clients.filter(c => c !== 'all').map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input type="date" className="input-field h-9 text-sm w-36" value={dateFrom}
                   onChange={e => setDateFrom(e.target.value)} title="From date" />
            <input type="date" className="input-field h-9 text-sm w-36" value={dateTo}
                   onChange={e => setDateTo(e.target.value)} title="To date" />
            {(search || filterEmployee !== 'all' || filterClient !== 'all' || dateFrom || dateTo) && (
              <button onClick={() => { setSearch(''); setFilterEmployee('all'); setFilterClient('all'); setDateFrom(''); setDateTo(''); }}
                      className="text-sm text-gray-500 hover:text-gray-800 underline">Clear</button>
            )}
            <span className="ml-auto text-sm font-semibold text-gray-700">
              {filtered.length} entries · <span className="text-gray-900 font-bold">{fmtMins(totalMins)}</span>
            </span>
          </div>

          {/* Table */}
          {filtered.length === 0 ? (
            <div className="card p-14 text-center">
              <Clock size={40} className="mx-auto mb-3 text-gray-300" />
              <h3 className="text-lg font-semibold text-gray-600 mb-1">No timesheet entries yet</h3>
              <p className="text-gray-400 text-sm mb-6">Log time from a completed service or click "Log Time"</p>
              <button onClick={() => setShowModal(true)} className="btn-primary mx-auto">Log Time</button>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr style={{ background: '#111827' }}>
                      {['Date','Employee','Client','Service / Task','Time','Notes',''].map((h, i) => (
                        <th key={i} className="px-4 py-3.5 text-left text-white font-semibold text-xs tracking-wide uppercase whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((e, i) => (
                      <tr key={e.Id || i} className="group border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap text-gray-600 tabular-nums">{fmtDate(e.date)}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full">
                            {e.user_name || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap font-semibold text-gray-800">{e.client_name || '—'}</td>
                        <td className="px-4 py-3 max-w-[200px]">
                          <p className="truncate text-gray-600">{e.service_category || '—'}</p>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="font-bold text-gray-900">{fmtMins(e.minutes)}</span>
                          <span className="text-xs text-gray-400 ml-1">({e.minutes}m)</span>
                        </td>
                        <td className="px-4 py-3 max-w-[160px]">
                          <p className="truncate text-xs text-gray-400">{e.notes || '—'}</p>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {(isAdmin || e.user_id === currentUser.id) && (
                            <button onClick={() => handleDelete(e)}
                                    className="p-1.5 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all">
                              <Trash2 size={14} className="text-red-500" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100 text-xs text-gray-500 flex justify-between">
                <span>{filtered.length} entries</span>
                <span className="font-semibold">Total: {fmtMins(totalMins)}</span>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── SUMMARY TAB ───────────────────────────────────────── */}
      {tab === 'summary' && (
        <div className="space-y-4">
          {clientSummary.length === 0 ? (
            <div className="card p-14 text-center">
              <BarChart2 size={40} className="mx-auto mb-3 text-gray-300" />
              <p className="text-gray-400">No data yet — log some time first</p>
            </div>
          ) : clientSummary.map((row, i) => (
            <div key={row.client} className="card p-5">
              <div className="flex items-start justify-between mb-3 gap-4">
                <div className="min-w-0">
                  <p className="font-bold text-gray-900 truncate">{row.client}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {row.employees.join(', ')} · {entries.filter(e => e.client_name === row.client).length} entries
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-2xl font-extrabold" style={{ color: BAR_COLORS[i % BAR_COLORS.length] }}>
                    {fmtMins(row.total)}
                  </p>
                  <p className="text-xs text-gray-400">{row.total} minutes</p>
                </div>
              </div>
              {/* Progress bar */}
              <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700"
                     style={{ width: `${(row.total / maxMins) * 100}%`, background: BAR_COLORS[i % BAR_COLORS.length] }} />
              </div>
              {/* Per-employee breakdown */}
              <div className="flex flex-wrap gap-2 mt-3">
                {row.employees.map(emp => {
                  const empMins = entries
                    .filter(e => e.client_name === row.client && e.user_name === emp)
                    .reduce((s, e) => s + (parseInt(e.minutes) || 0), 0);
                  return (
                    <span key={emp} className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full font-medium">
                      {emp}: {fmtMins(empMins)}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Log Time Modal ─────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 modal-overlay">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-scale-in">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4"
                 style={{ background: modalType === 'internal' ? '#1E293B' : '#111827' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                  {modalType === 'internal' ? <Coffee size={17} className="text-white" /> : <Timer size={17} className="text-white" />}
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">
                    {modalType === 'internal' ? 'Log Internal Time' : 'Log Client Time'}
                  </h2>
                  <p className="text-gray-400 text-xs mt-0.5">
                    {modalType === 'internal' ? 'Meeting, training, admin, etc.' : 'Time spent on a client task'}
                  </p>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} className="text-white/60 hover:text-white p-1.5 rounded-lg hover:bg-white/10">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} noValidate autoComplete="off" className="p-6 space-y-4">

              {/* Name + Date */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Your Name *</label>
                  <input type="text" className="input-field" placeholder="Enter your name" autoFocus
                         autoComplete="off"
                         value={form.user_name} onChange={e => setForm(f => ({ ...f, user_name: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Date *</label>
                  <input type="date" className="input-field"
                         value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                </div>
              </div>

              {/* Client — dropdown for client type, fixed for internal */}
              {modalType === 'client' ? (
                <div>
                  <label className="label">Client *</label>
                  <select className="input-field text-sm"
                          value={form.client_name}
                          onChange={e => { setForm(f => ({ ...f, client_name: e.target.value })); setCustomClient(''); }}>
                    <option value="">— Select client —</option>
                    {clientsList.map(c => <option key={c} value={c}>{c}</option>)}
                    <option value="__other__">Other (type manually)</option>
                  </select>
                  {form.client_name === '__other__' && (
                    <input type="text" className="input-field mt-2" placeholder="Type client name"
                           value={customClient} onChange={e => setCustomClient(e.target.value)} autoFocus />
                  )}
                </div>
              ) : (
                <div>
                  <label className="label">Category</label>
                  <div className="flex flex-wrap gap-2">
                    {INTERNAL_ACTIVITIES.map(a => (
                      <button key={a} type="button"
                              onClick={() => setForm(f => ({ ...f, service_category: a }))}
                              className={`text-xs px-3 py-1.5 rounded-full border-2 font-semibold transition-all ${
                                form.service_category === a
                                  ? 'border-gray-900 bg-gray-900 text-white'
                                  : 'border-gray-200 text-gray-600 hover:border-gray-400'
                              }`}>
                        {a}
                      </button>
                    ))}
                  </div>
                  {form.service_category === 'Other' && (
                    <input type="text" className="input-field mt-2" placeholder="Describe the activity"
                           value={customClient} onChange={e => setCustomClient(e.target.value)} />
                  )}
                </div>
              )}

              {/* Service/Task — only for client type */}
              {modalType === 'client' && (
                <div>
                  <label className="label">Service / Task</label>
                  <input type="text" className="input-field" placeholder="e.g. GST Filing, ITR Preparation"
                         value={form.service_category} onChange={e => setForm(f => ({ ...f, service_category: e.target.value }))} />
                </div>
              )}

              {/* Minutes */}
              <div>
                <label className="label">Time Taken (minutes) *</label>
                <div className="relative">
                  <input type="number" min="1" max="9999" className="input-field pr-16" placeholder="e.g. 90"
                         value={form.minutes} onChange={e => setForm(f => ({ ...f, minutes: e.target.value }))} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">
                    {form.minutes ? fmtMins(form.minutes) : 'min'}
                  </span>
                </div>
              </div>

              <div>
                <label className="label">Notes</label>
                <textarea className="textarea-field text-sm" rows={2}
                          placeholder={modalType === 'internal' ? 'Meeting agenda, outcomes, attendees…' : 'What was done? Any observations?'}
                          value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>

              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving ? 'Saving…' : 'Log Time'}
                </button>
                <button type="button" onClick={() => setShowModal(false)} className="btn-outline flex-1">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
