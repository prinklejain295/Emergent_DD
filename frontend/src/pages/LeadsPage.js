import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import {
  Plus, Edit2, Trash2, Search, X, LayoutGrid, List,
  Linkedin, Mail, Globe, Phone, Star, ChevronDown,
  Calendar, Building2, User, ArrowUpDown, ChevronUp, Upload,
  CheckSquare, Square, RefreshCw,
} from 'lucide-react';
import { toastMsg } from '../utils/errorLogger';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'https://emergent-dd-2b7s.vercel.app';
const API = `${BACKEND_URL}/api`;
const getAuthHeaders = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

/* ── Constants ───────────────────────────────────────────────────── */
const PLATFORMS = [
  { value: 'LinkedIn',  icon: Linkedin, color: '#0A66C2', bg: '#E8F0F9' },
  { value: 'Google',    icon: Globe,    color: '#EA4335', bg: '#FDE8E6' },
  { value: 'Yelp',      icon: Star,     color: '#D32323', bg: '#FDEAEA' },
  { value: 'Email',     icon: Mail,     color: '#7C3AED', bg: '#F3F4F6' },
  { value: 'Referral',  icon: User,     color: '#059669', bg: '#D1FAE5' },
  { value: 'Cold Call', icon: Phone,    color: '#D97706', bg: '#FEF3C7' },
  { value: 'Other',     icon: Globe,    color: '#6B7280', bg: '#F3F4F6' },
];

const STATUSES = [
  { label: 'New Lead',       bg: '#DBEAFE', text: '#1E40AF', border: '#BFDBFE', dot: '#3B82F6' },
  { label: 'Contacted',      bg: '#F3F4F6', text: '#374151', border: '#E5E7EB', dot: '#7C3AED' },
  { label: 'In Discussion',  bg: '#FEF9C3', text: '#854D0E', border: '#FEF08A', dot: '#F59E0B' },
  { label: 'Proposal Sent',  bg: '#FFEDD5', text: '#9A3412', border: '#FED7AA', dot: '#F97316' },
  { label: 'Negotiating',    bg: '#F3E8FF', text: '#6B21A8', border: '#E9D5FF', dot: '#A855F7' },
  { label: 'Converted',      bg: '#DCFCE7', text: '#166534', border: '#BBF7D0', dot: '#10B981' },
  { label: 'Lost',           bg: '#FEE2E2', text: '#991B1B', border: '#FECACA', dot: '#EF4444' },
  { label: 'On Hold',        bg: '#F1F5F9', text: '#475569', border: '#E2E8F0', dot: '#94A3B8' },
];

const getStatusStyle = (s) => STATUSES.find(o => o.label === s) || STATUSES[0];

const getPlatform = (p) => PLATFORMS.find(o => o.value === p) || PLATFORMS[PLATFORMS.length - 1];

const fmtDate = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d) ? '—' : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const daysSince = (v) => {
  if (!v) return null;
  const d = new Date(v);
  if (isNaN(d)) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
};

const EMPTY = {
  name: '', business_name: '', platform: '',
  status: '', last_followup_date: '', lead_generated_date: '',
  lead_manager: '', notes: '',
};

const GRADIENTS = [
  'linear-gradient(135deg,#7C3AED,#A855F7)',
  'linear-gradient(135deg,#3B82F6,#6366F1)',
  'linear-gradient(135deg,#EC4899,#F43F5E)',
  'linear-gradient(135deg,#10B981,#3B82F6)',
  'linear-gradient(135deg,#F59E0B,#EF4444)',
  'linear-gradient(135deg,#06B6D4,#7C3AED)',
];

/* ── Component ────────────────────────────────────────────────────── */
export default function LeadsPage() {
  const [leads, setLeads]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [viewMode, setViewMode]   = useState('table');
  const [showModal, setShowModal] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [formData, setFormData]   = useState(EMPTY);
  const [importing, setImporting]   = useState(false);
  const [selected, setSelected]     = useState(new Set()); // Set of lead Id values
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkActing, setBulkActing] = useState(false);

  /* Global search */
  const [search, setSearch] = useState('');

  /* Column-level filters */
  const EMPTY_CF = { name:'', business:'', platform:'all', status:'all', manager:'', dateFrom:'', dateTo:'' };
  const [cf, setCf]   = useState(EMPTY_CF);
  const setCol        = (k, v) => { setCf(p => ({ ...p, [k]: v })); setPage(1); };
  const clearFilters  = () => { setCf(EMPTY_CF); setSearch(''); setPage(1); };
  const anyFilter     = search || Object.entries(cf).some(([k, v]) => v !== '' && v !== 'all');

  /* Sort */
  const [sortKey, setSortKey] = useState('created_at');
  const [sortDir, setSortDir] = useState('desc');

  /* Pagination */
  const PAGE_SIZE = 50;
  const [page, setPage] = useState(1);

  useEffect(() => { fetchLeads(); }, []);
  useEffect(() => { setSelected(new Set()); setPage(1); }, [search, cf, sortKey, sortDir]);

  const fetchLeads = async () => {
    try {
      const res = await axios.get(`${API}/leads`, getAuthHeaders());
      setLeads(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      toast.error(await toastMsg('LeadsPage.fetch', err, 'Failed to load leads'));
    } finally { setLoading(false); }
  };

  const openAdd = () => {
    setEditingLead(null);
    setFormData(EMPTY);
    setShowModal(true);
  };

  const openEdit = (lead) => {
    setEditingLead(lead);
    setFormData({
      name:                lead.name || '',
      business_name:       lead.business_name || '',
      platform:            lead.platform || '',
      status:              lead.status || '',
      last_followup_date:  lead.last_followup_date ? lead.last_followup_date.split('T')[0] : '',
      lead_generated_date: lead.lead_generated_date ? lead.lead_generated_date.split('T')[0] : '',
      lead_manager:        lead.lead_manager || '',
      notes:               lead.notes || '',
    });
    setShowModal(true);
  };

  const set = (key, val) => setFormData(f => ({ ...f, [key]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) { toast.error('Name is required'); return; }
    try {
      const payload = { ...formData, last_followup_date: formData.last_followup_date || null };
      if (editingLead) {
        await axios.put(`${API}/leads/${editingLead.Id}`, payload, getAuthHeaders());
        toast.success('Lead updated');
      } else {
        await axios.post(`${API}/leads`, payload, getAuthHeaders());
        toast.success('Lead added');
      }
      setShowModal(false);
      fetchLeads();
    } catch (err) {
      toast.error(await toastMsg('LeadsPage.save', err, 'Failed to save lead'));
    }
  };

  const handleDelete = async (lead) => {
    if (!window.confirm(`Delete lead "${lead.name}"?`)) return;
    try {
      await axios.delete(`${API}/leads/${lead.Id}`, getAuthHeaders());
      toast.success('Lead deleted');
      fetchLeads();
    } catch (err) {
      toast.error(await toastMsg('LeadsPage.delete', err, 'Failed to delete'));
    }
  };

  /* Excel import — uses FileReader for broad browser compatibility */
  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    /* reset input so the same file can be re-selected */
    e.target.value = null;
    setImporting(true);

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const wb      = XLSX.read(new Uint8Array(ev.target.result), { type: 'array' });
        const ws      = wb.Sheets[wb.SheetNames[0]];
        const allRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

        if (!allRows.length) { toast.error('No data found in the file'); setImporting(false); return; }

        const LEAD_KW = ['name','contact','client','platform','status','source',
                         'notes','remarks','manager','follow','date','business','company'];
        const hasKW   = (cell) => LEAD_KW.some(kw => String(cell).toLowerCase().includes(kw));
        const str     = (v)    => String(v ?? '').trim();
        const pick    = (obj, ...keys) => {
          for (const k of keys) {
            const hit = Object.keys(obj).find(h => h.includes(k));
            if (hit && obj[hit]) return obj[hit];
          }
          return '';
        };

        /* ── Detect structure ──────────────────────────────────── */
        // Check if row 0 has section labels (non-empty, non-keyword cells like "PJ", "NS")
        const row0 = allRows[0].map(str);
        const sectionMarkers = row0.reduce((acc, cell, i) => {
          if (cell && !hasKW(cell)) acc.push({ label: cell, col: i });
          return acc;
        }, []);

        let sections   = [];   // [{ label, colStart, colEnd, headers[] }]
        let dataStart  = 1;    // row index where data begins

        if (sectionMarkers.length >= 2 && allRows.length > 1 && allRows[1].some(hasKW)) {
          /* Multi-section layout: row 0 = section labels, row 1 = column headers */
          const colHeaders = allRows[1].map(c => str(c).toLowerCase());
          dataStart = 2;
          sections = sectionMarkers.map((m, idx) => {
            const colEnd = idx < sectionMarkers.length - 1
              ? sectionMarkers[idx + 1].col
              : colHeaders.length;
            return { label: m.label, colStart: m.col, colEnd, headers: colHeaders.slice(m.col, colEnd) };
          });
        } else {
          /* Single-section layout: find the first keyword row as header */
          let headerIdx = 0;
          for (let i = 0; i < Math.min(allRows.length, 15); i++) {
            if (allRows[i].some(hasKW)) { headerIdx = i; break; }
          }
          const colHeaders = allRows[headerIdx].map(c => str(c).toLowerCase());
          dataStart = headerIdx + 1;
          sections = [{ label: '', colStart: 0, colEnd: colHeaders.length, headers: colHeaders }];
        }

        const dataRows = allRows.slice(dataStart).filter(r => r.some(c => str(c) !== ''));

        if (!dataRows.length) { toast.error('No data rows found'); setImporting(false); return; }

        /* ── Import one lead per section per row ───────────────── */
        let created = 0, skipped = 0;
        for (const rawRow of dataRows) {
          for (const sec of sections) {
            /* Map this section's columns into an object */
            const obj = {};
            sec.headers.forEach((h, i) => { if (h) obj[h] = str(rawRow[sec.colStart + i]); });

            const name = pick(obj, 'name','contact name','contact','full name','lead name','client name');
            if (!name) { skipped++; continue; }

            const payload = {
              name,
              business_name:       pick(obj, 'business name','business_name','company','firm','organisation','organization'),
              platform:            pick(obj, 'platform','source','channel','lead source'),
              status:              pick(obj, 'status','lead status') || 'New Lead',
              lead_manager:        pick(obj, 'lead manager','lead_manager','manager','assigned to','assignee') || sec.label || '',
              lead_generated_date: pick(obj, 'lead generated date','lead_generated_date','generated date','generated on','date') || null,
              last_followup_date:  pick(obj, 'last follow-up','last_followup_date','follow up date','last contact','followup date') || null,
              notes:               pick(obj, 'notes','remarks','comments','description'),
            };
            try {
              await axios.post(`${API}/leads`, payload, getAuthHeaders());
              created++;
            } catch (_err) { skipped++; }
          }
        }

        toast.success(`Imported ${created} lead${created !== 1 ? 's' : ''}${skipped ? ` · ${skipped} skipped` : ''}`);
        fetchLeads();
      } catch (err) {
        console.error('Import error:', err);
        toast.error(`Import failed: ${err.message || 'Could not parse file'}`);
      } finally {
        setImporting(false);
      }
    };
    reader.onerror = () => {
      toast.error('Could not read the file');
      setImporting(false);
    };
    reader.readAsArrayBuffer(file);
  };

  /* Quick status change from table */
  const handleStatusChange = async (lead, newStatus) => {
    try {
      await axios.put(`${API}/leads/${lead.Id}`, { ...lead, status: newStatus }, getAuthHeaders());
      setLeads(prev => prev.map(l => l.Id === lead.Id ? { ...l, status: newStatus } : l));
    } catch (err) {
      toast.error(await toastMsg('LeadsPage.status', err, 'Failed to update status'));
    }
  };

  /* ── Selection helpers ────────────────────────────────────────── */
  const toggleSelect = (id) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const toggleSelectAll = (ids) => {
    setSelected(prev => ids.every(id => prev.has(id)) ? new Set() : new Set(ids));
  };

  /* ── Bulk delete ──────────────────────────────────────────────── */
  const handleBulkDelete = async () => {
    if (!selected.size) return;
    if (!window.confirm(`Delete ${selected.size} lead${selected.size !== 1 ? 's' : ''}?`)) return;
    setBulkActing(true);
    let done = 0;
    for (const id of selected) {
      try { await axios.delete(`${API}/leads/${id}`, getAuthHeaders()); done++; } catch (_e) {}
    }
    toast.success(`Deleted ${done} lead${done !== 1 ? 's' : ''}`);
    setSelected(new Set());
    fetchLeads();
    setBulkActing(false);
  };

  /* ── Bulk status change ───────────────────────────────────────── */
  const handleBulkStatus = async (newStatus) => {
    if (!selected.size || !newStatus) return;
    setBulkActing(true);
    let done = 0;
    for (const id of selected) {
      const lead = leads.find(l => l.Id === id);
      if (!lead) continue;
      try {
        await axios.put(`${API}/leads/${id}`, { ...lead, status: newStatus }, getAuthHeaders());
        done++;
      } catch (_e) {}
    }
    toast.success(`Updated ${done} lead${done !== 1 ? 's' : ''} to "${newStatus}"`);
    setSelected(new Set());
    setBulkStatus('');
    fetchLeads();
    setBulkActing(false);
  };

  /* Sort */
  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };
  const SortIcon = ({ col }) => {
    if (sortKey !== col) return <ArrowUpDown size={12} className="text-white/50 ml-1 inline" />;
    return sortDir === 'asc'
      ? <ChevronUp size={12} className="text-white ml-1 inline" />
      : <ChevronDown size={12} className="text-white ml-1 inline" />;
  };

  /* Filtered + sorted */
  const displayed = leads
    .filter(l => {
      const q = search.toLowerCase();
      if (q && !(l.name||'').toLowerCase().includes(q) && !(l.business_name||'').toLowerCase().includes(q) && !(l.lead_manager||'').toLowerCase().includes(q)) return false;
      if (cf.name     && !(l.name          ||'').toLowerCase().includes(cf.name.toLowerCase()))    return false;
      if (cf.business && !(l.business_name ||'').toLowerCase().includes(cf.business.toLowerCase())) return false;
      if (cf.manager  && !(l.lead_manager  ||'').toLowerCase().includes(cf.manager.toLowerCase()))  return false;
      if (cf.platform !== 'all' && l.platform !== cf.platform) return false;
      if (cf.status   !== 'all' && l.status   !== cf.status)   return false;
      if (cf.dateFrom && (l.last_followup_date || '') < cf.dateFrom) return false;
      if (cf.dateTo   && (l.last_followup_date || '') > cf.dateTo)   return false;
      return true;
    })
    .sort((a, b) => {
      const av = (a[sortKey] || '').toString();
      const bv = (b[sortKey] || '').toString();
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });

  const totalPages = Math.max(1, Math.ceil(displayed.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const paginated  = displayed.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  /* Pipeline: group by status */
  const pipeline = STATUSES.map(s => ({
    ...s,
    leads: displayed.filter(l => l.status === s.label),
  })).filter(s => s.leads.length > 0);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900" />
    </div>
  );

  /* ── RENDER ──────────────────────────────────────────────────────── */
  return (
    <div className="animate-fade-in">

      {/* Header */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Leads Pipeline</h1>
          <p className="page-description">{leads.length} lead{leads.length !== 1 ? 's' : ''} · {leads.filter(l => l.status === 'Converted').length} converted</p>
        </div>
        <div className="flex gap-2 self-start sm:self-auto">
          <label className={`btn-secondary flex items-center gap-2 text-sm py-2 px-4 cursor-pointer ${importing ? 'opacity-60 pointer-events-none' : ''}`}>
            <Upload size={16} /> {importing ? 'Importing…' : 'Import Excel'}
            <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} disabled={importing} />
          </label>
          <button onClick={openAdd} className="btn-primary flex items-center gap-2">
            <Plus size={18} /> Add Lead
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="card p-3 mb-4 flex flex-col sm:flex-row gap-3 items-center">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Quick search name, business, manager…" className="input-field pl-9 text-sm h-9"
                 value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={13} /></button>}
        </div>
        {anyFilter && (
          <button onClick={clearFilters} className="text-xs font-semibold text-red-500 hover:text-red-700 whitespace-nowrap px-2">
            ✕ Clear filters
          </button>
        )}
        <div className="flex rounded-xl border-2 border-gray-200 overflow-hidden h-9 self-center flex-shrink-0">
          {[['table','≡ Table'],['pipeline','◫ Pipeline']].map(([mode, label]) => (
            <button key={mode} onClick={() => setViewMode(mode)}
                    className={`px-3 text-xs font-semibold transition-colors ${viewMode === mode ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Bulk action bar ─────────────────────────────────────────── */}
      {selected.size > 0 && (
        <div className="sticky top-4 z-30 mb-4 flex items-center gap-3 bg-gray-900 text-white rounded-2xl px-5 py-3 shadow-xl animate-scale-in">
          <span className="font-semibold text-sm">
            {selected.size} lead{selected.size !== 1 ? 's' : ''} selected
          </span>
          <div className="flex-1" />

          {/* Bulk status change */}
          <select value={bulkStatus}
                  onChange={e => { setBulkStatus(e.target.value); if (e.target.value) handleBulkStatus(e.target.value); }}
                  disabled={bulkActing}
                  className="text-xs font-semibold bg-white/10 border border-white/20 text-white rounded-lg px-3 py-1.5 cursor-pointer focus:outline-none hover:bg-white/20 transition-colors">
            <option value="">Change status…</option>
            {STATUSES.map(s => <option key={s.label} value={s.label} className="text-gray-900">{s.label}</option>)}
          </select>

          {/* Bulk delete */}
          <button onClick={handleBulkDelete} disabled={bulkActing}
                  className="flex items-center gap-1.5 text-xs font-semibold bg-red-500/80 hover:bg-red-500 px-3 py-1.5 rounded-lg transition-colors">
            <Trash2 size={13} /> {bulkActing ? 'Working…' : 'Delete'}
          </button>

          {/* Clear selection */}
          <button onClick={() => setSelected(new Set())}
                  className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
            <X size={16} />
          </button>
        </div>
      )}

      {/* ── Status summary chips ────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 mb-4">
        {STATUSES.map(s => {
          const count = leads.filter(l => l.status === s.label).length;
          if (!count) return null;
          return (
            <button key={s.label} onClick={() => { setCol('status', cf.status === s.label ? 'all' : s.label); }}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${cf.status === s.label ? 'ring-2 ring-gray-900 ring-offset-1' : ''}`}
                    style={{ backgroundColor: s.bg, color: s.text, borderColor: s.border }}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.dot }} />
              {s.label} <span className="font-bold ml-0.5">{count}</span>
            </button>
          );
        })}
      </div>

      {displayed.length === 0 ? (
        <div className="card p-14 text-center">
          <div className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center"
               style={{ background: 'linear-gradient(135deg,#F3F4F6,#E5E7EB)' }}>
            <User size={36} className="text-gray-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">No leads found</h3>
          <p className="text-gray-500 mb-6">{search || filterStatus !== 'all' || filterPlatform !== 'all' ? 'Try adjusting filters' : 'Start tracking potential clients'}</p>
          {!search && filterStatus === 'all' && filterPlatform === 'all' && <button onClick={openAdd} className="btn-primary">Add First Lead</button>}
        </div>

      ) : viewMode === 'table' ? (

        /* ── TABLE VIEW ─────────────────────────────────────────────── */
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                {/* ── Sort row ── */}
                <tr style={{ background: '#111827' }}>
                  <th className="px-3 py-3 w-10">
                    <button onClick={() => toggleSelectAll(paginated.map(l => l.Id))}
                            className="text-white/70 hover:text-white transition-colors">
                      {paginated.length > 0 && paginated.every(l => selected.has(l.Id))
                        ? <CheckSquare size={15} /> : <Square size={15} />}
                    </button>
                  </th>
                  {[
                    ['name','Name'],['business_name','Business'],['platform','Platform'],
                    ['status','Status'],['lead_generated_date','Generated'],
                    ['last_followup_date','Last Follow-up'],['lead_manager','Manager'],
                    ['','Notes'],['',''],
                  ].map(([key, label]) => (
                    <th key={key+label} onClick={() => key && toggleSort(key)}
                        className={`px-4 py-3 text-left text-white font-semibold text-xs tracking-wide uppercase whitespace-nowrap ${key ? 'cursor-pointer select-none hover:bg-white/10 transition-colors' : ''}`}>
                      {label}{key && <SortIcon col={key} />}
                    </th>
                  ))}
                </tr>

                {/* ── Filter row ── */}
                <tr className="bg-gray-100 border-b border-gray-200">
                  <td className="px-3 py-2" />
                  {/* Name */}
                  <td className="px-2 py-2">
                    <input type="text" placeholder="Name…" value={cf.name}
                           onChange={e => setCol('name', e.target.value)}
                           className="w-full text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:border-gray-500" />
                  </td>
                  {/* Business */}
                  <td className="px-2 py-2">
                    <input type="text" placeholder="Business…" value={cf.business}
                           onChange={e => setCol('business', e.target.value)}
                           className="w-full text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:border-gray-500" />
                  </td>
                  {/* Platform */}
                  <td className="px-2 py-2">
                    <select value={cf.platform} onChange={e => setCol('platform', e.target.value)}
                            className="w-full text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:border-gray-500 bg-white">
                      <option value="all">All</option>
                      {PLATFORMS.map(p => <option key={p.value} value={p.value}>{p.value}</option>)}
                    </select>
                  </td>
                  {/* Status */}
                  <td className="px-2 py-2">
                    <select value={cf.status} onChange={e => setCol('status', e.target.value)}
                            className="w-full text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:border-gray-500 bg-white">
                      <option value="all">All</option>
                      {STATUSES.map(s => <option key={s.label} value={s.label}>{s.label}</option>)}
                    </select>
                  </td>
                  {/* Generated — no filter */}
                  <td className="px-2 py-2" />
                  {/* Last Follow-up from/to */}
                  <td className="px-2 py-2">
                    <div className="flex gap-1">
                      <input type="date" value={cf.dateFrom} onChange={e => setCol('dateFrom', e.target.value)}
                             title="From date"
                             className="w-full text-xs border border-gray-300 rounded-lg px-1.5 py-1.5 focus:outline-none focus:border-gray-500" />
                      <input type="date" value={cf.dateTo} onChange={e => setCol('dateTo', e.target.value)}
                             title="To date"
                             className="w-full text-xs border border-gray-300 rounded-lg px-1.5 py-1.5 focus:outline-none focus:border-gray-500" />
                    </div>
                  </td>
                  {/* Manager */}
                  <td className="px-2 py-2">
                    <input type="text" placeholder="Manager…" value={cf.manager}
                           onChange={e => setCol('manager', e.target.value)}
                           className="w-full text-xs border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:border-gray-500" />
                  </td>
                  {/* Notes + Actions */}
                  <td className="px-2 py-2" />
                  <td className="px-2 py-2">
                    {anyFilter && (
                      <button onClick={clearFilters} title="Clear all filters"
                              className="text-xs text-red-500 hover:text-red-700 font-semibold">✕</button>
                    )}
                  </td>
                </tr>
              </thead>
              <tbody>
                {paginated.map((lead, i) => {
                  const plat = getPlatform(lead.platform);
                  const PlatIcon = plat.icon;
                  const st = getStatusStyle(lead.status);
                  const days = daysSince(lead.last_followup_date);
                  const isStale = days !== null && days > 7 && lead.status !== 'Converted' && lead.status !== 'Lost';

                  return (
                    <tr key={lead.Id || i}
                        className={`group border-b border-gray-100 transition-colors ${selected.has(lead.Id) ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                      {/* Checkbox */}
                      <td className="px-3 py-3 w-10">
                        <button onClick={() => toggleSelect(lead.Id)}
                                className="text-gray-400 hover:text-gray-700 transition-colors">
                          {selected.has(lead.Id) ? <CheckSquare size={16} className="text-blue-600" /> : <Square size={16} />}
                        </button>
                      </td>
                      {/* Name */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                               style={{ background: GRADIENTS[i % GRADIENTS.length] }}>
                            {(lead.name || '?')[0].toUpperCase()}
                          </div>
                          <span className="font-semibold text-[#111827]">{lead.name}</span>
                        </div>
                      </td>

                      {/* Business */}
                      <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                        {lead.business_name || <span className="text-gray-300">—</span>}
                      </td>

                      {/* Platform */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                              style={{ backgroundColor: plat.bg, color: plat.color }}>
                          <PlatIcon size={11} />
                          {lead.platform || '—'}
                        </span>
                      </td>

                      {/* Status — inline dropdown */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <select value={lead.status || 'New Lead'}
                                onChange={e => handleStatusChange(lead, e.target.value)}
                                className="text-xs font-semibold px-2.5 py-1 rounded-full border cursor-pointer focus:outline-none focus:ring-2 focus:ring-gray-900"
                                style={{ backgroundColor: st.bg, color: st.text, borderColor: st.border }}>
                          {STATUSES.map(s => <option key={s.label} value={s.label}>{s.label}</option>)}
                        </select>
                      </td>

                      {/* Lead generated date */}
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                        {fmtDate(lead.lead_generated_date) || <span className="text-gray-300">—</span>}
                      </td>

                      {/* Last follow-up */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div>
                          <p className={`text-sm font-medium ${isStale ? 'text-red-600' : 'text-gray-700'}`}>
                            {fmtDate(lead.last_followup_date)}
                          </p>
                          {days !== null && (
                            <p className={`text-xs mt-0.5 ${isStale ? 'text-red-400 font-semibold' : 'text-gray-400'}`}>
                              {days === 0 ? 'Today' : `${days}d ago`}{isStale ? ' ⚠️' : ''}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Lead manager */}
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                        {lead.lead_manager || <span className="text-gray-300">—</span>}
                      </td>

                      {/* Notes */}
                      <td className="px-4 py-3 max-w-[200px]">
                        <p className="text-xs text-gray-500 truncate">{lead.notes || '—'}</p>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEdit(lead)} className="p-1.5 hover:bg-gray-50 rounded-lg" title="Edit">
                            <Edit2 size={14} className="text-gray-500" />
                          </button>
                          <button onClick={() => handleDelete(lead)} className="p-1.5 hover:bg-red-50 rounded-lg" title="Delete">
                            <Trash2 size={14} className="text-red-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Pagination bar */}
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-3 flex-wrap">
            <span className="text-xs text-gray-500">
              Showing <span className="font-semibold text-gray-700">{(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, displayed.length)}</span> of <span className="font-semibold text-gray-700">{displayed.length}</span> lead{displayed.length !== 1 ? 's' : ''}
            </span>
            <div className="flex items-center gap-1">
              {/* Prev */}
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1}
                      className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                ← Prev
              </button>

              {/* Page numbers */}
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 2)
                .reduce((acc, p, idx, arr) => {
                  if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...');
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, i) => p === '...'
                  ? <span key={`ellipsis-${i}`} className="px-1.5 text-xs text-gray-400">…</span>
                  : <button key={p} onClick={() => setPage(p)}
                            className={`w-8 h-7 text-xs font-semibold rounded-lg transition-colors ${
                              p === safePage
                                ? 'bg-gray-900 text-white'
                                : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-100'
                            }`}>
                      {p}
                    </button>
                )}

              {/* Next */}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
                      className="px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                Next →
              </button>
            </div>
          </div>
        </div>

      ) : (

        /* ── PIPELINE VIEW ──────────────────────────────────────────── */
        <div className="flex gap-4 overflow-x-auto pb-4">
          {pipeline.map((stage) => (
            <div key={stage.label} className="flex-shrink-0 w-72">
              {/* Stage header */}
              <div className="flex items-center gap-2 mb-3 px-1">
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: stage.dot }} />
                <span className="font-bold text-sm text-[#111827]">{stage.label}</span>
                <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: stage.bg, color: stage.text }}>{stage.leads.length}</span>
              </div>

              {/* Lead cards */}
              <div className="space-y-3">
                {stage.leads.map((lead, i) => {
                  const plat = getPlatform(lead.platform);
                  const PlatIcon = plat.icon;
                  const days = daysSince(lead.last_followup_date);
                  const isStale = days !== null && days > 7 && stage.label !== 'Converted' && stage.label !== 'Lost';

                  return (
                    <div key={lead.Id || i} className="bg-white rounded-2xl border border-[#F3F4F6] p-4 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
                      {/* Top color bar */}
                      <div className="absolute top-0 left-0 right-0 h-0.5" style={{ backgroundColor: stage.dot }} />

                      {/* Name + actions */}
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                               style={{ background: GRADIENTS[i % GRADIENTS.length] }}>
                            {(lead.name || '?')[0].toUpperCase()}
                          </div>
                          <p className="font-semibold text-[#111827] text-sm truncate">{lead.name}</p>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                          <button onClick={() => openEdit(lead)} className="p-1 hover:bg-gray-50 rounded-lg"><Edit2 size={12} className="text-gray-500" /></button>
                          <button onClick={() => handleDelete(lead)} className="p-1 hover:bg-red-50 rounded-lg"><Trash2 size={12} className="text-red-400" /></button>
                        </div>
                      </div>

                      {/* Business */}
                      {lead.business_name && (
                        <div className="flex items-center gap-1.5 mb-2">
                          <Building2 size={12} className="text-gray-400 flex-shrink-0" />
                          <span className="text-xs text-gray-500 truncate">{lead.business_name}</span>
                        </div>
                      )}

                      {/* Platform */}
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full mb-2"
                            style={{ backgroundColor: plat.bg, color: plat.color }}>
                        <PlatIcon size={10} />{lead.platform}
                      </span>

                      {/* Follow-up date */}
                      <div className={`flex items-center gap-1.5 text-xs mt-1 ${isStale ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
                        <Calendar size={11} />
                        <span>{fmtDate(lead.last_followup_date)}{isStale ? ` (${days}d ago ⚠️)` : days !== null ? ` · ${days}d ago` : ''}</span>
                      </div>

                      {/* Notes */}
                      {lead.notes && <p className="text-xs text-gray-400 mt-2 line-clamp-2">{lead.notes}</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modal ─────────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg flex flex-col max-h-[92vh] overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 flex-shrink-0"
                 style={{ background: '#111827' }}>
              <div>
                <h2 className="text-lg font-bold text-white">{editingLead ? 'Edit Lead' : 'Add New Lead'}</h2>
                <p className="text-slate-300 text-xs mt-0.5">Track a potential client</p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-white/70 hover:text-white hover:bg-white/15 p-1.5 rounded-lg"><X size={20} /></button>
            </div>

            <form onSubmit={handleSubmit} noValidate className="overflow-y-auto flex-1 px-6 py-5 space-y-4">

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Contact Name *</label>
                  <input type="text" className="input-field" placeholder="Full name" autoFocus
                         value={formData.name} onChange={e => set('name', e.target.value)} required />
                </div>
                <div>
                  <label className="label">Business Name</label>
                  <input type="text" className="input-field" placeholder="Company / firm name"
                         value={formData.business_name} onChange={e => set('business_name', e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Platform Met On</label>
                  <div className="grid grid-cols-1 gap-2">
                    <select className="input-field text-sm" value={formData.platform} onChange={e => set('platform', e.target.value)}>
                      <option value="">— Select platform —</option>
                      {PLATFORMS.map(p => <option key={p.value} value={p.value}>{p.value}</option>)}
                    </select>
                    {/* Preview chip */}
                    {formData.platform && (() => {
                      const p = getPlatform(formData.platform);
                      const I = p.icon;
                      return (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-full w-fit"
                              style={{ backgroundColor: p.bg, color: p.color }}>
                          <I size={12} /> {formData.platform}
                        </span>
                      );
                    })()}
                  </div>
                </div>
                <div>
                  <label className="label">Lead Status</label>
                  <select className="input-field text-sm" value={formData.status} onChange={e => set('status', e.target.value)}>
                    <option value="">— Select status —</option>
                    {STATUSES.map(s => <option key={s.label} value={s.label}>{s.label}</option>)}
                  </select>
                  {formData.status && (() => {
                    const s = getStatusStyle(formData.status);
                    return (
                      <span className="inline-flex items-center gap-1.5 mt-2 text-xs font-semibold px-2.5 py-1 rounded-full border"
                            style={{ backgroundColor: s.bg, color: s.text, borderColor: s.border }}>
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.dot }} />
                        {formData.status}
                      </span>
                    );
                  })()}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Lead Generated Date</label>
                  <input type="date" className="input-field" value={formData.lead_generated_date}
                         onChange={e => set('lead_generated_date', e.target.value)} />
                </div>
                <div>
                  <label className="label">Date of Last Follow-up</label>
                  <input type="date" className="input-field" value={formData.last_followup_date}
                         onChange={e => set('last_followup_date', e.target.value)} />
                </div>
              </div>

              <div>
                <label className="label">Lead Manager</label>
                <input type="text" className="input-field" placeholder="Name of person managing this lead"
                       value={formData.lead_manager} onChange={e => set('lead_manager', e.target.value)} />
              </div>

              <div>
                <label className="label">Notes</label>
                <textarea className="textarea-field text-sm" rows={3}
                          placeholder="Call summary, next steps, context…"
                          value={formData.notes} onChange={e => set('notes', e.target.value)} />
              </div>

              <div className="flex gap-3 pt-1">
                <button type="submit" className="btn-primary flex-1">{editingLead ? 'Update Lead' : 'Add Lead'}</button>
                <button type="button" onClick={() => setShowModal(false)} className="btn-outline flex-1">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
