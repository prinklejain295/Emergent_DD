import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import {
  Plus, Edit2, Trash2, Search, X, Upload, Download, Filter,
  ChevronDown, ChevronUp, RefreshCw, Timer, LayoutList, Users,
} from 'lucide-react';
import { toastMsg } from '../utils/errorLogger';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'https://emergent-dd-2b7s.vercel.app';
const API = `${BACKEND_URL}/api`;
const getAuthHeaders = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

/* ── Constants ─────────────────────────────────────────────────── */
const SERVICE_CATEGORIES = [
  'Tax Filing', 'Payroll', 'Audit', 'GST / VAT', 'Compliance',
  'Advisory', 'Bookkeeping', 'Company Registration', 'Annual Filing',
  'TDS Filing', 'ROC Filing', 'Other',
];
const FEES_STATUS_OPTIONS = ['Pre Payment', 'Post Payment', 'Pending Payment', 'Invoiced', 'Waived', 'On Hold'];
const FREQ_OPTIONS = ['Monthly', 'Quarterly', 'Annual', 'One-time'];
const FREQ_MONTHS  = { Monthly: 1, Quarterly: 3, 'Half-yearly': 6, Annual: 12, Annually: 12 };

/* 4 clean statuses for new records */
const CORE_STATUSES = [
  { label: 'Not Started',  bg: '#F1F5F9', text: '#475569', border: '#E2E8F0' },
  { label: 'In Progress',  bg: '#FEF9C3', text: '#854D0E', border: '#FEF08A' },
  { label: 'Under Review', bg: '#DBEAFE', text: '#1E40AF', border: '#BFDBFE' },
  { label: 'Done',         bg: '#DCFCE7', text: '#166534', border: '#BBF7D0' },
];

/* Legacy statuses continue to display correctly */
const STATUS_STYLES = {
  'Not Started':  { bg: '#F1F5F9', text: '#475569', border: '#E2E8F0' },
  'In Progress':  { bg: '#FEF9C3', text: '#854D0E', border: '#FEF08A' },
  'Under Review': { bg: '#DBEAFE', text: '#1E40AF', border: '#BFDBFE' },
  'Done':         { bg: '#DCFCE7', text: '#166534', border: '#BBF7D0' },
  'Pending':      { bg: '#F3F4F6', text: '#374151', border: '#E5E7EB' },
  'Urgent':       { bg: '#FEE2E2', text: '#991B1B', border: '#FECACA' },
  'On Hold':      { bg: '#FFEDD5', text: '#9A3412', border: '#FED7AA' },
  'Washington':   { bg: '#FEE2E2', text: '#991B1B', border: '#FECACA' },
};

const statusStyle = (s) => {
  const f = STATUS_STYLES[s];
  return f
    ? { backgroundColor: f.bg, color: f.text, border: `1px solid ${f.border}` }
    : { backgroundColor: '#F3F4F6', color: '#374151', border: '1px solid #E5E7EB' };
};

const fmtDate = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d) ? '—' : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const checkOverdue = (rec) => {
  if (!rec.regulatory_due_date || rec.status === 'Done') return false;
  return new Date(rec.regulatory_due_date) < new Date();
};

/* Reads frequency from new field, falls back to legacy is_recurring combo */
const getFrequency = (rec) =>
  rec.frequency ||
  (rec.is_recurring === true || rec.is_recurring === 'true'
    ? (rec.recurrence_frequency || 'Monthly')
    : 'One-time');

const advanceDate = (dateStr, months) => {
  if (!dateStr || !months) return '';
  const d = new Date(dateStr);
  if (isNaN(d)) return '';
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split('T')[0];
};

const nextPeriodLabel = (frequency, fromDateStr) => {
  const d = fromDateStr ? new Date(fromDateStr) : new Date();
  if (isNaN(d)) return '';
  if (frequency === 'Monthly') {
    d.setMonth(d.getMonth() + 1);
    return d.toLocaleString('en-GB', { month: 'long', year: 'numeric' });
  }
  if (frequency === 'Quarterly') {
    d.setMonth(d.getMonth() + 3);
    const q = Math.ceil((d.getMonth() + 1) / 3);
    const yr = d.getFullYear();
    const fy = d.getMonth() < 3 ? yr - 1 : yr;
    return `Q${q} FY${String(fy + 1).slice(2)}`;
  }
  if (frequency === 'Annual') {
    d.setFullYear(d.getFullYear() + 1);
    const yr = d.getFullYear();
    const fy = d.getMonth() < 3 ? yr - 1 : yr;
    return `FY ${fy}–${String(fy + 1).slice(2)}`;
  }
  return '';
};

const EMPTY = {
  client_name: '', service_category: '', assignee: '', spoc: '',
  internal_due_date: '', regulatory_due_date: '',
  fees_status: '', status: 'Not Started',
  frequency: 'Monthly', period_label: '',
};

const EMPTY_FILTERS = {
  client_name: '', service_category: 'all', assignee: '',
  frequency: 'all', fees_status: 'all', status: 'all',
};

const colMap = {
  client_name:         ['client name', 'client_name', 'client'],
  service_category:    ['service category', 'service_category', 'category', 'service'],
  assignee:            ['assignee', 'assignees', 'assigned to', 'assigned_to'],
  spoc:                ['spoc', 'single point of contact', 'poc'],
  internal_due_date:   ['internal due date', 'internal_due_date', 'internal date'],
  regulatory_due_date: ['due date (regulatory)', 'regulatory_due_date', 'regulatory due date', 'due date', 'deadline'],
  fees_status:         ['fees status', 'fees_status', 'payment status', 'fees'],
  status:              ['status'],
  frequency:           ['frequency', 'recurrence', 'recurring'],
  period_label:        ['period', 'period label', 'period_label'],
};
const matchCol = (header, field) =>
  colMap[field].includes(String(header).toLowerCase().trim());

const fmtMins = (m) => { const n = parseInt(m)||0; return n<60?`${n}m`:`${Math.floor(n/60)}h ${n%60}m`; };
const todayStr = () => new Date().toISOString().split('T')[0];

const CLIENT_COLORS = [
  '#3B82F6','#8B5CF6','#10B981','#F59E0B','#EF4444',
  '#06B6D4','#EC4899','#6366F1','#84CC16','#F97316',
];

/* ═══════════════════════════════════════════════════════════════════ */
export default function ClientServicesPage() {
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  const [records, setRecords]             = useState([]);
  const [loading, setLoading]             = useState(true);
  const [uploading, setUploading]         = useState(false);
  const [showModal, setShowModal]         = useState(false);
  const [showFilters, setShowFilters]     = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [formData, setFormData]           = useState(EMPTY);
  const [filters, setFilters]             = useState(EMPTY_FILTERS);
  const [viewMode, setViewMode]           = useState('flat');
  const [activeTab, setActiveTab]         = useState('active');
  const [statusMenu, setStatusMenu]       = useState(null);
  const [feesMenu, setFeesMenu]           = useState(null);
  const fileInputRef                      = useRef(null);

  /* Bulk selection */
  const [selectedIds, setSelectedIds]     = useState(new Set());
  const [bulkFields, setBulkFields]       = useState({ status: '', assignee: '', fees_status: '' });
  const [bulkApplying, setBulkApplying]   = useState(false);

  /* Log-time popup */
  const [logTimeData, setLogTimeData] = useState(null);
  const [logMins, setLogMins]         = useState('');
  const [logNotes, setLogNotes]       = useState('');
  const [logDate, setLogDate]         = useState(todayStr());
  const [logSaving, setLogSaving]     = useState(false);

  useEffect(() => { fetchRecords(); }, []);

  useEffect(() => {
    const h = (e) => {
      if (!e.target.closest('[data-status-menu]')) setStatusMenu(null);
      if (!e.target.closest('[data-fees-menu]'))   setFeesMenu(null);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const fetchRecords = async () => {
    try {
      const res = await axios.get(`${API}/client-services`, getAuthHeaders());
      setRecords(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      toast.error(await toastMsg('ClientServicesPage.fetch', err, 'Failed to load services'));
    } finally { setLoading(false); }
  };

  /* ── CRUD ─────────────────────────────────────────────────────── */
  const openAdd = (prefill = '') => {
    setEditingRecord(null);
    setFormData({ ...EMPTY, client_name: prefill });
    setShowModal(true);
  };

  const openEdit = (rec) => {
    setEditingRecord(rec);
    setFormData({
      client_name:         rec.client_name || '',
      service_category:    rec.service_category || '',
      assignee:            rec.assignee || '',
      spoc:                rec.spoc || '',
      internal_due_date:   rec.internal_due_date   ? rec.internal_due_date.split('T')[0]   : '',
      regulatory_due_date: rec.regulatory_due_date ? rec.regulatory_due_date.split('T')[0] : '',
      fees_status:         rec.fees_status || '',
      status:              rec.status || 'Not Started',
      frequency:           getFrequency(rec),
      period_label:        rec.period_label || '',
    });
    setShowModal(true);
  };

  const handleRenew = (rec) => {
    const freq   = getFrequency(rec);
    const months = FREQ_MONTHS[freq] || 1;
    setEditingRecord(null);
    setFormData({
      client_name:         rec.client_name || '',
      service_category:    rec.service_category || '',
      assignee:            rec.assignee || '',
      spoc:                rec.spoc || '',
      internal_due_date:   advanceDate(rec.internal_due_date, months),
      regulatory_due_date: advanceDate(rec.regulatory_due_date, months),
      fees_status:         '',
      status:              'Not Started',
      frequency:           freq,
      period_label:        nextPeriodLabel(freq, rec.regulatory_due_date || rec.internal_due_date),
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const isOneTime = formData.frequency === 'One-time';
    const shouldArchive = formData.status === 'Done' && formData.fees_status === 'Post Payment';
    const payload = {
      ...formData,
      internal_due_date:    formData.internal_due_date   || null,
      regulatory_due_date:  formData.regulatory_due_date || null,
      is_recurring:         !isOneTime,
      recurrence_frequency: isOneTime ? '' : formData.frequency,
      archived:             shouldArchive,
    };
    try {
      if (editingRecord) {
        await axios.put(`${API}/client-services/${editingRecord.Id}`, payload, getAuthHeaders());
        toast.success('Service updated');
      } else {
        await axios.post(`${API}/client-services`, payload, getAuthHeaders());
        toast.success('Service added');
      }
      setShowModal(false);
      fetchRecords();
      if (payload.status === 'Done' && editingRecord?.status !== 'Done') {
        setLogTimeData({ client_name: payload.client_name, service_category: payload.service_category });
        setLogMins(''); setLogNotes(''); setLogDate(todayStr());
        if (editingRecord) autoRenew({ ...editingRecord, ...payload });
      }
    } catch (err) {
      toast.error(await toastMsg('ClientServicesPage.save', err, 'Failed to save service'));
    }
  };

  const handleDelete = async (rec) => {
    if (!window.confirm(`Delete "${rec.service_category}" for "${rec.client_name}"?`)) return;
    try {
      await axios.delete(`${API}/client-services/${rec.Id}`, getAuthHeaders());
      setRecords(prev => prev.filter(r => r.Id !== rec.Id));
      toast.success('Deleted');
    } catch (err) {
      toast.error(await toastMsg('ClientServicesPage.delete', err, 'Failed to delete'));
    }
  };

  /* Auto-create next period row when a recurring service is marked Done */
  const autoRenew = async (rec) => {
    const freq = getFrequency(rec);
    if (freq === 'One-time') return;
    const months    = FREQ_MONTHS[freq] || 1;
    const newPeriod = nextPeriodLabel(freq, rec.regulatory_due_date || rec.internal_due_date);
    const payload   = {
      client_name:         rec.client_name,
      service_category:    rec.service_category,
      assignee:            rec.assignee || '',
      spoc:                rec.spoc || '',
      internal_due_date:   advanceDate(rec.internal_due_date,   months),
      regulatory_due_date: advanceDate(rec.regulatory_due_date, months),
      fees_status:         '',
      status:              'Not Started',
      frequency:           freq,
      period_label:        newPeriod,
      is_recurring:        true,
      recurrence_frequency: freq,
    };
    try {
      await axios.post(`${API}/client-services`, payload, getAuthHeaders());
      toast.success(`Next period created: ${newPeriod || 'next cycle'} · ${rec.service_category} for ${rec.client_name}`);
      fetchRecords();
    } catch {
      toast.error('Marked Done but failed to create next period — use the Renew button manually');
    }
  };

  const quickUpdateStatus = async (rec, newStatus) => {
    setStatusMenu(null);
    try {
      await axios.put(`${API}/client-services/${rec.Id}`, { ...rec, status: newStatus }, getAuthHeaders());
      setRecords(prev => prev.map(r => r.Id === rec.Id ? { ...r, status: newStatus } : r));
      if (newStatus === 'Done' && rec.status !== 'Done') {
        setLogTimeData({ client_name: rec.client_name, service_category: rec.service_category });
        setLogMins(''); setLogNotes(''); setLogDate(todayStr());
        autoRenew(rec);
      }
    } catch { toast.error('Failed to update status'); }
  };

  const quickUpdateFees = async (rec, newFees) => {
    setFeesMenu(null);
    const shouldArchive = rec.status === 'Done' && newFees === 'Post Payment';
    try {
      await axios.put(`${API}/client-services/${rec.Id}`,
        { ...rec, fees_status: newFees, archived: shouldArchive },
        getAuthHeaders()
      );
      setRecords(prev => prev.map(r =>
        r.Id === rec.Id ? { ...r, fees_status: newFees, archived: shouldArchive } : r
      ));
      if (shouldArchive) toast.success(`Archived: ${rec.service_category} for ${rec.client_name}`);
    } catch { toast.error('Failed to update fees status'); }
  };

  /* ── Bulk selection helpers ───────────────────────────────────── */
  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(r => r.Id)));
    }
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setBulkFields({ status: '', assignee: '', fees_status: '' });
  };

  const handleBulkApply = async () => {
    if (selectedIds.size === 0) return;
    const hasChanges = bulkFields.status || bulkFields.assignee || bulkFields.fees_status;
    if (!hasChanges) { toast.error('Set at least one field to update'); return; }

    setBulkApplying(true);
    let updated = 0;
    try {
      const ids = [...selectedIds];
      await Promise.all(ids.map(async (id) => {
        const rec = records.find(r => r.Id === id);
        if (!rec) return;
        const patch = { ...rec };
        if (bulkFields.status)      patch.status      = bulkFields.status;
        if (bulkFields.assignee)    patch.assignee    = bulkFields.assignee;
        if (bulkFields.fees_status) patch.fees_status = bulkFields.fees_status;
        // Archive if Done + Post Payment
        if (patch.status === 'Done' && patch.fees_status === 'Post Payment') patch.archived = true;
        await axios.put(`${API}/client-services/${id}`, patch, getAuthHeaders());
        updated++;
      }));
      setRecords(prev => prev.map(r => {
        if (!selectedIds.has(r.Id)) return r;
        const updated = { ...r };
        if (bulkFields.status)      updated.status      = bulkFields.status;
        if (bulkFields.assignee)    updated.assignee    = bulkFields.assignee;
        if (bulkFields.fees_status) updated.fees_status = bulkFields.fees_status;
        if (updated.status === 'Done' && updated.fees_status === 'Post Payment') updated.archived = true;
        return updated;
      }));
      toast.success(`Updated ${updated} service${updated !== 1 ? 's' : ''}`);
      clearSelection();
    } catch (err) {
      toast.error('Some updates failed — please retry');
    } finally {
      setBulkApplying(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Delete ${selectedIds.size} service${selectedIds.size !== 1 ? 's' : ''}? This cannot be undone.`)) return;
    setBulkApplying(true);
    try {
      await Promise.all([...selectedIds].map(id =>
        axios.delete(`${API}/client-services/${id}`, getAuthHeaders())
      ));
      setRecords(prev => prev.filter(r => !selectedIds.has(r.Id)));
      toast.success(`Deleted ${selectedIds.size} service${selectedIds.size !== 1 ? 's' : ''}`);
      clearSelection();
    } catch {
      toast.error('Some deletes failed — please retry');
    } finally {
      setBulkApplying(false);
    }
  };

  /* ── EXCEL IMPORT ─────────────────────────────────────────────── */
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

      const existingClientsRes = await axios.get(`${API}/clients`, getAuthHeaders()).catch(() => ({ data: [] }));
      const existingClientNames = new Set(
        (existingClientsRes.data || []).map(c => (c.name || '').toLowerCase().trim())
      );
      const createdInThisSession = new Set();
      let imported = 0, skipped = 0, clientsCreated = 0;

      for (const row of dataRows) {
        const get = (field) => {
          const idx = headers.findIndex(h => matchCol(h, field));
          const val = idx >= 0 ? row[idx] : undefined;
          return val != null ? String(val).trim() : '';
        };
        const clientName = get('client_name');
        if (!clientName) { skipped++; continue; }

        const clientKey = clientName.toLowerCase().trim();
        if (!existingClientNames.has(clientKey) && !createdInThisSession.has(clientKey)) {
          try {
            await axios.post(`${API}/clients`, {
              name: clientName, type: 'individual',
              email: `${clientKey.replace(/\s+/g, '.')}@placeholder.com`,
              phone: '0000000000',
            }, getAuthHeaders());
            clientsCreated++;
            createdInThisSession.add(clientKey);
            existingClientNames.add(clientKey);
          } catch { /* continue even if client creation fails */ }
        }

        const fmtExcelDate = (v) => {
          if (!v) return null;
          if (v instanceof Date) return v.toISOString().split('T')[0];
          return String(v).slice(0, 10) || null;
        };

        const freqRaw = get('frequency');
        const freq = FREQ_OPTIONS.find(f => f.toLowerCase() === freqRaw.toLowerCase()) || freqRaw || 'Monthly';
        const payload = {
          client_name:         clientName,
          service_category:    get('service_category'),
          assignee:            get('assignee'),
          spoc:                get('spoc'),
          internal_due_date:   fmtExcelDate(get('internal_due_date')),
          regulatory_due_date: fmtExcelDate(get('regulatory_due_date')),
          fees_status:         get('fees_status'),
          status:              get('status') || 'Not Started',
          frequency:           freq,
          period_label:        get('period_label'),
          is_recurring:        freq !== 'One-time',
          recurrence_frequency: freq !== 'One-time' ? freq : '',
        };
        try { await axios.post(`${API}/client-services`, payload, getAuthHeaders()); imported++; }
        catch { skipped++; }
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

  const downloadTemplate = () => {
    const headers = ['Client Name','Service Category','Frequency','Period','Assignee','SPOC','Internal Due Date','Due Date (Regulatory)','Fees Status','Status'];
    const sample  = ['Acme Corp','Tax Filing','Monthly','May 2025','Priya, Rohit','Prinkle','2026-05-15','2026-05-31','Pre Payment','In Progress'];
    const ws = XLSX.utils.aoa_to_sheet([headers, sample]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Services');
    XLSX.writeFile(wb, 'client_services_template.xlsx');
  };

  /* ── FILTERING ────────────────────────────────────────────────── */
  const setFilter = (key, val) => setFilters(f => ({ ...f, [key]: val }));
  const clearFilters = () => setFilters(EMPTY_FILTERS);
  const activeFilterCount = Object.entries(filters).filter(([, v]) => v !== 'all' && v !== '').length;
  const spocOptions = [...new Set(records.map(r => r.spoc).filter(Boolean))].sort();

  const isArchived = (r) => r.archived === true || r.archived === 'true';

  const filtered = records.filter(r => {
    const cn = (r.client_name || '').toLowerCase();
    const as = (r.assignee   || '').toLowerCase();
    const fr = getFrequency(r);
    const matchesTab = activeTab === 'archived' ? isArchived(r) : !isArchived(r);
    return (
      matchesTab &&
      (!filters.client_name    || cn.includes(filters.client_name.toLowerCase())) &&
      (filters.service_category === 'all' || r.service_category === filters.service_category) &&
      (!filters.assignee       || as.includes(filters.assignee.toLowerCase())) &&
      (filters.frequency  === 'all' || fr === filters.frequency) &&
      (filters.fees_status === 'all' || r.fees_status === filters.fees_status) &&
      (filters.status      === 'all' || r.status      === filters.status)
    );
  });

  const activeCount   = records.filter(r => !isArchived(r)).length;
  const archivedCount = records.filter(r =>  isArchived(r)).length;

  const existingClients = [...new Set(records.map(r => r.client_name).filter(Boolean))];

  /* ── Grouped view data ────────────────────────────────────────── */
  const grouped = {};
  filtered.forEach(r => {
    const key = r.client_name || '—';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(r);
  });
  const sortedGroups = Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));

  /* ── Status badge with inline dropdown ───────────────────────── */
  const StatusBadge = ({ rec }) => (
    <div className="relative" data-status-menu>
      <button
        onClick={() => setStatusMenu(statusMenu === rec.Id ? null : rec.Id)}
        className="text-xs px-2.5 py-1 rounded-full font-semibold cursor-pointer hover:opacity-80 transition-opacity whitespace-nowrap"
        style={statusStyle(rec.status || 'Not Started')}
      >
        {rec.status || 'Not Started'}
      </button>
      {statusMenu === rec.Id && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-20 p-1 min-w-[160px]">
          {CORE_STATUSES.map(s => (
            <button key={s.label}
                    onClick={() => quickUpdateStatus(rec, s.label)}
                    className={`w-full text-left px-3 py-1.5 text-xs font-semibold rounded-lg hover:bg-gray-50 flex items-center gap-2 transition-colors ${
                      rec.status === s.label ? 'bg-gray-50' : ''
                    }`}>
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ background: s.bg, border: `1px solid ${s.border}` }} />
              {s.label}
              {rec.status === s.label && <span className="ml-auto text-gray-400">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  /* ── Fees badge — clickable dropdown on Done records ─────────── */
  const FeesBadge = ({ rec }) => {
    const isDone = rec.status === 'Done';
    if (!isDone) {
      return rec.fees_status
        ? <span className="bg-gray-50 text-gray-700 border border-gray-200 text-xs px-2.5 py-1 rounded-full font-medium whitespace-nowrap">{rec.fees_status}</span>
        : <span className="text-gray-400">—</span>;
    }
    return (
      <div className="relative" data-fees-menu>
        <button onClick={() => setFeesMenu(feesMenu === rec.Id ? null : rec.Id)}
                className={`text-xs px-2.5 py-1 rounded-full font-medium cursor-pointer border whitespace-nowrap transition-colors ${
                  rec.fees_status === 'Post Payment'
                    ? 'bg-green-50 text-green-700 border-green-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                }`}>
          {rec.fees_status || 'Set fees…'} {!rec.fees_status && <ChevronDown size={10} className="inline" />}
        </button>
        {feesMenu === rec.Id && (
          <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-20 p-1 min-w-[200px]">
            {FEES_STATUS_OPTIONS.map(f => (
              <button key={f} onClick={() => quickUpdateFees(rec, f)}
                      className={`w-full text-left px-3 py-1.5 text-xs font-medium rounded-lg hover:bg-gray-50 flex items-center justify-between transition-colors ${
                        rec.fees_status === f ? 'bg-gray-50 font-semibold' : ''
                      }`}>
                {f}
                {f === 'Post Payment' && <span className="text-gray-400 text-xs ml-2">→ archives</span>}
                {rec.fees_status === f && <span className="text-gray-400">✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  /* ── Row actions ──────────────────────────────────────────────── */
  const RowActions = ({ rec }) => (
    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
      {getFrequency(rec) !== 'One-time' && (
        <button onClick={() => handleRenew(rec)} title="Renew next period"
                className="p-1.5 hover:bg-gray-100 rounded-lg" >
          <RefreshCw size={13} className="text-gray-500" />
        </button>
      )}
      <button onClick={() => openEdit(rec)} className="p-1.5 hover:bg-gray-100 rounded-lg" title="Edit">
        <Edit2 size={13} className="text-gray-500" />
      </button>
      <button onClick={() => handleDelete(rec)} className="p-1.5 hover:bg-red-50 rounded-lg" title="Delete">
        <Trash2 size={13} className="text-red-500" />
      </button>
    </div>
  );

  /* ── RENDER ───────────────────────────────────────────────────── */
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
          <p className="page-description">Track compliance services, deadlines and status for every client</p>
        </div>
        <div className="flex flex-wrap gap-2 self-start sm:self-auto">
          <button onClick={downloadTemplate} className="btn-outline flex items-center gap-2 text-sm py-2 px-3">
            <Download size={15} /><span className="hidden sm:inline">Template</span>
          </button>
          <label className={`btn-secondary flex items-center gap-2 text-sm py-2 px-3 cursor-pointer ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
            <Upload size={15} /><span className="hidden sm:inline">{uploading ? 'Importing…' : 'Import Excel'}</span>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden"
                   onChange={handleExcelUpload} disabled={uploading} />
          </label>
          <button onClick={() => openAdd()} className="btn-primary flex items-center gap-2 text-sm py-2 px-3">
            <Plus size={15} /> Add Service
          </button>
        </div>
      </div>

      {/* Active / Archived tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-xl p-1 w-fit">
        <button onClick={() => { setActiveTab('active'); clearSelection(); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  activeTab === 'active' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}>
          Active
          <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${activeTab === 'active' ? 'bg-gray-900 text-white' : 'bg-gray-300 text-gray-600'}`}>
            {activeCount}
          </span>
        </button>
        <button onClick={() => { setActiveTab('archived'); clearSelection(); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  activeTab === 'archived' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}>
          Archived
          <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${activeTab === 'archived' ? 'bg-gray-900 text-white' : 'bg-gray-300 text-gray-600'}`}>
            {archivedCount}
          </span>
        </button>
      </div>

      {/* Filter + view toggle bar */}
      <div className="card p-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 min-w-0">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search client name…" className="input-field pl-9 text-sm h-10"
                   value={filters.client_name} onChange={e => setFilter('client_name', e.target.value)} />
            {filters.client_name && (
              <button onClick={() => setFilter('client_name', '')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={13} />
              </button>
            )}
          </div>

          {/* View toggle */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 flex-shrink-0">
            <button onClick={() => setViewMode('grouped')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                      viewMode === 'grouped' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}>
              <Users size={13} /> By Client
            </button>
            <button onClick={() => setViewMode('flat')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                      viewMode === 'flat' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}>
              <LayoutList size={13} /> Flat Table
            </button>
          </div>

          <button onClick={() => setShowFilters(f => !f)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors flex-shrink-0 ${
                    activeFilterCount > 0
                      ? 'bg-gray-100 border-gray-900 text-gray-900'
                      : 'bg-white border-gray-200 text-gray-500 hover:border-gray-900 hover:text-gray-900'
                  }`}>
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
            <button onClick={clearFilters} className="text-sm text-gray-500 hover:text-red-500 flex items-center gap-1">
              <X size={13} /> Clear
            </button>
          )}
        </div>

        {showFilters && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-4 pt-4 border-t border-gray-100">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Category</label>
              <select className="input-field text-sm h-9" value={filters.service_category} onChange={e => setFilter('service_category', e.target.value)}>
                <option value="all">All</option>
                {SERVICE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Frequency</label>
              <select className="input-field text-sm h-9" value={filters.frequency} onChange={e => setFilter('frequency', e.target.value)}>
                <option value="all">All</option>
                {FREQ_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Assignee</label>
              <input type="text" className="input-field text-sm h-9" placeholder="Search…"
                     value={filters.assignee} onChange={e => setFilter('assignee', e.target.value)} />
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
                {CORE_STATUSES.map(s => <option key={s.label} value={s.label}>{s.label}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* ── Bulk action bar ──────────────────────────────────────── */}
      {selectedIds.size > 0 && (
        <div className="card p-3 mb-4 flex flex-wrap items-center gap-3 border-2 border-gray-900 bg-gray-50">
          <span className="text-sm font-bold text-gray-900 whitespace-nowrap">
            {selectedIds.size} selected
          </span>
          <div className="flex-1 flex flex-wrap items-center gap-2">
            {/* Status */}
            <select value={bulkFields.status}
                    onChange={e => setBulkFields(f => ({ ...f, status: e.target.value }))}
                    className="input-field text-sm h-9 w-40">
              <option value="">Status…</option>
              {CORE_STATUSES.map(s => <option key={s.label} value={s.label}>{s.label}</option>)}
            </select>
            {/* Assignee */}
            <input type="text" placeholder="Assignee…"
                   value={bulkFields.assignee}
                   onChange={e => setBulkFields(f => ({ ...f, assignee: e.target.value }))}
                   className="input-field text-sm h-9 w-36" />
            {/* Fees Status */}
            <select value={bulkFields.fees_status}
                    onChange={e => setBulkFields(f => ({ ...f, fees_status: e.target.value }))}
                    className="input-field text-sm h-9 w-44">
              <option value="">Fees status…</option>
              {FEES_STATUS_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={handleBulkApply} disabled={bulkApplying}
                    className="btn-primary text-sm py-2 px-4">
              {bulkApplying ? 'Applying…' : `Apply to ${selectedIds.size}`}
            </button>
            <button onClick={handleBulkDelete} disabled={bulkApplying}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors">
              <Trash2 size={14} /> Delete {selectedIds.size}
            </button>
            <button onClick={clearSelection}
                    className="btn-outline text-sm py-2 px-3">
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {filtered.length === 0 && (
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
      )}

      {/* ── GROUPED VIEW ────────────────────────────────────────── */}
      {filtered.length > 0 && viewMode === 'grouped' && (
        <div className="space-y-4">
          {sortedGroups.map(([clientName, recs], ci) => {
            const done    = recs.filter(r => r.status === 'Done').length;
            const overdue = recs.filter(r => checkOverdue(r)).length;
            const pct     = recs.length ? Math.round((done / recs.length) * 100) : 0;
            const color   = CLIENT_COLORS[ci % CLIENT_COLORS.length];
            return (
              <div key={clientName} className="card overflow-hidden">
                {/* Client header */}
                <div className="flex items-center gap-3 px-5 py-4" style={{ backgroundColor: '#111827' }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                       style={{ background: color }}>
                    {clientName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white truncate">{clientName}</p>
                    <p className="text-xs text-gray-400">
                      {recs.length} service{recs.length !== 1 ? 's' : ''}
                      {overdue > 0 && <span className="ml-2 text-red-400">· {overdue} overdue</span>}
                    </p>
                  </div>
                  {/* Progress */}
                  <div className="text-right flex-shrink-0 mr-2">
                    <p className="text-xs text-gray-400 mb-1">{done}/{recs.length} done</p>
                    <div className="w-24 h-1.5 bg-white/10 rounded-full">
                      <div className="h-full bg-green-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <button onClick={() => openAdd(clientName)}
                          className="p-2 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0" title="Add service for this client">
                    <Plus size={14} className="text-white" />
                  </button>
                </div>

                {/* Services table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="pl-4 pr-2 py-2 w-8">
                          <input type="checkbox" className="rounded border-gray-300 cursor-pointer"
                                 checked={recs.length > 0 && recs.every(r => selectedIds.has(r.Id))}
                                 onChange={() => {
                                   const allSelected = recs.every(r => selectedIds.has(r.Id));
                                   setSelectedIds(prev => {
                                     const next = new Set(prev);
                                     recs.forEach(r => allSelected ? next.delete(r.Id) : next.add(r.Id));
                                     return next;
                                   });
                                 }} />
                        </th>
                        {['Service','Frequency','Period','Assignee','Due Date','Status','Fees',''].map(h => (
                          <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {recs.map((rec, ri) => {
                        const od         = checkOverdue(rec);
                        const isSelected = selectedIds.has(rec.Id);
                        return (
                          <tr key={rec.Id || ri}
                              className={`group border-b border-gray-50 transition-colors ${
                                isSelected ? 'bg-gray-100' : od ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'
                              }`}>
                            <td className="pl-4 pr-2 py-3 w-8">
                              <input type="checkbox" className="rounded border-gray-300 cursor-pointer"
                                     checked={isSelected}
                                     onChange={() => toggleSelect(rec.Id)} />
                            </td>
                            <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">
                              {rec.service_category || '—'}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full font-medium">
                                {getFrequency(rec)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">
                              {rec.period_label || '—'}
                            </td>
                            <td className="px-4 py-3 max-w-[180px]">
                              {rec.assignee
                                ? <div className="flex flex-wrap gap-1">
                                    {rec.assignee.split(',').map((a, j) => (
                                      <span key={j} className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
                                        {a.trim()}
                                      </span>
                                    ))}
                                  </div>
                                : <span className="text-gray-400">—</span>}
                            </td>
                            <td className={`px-4 py-3 whitespace-nowrap tabular-nums text-sm ${od ? 'text-red-700 font-semibold' : 'text-gray-600'}`}>
                              {fmtDate(rec.regulatory_due_date)}
                              {od && <span className="ml-1 text-xs">⚠</span>}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <StatusBadge rec={rec} />
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <FeesBadge rec={rec} />
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <RowActions rec={rec} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
          <div className="text-xs text-gray-400 px-1">
            {filtered.length} service{filtered.length !== 1 ? 's' : ''} across {sortedGroups.length} client{sortedGroups.length !== 1 ? 's' : ''}
            {activeFilterCount > 0 && ` · ${activeFilterCount} filter${activeFilterCount !== 1 ? 's' : ''} active`}
          </div>
        </div>
      )}

      {/* ── FLAT TABLE VIEW ─────────────────────────────────────── */}
      {filtered.length > 0 && viewMode === 'flat' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr style={{ backgroundColor: '#111827' }}>
                  <th className="pl-4 pr-2 py-3 w-8">
                    <input type="checkbox"
                           className="rounded border-gray-600 cursor-pointer"
                           checked={filtered.length > 0 && selectedIds.size === filtered.length}
                           onChange={toggleSelectAll} />
                  </th>
                  {['Client','Service','Frequency','Period','Assignee','Due Date','Status','Fees',''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-white font-semibold whitespace-nowrap text-xs tracking-wide uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((rec, i) => {
                  const od       = checkOverdue(rec);
                  const isSelected = selectedIds.has(rec.Id);
                  return (
                    <tr key={rec.Id || i}
                        className={`group border-b border-gray-100 transition-colors ${
                          isSelected ? 'bg-gray-100' : od ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'
                        }`}>
                      <td className="pl-4 pr-2 py-3 w-8">
                        <input type="checkbox" className="rounded border-gray-300 cursor-pointer"
                               checked={isSelected}
                               onChange={() => toggleSelect(rec.Id)} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-gray-800">{rec.client_name || '—'}</span>
                          <button onClick={() => openAdd(rec.client_name)}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-gray-100 rounded"
                                  title="Add another service for this client">
                            <Plus size={11} className="text-gray-500" />
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-700">{rec.service_category || '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full font-medium">
                          {getFrequency(rec)}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-600 text-xs">{rec.period_label || '—'}</td>
                      <td className="px-4 py-3 max-w-[160px]">
                        {rec.assignee
                          ? <div className="flex flex-wrap gap-1">
                              {rec.assignee.split(',').map((a, j) => (
                                <span key={j} className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap">{a.trim()}</span>
                              ))}
                            </div>
                          : <span className="text-gray-400">—</span>}
                      </td>
                      <td className={`px-4 py-3 whitespace-nowrap tabular-nums ${od ? 'text-red-700 font-semibold' : 'text-gray-600'}`}>
                        {fmtDate(rec.regulatory_due_date)}
                        {od && <span className="ml-1 text-xs">⚠</span>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <StatusBadge rec={rec} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <FeesBadge rec={rec} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <RowActions rec={rec} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100 text-xs text-gray-500">
            Showing {filtered.length} of {records.length} service{records.length !== 1 ? 's' : ''}
            {activeFilterCount > 0 && ` · ${activeFilterCount} filter${activeFilterCount !== 1 ? 's' : ''} active`}
          </div>
        </div>
      )}

      {/* ── Add / Edit Modal ─────────────────────────────────────── */}
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
                  <input type="text" list="cs-clients" className="input-field"
                         placeholder="Type or pick existing" required autoFocus
                         value={formData.client_name}
                         onChange={e => setFormData({ ...formData, client_name: e.target.value })} />
                  <datalist id="cs-clients">{existingClients.map(n => <option key={n} value={n} />)}</datalist>
                </div>

                <div>
                  <label className="label">Service Category *</label>
                  <select className="input-field" required value={formData.service_category}
                          onChange={e => setFormData({ ...formData, service_category: e.target.value })}>
                    <option value="">Select category</option>
                    {SERVICE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div>
                  <label className="label">Frequency</label>
                  <select className="input-field" value={formData.frequency}
                          onChange={e => setFormData({ ...formData, frequency: e.target.value })}>
                    {FREQ_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>

                <div>
                  <label className="label">Period <span className="text-gray-400 font-normal">(e.g. May 2025, Q1 FY25)</span></label>
                  <input type="text" className="input-field" placeholder="Which period does this cover?"
                         value={formData.period_label}
                         onChange={e => setFormData({ ...formData, period_label: e.target.value })} />
                </div>

                <div>
                  <label className="label">Assignee(s)</label>
                  <input type="text" className="input-field" placeholder="e.g. Priya, Rohit"
                         value={formData.assignee}
                         onChange={e => setFormData({ ...formData, assignee: e.target.value })} />
                  <p className="text-xs text-gray-400 mt-1">Separate multiple names with commas</p>
                </div>

                <div>
                  <label className="label">SPOC</label>
                  <input type="text" className="input-field" placeholder="Single point of contact"
                         value={formData.spoc}
                         onChange={e => setFormData({ ...formData, spoc: e.target.value })} />
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
                    {CORE_STATUSES.map(s => <option key={s.label} value={s.label}>{s.label}</option>)}
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

              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1">{editingRecord ? 'Update Service' : 'Add Service'}</button>
                <button type="button" onClick={() => setShowModal(false)} className="btn-outline flex-1">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Log Time Popup ────────────────────────────────────────── */}
      {logTimeData && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
            <div className="bg-gray-900 px-6 py-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                <Timer size={18} className="text-white" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Log Time</h2>
                <p className="text-xs text-gray-400 mt-0.5 truncate">{logTimeData.client_name} · {logTimeData.service_category}</p>
              </div>
              <button onClick={() => setLogTimeData(null)} className="ml-auto text-white/60 hover:text-white p-1.5 rounded-lg hover:bg-white/10">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                <strong>{logTimeData.service_category}</strong> is marked Done! How long did it take?
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Minutes taken *</label>
                  <div className="relative">
                    <input type="number" min="1" className="input-field pr-14" placeholder="e.g. 90"
                           value={logMins} onChange={e => setLogMins(e.target.value)} autoFocus />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">
                      {logMins ? fmtMins(logMins) : 'min'}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="label">Date</label>
                  <input type="date" className="input-field" value={logDate} onChange={e => setLogDate(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="label">Notes (optional)</label>
                <textarea className="textarea-field text-sm" rows={2}
                          placeholder="What was done? Any observations?"
                          value={logNotes} onChange={e => setLogNotes(e.target.value)} />
              </div>
              <div className="flex gap-3">
                <button disabled={logSaving} onClick={async () => {
                  if (!logMins || parseInt(logMins) <= 0) { toast.error('Enter valid minutes'); return; }
                  setLogSaving(true);
                  try {
                    await axios.post(`${API}/timesheets`, {
                      client_name:      logTimeData.client_name,
                      service_category: logTimeData.service_category,
                      minutes:          parseInt(logMins),
                      date:             logDate,
                      notes:            logNotes,
                      user_name:        currentUser.name || '',
                    }, getAuthHeaders());
                    toast.success('Time logged to timesheet');
                    setLogTimeData(null);
                  } catch (err) {
                    toast.error(await toastMsg('Services.logTime', err, 'Failed to log time'));
                  } finally { setLogSaving(false); }
                }} className="btn-primary flex-1">
                  {logSaving ? 'Saving…' : 'Log Time'}
                </button>
                <button onClick={() => setLogTimeData(null)} className="btn-outline flex-1">Skip</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
