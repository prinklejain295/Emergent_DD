import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Plus, Edit2, Trash2, Mail, Phone, Building, User,
  LayoutGrid, List, Search, X, ChevronUp, ChevronDown,
  ArrowUpDown, Tag, Globe, Upload, Download,
} from 'lucide-react';
import { toastMsg } from '../utils/errorLogger';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'https://emergent-dd-2b7s.vercel.app';
const API = `${BACKEND_URL}/api`;
const getAuthHeaders = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

/* ── Constants ────────────────────────────────────────────────────── */
const PHONE_CODES = [
  { code: '+91', label: '🇮🇳 +91', country: 'India' },
  { code: '+1',  label: '🇺🇸 +1',  country: 'USA/Canada' },
  { code: '+44', label: '🇬🇧 +44', country: 'UK' },
  { code: '+971',label: '🇦🇪 +971',country: 'UAE' },
  { code: '+65', label: '🇸🇬 +65', country: 'Singapore' },
  { code: '+61', label: '🇦🇺 +61', country: 'Australia' },
  { code: '+49', label: '🇩🇪 +49', country: 'Germany' },
  { code: '+33', label: '🇫🇷 +33', country: 'France' },
  { code: '+81', label: '🇯🇵 +81', country: 'Japan' },
  { code: '+86', label: '🇨🇳 +86', country: 'China' },
  { code: '+55', label: '🇧🇷 +55', country: 'Brazil' },
  { code: '+27', label: '🇿🇦 +27', country: 'South Africa' },
  { code: '+971',label: '🇦🇪 +971',country: 'UAE' },
  { code: '+60', label: '🇲🇾 +60', country: 'Malaysia' },
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
  'Australia':      { bg: '#E8D5FF', text: '#4C1D95', border: '#DDD6FE' },
  'Singapore':      { bg: '#FFF0F0', text: '#9B1C1C', border: '#FECACA' },
  'Germany':        { bg: '#F0F4C3', text: '#5D4037', border: '#E6EE9C' },
  'Other':          { bg: '#F3F4F6', text: '#374151', border: '#E5E7EB' },
};

const getTagStyle = (tag) =>
  TAG_COLORS[tag] || { bg: '#EDE9FE', text: '#5B21B6', border: '#DDD6FE' };

const EMPTY = {
  type: 'individual', name: '', company: '', email: '',
  phone_code: '+91', phone: '', tags: [], notes: '',
};

/* ── Validation ─────────────────────────────────────────────────── */
const emailRx  = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRx  = /^\d{6,15}$/;

const validate = (f) => {
  const e = {};
  if (f.type === 'business' && !f.company.trim()) e.company = 'Company name is required';
  if (!f.name.trim())  e.name  = f.type === 'business' ? 'Contact person name is required' : 'Full name is required';
  if (!f.email.trim()) e.email = 'Email is required';
  else if (!emailRx.test(f.email)) e.email = 'Enter a valid email address';
  if (!f.phone.trim()) e.phone = 'Phone number is required';
  else if (!phoneRx.test(f.phone.replace(/[\s-]/g, '')))
    e.phone = 'Phone must be 6–15 digits (no spaces or dashes)';
  return e;
};

/* ── Initials avatar ─────────────────────────────────────────────── */
const getInitials = (client) => {
  const name = client.type === 'business' ? (client.company || client.name) : client.name;
  return (name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
};

/* ── Avatar gradient by index ───────────────────────────────────── */
const GRADIENTS = [
  'linear-gradient(135deg, #7C3AED 0%, #A855F7 100%)',
  'linear-gradient(135deg, #EC4899 0%, #F43F5E 100%)',
  'linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)',
  'linear-gradient(135deg, #10B981 0%, #3B82F6 100%)',
  'linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)',
  'linear-gradient(135deg, #06B6D4 0%, #7C3AED 100%)',
];

export default function ClientsPage() {
  const [clients, setClients]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [viewMode, setViewMode]       = useState('board');
  const [showModal, setShowModal]     = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [formData, setFormData]       = useState(EMPTY);
  const [formErrors, setFormErrors]   = useState({});
  const [showTagMenu, setShowTagMenu] = useState(false);
  /* filters */
  const [search, setSearch]           = useState('');
  const [filterType, setFilterType]   = useState('all');
  const [filterTag, setFilterTag]     = useState('all');
  /* sort (list view) */
  const [sortKey, setSortKey]         = useState('name');
  const [sortDir, setSortDir]         = useState('asc');
  const tagMenuRef                    = useRef(null);

  useEffect(() => { fetchClients(); }, []);

  /* Close tag dropdown when clicking outside */
  useEffect(() => {
    const handler = (e) => { if (tagMenuRef.current && !tagMenuRef.current.contains(e.target)) setShowTagMenu(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchClients = async () => {
    try {
      const res = await axios.get(`${API}/clients`, getAuthHeaders());
      setClients(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      toast.error(await toastMsg('ClientsPage.fetchClients', err, 'Failed to load clients'));
    } finally {
      setLoading(false);
    }
  };

  const openAdd = () => { setEditingClient(null); setFormData(EMPTY); setFormErrors({}); setShowModal(true); };
  const openEdit = (c) => {
    setEditingClient(c);
    setFormData({
      type:       c.type       || 'individual',
      name:       c.name       || '',
      company:    c.company    || '',
      email:      c.email      || '',
      phone_code: c.phone_code || '+91',
      phone:      c.phone      || '',
      tags:       c.tags ? c.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      notes:      c.notes      || '',
    });
    setFormErrors({});
    setShowModal(true);
  };

  const set = (key, val) => {
    setFormData(f => ({ ...f, [key]: val }));
    if (formErrors[key]) setFormErrors(e => ({ ...e, [key]: undefined }));
  };

  const toggleTag = (tag) => {
    setFormData(f => ({
      ...f,
      tags: f.tags.includes(tag) ? f.tags.filter(t => t !== tag) : [...f.tags, tag],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate(formData);
    if (Object.keys(errs).length) { setFormErrors(errs); return; }

    const payload = {
      name:       formData.name,
      company:    formData.type === 'business' ? formData.company : '',
      email:      formData.email,
      phone:      formData.phone,
      phone_code: formData.phone_code,
      type:       formData.type,
      tags:       formData.tags.join(', '),
      notes:      formData.notes,
    };

    try {
      if (editingClient) {
        await axios.put(`${API}/clients/${editingClient.id || editingClient.Id}`, payload, getAuthHeaders());
        toast.success('Client updated');
      } else {
        await axios.post(`${API}/clients`, payload, getAuthHeaders());
        toast.success('Client created');
      }
      setShowModal(false);
      fetchClients();
    } catch (err) {
      toast.error(await toastMsg('ClientsPage.save', err,
        err.response?.data?.detail || err.response?.data?.error || 'Failed to save client'));
    }
  };

  const handleDelete = async (c) => {
    if (!window.confirm(`Delete ${c.name}?`)) return;
    try {
      await axios.delete(`${API}/clients/${c.id || c.Id}`, getAuthHeaders());
      toast.success('Client deleted');
      fetchClients();
    } catch (err) {
      toast.error(await toastMsg('ClientsPage.delete', err, 'Failed to delete client'));
    }
  };

  /* ── Filter + sort ──────────────────────────────────────────────── */
  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const displayed = clients
    .filter(c => {
      const q = search.toLowerCase();
      const matchSearch = !q ||
        (c.name    || '').toLowerCase().includes(q) ||
        (c.email   || '').toLowerCase().includes(q) ||
        (c.company || '').toLowerCase().includes(q);
      const matchType = filterType === 'all' || (c.type || 'individual') === filterType;
      const matchTag  = filterTag  === 'all' || (c.tags || '').includes(filterTag);
      return matchSearch && matchType && matchTag;
    })
    .sort((a, b) => {
      const av = (a[sortKey] || '').toString().toLowerCase();
      const bv = (b[sortKey] || '').toString().toLowerCase();
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });

  const SortIcon = ({ col }) => {
    if (sortKey !== col) return <ArrowUpDown size={13} className="text-gray-400 ml-1 inline" />;
    return sortDir === 'asc'
      ? <ChevronUp size={13} className="text-purple-500 ml-1 inline" />
      : <ChevronDown size={13} className="text-purple-500 ml-1 inline" />;
  };

  /* ── Render helpers ─────────────────────────────────────────────── */
  const TagPills = ({ tags, max = 3 }) => {
    if (!tags) return null;
    const list = typeof tags === 'string' ? tags.split(',').map(t => t.trim()).filter(Boolean) : tags;
    return (
      <div className="flex flex-wrap gap-1">
        {list.slice(0, max).map(t => (
          <span key={t} className="text-xs px-2 py-0.5 rounded-full font-medium border"
                style={getTagStyle(t)}>
            {t}
          </span>
        ))}
        {list.length > max && (
          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-500">
            +{list.length - max}
          </span>
        )}
      </div>
    );
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#7C3AED]" />
    </div>
  );

  return (
    <div data-testid="clients-page" className="animate-fade-in">

      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Clients</h1>
          <p className="page-description">{clients.length} client{clients.length !== 1 ? 's' : ''} in your organisation</p>
        </div>
        <button onClick={openAdd} data-testid="add-client-button" className="btn-primary flex items-center gap-2 self-start sm:self-auto">
          <Plus size={18} /> Add Client
        </button>
      </div>

      {/* ── Toolbar ───────────────────────────────────────────────── */}
      <div className="card p-4 mb-6 flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Search by name, email or company…"
                 className="input-field pl-9 text-sm h-10"
                 value={search} onChange={e => setSearch(e.target.value)} />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={13} />
            </button>
          )}
        </div>

        {/* Type filter */}
        <select className="input-field text-sm h-10 sm:w-36" value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="all">All Types</option>
          <option value="individual">Individual</option>
          <option value="business">Business</option>
        </select>

        {/* Tag filter */}
        <select className="input-field text-sm h-10 sm:w-44" value={filterTag} onChange={e => setFilterTag(e.target.value)}>
          <option value="all">All Countries</option>
          {COUNTRY_TAGS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        {/* Sort (always visible) */}
        <select className="input-field text-sm h-10 sm:w-40" value={`${sortKey}-${sortDir}`}
                onChange={e => { const [k, d] = e.target.value.split('-'); setSortKey(k); setSortDir(d); }}>
          <option value="name-asc">Name A→Z</option>
          <option value="name-desc">Name Z→A</option>
          <option value="type-asc">Type A→Z</option>
          <option value="email-asc">Email A→Z</option>
        </select>

        {/* View toggle */}
        <div className="flex rounded-lg border border-[#DDD6FE] overflow-hidden h-10 self-center">
          <button onClick={() => setViewMode('board')}
                  className={`px-3 flex items-center transition-colors ${viewMode === 'board' ? 'bg-[#7C3AED] text-white' : 'bg-white text-[#6B7280] hover:bg-[#EDE9FE]'}`}>
            <LayoutGrid size={16} />
          </button>
          <button onClick={() => setViewMode('list')}
                  className={`px-3 flex items-center transition-colors ${viewMode === 'list' ? 'bg-[#7C3AED] text-white' : 'bg-white text-[#6B7280] hover:bg-[#EDE9FE]'}`}>
            <List size={16} />
          </button>
        </div>
      </div>

      {/* ── Empty state ───────────────────────────────────────────── */}
      {displayed.length === 0 ? (
        <div className="card p-14 text-center">
          <div className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center"
               style={{ background: 'linear-gradient(135deg, #EDE9FE 0%, #DDD6FE 100%)' }}>
            <Building size={36} className="text-[#7C3AED]" />
          </div>
          <h3 className="text-xl font-semibold text-[#374151] mb-2">No clients found</h3>
          <p className="text-[#6B7280] mb-6">{search || filterType !== 'all' || filterTag !== 'all' ? 'Try adjusting your filters' : 'Add your first client to get started'}</p>
          {!search && filterType === 'all' && filterTag === 'all' && (
            <button onClick={openAdd} className="btn-primary">Add First Client</button>
          )}
        </div>
      ) : viewMode === 'board' ? (

        /* ── BOARD VIEW ──────────────────────────────────────────── */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {displayed.map((client, idx) => (
            <div key={client.id || idx} data-testid={`client-card-${client.id}`}
                 className="card p-5 group relative overflow-hidden">
              {/* Subtle gradient background strip */}
              <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl"
                   style={{ background: GRADIENTS[idx % GRADIENTS.length] }} />

              {/* Avatar + type */}
              <div className="flex items-center gap-3 mb-4 mt-1">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-md flex-shrink-0"
                     style={{ background: GRADIENTS[idx % GRADIENTS.length] }}>
                  {getInitials(client)}
                </div>
                <div className="min-w-0">
                  {client.type === 'business' && client.company && (
                    <p className="font-bold text-[#4C1D95] truncate text-sm leading-tight">{client.company}</p>
                  )}
                  <p className={`${client.type === 'business' ? 'text-gray-500 text-xs' : 'font-bold text-[#4C1D95] text-sm'} truncate leading-tight`}>
                    {client.name}
                  </p>
                </div>
              </div>

              {/* Type badge */}
              <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full mb-3 ${
                client.type === 'business'
                  ? 'bg-violet-100 text-violet-700'
                  : 'bg-pink-50 text-pink-700'
              }`}>
                {client.type === 'business' ? <Building size={11} /> : <User size={11} />}
                {client.type === 'business' ? 'Business' : 'Individual'}
              </span>

              {/* Contact info */}
              <div className="space-y-1.5 text-sm text-gray-600 mb-3">
                <div className="flex items-center gap-2 truncate">
                  <Mail size={13} className="text-[#7C3AED] flex-shrink-0" />
                  <span className="truncate">{client.email || '—'}</span>
                </div>
                {client.phone && (
                  <div className="flex items-center gap-2">
                    <Phone size={13} className="text-[#7C3AED] flex-shrink-0" />
                    <span>{client.phone_code || ''} {client.phone}</span>
                  </div>
                )}
              </div>

              {/* Tags */}
              {client.tags && <div className="mb-4"><TagPills tags={client.tags} /></div>}

              {/* Actions */}
              <div className="flex gap-2 pt-3 border-t border-[#EDE9FE] opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => openEdit(client)} data-testid={`edit-client-${client.id}`}
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-[#5B21B6] hover:bg-[#EDE9FE] rounded-lg transition-colors">
                  <Edit2 size={12} /> Edit
                </button>
                <button onClick={() => handleDelete(client)} data-testid={`delete-client-${client.id}`}
                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>

      ) : (

        /* ── LIST VIEW ───────────────────────────────────────────── */
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr style={{ background: 'linear-gradient(135deg, #4C1D95 0%, #6D28D9 100%)' }}>
                  {[['name','Name'],['type','Type'],['company','Company'],['email','Email'],['phone','Phone'],['tags','Tags'],['','']].map(([key, label]) => (
                    <th key={key} onClick={() => key && toggleSort(key)}
                        className={`px-4 py-3.5 text-left text-white font-semibold text-xs tracking-wide uppercase whitespace-nowrap ${key ? 'cursor-pointer select-none hover:bg-white/10 transition-colors' : ''}`}>
                      {label} {key && <SortIcon col={key} />}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayed.map((client, idx) => (
                  <tr key={client.id || idx} className="group border-b border-[#EDE9FE] hover:bg-[#F5F3FF] transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                             style={{ background: GRADIENTS[idx % GRADIENTS.length] }}>
                          {getInitials(client)}
                        </div>
                        <span className="font-semibold text-[#4C1D95]">{client.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                        client.type === 'business' ? 'bg-violet-100 text-violet-700' : 'bg-pink-50 text-pink-700'
                      }`}>
                        {client.type === 'business' ? <Building size={10} /> : <User size={10} />}
                        {client.type === 'business' ? 'Business' : 'Individual'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">{client.company || '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">{client.email}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                      {client.phone ? `${client.phone_code || ''} ${client.phone}` : '—'}
                    </td>
                    <td className="px-4 py-3 max-w-[200px]"><TagPills tags={client.tags} /></td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(client)} className="p-1.5 hover:bg-[#EDE9FE] rounded-lg">
                          <Edit2 size={14} className="text-[#6B7280]" />
                        </button>
                        <button onClick={() => handleDelete(client)} className="p-1.5 hover:bg-red-50 rounded-lg">
                          <Trash2 size={14} className="text-red-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2.5 text-xs text-[#6B7280] border-t border-[#EDE9FE]"
               style={{ backgroundColor: '#F5F3FF' }}>
            {displayed.length} of {clients.length} client{clients.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      {/* ── Add / Edit Modal ──────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl flex flex-col max-h-[94vh] overflow-hidden shadow-2xl">

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 flex-shrink-0"
                 style={{ background: 'linear-gradient(135deg, #4C1D95 0%, #7C3AED 100%)' }}>
              <div>
                <h2 className="text-lg font-bold text-white">{editingClient ? 'Edit Client' : 'Add New Client'}</h2>
                <p className="text-purple-300 text-xs mt-0.5">{editingClient ? 'Update client details' : 'Fill in the details below'}</p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-white/70 hover:text-white hover:bg-white/15 p-1.5 rounded-lg transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

              {/* ── Client Type ─────────────────────────────────── */}
              <div>
                <label className="label">Client Type *</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { val: 'individual', label: 'Individual', icon: User, desc: 'Personal client' },
                    { val: 'business',   label: 'Business',   icon: Building, desc: 'Company / firm' },
                  ].map(({ val, label, icon: Icon, desc }) => (
                    <button
                      key={val} type="button"
                      onClick={() => set('type', val)}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                        formData.type === val
                          ? 'border-[#7C3AED] bg-[#EDE9FE]'
                          : 'border-[#DDD6FE] hover:border-[#A855F7] hover:bg-[#F5F3FF]'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        formData.type === val ? 'bg-[#7C3AED] text-white' : 'bg-[#EDE9FE] text-[#5B21B6]'
                      }`}>
                        <Icon size={18} />
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-gray-800">{label}</p>
                        <p className="text-xs text-gray-500">{desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Company name (business only) ─────────────────── */}
              {formData.type === 'business' && (
                <div>
                  <label className="label">Company Name *</label>
                  <input type="text" className={`input-field ${formErrors.company ? 'error' : ''}`}
                         placeholder="e.g. Acme Corporation"
                         value={formData.company} onChange={e => set('company', e.target.value)} />
                  {formErrors.company && <p className="error-msg">{formErrors.company}</p>}
                </div>
              )}

              {/* ── Name ─────────────────────────────────────────── */}
              <div>
                <label className="label">
                  {formData.type === 'business' ? 'Contact Person Name *' : 'Full Name *'}
                </label>
                <input type="text" className={`input-field ${formErrors.name ? 'error' : ''}`}
                       placeholder={formData.type === 'business' ? 'Contact person at the company' : 'Full legal name'}
                       value={formData.name} onChange={e => set('name', e.target.value)} autoFocus />
                {formErrors.name && <p className="error-msg">{formErrors.name}</p>}
              </div>

              {/* ── Email + Phone ─────────────────────────────────── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Email Address *</label>
                  <input type="email" className={`input-field ${formErrors.email ? 'error' : ''}`}
                         placeholder="email@example.com"
                         value={formData.email} onChange={e => set('email', e.target.value)} />
                  {formErrors.email && <p className="error-msg">{formErrors.email}</p>}
                </div>
                <div>
                  <label className="label">Phone Number *</label>
                  <div className="flex gap-2">
                    <select className="input-field w-28 flex-shrink-0 text-sm px-2"
                            value={formData.phone_code} onChange={e => set('phone_code', e.target.value)}>
                      {PHONE_CODES.map(p => (
                        <option key={p.code + p.country} value={p.code}>{p.label}</option>
                      ))}
                    </select>
                    <div className="flex-1">
                      <input type="tel" className={`input-field ${formErrors.phone ? 'error' : ''}`}
                             placeholder="9876543210"
                             value={formData.phone} onChange={e => set('phone', e.target.value.replace(/[^\d\s-]/g, ''))} />
                    </div>
                  </div>
                  {formErrors.phone && <p className="error-msg">{formErrors.phone}</p>}
                </div>
              </div>

              {/* ── Country Tags ──────────────────────────────────── */}
              <div>
                <label className="label flex items-center gap-2">
                  <Globe size={14} /> Country / Region Tags
                </label>
                <div className="relative" ref={tagMenuRef}>
                  <button type="button"
                          onClick={() => setShowTagMenu(v => !v)}
                          className="input-field flex items-center justify-between text-sm text-left cursor-pointer h-10">
                    <span className="text-gray-500">
                      {formData.tags.length === 0 ? 'Select countries…' : `${formData.tags.length} selected`}
                    </span>
                    <ChevronDown size={15} className="text-gray-400 flex-shrink-0" />
                  </button>

                  {showTagMenu && (
                    <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-[#DDD6FE] rounded-xl shadow-xl z-20 p-2 max-h-48 overflow-y-auto">
                      {COUNTRY_TAGS.map(tag => (
                        <button key={tag} type="button"
                                onClick={() => toggleTag(tag)}
                                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-[#F5F3FF] transition-colors">
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                            formData.tags.includes(tag) ? 'bg-[#7C3AED] border-[#7C3AED]' : 'border-gray-300'
                          }`}>
                            {formData.tags.includes(tag) && <span className="text-white text-xs">✓</span>}
                          </div>
                          <span className="flex-1 text-left text-gray-700">{tag}</span>
                          {formData.tags.includes(tag) && (
                            <span className="text-xs px-2 py-0.5 rounded-full border"
                                  style={getTagStyle(tag)}>{tag}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Selected tag pills */}
                {formData.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {formData.tags.map(t => (
                      <span key={t} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border font-medium"
                            style={getTagStyle(t)}>
                        {t}
                        <button type="button" onClick={() => toggleTag(t)} className="hover:opacity-70">×</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Notes ─────────────────────────────────────────── */}
              <div>
                <label className="label">Notes</label>
                <textarea className="textarea-field text-sm" rows={3} placeholder="Any additional notes…"
                          value={formData.notes} onChange={e => set('notes', e.target.value)} />
              </div>

              {/* ── Submit ────────────────────────────────────────── */}
              <div className="flex gap-3 pt-1">
                <button type="submit" data-testid="save-client-button" className="btn-primary flex-1">
                  {editingClient ? 'Update Client' : 'Create Client'}
                </button>
                <button type="button" onClick={() => setShowModal(false)} className="btn-outline flex-1">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
