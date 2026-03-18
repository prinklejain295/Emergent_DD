import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Plus, Trash2, Clock, ToggleLeft, ToggleRight } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'https://emergent-dd-2b7s.vercel.app';
const API = `${BACKEND_URL}/api`;

const getAuthHeaders = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
});

export default function RemindersPage() {
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    days_before: 7,
    notification_time: '09:00'
  });

  useEffect(() => {
    fetchReminders();
  }, []);

  const fetchReminders = async () => {
    try {
      const response = await axios.get(`${API}/reminders`, getAuthHeaders());
      setReminders(response.data.sort((a, b) => a.days_before - b.days_before));
    } catch (error) {
      toast.error('Failed to load reminders');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/reminders`, formData, getAuthHeaders());
      toast.success('Reminder schedule created successfully');
      setShowModal(false);
      setFormData({ days_before: 7, notification_time: '09:00' });
      fetchReminders();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create reminder');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this reminder schedule?')) return;
    try {
      await axios.delete(`${API}/reminders/${id}`, getAuthHeaders());
      toast.success('Reminder deleted successfully');
      fetchReminders();
    } catch (error) {
      toast.error('Failed to delete reminder');
    }
  };

  const handleToggle = async (id) => {
    try {
      const response = await axios.patch(`${API}/reminders/${id}/toggle`, {}, getAuthHeaders());
      toast.success(`Reminder ${response.data.is_active ? 'enabled' : 'disabled'}`);
      fetchReminders();
    } catch (error) {
      toast.error('Failed to toggle reminder');
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
    <div data-testid="reminders-page">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Reminder Settings</h1>
          <p className="page-description">Configure automated reminder schedules</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          data-testid="add-reminder-button"
          className="btn-primary flex items-center space-x-2"
        >
          <Plus size={18} />
          <span>Add Reminder</span>
        </button>
      </div>

      {/* Info Card */}
      <div className="card p-6 mb-6 bg-[#DBEAFE] border-[#93C5FD]">
        <h3 className="font-semibold text-[#1E40AF] mb-2 flex items-center space-x-2">
          <Clock size={20} />
          <span>How Reminders Work</span>
        </h3>
        <p className="text-sm text-[#1E40AF]">
          Reminders are automatically sent to both you and your clients based on the schedule you set. 
          For example, a "7 days before" reminder will send emails 7 days prior to each due date.
        </p>
      </div>

      {reminders.length === 0 ? (
        <div className="card p-12 text-center">
          <Clock size={48} className="mx-auto text-[#9CA3AF] mb-4" />
          <h3 className="text-xl font-semibold text-[#374151] mb-2">No reminder schedules yet</h3>
          <p className="text-[#6B7280] mb-6">Set up automated reminders to never miss a deadline</p>
          <button onClick={() => setShowModal(true)} className="btn-primary">
            Create Your First Reminder
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reminders.map((reminder) => (
            <div
              key={reminder.id}
              data-testid={`reminder-card-${reminder.id}`}
              className={`card p-6 ${!reminder.is_active ? 'opacity-60' : ''}`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-[#064E3B] mb-2">
                    {reminder.days_before} {reminder.days_before === 1 ? 'day' : 'days'}
                  </h3>
                  <p className="text-sm text-[#6B7280]">before due date</p>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleToggle(reminder.id)}
                    data-testid={`toggle-reminder-${reminder.id}`}
                    className="p-2 hover:bg-[#F3F4F6] rounded-lg transition-colors"
                    title={reminder.is_active ? 'Disable' : 'Enable'}
                  >
                    {reminder.is_active ? (
                      <ToggleRight size={24} className="text-[#059669]" />
                    ) : (
                      <ToggleLeft size={24} className="text-[#9CA3AF]" />
                    )}
                  </button>
                  <button
                    onClick={() => handleDelete(reminder.id)}
                    data-testid={`delete-reminder-${reminder.id}`}
                    className="p-2 hover:bg-[#FEE2E2] rounded-lg transition-colors"
                  >
                    <Trash2 size={18} className="text-[#991B1B]" />
                  </button>
                </div>
              </div>

              <div className="pt-4 border-t border-[#E5E7EB]">
                <div className="flex items-center space-x-2 text-sm text-[#6B7280]">
                  <Clock size={14} />
                  <span>Notification time: {reminder.notification_time}</span>
                </div>
                <div className="mt-2">
                  <span className={`badge ${reminder.is_active ? 'badge-completed' : 'badge-pending'}`}>
                    {reminder.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6" data-testid="reminder-modal">
            <h2 className="text-2xl font-bold text-[#064E3B] mb-6">Add Reminder Schedule</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Days Before Due Date *</label>
                <input
                  type="number"
                  data-testid="reminder-days-input"
                  className="input-field"
                  value={formData.days_before}
                  onChange={(e) => setFormData({ ...formData, days_before: parseInt(e.target.value) })}
                  min="1"
                  max="90"
                  required
                />
                <p className="text-xs text-[#6B7280] mt-1">
                  Enter the number of days before the due date to send the reminder (1-90 days)
                </p>
              </div>
              <div>
                <label className="label">Notification Time *</label>
                <input
                  type="time"
                  data-testid="reminder-time-input"
                  className="input-field"
                  value={formData.notification_time}
                  onChange={(e) => setFormData({ ...formData, notification_time: e.target.value })}
                  required
                />
                <p className="text-xs text-[#6B7280] mt-1">
                  Time when the reminder should be sent (24-hour format)
                </p>
              </div>
              <div className="flex space-x-3 pt-4">
                <button type="submit" data-testid="save-reminder-button" className="btn-primary flex-1">
                  Create Reminder
                </button>
                <button
                  type="button"
                  data-testid="cancel-reminder-button"
                  onClick={() => {
                    setShowModal(false);
                    setFormData({ days_before: 7, notification_time: '09:00' });
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
