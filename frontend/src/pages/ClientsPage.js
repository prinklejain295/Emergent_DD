import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Plus, Edit2, Trash2, Mail, Phone, Building, User,
  LayoutGrid, List, Search, X, ChevronUp, ChevronDown, ArrowUpDown, Globe, Filter,
} from 'lucide-react';
import { toastMsg } from '../utils/errorLogger';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'https://emergent-dd-2b7s.vercel.app';
const API = `${BACKEND_URL}/api`;
const getAuthHeaders = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

/* ── Constants ───────────────────────────────────────────────────── */
const PHONE_CODES = [
  { code: '+91',  country: 'India 🇮🇳' },
  { code: '+1',   country: 'USA/Canada 🇺🇸' },
  { code: '+44',  country: 'UK 🇬🇧' },
  { code: '+971', country: 'UAE 🇦🇪' },
  { code: '+65',  country: 'Singapore 🇸🇬' },
  { code: '+61',  country: 'Australia 🇦🇺' },
  { code: '+49',  country: 'Germany 🇩🇪' },
  { code: '+33',  country: 'France 🇫🇷' },
  { code: '+81',  country: 'Japan 🇯🇵' },
  { code: '+86',  country: 'China 🇨🇳' },
  { code: '+55',  country: 'Brazil 🇧🇷' },
  { code: '+27',  country: 'South Africa 🇿🇦' },
  { code: '+60',  country: 'Malaysia 🇲🇾' },
  { code: '+92',  country: 'Pakistan 🇵🇰' },
  { code: '+880', country: 'Bangladesh 🇧🇩' },
];

const COUNTRY_TAGS = [
  'India','United States','United Kingdom','UAE','Canada',
  'Australia','Singapore','Germany','France','Japan',
  'China','Brazil','Malaysia','South Africa','Other',
];

const TAG_COLORS = {
  'India':          { bg: '#FFF3CD', text: '#856404', border: '#FFEAA7' },
  'United States':  { bg: '#D1ECF1', text: '#0C5460', border: '#BEE5EB' },
  'United Kingdom': { bg: '#CCE5FF', text: '#004085', border: '#B8D4FF' },
  'UAE':            { bg: '#D4EDDA', text: '#155724', border: '#C3E6CB' },
  'Canada':         { bg: '#FFE4E4', text: '#7B1D1D', border: '#FFCCCC' },
  'Australia':      { bg: '#E8D5FF', text: '#111827', border: '#E5E7EB' },
  'Singapore':      { bg: '#FFF0F0', text: '#9B1C1C', border: '#FECACA' },
  'Germany':        { bg: '#F0F4C3', text: '#5D4037', border: '#E6EE9C' },
  'Other':          { bg: '#F3F4F6', text: '#374151', border: '#E5E7EB' },
};
const getTagStyle = (tag) => TAG_COLORS[tag] || { bg: '#F3F4F6', text: '#374151', border: '#E5E7EB' };

/* ── Client categories ───────────────────────────────────────────── */
const CATEGORIES = [
  { value: 'Diamond',  label: 'Diamond',  bg: '#111827', text: '#FFFFFF', border: '#111827' },
  { value: 'Platinum', label: 'Platinum', bg: '#374151', text: '#FFFFFF', border: '#374151' },
  { value: 'Gold',     label: 'Gold',     bg: '#6B7280', text: '#FFFFFF', border: '#6B7280' },
  { value: 'Silver',   label: 'Silver',   bg: '#F3F4F6', text: '#374151', border: '#D1D5DB' },
  { value: 'Bronze',   label: 'Bronze',   bg: '#FFFFFF', text: '#374151', border: '#D1D5DB' },
  { value: 'Standard', label: 'Standard', bg: '#FFFFFF', text: '#9CA3AF', border: '#E5E7EB' },
];
const getCategoryStyle = (cat) => CATEGORIES.find(c => c.value === cat) || null;

const EMPTY = {
  type: 'individual', name: '', doing_business_as: '', company: '',
  email: '', phone_code: '+91', phone: '', tags: [], notes: '', category: '',
};

/* ── Validation (no browser HTML5 validation — we do it ourselves) ── */
const emailRx = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
const phoneRx = /^\d{6,15}$/;

const validate = (f) => {
  const e = {};
  if (f.type === 'business' && !f.company.trim()) e.company = 'Company name is required';
  if (!f.name.trim()) e.name = f.type === 'business' ? 'Contact person name is required' : 'Full name is required';
  if (!f.email.trim()) e.email = 'Email is required';
  else if (!emailRx.test(f.email.trim())) e.email = 'Enter a valid email address (e.g. name@domain.com)';
  if (!f.phone.trim()) e.phone = 'Phone is required';
  else if (!phoneRx.test(f.phone.replace(/[\s\-()]/g, ''))) e.phone = 'Must be 6–15 digits only';
  return e;
};

/* ── Helpers ─────────────────────────────────────────────────────── */
/* Infer type from stored field, falling back to company presence.
   Handles clients saved before the 'type' field was added to NocoDB. */
const getClientType = (c) => c.type || (c.company?.trim() ? 'business' : 'individual');

const getInitials = (c) => {
  const n = getClientType(c) === 'business' ? (c.company || c.name) : (c.doing_business_as || c.name);
  return (n || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
};

const GRADIENTS = [
  '#3B82F6',
  '#8B5CF6',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#06B6D4',
];

const TagPills = ({ tags, max = 3 }) => {
  if (!tags) return null;
  const list = typeof tags === 'string' ? tags.split(',').map(t => t.trim()).filter(Boolean) : tags;
  if (!list.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {list.slice(0, max).map(t => (
        <span key={t} className="text-xs px-2 py-0.5 rounded-full font-medium border" style={getTagStyle(t)}>{t}</span>
      ))}
      {list.length > max && (
        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">+{list.length - max}</span>
      )}
    </div>
  );
};

/* ── Inline filter input for list view header ────────────────────── */
const ColFilter = ({ value, onChange, placeholder, type = 'text', options }) =>
  type === 'select' ? (
    <select value={value} onChange={e => onChange(e.target.value)}
            className="w-full text-xs border border-[#E5E7EB] rounded-lg px-2 py-1 bg-white focus:outline-none focus:border-gray-900 cursor-pointer">
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  ) : (
    <input type="text" value={value} onChange={e => onChange(e.target.value)}
           placeholder={placeholder}
           className="w-full text-xs border border-[#E5E7EB] rounded-lg px-2 py-1 bg-white focus:outline-none focus:border-gray-900 placeholder-gray-400" />
  );

/* ═══════════════════════════════════════════════════════════════════ */
export default function ClientsPage() {
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const userRole    = currentUser.role || 'consultant';

  const [clients, setClients]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [permissions, setPermissions] = useState(null);
  const [viewMode, setViewMode]   = useState('board');
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [formData, setFormData]   = useState(EMPTY);
  const [formErrors, setFormErrors] = useState({});
  const [showTagMenu, setShowTagMenu] = useState(false);
  const tagMenuRef = useRef(null);

  /* Toolbar filters */
  const [search, setSearch]               = useState('');
  const [filterType, setFilterType]       = useState('all');
  const [filterTag, setFilterTag]         = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [sortKey, setSortKey]             = useState('name');
  const [sortDir, setSortDir]             = useState('asc');
  const [showFilters, setShowFilters]     = useState(false);

  /* Column-level filters (list view only) */
  const [cf, setCf] = useState({ name: '', type: 'all', company: '', email: '', tags: 'all' });
  const setColFilter = (key, val) => setCf(f => ({ ...f, [key]: val }));

  useEffect(() => {
    fetchClients();
    axios.get(`${API}/permissions`, getAuthHeaders())
      .then(r => setPermissions(r.data))
      .catch(() => {});
  }, []);
  useEffect(() => {
    const h = (e) => { if (tagMenuRef.current && !tagMenuRef.current.contains(e.target)) setShowTagMenu(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const canAdd    = userRole === 'admin' || !!permissions?.add_client?.[userRole];
  const canEdit   = userRole === 'admin' || !!permissions?.edit_client?.[userRole];
  const canDelete = userRole === 'admin' || !!permissions?.delete_client?.[userRole];

  const fetchClients = async () => {
    try {
      const res = await axios.get(`${API}/clients`, getAuthHeaders());
      setClients(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      toast.error(await toastMsg('ClientsPage.fetch', err, 'Failed to load clients'));
    } finally { setLoading(false); }
  };

  const openAdd = () => { setEditingClient(null); setFormData(EMPTY); setFormErrors({}); setShowModal(true); };
  const openEdit = (c) => {
    setEditingClient(c);
    setFormData({
      type: getClientType(c),
      name: c.name || '',
      doing_business_as: c.doing_business_as || '',
      company: c.company || '',
      email: c.email || '',
      phone_code: c.phone_code || '+91',
      phone: c.phone || '',
      tags: c.tags ? c.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      notes: c.notes || '',
      category: c.category || '',
    });
    setFormErrors({});
    setShowModal(true);
  };

  const set = (key, val) => {
    setFormData(f => ({ ...f, [key]: val }));
    if (key === 'email') {
      const ok = !val || emailRx.test(val.trim());
      setFormErrors(e => ({ ...e, email: ok ? undefined : 'Enter a valid email address (e.g. name@domain.com)' }));
    } else if (formErrors[key]) {
      setFormErrors(e => ({ ...e, [key]: undefined }));
    }
  };
  const toggleTag = (tag) =>
    setFormData(f => ({ ...f, tags: f.tags.includes(tag) ? f.tags.filter(t => t !== tag) : [...f.tags, tag] }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate(formData);
    if (Object.keys(errs).length) { setFormErrors(errs); return; }
    const payload = {
      name: formData.name, company: formData.type === 'business' ? formData.company : '',
      doing_business_as: formData.type === 'individual' ? formData.doing_business_as : '',
      email: formData.email.trim(), phone: formData.phone, phone_code: formData.phone_code,
      type: formData.type, tags: formData.tags.join(', '), notes: formData.notes,
      category: formData.category || '',
    };
    try {
      if (editingClient) {
        await axios.put(`${API}/clients/${editingClient.Id}`, payload, getAuthHeaders());
        toast.success('Client updated');
      } else {
        await axios.post(`${API}/clients`, payload, getAuthHeaders());
        toast.success('Client created');
      }
      setShowModal(false);
      fetchClients();
    } catch (err) {
      toast.error(await toastMsg('ClientsPage.save', err, err.response?.data?.error || 'Failed to save'));
    }
  };

  const handleDelete = async (c) => {
    if (!window.confirm(`Delete "${c.name}"?`)) return;
    try {
      await axios.delete(`${API}/clients/${c.Id}`, getAuthHeaders());
      toast.success('Deleted');
      fetchClients();
    } catch (err) {
      toast.error(await toastMsg('ClientsPage.delete', err, 'Failed to delete'));
    }
  };

  /* ── Sort ────────────────────────────────────────────────────────── */
  const toggleSort = (key) => { if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortKey(key); setSortDir('asc'); } };
  const SortIcon = ({ col }) => {
    if (sortKey !== col) return <ArrowUpDown size={12} className="text-white/50 ml-1 inline" />;
    return sortDir === 'asc' ? <ChevronUp size={12} className="text-white ml-1 inline" /> : <ChevronDown size={12} className="text-white ml-1 inline" />;
  };

  /* ── Filtered + sorted data ─────────────────────────────────────── */
  const displayed = clients
    .filter(c => {
      const q = search.toLowerCase();
      if (q && !(c.name||'').toLowerCase().includes(q) && !(c.email||'').toLowerCase().includes(q) && !(c.company||'').toLowerCase().includes(q)) return false;
      if (filterType     !== 'all' && getClientType(c) !== filterType) return false;
      if (filterTag      !== 'all' && !(c.tags || '').split(',').map(t => t.trim()).includes(filterTag)) return false;
      if (filterCategory !== 'all' && (c.category || '') !== filterCategory) return false;
      // Column filters (list view)
      if (viewMode === 'list') {
        if (cf.name    && !(c.name    || '').toLowerCase().includes(cf.name.toLowerCase()))    return false;
        if (cf.type   !== 'all' && getClientType(c) !== cf.type)                                 return false;
        if (cf.company   && !(c.company  || '').toLowerCase().includes(cf.company.toLowerCase())) return false;
        if (cf.email     && !(c.email    || '').toLowerCase().includes(cf.email.toLowerCase()))   return false;
        if (cf.tags !== 'all' && !(c.tags || '').split(',').map(t => t.trim()).includes(cf.tags)) return false;
        if (cf.category && cf.category !== 'all' && (c.category || '') !== cf.category)           return false;
      }
      return true;
    })
    .sort((a, b) => {
      const av = (a[sortKey] || '').toString().toLowerCase();
      const bv = (b[sortKey] || '').toString().toLowerCase();
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });

  const activeColFilters = Object.entries(cf).filter(([, v]) => v !== '' && v !== 'all').length;

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900" />
    </div>
  );

  /* ═══════ RENDER ══════════════════════════════════════════════════ */
  return (
    <div data-testid="clients-page" className="animate-fade-in">

      {/* Header */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Clients</h1>
          <p className="page-description">{clients.length} client{clients.length !== 1 ? 's' : ''} in your organisation</p>
        </div>
        {canAdd && (
          <button onClick={openAdd} data-testid="add-client-button" className="btn-primary flex items-center gap-2 self-start sm:self-auto">
            <Plus size={18} /> Add Client
          </button>
        )}
      </div>

      {/* Toolbar */}
      {(() => {
        const activeFilterCount = [filterType, filterTag, filterCategory].filter(v => v !== 'all').length + (search ? 1 : 0);
        const clearAllFilters = () => { setFilterType('all'); setFilterTag('all'); setFilterCategory('all'); setSearch(''); setSortKey('name'); setSortDir('asc'); };
        return (
          <div className="card p-4 mb-6">
            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative flex-1 min-w-0">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" placeholder="Search by name, email or company…" className="input-field pl-9 text-sm h-10"
                       value={search} onChange={e => setSearch(e.target.value)} />
                {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={13} /></button>}
              </div>
              {/* View toggle */}
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 flex-shrink-0">
                <button onClick={() => setViewMode('board')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${viewMode === 'board' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  <LayoutGrid size={13} /> Board
                </button>
                <button onClick={() => setViewMode('list')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${viewMode === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                  <List size={13} /> List
                </button>
              </div>
              {/* Filters toggle */}
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
                <button onClick={clearAllFilters} className="text-sm text-gray-500 hover:text-red-500 flex items-center gap-1 flex-shrink-0">
                  <X size={13} /> Clear
                </button>
              )}
            </div>

            {/* Expandable filter panel */}
            {showFilters && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-gray-100">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Type</label>
                  <select className="input-field text-sm h-9" value={filterType} onChange={e => setFilterType(e.target.value)}>
                    <option value="all">All Types</option>
                    <option value="individual">Individual</option>
                    <option value="business">Business</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Category</label>
                  <select className="input-field text-sm h-9" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
                    <option value="all">All Categories</option>
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Country</label>
                  <select className="input-field text-sm h-9" value={filterTag} onChange={e => setFilterTag(e.target.value)}>
                    <option value="all">All Countries</option>
                    {COUNTRY_TAGS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Sort</label>
                  <select className="input-field text-sm h-9" value={`${sortKey}-${sortDir}`}
                          onChange={e => { const [k, d] = e.target.value.split('-'); setSortKey(k); setSortDir(d); }}>
                    <option value="name-asc">Name A→Z</option>
                    <option value="name-desc">Name Z→A</option>
                    <option value="type-asc">Type A→Z</option>
                    <option value="email-asc">Email A→Z</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Empty state */}
      {displayed.length === 0 ? (
        <div className="card p-14 text-center">
          <div className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#F3F4F6,#E5E7EB)' }}>
            <Building size={36} className="text-gray-600" />
          </div>
          <h3 className="text-xl font-semibold text-[#374151] mb-2">No clients found</h3>
          <p className="text-gray-500 mb-6">{search || filterType !== 'all' || filterTag !== 'all' ? 'Try adjusting filters' : 'Add your first client to get started'}</p>
          {!search && filterType === 'all' && filterTag === 'all' && canAdd && <button onClick={openAdd} className="btn-primary">Add First Client</button>}
        </div>

      ) : viewMode === 'board' ? ((() => {
        /* ── BOARD VIEW — grouped by type ──────────────────────── */
        const ClientCard = ({ c, i }) => (
          <div key={c.Id || i} className="card p-5 group relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl" style={{ background: GRADIENTS[i % GRADIENTS.length] }} />
            <div className="flex items-center gap-3 mb-4 mt-1">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-md flex-shrink-0"
                   style={{ background: GRADIENTS[i % GRADIENTS.length] }}>
                {getInitials(c)}
              </div>
              <div className="min-w-0">
                {getClientType(c) === 'business' && c.company && <p className="font-bold text-gray-900 truncate text-sm">{c.company}</p>}
                <p className={`truncate ${getClientType(c) === 'business' ? 'text-gray-500 text-xs' : 'font-bold text-gray-900 text-sm'}`}>{c.name}</p>
                {getClientType(c) === 'individual' && c.doing_business_as && <p className="text-xs text-gray-500 truncate">DBA: {c.doing_business_as}</p>}
              </div>
            </div>
            {(() => { const cat = getCategoryStyle(c.category); return cat ? (
              <span className="inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full border mb-3"
                    style={{ background: cat.bg, color: cat.text, borderColor: cat.border }}>
                {cat.label}
              </span>
            ) : null; })()}
            <div className="space-y-1.5 text-sm text-gray-600 mb-3">
              <div className="flex items-center gap-2 truncate"><Mail size={13} className="text-gray-500 flex-shrink-0" /><span className="truncate">{c.email || '—'}</span></div>
              {c.phone && <div className="flex items-center gap-2"><Phone size={13} className="text-gray-500 flex-shrink-0" /><span>{c.phone_code || ''} {c.phone}</span></div>}
            </div>
            {c.tags && <div className="mb-4"><TagPills tags={c.tags} /></div>}
            {(canEdit || canDelete) && (
              <div className="flex gap-2 pt-3 border-t border-gray-100 opacity-0 group-hover:opacity-100 transition-opacity">
                {canEdit   && <button onClick={() => openEdit(c)}   className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"><Edit2 size={12} /> Edit</button>}
                {canDelete && <button onClick={() => handleDelete(c)} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={12} /> Delete</button>}
              </div>
            )}
          </div>
        );

        const businesses  = displayed.filter(c => getClientType(c) === 'business');
        const individuals = displayed.filter(c => getClientType(c) !== 'business');
        const showBoth    = filterType === 'all';

        return (
          <div className="space-y-8">
            {/* Business clients */}
            {(showBoth || filterType === 'business') && (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex items-center gap-2 bg-gray-100 text-gray-700 px-3 py-1.5 rounded-xl">
                    <Building size={15} />
                    <span className="font-semibold text-sm">Business Clients</span>
                    <span className="bg-gray-200 text-gray-800 text-xs font-bold px-2 py-0.5 rounded-full">{businesses.length}</span>
                  </div>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>
                {businesses.length === 0
                  ? <p className="text-sm text-gray-400 pl-1">No business clients yet</p>
                  : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                      {businesses.map((c, i) => <ClientCard key={c.Id || i} c={c} i={i} />)}
                    </div>
                }
              </div>
            )}

            {/* Individual clients */}
            {(showBoth || filterType === 'individual') && (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex items-center gap-2 bg-gray-50 text-gray-600 px-3 py-1.5 rounded-xl">
                    <User size={15} />
                    <span className="font-semibold text-sm">Individual Clients</span>
                    <span className="bg-gray-100 text-gray-700 text-xs font-bold px-2 py-0.5 rounded-full">{individuals.length}</span>
                  </div>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>
                {individuals.length === 0
                  ? <p className="text-sm text-gray-400 pl-1">No individual clients yet</p>
                  : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                      {individuals.map((c, i) => <ClientCard key={c.Id || i} c={c} i={i} />)}
                    </div>
                }
              </div>
            )}
          </div>
        );
      })()) : (
        /* ── LIST VIEW ──────────────────────────────────────────── */
        <div className="card overflow-hidden">
          {activeColFilters > 0 && (
            <div className="px-4 py-2 bg-[#F3F4F6] border-b border-[#E5E7EB] flex items-center gap-2">
              <span className="text-xs font-semibold text-[#374151]">{activeColFilters} column filter{activeColFilters > 1 ? 's' : ''} active</span>
              <button onClick={() => setCf({ name: '', type: 'all', company: '', email: '', tags: 'all' })} className="text-xs text-gray-600 hover:underline ml-auto">Clear all</button>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                {/* Column headers */}
                <tr style={{ background: '#111827' }}>
                  {[['name','Name'],['type','Type'],['category','Category'],['company','Company / DBA'],['email','Email'],['phone','Phone'],['tags','Countries'],['','']].map(([key, label]) => (
                    <th key={key} onClick={() => key && toggleSort(key)}
                        className={`px-4 py-3.5 text-left text-white font-semibold text-xs tracking-wide uppercase whitespace-nowrap ${key ? 'cursor-pointer hover:bg-white/10 transition-colors' : ''}`}>
                      {label}{key && <SortIcon col={key} />}
                    </th>
                  ))}
                </tr>
                {/* Column filter row */}
                <tr className="border-b border-[#E5E7EB]" style={{ backgroundColor: '#F9FAFB' }}>
                  <th className="px-3 py-2 font-normal"><ColFilter value={cf.name} onChange={v => setColFilter('name', v)} placeholder="Filter name…" /></th>
                  <th className="px-3 py-2 font-normal">
                    <ColFilter type="select" value={cf.type} onChange={v => setColFilter('type', v)}
                               options={[{ value: 'all', label: 'All' }, { value: 'individual', label: 'Individual' }, { value: 'business', label: 'Business' }]} />
                  </th>
                  <th className="px-3 py-2 font-normal">
                    <ColFilter type="select" value={cf.category || 'all'} onChange={v => setColFilter('category', v)}
                               options={[{ value: 'all', label: 'All' }, ...CATEGORIES.map(c => ({ value: c.value, label: c.value }))]} />
                  </th>
                  <th className="px-3 py-2 font-normal"><ColFilter value={cf.company} onChange={v => setColFilter('company', v)} placeholder="Filter company…" /></th>
                  <th className="px-3 py-2 font-normal"><ColFilter value={cf.email} onChange={v => setColFilter('email', v)} placeholder="Filter email…" /></th>
                  <th className="px-3 py-2 font-normal text-xs text-gray-400 font-normal">—</th>
                  <th className="px-3 py-2 font-normal">
                    <ColFilter type="select" value={cf.tags} onChange={v => setColFilter('tags', v)}
                               options={[{ value: 'all', label: 'All countries' }, ...COUNTRY_TAGS.map(t => ({ value: t, label: t }))]} />
                  </th>
                  <th className="px-3 py-2 font-normal" />
                </tr>
              </thead>
              <tbody>
                {displayed.map((c, i) => (
                  <tr key={c.id || i} className="group border-b border-[#F3F4F6] hover:bg-[#F9FAFB] transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: GRADIENTS[i % GRADIENTS.length] }}>{getInitials(c)}</div>
                        <div>
                          <p className="font-semibold text-[#111827] leading-tight">{c.name}</p>
                          {c.doing_business_as && <p className="text-xs text-gray-600">DBA: {c.doing_business_as}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${getClientType(c) === 'business' ? 'bg-gray-100 text-gray-700' : 'bg-gray-50 text-gray-600'}`}>
                        {getClientType(c) === 'business' ? <Building size={10} /> : <User size={10} />}
                        {getClientType(c) === 'business' ? 'Business' : 'Individual'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {getCategoryStyle(c.category) ? (
                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full border"
                              style={{ background: getCategoryStyle(c.category).bg, color: getCategoryStyle(c.category).text, borderColor: getCategoryStyle(c.category).border }}>
                          {getCategoryStyle(c.category).label}
                        </span>
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">{c.company || '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">{c.email}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">{c.phone ? `${c.phone_code || ''} ${c.phone}` : '—'}</td>
                    <td className="px-4 py-3 max-w-[200px]"><TagPills tags={c.tags} /></td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {(canEdit || canDelete) && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {canEdit   && <button onClick={() => openEdit(c)}   className="p-1.5 hover:bg-gray-50 rounded-lg"><Edit2 size={14} className="text-gray-500" /></button>}
                          {canDelete && <button onClick={() => handleDelete(c)} className="p-1.5 hover:bg-red-50 rounded-lg"><Trash2 size={14} className="text-red-500" /></button>}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2.5 text-xs text-gray-500 border-t border-[#F3F4F6]" style={{ backgroundColor: '#F9FAFB' }}>
            {displayed.length} of {clients.length} client{clients.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      {/* ── Modal ─────────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl flex flex-col max-h-[94vh] overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 flex-shrink-0"
                 style={{ background: '#111827' }}>
              <div>
                <h2 className="text-lg font-bold text-white">{editingClient ? 'Edit Client' : 'Add New Client'}</h2>
                <p className="text-slate-300 text-xs mt-0.5">All fields marked * are required</p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-white/70 hover:text-white hover:bg-white/15 p-1.5 rounded-lg transition-colors"><X size={20} /></button>
            </div>

            {/* ── noValidate disables browser built-in HTML5 popup validation ── */}
            <form onSubmit={handleSubmit} noValidate className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

              {/* Type toggle */}
              <div>
                <label className="label">Client Type *</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { val: 'individual', label: 'Individual', icon: User, desc: 'Personal / sole trader' },
                    { val: 'business', label: 'Business', icon: Building, desc: 'Company / firm / LLP' },
                  ].map(({ val, label, icon: Icon, desc }) => (
                    <button key={val} type="button" onClick={() => set('type', val)}
                            className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${formData.type === val ? 'border-gray-900 bg-[#F3F4F6]' : 'border-[#E5E7EB] hover:border-gray-500'}`}>
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${formData.type === val ? 'bg-gray-900 text-white' : 'bg-[#F3F4F6] text-[#374151]'}`}><Icon size={18} /></div>
                      <div><p className="font-semibold text-sm">{label}</p><p className="text-xs text-gray-500">{desc}</p></div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Business: company name */}
              {formData.type === 'business' && (
                <div>
                  <label className="label">Company Name *</label>
                  <input type="text" className={`input-field ${formErrors.company ? 'error' : ''}`}
                         placeholder="e.g. Acme Pvt Ltd" value={formData.company} onChange={e => set('company', e.target.value)} />
                  {formErrors.company && <p className="error-msg">{formErrors.company}</p>}
                </div>
              )}

              {/* Name */}
              <div>
                <label className="label">{formData.type === 'business' ? 'Contact Person Name *' : 'Full Name *'}</label>
                <input type="text" className={`input-field ${formErrors.name ? 'error' : ''}`}
                       placeholder={formData.type === 'business' ? 'Contact person at the company' : 'Full legal name'}
                       value={formData.name} onChange={e => set('name', e.target.value)} autoFocus />
                {formErrors.name && <p className="error-msg">{formErrors.name}</p>}
              </div>

              {/* Individual only: Doing Business As */}
              {formData.type === 'individual' && (
                <div>
                  <label className="label">Doing Business As</label>
                  <input type="text" className="input-field"
                         placeholder="Trade / business name (if any)"
                         value={formData.doing_business_as} onChange={e => set('doing_business_as', e.target.value)} />
                  <p className="text-xs text-gray-400 mt-1">Leave blank if same as legal name</p>
                </div>
              )}

              {/* Email + Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Email Address *</label>
                  {/* type="text" + noValidate on form so our validation runs instead of browser popup */}
                  <input type="text" inputMode="email" autoComplete="email"
                         className={`input-field ${formErrors.email ? 'error' : ''}`}
                         placeholder="name@company.com"
                         value={formData.email} onChange={e => set('email', e.target.value)} />
                  {formErrors.email && <p className="error-msg">{formErrors.email}</p>}
                </div>

                <div>
                  <label className="label">Phone Number *</label>
                  {/* Joined input: narrow code selector + wide number input */}
                  <div className={`flex rounded-xl overflow-hidden border-2 transition-all focus-within:border-gray-900 focus-within:shadow-[0_0_0_4px_rgba(0,0,0,0.08)] ${formErrors.phone ? 'border-red-400' : 'border-[#E5E7EB]'}`}>
                    <select value={formData.phone_code} onChange={e => set('phone_code', e.target.value)}
                            className="bg-[#F9FAFB] text-sm font-semibold text-[#111827] border-r border-[#E5E7EB] focus:outline-none cursor-pointer px-2"
                            style={{ width: '68px', flexShrink: 0 }}>
                      {PHONE_CODES.map(p => (
                        <option key={p.code + p.country} value={p.code}>{p.code}</option>
                      ))}
                    </select>
                    <input type="tel" className="flex-1 px-3 py-2 text-sm bg-white focus:outline-none min-w-0"
                           placeholder="9876543210"
                           value={formData.phone} onChange={e => set('phone', e.target.value.replace(/[^\d\s\-()]/g, ''))} />
                  </div>
                  {formErrors.phone && <p className="error-msg">{formErrors.phone}</p>}
                </div>
              </div>

              {/* Country Tags */}
              <div>
                <label className="label flex items-center gap-2"><Globe size={14} /> Country / Region Tags</label>
                <div className="relative" ref={tagMenuRef}>
                  <button type="button" onClick={() => setShowTagMenu(v => !v)}
                          className="input-field flex items-center justify-between text-sm cursor-pointer h-10">
                    <span className="text-gray-500">{formData.tags.length === 0 ? 'Select countries…' : `${formData.tags.length} selected`}</span>
                    <ChevronDown size={15} className="text-gray-400 flex-shrink-0" />
                  </button>
                  {showTagMenu && (
                    <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-[#E5E7EB] rounded-xl shadow-xl z-20 p-2 max-h-48 overflow-y-auto">
                      {COUNTRY_TAGS.map(tag => (
                        <button key={tag} type="button" onClick={() => toggleTag(tag)}
                                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-[#F9FAFB] transition-colors">
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${formData.tags.includes(tag) ? 'bg-gray-900 border-gray-900' : 'border-gray-300'}`}>
                            {formData.tags.includes(tag) && <span className="text-white text-xs leading-none">✓</span>}
                          </div>
                          <span className="flex-1 text-left text-gray-700">{tag}</span>
                          {formData.tags.includes(tag) && <span className="text-xs px-2 py-0.5 rounded-full border" style={getTagStyle(tag)}>{tag}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {formData.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {formData.tags.map(t => (
                      <span key={t} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border font-medium" style={getTagStyle(t)}>
                        {t}<button type="button" onClick={() => toggleTag(t)} className="hover:opacity-70 ml-0.5">×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Category */}
              <div>
                <label className="label">Client Category</label>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => set('category', '')}
                          className={`text-xs px-3 py-1.5 rounded-full border-2 font-medium transition-all ${!formData.category ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 text-gray-500 hover:border-gray-400'}`}>
                    None
                  </button>
                  {CATEGORIES.map(cat => (
                    <button key={cat.value} type="button" onClick={() => set('category', cat.value)}
                            className={`text-xs px-3 py-1.5 rounded-full border-2 font-medium transition-all ${formData.category === cat.value ? 'border-gray-900 ring-2 ring-gray-300' : 'border-transparent hover:border-gray-300'}`}
                            style={formData.category === cat.value
                              ? { background: cat.bg, color: cat.text, borderColor: cat.border }
                              : { background: cat.bg, color: cat.text, borderColor: cat.border, opacity: 0.7 }}>
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="label">Notes</label>
                <textarea className="textarea-field text-sm" rows={3} placeholder="Any additional notes…"
                          value={formData.notes} onChange={e => set('notes', e.target.value)} />
              </div>

              <div className="flex gap-3 pt-1">
                <button type="submit" data-testid="save-client-button" className="btn-primary flex-1">{editingClient ? 'Update Client' : 'Create Client'}</button>
                <button type="button" onClick={() => setShowModal(false)} className="btn-outline flex-1">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
