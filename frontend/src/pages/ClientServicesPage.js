import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2, Search, X } from 'lucide-react';
import { toastMsg } from '../utils/errorLogger';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'https://emergent-dd-2b7s.vercel.app';
const API = `${BACKEND_URL}/api`;

const getAuthHeaders = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
});

const SERVICE_CATEGORIES = [
  'Tax Filing', 'Payroll', 'Audit', 'GST / VAT', 'Compliance',
  'Advisory', 'Bookkeeping', 'Company Registration', 'Annual Filing',
  'TDS Filing', 'ROC Filing', 'Other',
];

const FEES_STATUS_OPTIONS = [
  'Pre Payment', 'Post Payment', 'Pending Payment',
  'Invoiced', 'Waived', 'On Hold',
];

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

const getStatusStyle = (status) => {
  const found = STATUS_OPTIONS.find(s => s.label === status);
  return found
    ? { backgroundColor: found.bg, color: found.text, border: `1px solid ${found.border}` }
    : { backgroundColor: '#F3F4F6', color: '#374151', border: '1px solid #E5E7EB' };
};

const fmtDate = (val) => {
  if (!val) return '—';
  const d = new Date(val);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const EMPTY_FORM = {
  client_name: '', service_category: '', assignee: '',
  spoc: '', internal_due_date: '', regulatory_due_date: '',
  fees_status: '', status: 'Pending',
};

export default function ClientServicesPage() {
  const [records, setRecords]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [showModal, setShowModal]       = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [searchTerm, setSearchTerm]     = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [formData, setFormData]         = useState(EMPTY_FORM);

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

  const openAdd = (prefill = '') => {
    setEditingRecord(null);
    setFormData({ ...EMPTY_FORM, client_name: prefill });
    setShowModal(true);
  };

  const openEdit = (rec) => {
    setEditingRecord(rec);
    setFormData({
      client_name:         rec.client_name || '',
      service_category:    rec.service_category || '',
      assignee:            rec.assignee || '',
      spoc:                rec.spoc || '',
      internal_due_date:   rec.internal_due_date ? rec.internal_due_date.split('T')[0] : '',
      regulatory_due_date: rec.regulatory_due_date ? rec.regulatory_due_date.split('T')[0] : '',
      fees_status:         rec.fees_status || '',
      status:              rec.status || 'Pending',
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
      toast.success('Service deleted');
      fetchRecords();
    } catch (err) {
      toast.error(await toastMsg('ClientServicesPage.delete', err, 'Failed to delete'));
    }
  };

  const existingClients = [...new Set(records.map(r => r.client_name).filter(Boolean))];

  const filtered = records.filter(r => {
    const matchSearch = (r.client_name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = filterStatus === 'all' || r.status === filterStatus;
    return matchSearch && matchStatus;
  });

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00C9A7]" />
    </div>
  );

  return (
    <div className="animate-fade-in">

      {/* Page header */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Client Services</h1>
          <p className="page-description">Track services, deadlines, fees and status for every client</p>
        </div>
        <button onClick={() => openAdd()} className="btn-primary flex items-center space-x-2 self-start sm:self-auto">
          <Plus size={18} />
          <span>Add Service</span>
        </button>
      </div>

      {/* Filters bar */}
      <div className="card p-4 mb-6 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by client name…"
            className="input-field pl-9"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          )}
        </div>
        <select
          className="input-field sm:w-48"
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
        >
          <option value="all">All Statuses</option>
          {STATUS_OPTIONS.map(s => <option key={s.label} value={s.label}>{s.label}</option>)}
        </select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="card p-14 text-center">
          <p className="text-[#6B7280] mb-4 text-lg">
            {searchTerm || filterStatus !== 'all' ? 'No matching services found' : 'No services yet — add your first one'}
          </p>
          {!searchTerm && filterStatus === 'all' && (
            <button onClick={() => openAdd()} className="btn-primary">Add First Service</button>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              {/* Dark green header */}
              <thead>
                <tr style={{ backgroundColor: '#00695C' }}>
                  {['Client Name','Service Category','Assignee','SPOC','Internal Due Date','Due Date (Regulatory)','Fees Status','Status',''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-white font-semibold whitespace-nowrap text-xs tracking-wide uppercase">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((rec, i) => (
                  <tr
                    key={rec.Id || i}
                    className="group border-b border-[#E0F7F4] hover:bg-[#F0FDFB] transition-colors"
                  >
                    {/* Client name + quick-add */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-[#00796B]">{rec.client_name || '—'}</span>
                        <button
                          onClick={() => openAdd(rec.client_name)}
                          title="Add another service for this client"
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-[#E0F7F4] rounded"
                        >
                          <Plus size={11} className="text-[#00C9A7]" />
                        </button>
                      </div>
                    </td>

                    {/* Service category */}
                    <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                      {rec.service_category || '—'}
                    </td>

                    {/* Assignee — pill tags */}
                    <td className="px-4 py-3 max-w-[180px]">
                      {rec.assignee
                        ? <div className="flex flex-wrap gap-1">
                            {rec.assignee.split(',').map((a, j) => (
                              <span key={j} className="bg-[#E0F7F4] text-[#00796B] text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
                                {a.trim()}
                              </span>
                            ))}
                          </div>
                        : <span className="text-gray-400">—</span>
                      }
                    </td>

                    {/* SPOC */}
                    <td className="px-4 py-3 whitespace-nowrap text-gray-700">{rec.spoc || '—'}</td>

                    {/* Internal due date */}
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600 tabular-nums">
                      {fmtDate(rec.internal_due_date)}
                    </td>

                    {/* Regulatory due date */}
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600 tabular-nums">
                      {fmtDate(rec.regulatory_due_date)}
                    </td>

                    {/* Fees status */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {rec.fees_status
                        ? <span className="bg-purple-50 text-purple-700 border border-purple-200 text-xs px-2.5 py-1 rounded-full font-medium">
                            {rec.fees_status}
                          </span>
                        : <span className="text-gray-400">—</span>
                      }
                    </td>

                    {/* Status — color coded */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {rec.status
                        ? <span
                            className="text-xs px-2.5 py-1 rounded-full font-semibold"
                            style={getStatusStyle(rec.status)}
                          >
                            {rec.status}
                          </span>
                        : <span className="text-gray-400">—</span>
                      }
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(rec)} className="p-1.5 hover:bg-[#E0F7F4] rounded-lg" title="Edit">
                          <Edit2 size={14} className="text-[#6B7280]" />
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

          {/* Footer count */}
          <div className="px-4 py-2.5 bg-[#F0FDFB] border-t border-[#E0F7F4] text-xs text-[#6B7280]">
            Showing {filtered.length} of {records.length} service{records.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      {/* ── Add / Edit Modal ─────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl flex flex-col max-h-[92vh] overflow-hidden shadow-2xl">

            {/* Modal header — dark green */}
            <div className="flex items-center justify-between px-6 py-4" style={{ backgroundColor: '#00695C' }}>
              <h2 className="text-lg font-bold text-white">
                {editingRecord ? 'Edit Service' : 'Add New Service'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-white/80 hover:text-white hover:bg-white/20 p-1 rounded transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Modal body */}
            <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-6 py-5 space-y-4">

              {/* Row 1 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Client Name *</label>
                  <input
                    type="text"
                    list="cs-clients"
                    className="input-field"
                    placeholder="Type or pick existing client"
                    value={formData.client_name}
                    onChange={e => setFormData({ ...formData, client_name: e.target.value })}
                    required
                    autoFocus
                  />
                  <datalist id="cs-clients">
                    {existingClients.map(n => <option key={n} value={n} />)}
                  </datalist>
                </div>
                <div>
                  <label className="label">Service Category *</label>
                  <select
                    className="input-field"
                    value={formData.service_category}
                    onChange={e => setFormData({ ...formData, service_category: e.target.value })}
                    required
                  >
                    <option value="">Select category</option>
                    {SERVICE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              {/* Row 2 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Assignee(s)</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g. Priya, Rohit, Sneha"
                    value={formData.assignee}
                    onChange={e => setFormData({ ...formData, assignee: e.target.value })}
                  />
                  <p className="text-xs text-gray-400 mt-1">Separate multiple names with commas</p>
                </div>
                <div>
                  <label className="label">SPOC</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Single point of contact"
                    value={formData.spoc}
                    onChange={e => setFormData({ ...formData, spoc: e.target.value })}
                  />
                </div>
              </div>

              {/* Row 3 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Internal Due Date</label>
                  <input
                    type="date"
                    className="input-field"
                    value={formData.internal_due_date}
                    onChange={e => setFormData({ ...formData, internal_due_date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Due Date (Regulatory)</label>
                  <input
                    type="date"
                    className="input-field"
                    value={formData.regulatory_due_date}
                    onChange={e => setFormData({ ...formData, regulatory_due_date: e.target.value })}
                  />
                </div>
              </div>

              {/* Row 4 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Fees Status</label>
                  <select
                    className="input-field"
                    value={formData.fees_status}
                    onChange={e => setFormData({ ...formData, fees_status: e.target.value })}
                  >
                    <option value="">Select fees status</option>
                    {FEES_STATUS_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Status</label>
                  <select
                    className="input-field"
                    value={formData.status}
                    onChange={e => setFormData({ ...formData, status: e.target.value })}
                  >
                    {STATUS_OPTIONS.map(s => <option key={s.label} value={s.label}>{s.label}</option>)}
                  </select>
                  {/* Status preview */}
                  {formData.status && (
                    <div className="mt-2">
                      <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={getStatusStyle(formData.status)}>
                        {formData.status}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button type="submit" className="btn-primary flex-1">
                  {editingRecord ? 'Update Service' : 'Add Service'}
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
