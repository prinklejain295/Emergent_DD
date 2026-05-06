import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameMonth, isSameDay, isToday,
} from 'date-fns';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { toastMsg } from '../utils/errorLogger';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'https://emergent-dd-2b7s.vercel.app';
const API = `${BACKEND_URL}/api`;
const getAuthHeaders = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

const STATUS_STYLE = {
  'Done':         { bg: '#DCFCE7', text: '#166534' },
  'In Progress':  { bg: '#FEF9C3', text: '#854D0E' },
  'Under Review': { bg: '#DBEAFE', text: '#1E40AF' },
  'Pending':      { bg: '#F3F4F6', text: '#374151' },
  'Washington':   { bg: '#FEE2E2', text: '#991B1B' },
  'Urgent':       { bg: '#FEE2E2', text: '#991B1B' },
  'On Hold':      { bg: '#FFEDD5', text: '#9A3412' },
  'Not Started':  { bg: '#F1F5F9', text: '#475569' },
};

const EVENT_STYLE = {
  internal:   { bg: '#FEF9C3', text: '#854D0E', border: '#FEF08A', dot: '#F59E0B', label: 'Internal' },
  regulatory: { bg: '#E0F7F4', text: '#00796B', border: '#B2DFDB', dot: '#00C9A7', label: 'Regulatory' },
};

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [services, setServices]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [selectedDay, setSelectedDay]   = useState(null);
  const [selectedEvents, setSelectedEvents] = useState([]);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const res = await axios.get(`${API}/client-services`, getAuthHeaders());
      setServices(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      toast.error(await toastMsg('CalendarPage.fetch', err, 'Failed to load calendar data'));
    } finally {
      setLoading(false);
    }
  };

  /* Build flat list of {service, eventType} for a given day */
  const getEventsForDay = (day) => {
    const evts = [];
    services.forEach(svc => {
      if (svc.internal_due_date) {
        const d = new Date(svc.internal_due_date);
        if (!isNaN(d) && isSameDay(d, day)) evts.push({ ...svc, eventType: 'internal' });
      }
      if (svc.regulatory_due_date) {
        const d = new Date(svc.regulatory_due_date);
        if (!isNaN(d) && isSameDay(d, day)) evts.push({ ...svc, eventType: 'regulatory' });
      }
    });
    return evts;
  };

  const handleDayClick = (day) => {
    const evts = getEventsForDay(day);
    if (evts.length) { setSelectedDay(day); setSelectedEvents(evts); }
  };

  /* Calendar grid */
  const monthStart = startOfMonth(currentMonth);
  const monthEnd   = endOfMonth(currentMonth);
  const gridStart  = new Date(monthStart);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());
  const gridEnd    = new Date(monthEnd);
  gridEnd.setDate(gridEnd.getDate() + (6 - gridEnd.getDay()));
  const dateRange  = eachDayOfInterval({ start: gridStart, end: gridEnd });

  /* Month-level counts for summary */
  const monthEventCount = services.reduce((n, svc) => {
    if (svc.internal_due_date) {
      const d = new Date(svc.internal_due_date);
      if (!isNaN(d) && isSameMonth(d, currentMonth)) n++;
    }
    if (svc.regulatory_due_date) {
      const d = new Date(svc.regulatory_due_date);
      if (!isNaN(d) && isSameMonth(d, currentMonth)) n++;
    }
    return n;
  }, 0);

  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  const goToday   = () => setCurrentMonth(new Date());

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00C9A7]" />
    </div>
  );

  return (
    <div data-testid="calendar-page" className="animate-fade-in">
      <div className="page-header flex flex-col sm:flex-row sm:items-end justify-between gap-2">
        <div>
          <h1 className="page-title">Calendar</h1>
          <p className="page-description">All service due dates at a glance</p>
        </div>
        {/* Legend */}
        <div className="flex items-center gap-4 text-sm pb-1">
          {Object.entries(EVENT_STYLE).map(([type, s]) => (
            <div key={type} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.dot }} />
              <span className="text-[#6B7280]">{s.label}</span>
            </div>
          ))}
          <span className="text-[#9CA3AF] text-xs ml-2">
            {monthEventCount} event{monthEventCount !== 1 ? 's' : ''} this month
          </span>
        </div>
      </div>

      <div className="card p-4 md:p-6">
        {/* Month navigation */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold text-[#00796B]">{format(currentMonth, 'MMMM yyyy')}</h2>
          <div className="flex items-center gap-1">
            <button onClick={prevMonth} className="p-2 hover:bg-[#E0F7F4] rounded-lg transition-colors">
              <ChevronLeft size={18} className="text-[#6B7280]" />
            </button>
            <button onClick={goToday} className="px-3 py-1.5 text-xs font-semibold text-[#00796B] bg-[#E0F7F4] hover:bg-[#B2DFDB] rounded-lg transition-colors">
              Today
            </button>
            <button onClick={nextMonth} className="p-2 hover:bg-[#E0F7F4] rounded-lg transition-colors">
              <ChevronRight size={18} className="text-[#6B7280]" />
            </button>
          </div>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 mb-1">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="text-center text-xs font-semibold text-[#9CA3AF] py-2 uppercase tracking-wider">{d}</div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-1">
          {dateRange.map((day, idx) => {
            const evts      = getEventsForDay(day);
            const inMonth   = isSameMonth(day, currentMonth);
            const todayFlag = isToday(day);
            const hasEvts   = evts.length > 0;
            const visible   = evts.slice(0, 2);
            const overflow  = evts.length - 2;

            return (
              <div
                key={idx}
                onClick={() => hasEvts && handleDayClick(day)}
                className={[
                  'min-h-[72px] p-1 rounded-lg border transition-all select-none',
                  !inMonth   ? 'bg-gray-50 opacity-35'  : 'bg-white',
                  todayFlag  ? 'border-[#00C9A7] border-2' : 'border-[#E0F7F4]',
                  hasEvts    ? 'cursor-pointer hover:border-[#00796B] hover:shadow-md' : '',
                ].join(' ')}
              >
                {/* Day number */}
                <div className="flex justify-center mb-0.5">
                  <span className={[
                    'text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full',
                    todayFlag ? 'bg-[#00C9A7] text-white' : 'text-gray-600',
                  ].join(' ')}>
                    {format(day, 'd')}
                  </span>
                </div>

                {/* Event chips */}
                <div className="space-y-0.5">
                  {visible.map((ev, j) => {
                    const es = EVENT_STYLE[ev.eventType];
                    return (
                      <div
                        key={j}
                        className="text-xs px-1.5 py-0.5 rounded truncate leading-tight font-medium"
                        style={{ backgroundColor: es.bg, color: es.text }}
                        title={`${ev.client_name} · ${ev.service_category} (${es.label})`}
                      >
                        {ev.client_name}
                      </div>
                    );
                  })}
                  {overflow > 0 && (
                    <div className="text-xs text-[#9CA3AF] px-1.5">+{overflow} more</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Day detail modal ── */}
      {selectedDay && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg flex flex-col max-h-[80vh] shadow-2xl overflow-hidden">

            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 flex-shrink-0" style={{ backgroundColor: '#00695C' }}>
              <div>
                <h2 className="text-lg font-bold text-white">{format(selectedDay, 'MMMM dd, yyyy')}</h2>
                <p className="text-white/70 text-xs mt-0.5">{selectedEvents.length} deadline{selectedEvents.length !== 1 ? 's' : ''}</p>
              </div>
              <button
                onClick={() => { setSelectedDay(null); setSelectedEvents([]); }}
                className="text-white/80 hover:text-white hover:bg-white/20 p-1.5 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Events list */}
            <div className="overflow-y-auto flex-1 p-4 space-y-3">
              {selectedEvents.map((ev, i) => {
                const es = EVENT_STYLE[ev.eventType];
                const st = STATUS_STYLE[ev.status] || { bg: '#F3F4F6', text: '#374151' };
                return (
                  <div key={i} className="border rounded-xl p-4 transition-colors hover:bg-[#F0FDFB]"
                    style={{ borderColor: es.border }}>

                    {/* Top row */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="min-w-0">
                        <p className="font-bold text-[#00796B] text-base truncate">{ev.client_name}</p>
                        <p className="text-sm text-gray-500">{ev.service_category || '—'}</p>
                      </div>
                      <span
                        className="text-xs px-2.5 py-1 rounded-full font-bold whitespace-nowrap flex-shrink-0"
                        style={{ backgroundColor: es.bg, color: es.text, border: `1px solid ${es.border}` }}
                      >
                        {es.label} Deadline
                      </span>
                    </div>

                    {/* Meta row */}
                    <div className="flex flex-wrap gap-2">
                      {ev.spoc && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                          SPOC: <strong>{ev.spoc}</strong>
                        </span>
                      )}
                      {ev.assignee && ev.assignee.split(',').map((a, ai) => (
                        <span key={ai} className="text-xs bg-[#E0F7F4] text-[#00796B] px-2 py-0.5 rounded-full font-medium">
                          {a.trim()}
                        </span>
                      ))}
                      {ev.fees_status && (
                        <span className="text-xs bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full font-medium">
                          {ev.fees_status}
                        </span>
                      )}
                      {ev.status && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                          style={{ backgroundColor: st.bg, color: st.text }}>
                          {ev.status}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
