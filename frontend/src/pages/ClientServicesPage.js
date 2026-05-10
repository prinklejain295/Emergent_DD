import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { Plus, Edit2, Trash2, Search, X, Upload, Download, Filter, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { toastMsg } from '../utils/errorLogger';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'https://emergent-dd-2b7s.vercel.app';
const API = `${BACKEND_URL}/api`;
const getAuthHeaders = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

const SERVICE_CATEGORIES = [
  'Tax Filing', 'Payroll', 'Audit', 'GST / VAT', 'Compliance',
  'Advisory', 'Bookkeeping', 'Company Registration', 'Annual Filing',
  'TDS Filing', 'ROC Filing', 'Other',
];
const FEES_STATUS_OPTIONS = ['Pre Payment', 'Post Payment', 'Pending Payment', 'Invoiced', 'Waived', 'On Hold'];
const STATUS_OPTIONS = [
  { label: 'Done',         bg: '#DCFCE7', text: '#166534', border: '#BBF7D0' },
  { label: 'In Progress',  bg: '#FEF9C3', text: '#854D0E', border: '#FEF08A' },
  { label: 'Under Review', bg: '#DBEAFE', text: '#1E40AF', border: '#BFDBFE' },
  { label: 'Pending',      bg: '#F3F4F6', text: '#374151', border: '#E5E7EB' },
  { label: 'Washington',   bg: '#FEE2E2', text: '#991B1B', border: '#FECACA' },
  { label: 'Urgent',       bg: '#FEE2E2', text: '#991B1B', border: '#FECACA' },
  { label: 'On Hold',      bg: '#FFEDD5', text: '#9A3412', border: '#FED7AA' },
  { label: 'Not Started',  bg: '#F1F5F9', text: '#475569', border: '#E2E8F0' },
];

const statusStyle = (s) => {
  const f = STATUS_OPTIONS.find(o => o.label === s);
  return f
    ? { backgroundColor: f.bg, color: f.text, border: `1px solid ${f.border}` }
    : { backgroundColor: '#F3F4F6', color: '#374151', border: '1px solid #E5E7EB' };
};

const fmtDate = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d) ? '—' : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const EMPTY = {
  client_name: '', service_category: '', assignee: '', spoc: '',
  internal_due_date: '', regulatory_due_date: '', fees_status: '', status: 'Pending',
  is_recurring: false, recurrence_frequency: 'Monthly',
};

const FREQ_MONTHS = { Monthly: 1, Quarterly: 3, 'Half-yearly': 6, Annually: 12 };

const advanceDate = (dateStr, months) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d)) return '';
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split('T')[0];
};

const EMPTY_FILTERS = {
  client_name: '', service_category: 'all', assignee: '',
  spoc: 'all', fees_status: 'all', status: 'all',
};

// Flexible column name matching for Excel import
const colMap = {
  client_name:         ['client name', 'client_name', 'client'],
  service_category:    ['service category', 'service_category', 'category', 'service'],
  assignee:            ['assignee', 'assignees', 'assigned to', 'assigned_to'],
  spoc:                ['spoc', 'single point of contact', 'poc'],
  internal_due_date:   ['internal due date', 'internal_due_date', 'internal date'],
  regulatory_due_date: ['due date (regulatory)', 'regulatory_due_date', 'regulatory due date', 'due date', 'deadline'],
  fees_status:         ['fees status', 'fees_status', 'payment status', 'fees'],
  status:              ['status'],
};

const matchCol = (header, field) =>
  colMap[field].includes(String(header).toLowerCase().trim());

export default function ClientServicesPage() {
  const [records, setRecords]             = useState([]);
  const [loading, setLoading]             = useState(true);
  const [uploading, setUploading]         = useState(false);
  const [showModal, setShowModal]         = useState(false);
  const [showFilters, setShowFilters]     = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [formData, setFormData]           = useState(EMPTY);
  const [filters, setFilters]             = useState(EMPTY_FILTERS);
  const fileInputRef                      = useRef(null);

  useEffect(() => { fetchRecords(); }, []);

  const fetchRecords = async () => {
    try {
      const res = await axios.get(`${API}/client-services`, getAuthHeaders());
      setRecords(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      toast.error(await toastMsg('ClientServicesPage.fetch', err, 'Failed to load services'));
    } finally {
      setLoading(false);
    }
  };

  /* ── CRUD ──────────────────────────────────────────────────────────── */
  const openAdd = (prefill = '') => {
    setEditingRecord(null);
    setFormData({ ...EMPTY, client_name: prefill });
    setShowModal(true);
  };

  const openEdit = (rec) => {
    setEditingRecord(rec);
    setFormData({
      client_name:          rec.client_name || '',
      service_category:     rec.service_category || '',
      assignee:             rec.assignee || '',
      spoc:                 rec.spoc || '',
      internal_due_date:    rec.internal_due_date   ? rec.internal_due_date.split('T')[0]   : '',
      regulatory_due_date:  rec.regulatory_due_date ? rec.regulatory_due_date.split('T')[0] : '',
      fees_status:          rec.fees_status || '',
      status:               rec.status || 'Pending',
      is_recurring:         rec.is_recurring === true || rec.is_recurring === 'true',
      recurrence_frequency: rec.recurrence_frequency || 'Monthly',
    });
    setShowModal(true);
  };

  /* Renew: pre-fill form with next-cycle dates, reset status + fees */
  const handleRenew = (rec) => {
    const months = FREQ_MONTHS[rec.recurrence_frequency || 'Monthly'] || 1;
    setEditingRecord(null);
    setFormData({
      client_name:          rec.client_name || '',
      service_category:     rec.service_category || '',
      assignee:             rec.assignee || '',
      spoc:                 rec.spoc || '',
      internal_due_date:    advanceDate(rec.internal_due_date, months),
      regulatory_due_date:  advanceDate(rec.regulatory_due_date, months),
      fees_status:          '',
      status:               'Pending',
      is_recurring:         true,
      recurrence_frequency: rec.recurrence_frequency || 'Monthly',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        internal_due_date:   formData.internal_due_date   || null,
        regulatory_due_date: formData.regulatory_due_date || null,
        is_recurring:        formData.is_recurring,
        recurrence_frequency: formData.is_recurring ? formData.recurrence_frequency : '',
      };
      if (editingRecord) {
        await axios.put(`${API}/client-services/${editingRecord.Id}`, payload, getAuthHeaders());
        toast.success('Service updated');
      } else {
        await axios.post(`${API}/client-services`, payload, getAuthHeaders());
        toast.success('Service added');
      }
      setShowModal(false);
      fetchRecords();
    } catch (err) {
      toast.error(await toastMsg('ClientServicesPage.save', err, 'Failed to save service'));
    }
  };

  const handleDelete = async (rec) => {
    if (!window.confirm(`Delete service for "${rec.client_name}"?`)) return;
    try {
      await axios.delete(`${API}/client-services/${rec.Id}`, getAuthHeaders());
      toast.success('Deleted');
      fetchRecords();
    } catch (err) {
      toast.error(await toastMsg('ClientServicesPage.delete', err, 'Failed to delete'));
    }
  };

  /* ── EXCEL IMPORT ──────────────────────────────────────────────────── */
  const handleExcelUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);

    try {
      const buffer   = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { cellDates: true });
      const sheet    = workbook.Sheets[workbook.SheetNames[0]];
      const rows     = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, dateNF: 'yyyy-mm-dd' });

      if (rows.length < 2) { toast.error('File is empty or has no data rows'); return; }

      const headers  = rows[0];
      const dataRows = rows.slice(1).filter(r => r.some(c => c !== '' && c != null));

      // Pre-fetch existing clients to avoid duplicate creation
      const existingClientsRes = await axios.get(`${API}/clients`, getAuthHeaders()).catch(() => ({ data: [] }));
      const existingClientNames = new Set(
        (existingClientsRes.data || []).map(c => (c.name || '').toLowerCase().trim())
      );
      const createdInThisSession = new Set(); // track newly created in this import

      let imported = 0, skipped = 0, clientsCreated = 0;

      for (const row of dataRows) {
        const get = (field) => {
          const idx = headers.findIndex(h => matchCol(h, field));
          const val = idx >= 0 ? row[idx] : undefined;
          return val != null ? String(val).trim() : '';
        };

        const clientName = get('client_name');
        if (!clientName) { skipped++; continue; }

        // Auto-create client in master if not already there
        const clientKey = clientName.toLowerCase().trim();
        if (!existingClientNames.has(clientKey) && !createdInThisSession.has(clientKey)) {
          try {
            await axios.post(`${API}/clients`, {
              name:  clientName,
              email: '',
              phone: '',
              company: clientName,
              notes: 'Auto-created during service import',
            }, getAuthHeaders());
            existingClientNames.add(clientKey);
            createdInThisSession.add(clientKey);
            clientsCreated++;
          } catch {
            // non-fatal — still attempt to create the service row
          }
        }

        // Normalise dates that XLSX returns as JS Date objects
        const fmtExcelDate = (v) => {
          if (!v) return null;
          if (v instanceof Date) return v.toISOString().split('T')[0];
          return String(v).slice(0, 10) || null;
        };

        const payload = {
          client_name:         clientName,
          service_category:    get('service_category'),
          assignee:            get('assignee'),
          spoc:                get('spoc'),
          internal_due_date:   fmtExcelDate(get('internal_due_date')),
          regulatory_due_date: fmtExcelDate(get('regulatory_due_date')),
          fees_status:         get('fees_status'),
          status:              get('status') || 'Pending',
        };

        try {
          await axios.post(`${API}/client-services`, payload, getAuthHeaders());
          imported++;
        } catch { skipped++; }
      }

      const parts = [`Imported ${imported} service${imported !== 1 ? 's' : ''}`];
      if (clientsCreated > 0) parts.push(`${clientsCreated} new client${clientsCreated !== 1 ? 's' : ''} created`);
      if (skipped > 0) parts.push(`${skipped} skipped`);
      toast.success(parts.join(' · '));
      fetchRecords();
    } catch (err) {
      toast.error(await toastMsg('ClientServicesPage.import', err, 'Failed to import Excel file'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  /* ── TEMPLATE DOWNLOAD ─────────────────────────────────────────────── */
  const downloadTemplate = () => {
    const headers = ['Client Name','Service Category','Assignee','SPOC','Internal Due Date','Due Date (Regulatory)','Fees Status','Status'];
    const sample  = ['Acme Corp','Tax Filing','Priya, Rohit','Prinkle','2026-05-15','2026-05-31','Pre Payment','In Progress'];
    const ws      = XLSX.utils.aoa_to_sheet([headers, sample]);
    const wb      = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Services');
    XLSX.writeFile(wb, 'client_services_template.xlsx');
  };

  /* ── FILTERING ─────────────────────────────────────────────────────── */
  const setFilter = (key, val) => setFilters(f => ({ ...f, [key]: val }));
  const clearFilters = () => setFilters(EMPTY_FILTERS);
  const activeFilterCount = Object.entries(filters).filter(([, v]) => v !== 'all' && v !== '').length;

  // Derive unique SPOC values for dropdown
  const spocOptions = [...new Set(records.map(r => r.spoc).filter(Boolean))].sort();

  const filtered = records.filter(r => {
    const cn = (r.client_name || '').toLowerCase();
    const as = (r.assignee   || '').toLowerCase();
    return (
      (!filters.client_name    || cn.includes(filters.client_name.toLowerCase())) &&
      (filters.service_category === 'all' || r.service_category === filters.service_category) &&
      (!filters.assignee       || as.includes(filters.assignee.toLowerCase())) &&
      (filters.spoc       === 'all' || r.spoc        === filters.spoc) &&
      (filters.fees_status === 'all' || r.fees_status === filters.fees_status) &&
      (filters.status      === 'all' || r.status      === filters.status)
    );
  });

  const existingClients = [...new Set(records.map(r => r.client_name).filter(Boolean))];

  /* ── RENDER ─────────────────────────────────────────────────────────── */
  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900" />
    </div>
  );

  return (
    <div className="animate-fade-in">

      {/* Header */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Client Services</h1>
          <p className="page-description">Track services, deadlines, fees and status for every client</p>
        </div>
        <div className="flex flex-wrap gap-2 self-start sm:self-auto">
          {/* Download template */}
          <button onClick={downloadTemplate} className="btn-outline flex items-center gap-2 text-sm py-2 px-3">
            <Download size={15} />
            <span className="hidden sm:inline">Template</span>
          </button>

          {/* Import Excel */}
          <label className={`btn-secondary flex items-center gap-2 text-sm py-2 px-3 cursor-pointer ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
            <Upload size={15} />
            <span className="hidden sm:inline">{uploading ? 'Importing…' : 'Import Excel'}</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleExcelUpload}
              disabled={uploading}
            />
          </label>

          {/* Add service */}
          <button onClick={() => openAdd()} className="btn-primary flex items-center gap-2 text-sm py-2 px-3">
            <Plus size={15} />
            <span>Add Service</span>
          </button>
        </div>
      </div>

      {/* Filter toggle bar */}
      <div className="card p-4 mb-4">
        <div className="flex items-center gap-3">
          {/* Client name always-visible quick search */}
          <div className="relative flex-1 min-w-0">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search client name…"
              className="input-field pl-9 text-sm h-10"
              value={filters.client_name}
              onChange={e => setFilter('client_name', e.target.value)}
            />
            {filters.client_name && (
              <button onClick={() => setFilter('client_name', '')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={13} />
              </button>
            )}
          </div>

          {/* Filter toggle button */}
          <button
            onClick={() => setShowFilters(f => !f)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
              activeFilterCount > 0
                ? 'bg-[#F3F4F6] border-gray-900 text-[#374151]'
                : 'bg-white border-[#E5E7EB] text-gray-500 hover:border-gray-900 hover:text-[#374151]'
            }`}
          >
            <Filter size={14} />
            Filters
            {activeFilterCount > 0 && (
              <span className="bg-gray-900 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                {activeFilterCount}
              </span>
            )}
            {showFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {activeFilterCount > 0 && (
            <button onClick={clearFilters} className="text-sm text-gray-500 hover:text-red-500 flex items-center gap-1 transition-colors">
              <X size={13} /> Clear
            </button>
          )}
        </div>

        {/* Expandable filter panel */}
        {showFilters && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-4 pt-4 border-t border-[#F3F4F6]">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Service Category</label>
              <select className="input-field text-sm h-9" value={filters.service_category} onChange={e => setFilter('service_category', e.target.value)}>
                <option value="all">All</option>
                {SERVICE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Assignee</label>
              <input
                type="text"
                className="input-field text-sm h-9"
                placeholder="Search assignee…"
                value={filters.assignee}
                onChange={e => setFilter('assignee', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">SPOC</label>
              <select className="input-field text-sm h-9" value={filters.spoc} onChange={e => setFilter('spoc', e.target.value)}>
                <option value="all">All</option>
                {spocOptions.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Fees Status</label>
              <select className="input-field text-sm h-9" value={filters.fees_status} onChange={e => setFilter('fees_status', e.target.value)}>
                <option value="all">All</option>
                {FEES_STATUS_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Status</label>
              <select className="input-field text-sm h-9" value={filters.status} onChange={e => setFilter('status', e.target.value)}>
                <option value="all">All</option>
                {STATUS_OPTIONS.map(s => <option key={s.label} value={s.label}>{s.label}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="card p-14 text-center">
          <p className="text-gray-500 mb-4 text-lg">
            {activeFilterCount > 0 || filters.client_name
              ? 'No services match your filters'
              : 'No services yet — add one or import from Excel'}
          </p>
          {activeFilterCount === 0 && !filters.client_name && (
            <div className="flex justify-center gap-3">
              <button onClick={() => openAdd()} className="btn-primary">Add Service</button>
              <label className="btn-outline cursor-pointer flex items-center gap-2">
                <Upload size={15} /> Import Excel
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleExcelUpload} />
              </label>
            </div>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr style={{ backgroundColor: '#111827' }}>
                  {['Client Name','Service Category','Assignee','SPOC','Internal Due Date','Due Date (Regulatory)','Fees Status','Status',''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-white font-semibold whitespace-nowrap text-xs tracking-wide uppercase">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((rec, i) => (
                  <tr key={rec.Id || i} className="group border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-colors">

                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-[#374151]">{rec.client_name || '—'}</span>
                        <button
                          onClick={() => openAdd(rec.client_name)}
                          title="Add another service for this client"
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-gray-50 rounded"
                        >
                          <Plus size={11} className="text-gray-600" />
                        </button>
                      </div>
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap text-gray-700">{rec.service_category || '—'}</td>

                    <td className="px-4 py-3 max-w-[180px]">
                      {rec.assignee
                        ? <div className="flex flex-wrap gap-1">
                            {rec.assignee.split(',').map((a, j) => (
                              <span key={j} className="bg-[#F3F4F6] text-[#374151] text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
                                {a.trim()}
                              </span>
                            ))}
                          </div>
                        : <span className="text-gray-400">—</span>}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap text-gray-700">{rec.spoc || '—'}</td>

                    <td className="px-4 py-3 whitespace-nowrap text-gray-600 tabular-nums">{fmtDate(rec.internal_due_date)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600 tabular-nums">{fmtDate(rec.regulatory_due_date)}</td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      {rec.fees_status
                        ? <span className="bg-gray-50 text-gray-700 border border-gray-200 text-xs px-2.5 py-1 rounded-full font-medium">
                            {rec.fees_status}
                          </span>
                        : <span className="text-gray-400">—</span>}
                    </td>

                    {/* Status + recurring badge */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="space-y-1">
                        {rec.status
                          ? <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={statusStyle(rec.status)}>{rec.status}</span>
                          : <span className="text-gray-400">—</span>}
                        {(rec.is_recurring === true || rec.is_recurring === 'true') && (
                          <div className="flex items-center gap-1">
                            <RefreshCw size={10} className="text-gray-600" />
                            <span className="text-xs text-gray-600 font-medium">{rec.recurrence_frequency || 'Recurring'}</span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {(rec.is_recurring === true || rec.is_recurring === 'true') && (
                          <button onClick={() => handleRenew(rec)} title={`Renew next ${rec.recurrence_frequency || 'cycle'}`}
                                  className="p-1.5 hover:bg-gray-50 rounded-lg">
                            <RefreshCw size={14} className="text-gray-600" />
                          </button>
                        )}
                        <button onClick={() => openEdit(rec)} className="p-1.5 hover:bg-gray-50 rounded-lg" title="Edit">
                          <Edit2 size={14} className="text-gray-500" />
                        </button>
                        <button onClick={() => handleDelete(rec)} className="p-1.5 hover:bg-red-50 rounded-lg" title="Delete">
                          <Trash2 size={14} className="text-red-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2.5 bg-[#F9FAFB] border-t border-[#F3F4F6] text-xs text-gray-500">
            Showing {filtered.length} of {records.length} service{records.length !== 1 ? 's' : ''}
            {activeFilterCount > 0 && ` · ${activeFilterCount} filter${activeFilterCount !== 1 ? 's' : ''} active`}
          </div>
        </div>
      )}

      {/* ── Modal ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl flex flex-col max-h-[92vh] overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4" style={{ backgroundColor: '#111827' }}>
              <h2 className="text-lg font-bold text-white">
                {editingRecord ? 'Edit Service' : 'Add New Service'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-white/80 hover:text-white hover:bg-white/20 p-1 rounded">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Client Name *</label>
                  <input type="text" list="cs-clients" className="input-field" placeholder="Type or pick existing"
                    value={formData.client_name} onChange={e => setFormData({ ...formData, client_name: e.target.value })} required autoFocus />
                  <datalist id="cs-clients">{existingClients.map(n => <option key={n} value={n} />)}</datalist>
                </div>
                <div>
                  <label className="label">Service Category *</label>
                  <select className="input-field" value={formData.service_category}
                    onChange={e => setFormData({ ...formData, service_category: e.target.value })} required>
                    <option value="">Select category</option>
                    {SERVICE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Assignee(s)</label>
                  <input type="text" className="input-field" placeholder="e.g. Priya, Rohit"
                    value={formData.assignee} onChange={e => setFormData({ ...formData, assignee: e.target.value })} />
                  <p className="text-xs text-gray-400 mt-1">Separate multiple names with commas</p>
                </div>
                <div>
                  <label className="label">SPOC</label>
                  <input type="text" className="input-field" placeholder="Single point of contact"
                    value={formData.spoc} onChange={e => setFormData({ ...formData, spoc: e.target.value })} />
                </div>
                <div>
                  <label className="label">Internal Due Date</label>
                  <input type="date" className="input-field" value={formData.internal_due_date}
                    onChange={e => setFormData({ ...formData, internal_due_date: e.target.value })} />
                </div>
                <div>
                  <label className="label">Due Date (Regulatory)</label>
                  <input type="date" className="input-field" value={formData.regulatory_due_date}
                    onChange={e => setFormData({ ...formData, regulatory_due_date: e.target.value })} />
                </div>
                <div>
                  <label className="label">Fees Status</label>
                  <select className="input-field" value={formData.fees_status}
                    onChange={e => setFormData({ ...formData, fees_status: e.target.value })}>
                    <option value="">Select fees status</option>
                    {FEES_STATUS_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Status</label>
                  <select className="input-field" value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value })}>
                    {STATUS_OPTIONS.map(s => <option key={s.label} value={s.label}>{s.label}</option>)}
                  </select>
                  {formData.status && (
                    <div className="mt-2">
                      <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={statusStyle(formData.status)}>
                        {formData.status}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Recurring toggle */}
              <div className={`flex flex-wrap items-center gap-3 p-4 rounded-xl border-2 transition-all cursor-pointer ${formData.is_recurring ? 'border-gray-900 bg-[#F3F4F6]' : 'border-[#E5E7EB] bg-[#F9FAFB]'}`}
                   onClick={() => setFormData(f => ({ ...f, is_recurring: !f.is_recurring }))}>
                <div className={`w-10 h-6 rounded-full transition-all relative flex-shrink-0 ${formData.is_recurring ? 'bg-gray-900' : 'bg-gray-300'}`}>
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${formData.is_recurring ? 'left-5' : 'left-1'}`} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-800">Recurring Compliance</p>
                  <p className="text-xs text-gray-500">Dates will auto-advance when you use Renew</p>
                </div>
                {formData.is_recurring && (
                  <select className="input-field text-sm h-9 w-36 flex-shrink-0"
                          value={formData.recurrence_frequency}
                          onClick={e => e.stopPropagation()}
                          onChange={e => { e.stopPropagation(); setFormData(f => ({ ...f, recurrence_frequency: e.target.value })); }}>
                    <option value="Monthly">Monthly</option>
                    <option value="Quarterly">Quarterly</option>
                    <option value="Half-yearly">Half-yearly</option>
                    <option value="Annually">Annually</option>
                  </select>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1">{editingRecord ? 'Update Service' : 'Add Service'}</button>
                <button type="button" onClick={() => setShowModal(false)} className="btn-outline flex-1">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
