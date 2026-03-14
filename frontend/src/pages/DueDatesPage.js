import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2, CheckCircle, Search, PlusCircle } from 'lucide-react';
import { format } from 'date-fns';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const getAuthHeaders = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
});

export default function DueDatesPage() {
  const [dueDates, setDueDates] = useState([]);
  const [clients, setClients] = useState([]);
  const [serviceTypes, setServiceTypes] = useState({});
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showAddServiceModal, setShowAddServiceModal] = useState(false);
  const [editingDueDate, setEditingDueDate] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [newServiceName, setNewServiceName] = useState('');
  const [newServiceCategory, setNewServiceCategory] = useState('custom');
  const [formData, setFormData] = useState({
    client_id: '',
    service_type: '',
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
      const [dueDatesRes, clientsRes, serviceTypesRes] = await Promise.all([
        axios.get(`${API}/due-dates`, getAuthHeaders()),
        axios.get(`${API}/clients`, getAuthHeaders()),
        axios.get(`${API}/service-types`, getAuthHeaders())
      ]);
      setDueDates(dueDatesRes.data);
      setClients(clientsRes.data);
      setServiceTypes(serviceTypesRes.data);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCustomService = async () => {
    if (!newServiceName.trim()) {
      toast.error('Please enter a service name');
      return;
    }

    try {
      await axios.post(
        `${API}/service-types`,
        { name: newServiceName, category: newServiceCategory },
        getAuthHeaders()
      );
      toast.success('Custom service added successfully');
      setShowAddServiceModal(false);
      setNewServiceName('');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add custom service');
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
      service_type: dueDate.service_type,
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
      service_type: '',
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

  const getAllServiceTypes = () => {
    const all = [];
    Object.keys(serviceTypes).forEach(category => {
      if (serviceTypes[category]) {
        all.push(...serviceTypes[category]);
      }
    });
    return all;
  };

  const filteredDueDates = dueDates.filter(dd => {
    const matchesSearch = dd.service_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         dd.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         getClientName(dd.client_id).toLowerCase().includes(searchTerm.toLowerCase());
    
    if (selectedCategory === 'all') return matchesSearch;
    
    // Check which category this service type belongs to
    for (const [category, types] of Object.entries(serviceTypes)) {
      if (types && types.includes(dd.service_type)) {
        return category === selectedCategory && matchesSearch;
      }
    }
    return matchesSearch;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
      </div>
    );
  }

  return (
    <div data-testid="due-dates-page" className="animate-fade-in">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Due Dates</h1>
          <p className="page-description">Manage compliance due dates and deadlines</p>
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

      {/* Filters */}
      <div className="card p-6 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by service type, description, or client..."
              className="input-field pl-11"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            className="input-field md:w-64"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="all">All Categories</option>
            <option value="federal">Federal</option>
            <option value="state">State</option>
            <option value="payroll">Payroll</option>
            <option value="custom">Custom</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>

      {filteredDueDates.length === 0 ? (
        <div className="card p-12 text-center">
          <CheckCircle size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">No due dates found</h3>
          <p className="text-gray-600 mb-6">
            {searchTerm || selectedCategory !== 'all' 
              ? 'Try adjusting your filters'
              : 'Start by adding compliance due dates for your clients'}
          </p>
          {!searchTerm && selectedCategory === 'all' && (
            <button onClick={() => setShowModal(true)} className="btn-primary">
              Add Your First Due Date
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredDueDates.map((dueDate) => {
            const isPast = new Date(dueDate.due_date) < new Date();
            const status = dueDate.status === 'completed' ? 'completed' : (isPast ? 'overdue' : 'pending');
            
            return (
              <div
                key={dueDate.id}
                data-testid={`due-date-card-${dueDate.id}`}
                className="card p-6 animate-scale-in"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-3 flex-wrap gap-2">
                      <span className="badge" style={{ backgroundColor: '#f5f5f5', color: '#000' }}>
                        {dueDate.service_type}
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
                    <h3 className="text-lg font-semibold text-black mb-2">
                      {getClientName(dueDate.client_id)}
                    </h3>
                    <p className="text-sm text-gray-600 mb-3">{dueDate.description}</p>
                    <p className="text-sm font-medium text-black">
                      Due: {format(new Date(dueDate.due_date), 'MMMM dd, yyyy')}
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    {dueDate.status !== 'completed' && (
                      <button
                        onClick={() => handleStatusChange(dueDate.id, 'completed')}
                        data-testid={`complete-due-date-${dueDate.id}`}
                        className="p-2 hover:bg-green-50 rounded-lg transition-colors"
                        title="Mark as completed"
                      >
                        <CheckCircle size={18} className="text-green-600" />
                      </button>
                    )}
                    <button
                      onClick={() => handleEdit(dueDate)}
                      data-testid={`edit-due-date-${dueDate.id}`}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <Edit2 size={18} className="text-gray-600" />
                    </button>
                    <button
                      onClick={() => handleDelete(dueDate.id)}
                      data-testid={`delete-due-date-${dueDate.id}`}
                      className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={18} className="text-red-600" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Due Date Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 modal-overlay flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto animate-scale-in" data-testid="due-date-modal">
            <h2 className="text-2xl font-bold text-black mb-6">
              {editingDueDate ? 'Edit Due Date' : 'Add New Due Date'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-5">
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
                <div className="flex items-center justify-between mb-2">
                  <label className="label mb-0">Service Type *</label>
                  <button
                    type="button"
                    onClick={() => setShowAddServiceModal(true)}
                    className="text-sm text-black hover:underline flex items-center space-x-1"
                  >
                    <PlusCircle size={16} />
                    <span>Add Custom</span>
                  </button>
                </div>
                <select
                  data-testid="due-date-service-type-select"
                  className="input-field"
                  value={formData.service_type}
                  onChange={(e) => setFormData({ ...formData, service_type: e.target.value })}
                  required
                >
                  <option value="">Select a service type</option>
                  {Object.entries(serviceTypes).map(([category, types]) => (
                    <optgroup key={category} label={category.charAt(0).toUpperCase() + category.slice(1)}>
                      {types && types.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </optgroup>
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
                  placeholder="Provide details about this compliance requirement..."
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
              
              <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg">
                <input
                  type="checkbox"
                  data-testid="due-date-recurring-checkbox"
                  id="is_recurring"
                  checked={formData.is_recurring}
                  onChange={(e) => setFormData({ ...formData, is_recurring: e.target.checked })}
                  className="w-5 h-5 text-black rounded"
                />
                <label htmlFor="is_recurring" className="text-sm font-semibold text-gray-700 cursor-pointer">
                  This is a recurring compliance requirement
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
                    <option value="annually">Annually</option>
                  </select>
                </div>
              )}
              
              <div className="flex space-x-3 pt-4">
                <button type="submit" data-testid="save-due-date-button" className="btn-primary flex-1">
                  {editingDueDate ? 'Update Due Date' : 'Create Due Date'}
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

      {/* Add Custom Service Modal */}
      {showAddServiceModal && (
        <div className="fixed inset-0 bg-black/50 modal-overlay flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 animate-scale-in">
            <h2 className="text-2xl font-bold text-black mb-6">Add Custom Service</h2>
            <div className="space-y-4">
              <div>
                <label className="label">Service Name *</label>
                <input
                  type="text"
                  className="input-field"
                  value={newServiceName}
                  onChange={(e) => setNewServiceName(e.target.value)}
                  placeholder="e.g., Business License Renewal"
                  autoFocus
                />
              </div>
              <div>
                <label className="label">Category</label>
                <select
                  className="input-field"
                  value={newServiceCategory}
                  onChange={(e) => setNewServiceCategory(e.target.value)}
                >
                  <option value="custom">Custom</option>
                  <option value="federal">Federal</option>
                  <option value="state">State</option>
                  <option value="payroll">Payroll</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="flex space-x-3 pt-4">
                <button
                  onClick={handleAddCustomService}
                  className="btn-primary flex-1"
                >
                  Add Service
                </button>
                <button
                  onClick={() => {
                    setShowAddServiceModal(false);
                    setNewServiceName('');
                  }}
                  className="btn-outline flex-1"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
