import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const getAuthHeaders = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
});

const TAX_TYPES = [
  'GST',
  'Income Tax',
  'TDS',
  'Professional Tax',
  'Sales Tax',
  'Service Tax',
  'Corporate Tax',
  'Other'
];

export default function DueDatesPage() {
  const [dueDates, setDueDates] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingDueDate, setEditingDueDate] = useState(null);
  const [formData, setFormData] = useState({
    client_id: '',
    tax_type: 'GST',
    description: '',
    due_date: '',
    is_recurring: false,
    recurrence_frequency: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [dueDatesRes, clientsRes] = await Promise.all([
        axios.get(`${API}/due-dates`, getAuthHeaders()),
        axios.get(`${API}/clients`, getAuthHeaders())
      ]);
      setDueDates(dueDatesRes.data);
      setClients(clientsRes.data);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        due_date: new Date(formData.due_date).toISOString()
      };

      if (editingDueDate) {
        await axios.put(`${API}/due-dates/${editingDueDate.id}`, payload, getAuthHeaders());
        toast.success('Due date updated successfully');
      } else {
        await axios.post(`${API}/due-dates`, payload, getAuthHeaders());
        toast.success('Due date created successfully');
      }
      setShowModal(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save due date');
    }
  };

  const handleEdit = (dueDate) => {
    setEditingDueDate(dueDate);
    setFormData({
      client_id: dueDate.client_id,
      tax_type: dueDate.tax_type,
      description: dueDate.description,
      due_date: format(new Date(dueDate.due_date), 'yyyy-MM-dd'),
      is_recurring: dueDate.is_recurring,
      recurrence_frequency: dueDate.recurrence_frequency || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this due date?')) return;
    try {
      await axios.delete(`${API}/due-dates/${id}`, getAuthHeaders());
      toast.success('Due date deleted successfully');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete due date');
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      await axios.patch(`${API}/due-dates/${id}/status?status=${newStatus}`, {}, getAuthHeaders());
      toast.success('Status updated successfully');
      fetchData();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const resetForm = () => {
    setFormData({
      client_id: '',
      tax_type: 'GST',
      description: '',
      due_date: '',
      is_recurring: false,
      recurrence_frequency: ''
    });
    setEditingDueDate(null);
  };

  const getClientName = (clientId) => {
    const client = clients.find(c => c.id === clientId);
    return client?.name || 'Unknown Client';
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'completed': return 'badge-completed';
      case 'overdue': return 'badge-overdue';
      default: return 'badge-pending';
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
    <div data-testid="due-dates-page">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Due Dates</h1>
          <p className="page-description">Manage tax compliance due dates</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          data-testid="add-due-date-button"
          className="btn-primary flex items-center space-x-2"
        >
          <Plus size={18} />
          <span>Add Due Date</span>
        </button>
      </div>

      {dueDates.length === 0 ? (
        <div className="card p-12 text-center">
          <CheckCircle size={48} className="mx-auto text-[#9CA3AF] mb-4" />
          <h3 className="text-xl font-semibold text-[#374151] mb-2">No due dates yet</h3>
          <p className="text-[#6B7280] mb-6">Start by adding tax compliance due dates for your clients</p>
          <button onClick={() => setShowModal(true)} className="btn-primary">
            Add Your First Due Date
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {dueDates.map((dueDate) => {
            const isPast = new Date(dueDate.due_date) < new Date();
            const status = dueDate.status === 'completed' ? 'completed' : (isPast ? 'overdue' : 'pending');
            
            return (
              <div
                key={dueDate.id}
                data-testid={`due-date-card-${dueDate.id}`}
                className="card p-6"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-3">
                      <span className={`badge ${getStatusBadgeClass(status)}`}>
                        {dueDate.tax_type}
                      </span>
                      <span className={`badge ${getStatusBadgeClass(dueDate.status)}`}>
                        {status}
                      </span>
                      {dueDate.is_recurring && (
                        <span className="badge" style={{ backgroundColor: '#E0E7FF', color: '#3730A3' }}>
                          Recurring ({dueDate.recurrence_frequency})
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-semibold text-[#064E3B] mb-2">
                      {getClientName(dueDate.client_id)}
                    </h3>
                    <p className="text-sm text-[#6B7280] mb-3">{dueDate.description}</p>
                    <p className="text-sm font-medium text-[#064E3B]">
                      Due: {format(new Date(dueDate.due_date), 'MMMM dd, yyyy')}
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    {dueDate.status !== 'completed' && (
                      <button
                        onClick={() => handleStatusChange(dueDate.id, 'completed')}
                        data-testid={`complete-due-date-${dueDate.id}`}
                        className="p-2 hover:bg-[#D1FAE5] rounded-lg transition-colors"
                        title="Mark as completed"
                      >
                        <CheckCircle size={18} className="text-[#059669]" />
                      </button>
                    )}
                    <button
                      onClick={() => handleEdit(dueDate)}
                      data-testid={`edit-due-date-${dueDate.id}`}
                      className="p-2 hover:bg-[#F3F4F6] rounded-lg transition-colors"
                    >
                      <Edit2 size={18} className="text-[#6B7280]" />
                    </button>
                    <button
                      onClick={() => handleDelete(dueDate.id)}
                      data-testid={`delete-due-date-${dueDate.id}`}
                      className="p-2 hover:bg-[#FEE2E2] rounded-lg transition-colors"
                    >
                      <Trash2 size={18} className="text-[#991B1B]" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto" data-testid="due-date-modal">
            <h2 className="text-2xl font-bold text-[#064E3B] mb-6">
              {editingDueDate ? 'Edit Due Date' : 'Add New Due Date'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Client *</label>
                <select
                  data-testid="due-date-client-select"
                  className="input-field"
                  value={formData.client_id}
                  onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                  required
                >
                  <option value="">Select a client</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Tax Type *</label>
                <select
                  data-testid="due-date-tax-type-select"
                  className="input-field"
                  value={formData.tax_type}
                  onChange={(e) => setFormData({ ...formData, tax_type: e.target.value })}
                  required
                >
                  {TAX_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Description *</label>
                <textarea
                  data-testid="due-date-description-input"
                  className="textarea-field"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label">Due Date *</label>
                <input
                  type="date"
                  data-testid="due-date-input"
                  className="input-field"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  required
                />
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  data-testid="due-date-recurring-checkbox"
                  id="is_recurring"
                  checked={formData.is_recurring}
                  onChange={(e) => setFormData({ ...formData, is_recurring: e.target.checked })}
                  className="w-4 h-4 text-[#064E3B] rounded"
                />
                <label htmlFor="is_recurring" className="text-sm font-medium text-[#374151]">
                  Recurring
                </label>
              </div>
              {formData.is_recurring && (
                <div>
                  <label className="label">Recurrence Frequency *</label>
                  <select
                    data-testid="due-date-frequency-select"
                    className="input-field"
                    value={formData.recurrence_frequency}
                    onChange={(e) => setFormData({ ...formData, recurrence_frequency: e.target.value })}
                    required={formData.is_recurring}
                  >
                    <option value="">Select frequency</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              )}
              <div className="flex space-x-3 pt-4">
                <button type="submit" data-testid="save-due-date-button" className="btn-primary flex-1">
                  {editingDueDate ? 'Update' : 'Create'}
                </button>
                <button
                  type="button"
                  data-testid="cancel-due-date-button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="btn-outline flex-1"
                >
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
