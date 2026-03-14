import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2, Mail, Phone, Building, Upload, Download } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const getAuthHeaders = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
});

export default function ClientsPage() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const fileInputRef = useRef(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    notes: ''
  });

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const response = await axios.get(`${API}/clients`, getAuthHeaders());
      setClients(response.data);
    } catch (error) {
      toast.error('Failed to load clients');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingClient) {
        await axios.put(`${API}/clients/${editingClient.id}`, formData, getAuthHeaders());
        toast.success('Client updated successfully');
      } else {
        await axios.post(`${API}/clients`, formData, getAuthHeaders());
        toast.success('Client created successfully');
      }
      setShowModal(false);
      resetForm();
      fetchClients();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save client');
    }
  };

  const handleEdit = (client) => {
    setEditingClient(client);
    setFormData({
      name: client.name,
      email: client.email,
      phone: client.phone || '',
      company: client.company || '',
      notes: client.notes || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this client?')) return;
    try {
      await axios.delete(`${API}/clients/${id}`, getAuthHeaders());
      toast.success('Client deleted successfully');
      fetchClients();
    } catch (error) {
      toast.error('Failed to delete client');
    }
  };

  const resetForm = () => {
    setFormData({ name: '', email: '', phone: '', company: '', notes: '' });
    setEditingClient(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#064E3B]"></div>
      </div>
    );
  }

  return (
    <div data-testid="clients-page">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Clients</h1>
          <p className="page-description">Manage your client information</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          data-testid="add-client-button"
          className="btn-primary flex items-center space-x-2"
        >
          <Plus size={18} />
          <span>Add Client</span>
        </button>
      </div>

      {clients.length === 0 ? (
        <div className="card p-12 text-center">
          <Building size={48} className="mx-auto text-[#9CA3AF] mb-4" />
          <h3 className="text-xl font-semibold text-[#374151] mb-2">No clients yet</h3>
          <p className="text-[#6B7280] mb-6">Get started by adding your first client</p>
          <button onClick={() => setShowModal(true)} className="btn-primary">
            Add Your First Client
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {clients.map((client) => (
            <div key={client.id} data-testid={`client-card-${client.id}`} className="card p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-[#064E3B] mb-2">{client.name}</h3>
                  {client.company && (
                    <p className="text-sm text-[#6B7280] mb-3">{client.company}</p>
                  )}
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleEdit(client)}
                    data-testid={`edit-client-${client.id}`}
                    className="p-2 hover:bg-[#F3F4F6] rounded-lg transition-colors"
                  >
                    <Edit2 size={16} className="text-[#6B7280]" />
                  </button>
                  <button
                    onClick={() => handleDelete(client.id)}
                    data-testid={`delete-client-${client.id}`}
                    className="p-2 hover:bg-[#FEE2E2] rounded-lg transition-colors"
                  >
                    <Trash2 size={16} className="text-[#991B1B]" />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center space-x-2 text-sm text-[#6B7280]">
                  <Mail size={14} />
                  <span>{client.email}</span>
                </div>
                {client.phone && (
                  <div className="flex items-center space-x-2 text-sm text-[#6B7280]">
                    <Phone size={14} />
                    <span>{client.phone}</span>
                  </div>
                )}
              </div>

              {client.notes && (
                <div className="mt-4 pt-4 border-t border-[#E5E7EB]">
                  <p className="text-sm text-[#6B7280]">{client.notes}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6" data-testid="client-modal">
            <h2 className="text-2xl font-bold text-[#064E3B] mb-6">
              {editingClient ? 'Edit Client' : 'Add New Client'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Name *</label>
                <input
                  type="text"
                  data-testid="client-name-input"
                  className="input-field"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label">Email *</label>
                <input
                  type="email"
                  data-testid="client-email-input"
                  className="input-field"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label">Phone</label>
                <input
                  type="tel"
                  data-testid="client-phone-input"
                  className="input-field"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Company</label>
                <input
                  type="text"
                  data-testid="client-company-input"
                  className="input-field"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea
                  data-testid="client-notes-input"
                  className="textarea-field"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>
              <div className="flex space-x-3 pt-4">
                <button type="submit" data-testid="save-client-button" className="btn-primary flex-1">
                  {editingClient ? 'Update' : 'Create'}
                </button>
                <button
                  type="button"
                  data-testid="cancel-client-button"
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
