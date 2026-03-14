import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const getAuthHeaders = () => ({
  headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
});

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [dueDates, setDueDates] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedDueDates, setSelectedDueDates] = useState([]);

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
      toast.error('Failed to load calendar data');
    } finally {
      setLoading(false);
    }
  };

  const getClientName = (clientId) => {
    const client = clients.find(c => c.id === clientId);
    return client?.name || 'Unknown';
  };

  const getDueDatesForDay = (day) => {
    return dueDates.filter(dd => isSameDay(new Date(dd.due_date), day));
  };

  const handlePreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const handleDayClick = (day) => {
    const dayDueDates = getDueDatesForDay(day);
    if (dayDueDates.length > 0) {
      setSelectedDate(day);
      setSelectedDueDates(dayDueDates);
    }
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const startDate = new Date(monthStart);
  startDate.setDate(startDate.getDate() - startDate.getDay());
  const endDate = new Date(monthEnd);
  endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));
  const dateRange = eachDayOfInterval({ start: startDate, end: endDate });

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#064E3B]"></div>
      </div>
    );
  }

  return (
    <div data-testid="calendar-page">
      <div className="page-header">
        <h1 className="page-title">Calendar</h1>
        <p className="page-description">View all tax compliance due dates in calendar format</p>
      </div>

      <div className="card p-6">
        {/* Calendar Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-[#064E3B]" style={{ fontFamily: 'Manrope, sans-serif' }}>
            {format(currentMonth, 'MMMM yyyy')}
          </h2>
          <div className="flex space-x-2">
            <button
              onClick={handlePreviousMonth}
              data-testid="prev-month-button"
              className="p-2 hover:bg-[#F3F4F6] rounded-lg transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={handleNextMonth}
              data-testid="next-month-button"
              className="p-2 hover:bg-[#F3F4F6] rounded-lg transition-colors"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-2">
          {/* Week day headers */}
          {weekDays.map(day => (
            <div key={day} className="text-center font-semibold text-sm text-[#6B7280] py-2">
              {day}
            </div>
          ))}

          {/* Calendar days */}
          {dateRange.map((day, idx) => {
            const dayDueDates = getDueDatesForDay(day);
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isTodayDate = isToday(day);
            const hasDueDates = dayDueDates.length > 0;

            return (
              <div
                key={idx}
                data-testid={`calendar-day-${format(day, 'yyyy-MM-dd')}`}
                onClick={() => handleDayClick(day)}
                className={`
                  min-h-[80px] p-2 border rounded-lg transition-all
                  ${!isCurrentMonth ? 'bg-[#F9FAFB] text-[#9CA3AF]' : 'bg-white'}
                  ${isTodayDate ? 'border-[#064E3B] border-2' : 'border-[#E5E7EB]'}
                  ${hasDueDates ? 'cursor-pointer hover:border-[#064E3B] hover:shadow-md' : ''}
                `}
              >
                <div className={`text-sm font-medium mb-1 ${isTodayDate ? 'text-[#064E3B]' : ''}`}>
                  {format(day, 'd')}
                </div>
                {hasDueDates && (
                  <div className="space-y-1">
                    {dayDueDates.slice(0, 2).map(dd => (
                      <div
                        key={dd.id}
                        className="text-xs px-2 py-1 bg-[#D1FAE5] text-[#064E3B] rounded truncate"
                      >
                        {dd.service_type}
                      </div>
                    ))}
                    {dayDueDates.length > 2 && (
                      <div className="text-xs text-[#6B7280] px-2">
                        +{dayDueDates.length - 2} more
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Date Details Modal */}
      {selectedDate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[80vh] overflow-y-auto" data-testid="date-details-modal">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-[#064E3B]">
                {format(selectedDate, 'MMMM dd, yyyy')}
              </h2>
              <button
                onClick={() => {
                  setSelectedDate(null);
                  setSelectedDueDates([]);
                }}
                data-testid="close-modal-button"
                className="p-2 hover:bg-[#F3F4F6] rounded-lg transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {selectedDueDates.map(dd => (
                <div key={dd.id} className="card p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="badge badge-pending">{dd.service_type}</span>
                        <span className={`badge ${dd.status === 'completed' ? 'badge-completed' : 'badge-pending'}`}>
                          {dd.status}
                        </span>
                      </div>
                      <h3 className="text-lg font-semibold text-[#064E3B] mb-2">
                        {getClientName(dd.client_id)}
                      </h3>
                      <p className="text-sm text-[#6B7280]">{dd.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
