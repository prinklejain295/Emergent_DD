import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Users, Shield, Plus, Edit2, Trash2, X, Eye, EyeOff,
  Key, ChevronDown, CheckCircle, AlertCircle, Crown,
  Briefcase, UserCheck,
} from 'lucide-react';
import { toastMsg } from '../utils/errorLogger';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'https://emergent-dd-2b7s.vercel.app';
const API = `${BACKEND_URL}/api`;
const getAuthHeaders = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

/* ── Role config ─────────────────────────────────────────────────── */
const ROLES = [
  { value: 'admin',     label: 'Admin',      icon: Crown,     color: 'bg-amber-100 text-amber-800 border-amber-200',     desc: 'Full access — manage team, view everything' },
  { value: 'manager',  label: 'Manager',    icon: Briefcase, color: 'bg-gray-100 text-gray-700 border-gray-200',        desc: 'View all data, cannot manage team members' },
  { value: 'consultant',label: 'Consultant', icon: UserCheck, color: 'bg-gray-100 text-gray-600 border-gray-200', desc: 'Restricted to assigned clients only' },
];

const getRoleConfig = (r) => ROLES.find(x => x.value === r) || ROLES[2];

const GRADIENTS = [
  '#7C3AED',
  '#3B82F6',
  '#EC4899',
  '#10B981',
  '#F59E0B',
  '#06B6D4',
];

const initials = (name) => (name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

const EMPTY_FORM = { name: '', email: '', password: '', role: '' };

const emailRx = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

const pwdChecks = (p) => ({
  len:     p.length >= 8,
  upper:   /[A-Z]/.test(p),
  number:  /[0-9]/.test(p),
  special: /[^A-Za-z0-9]/.test(p),
});
const pwdStrength = (p) => Object.values(pwdChecks(p)).filter(Boolean).length;
const PWD_LABELS = { len: 'At least 8 characters', upper: 'One uppercase letter', number: 'One number', special: 'One special character (!@#$…)' };

/* ═══════════════════════════════════════════════════════════════════ */
export default function SettingsPage() {
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin     = currentUser.role === 'admin';

  const [tab, setTab]         = useState('team');
  const [members, setMembers] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  /* Add member modal */
  const [showModal, setShowModal] = useState(false);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [showPwd, setShowPwd]     = useState(false);
  const [saving, setSaving]       = useState(false);

  /* Reset password modal */
  const [resetTarget, setResetTarget] = useState(null);
  const [newPwd, setNewPwd]           = useState('');
  const [showNewPwd, setShowNewPwd]   = useState(false);

  /* Access control state: { memberId: [clientId, ...] } */
  const [accessMap, setAccessMap]     = useState({});
  const [accessSaving, setAccessSaving] = useState({});

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      const [teamRes, clientRes] = await Promise.all([
        axios.get(`${API}/team`, getAuthHeaders()),
        axios.get(`${API}/clients`, getAuthHeaders()),
      ]);
      const teamData = Array.isArray(teamRes.data) ? teamRes.data : [];
      setMembers(teamData);
      setClients(Array.isArray(clientRes.data) ? clientRes.data : []);

      // Build initial access map for consultants
      const map = {};
      teamData.filter(m => m.role === 'consultant').forEach(m => {
        map[m.Id] = (m.assigned_clients || '').split(',').map(s => s.trim()).filter(Boolean);
      });
      setAccessMap(map);
    } catch (err) {
      toast.error(await toastMsg('SettingsPage.fetch', err, 'Failed to load team data'));
    } finally { setLoading(false); }
  };

  /* ── Add member ─────────────────────────────────────────────────── */
  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.password.trim() || !form.role) {
      toast.error('All fields including role are required'); return;
    }
    if (!emailRx.test(form.email.trim())) {
      toast.error('Enter a valid email address'); return;
    }
    if (pwdStrength(form.password) < 3) {
      toast.error('Password is too weak — use 8+ chars, uppercase, number, special character'); return;
    }
    setSaving(true);
    try {
      await axios.post(`${API}/team`, form, getAuthHeaders());
      toast.success(`${form.name} added to your team`);
      setShowModal(false);
      setForm(EMPTY_FORM);
      fetchAll();
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to add member';
      toast.error(msg);
    } finally { setSaving(false); }
  };

  /* ── Change role inline ─────────────────────────────────────────── */
  const handleRoleChange = async (member, newRole) => {
    try {
      await axios.put(`${API}/team/${member.Id}`, { role: newRole }, getAuthHeaders());
      setMembers(prev => prev.map(m => m.Id === member.Id ? { ...m, role: newRole } : m));
      toast.success(`${member.name}'s role updated to ${newRole}`);
    } catch (err) {
      toast.error(await toastMsg('SettingsPage.role', err, 'Failed to update role'));
    }
  };

  /* ── Reset password ─────────────────────────────────────────────── */
  const handleResetPassword = async () => {
    if (pwdStrength(newPwd) < 3) { toast.error('Password is too weak — use 8+ chars, uppercase, number, special character'); return; }
    try {
      await axios.put(`${API}/team/${resetTarget.Id}`, { password: newPwd }, getAuthHeaders());
      toast.success(`Password reset for ${resetTarget.name}`);
      setResetTarget(null);
      setNewPwd('');
    } catch (err) {
      toast.error(await toastMsg('SettingsPage.resetPwd', err, 'Failed to reset password'));
    }
  };

  /* ── Remove member ─────────────────────────────────────────────── */
  const handleRemove = async (member) => {
    if (member.id === currentUser.id) { toast.error("You can't remove yourself"); return; }
    if (!window.confirm(`Remove ${member.name} from your team?`)) return;
    try {
      await axios.delete(`${API}/team/${member.Id}`, getAuthHeaders());
      toast.success(`${member.name} removed`);
      fetchAll();
    } catch (err) {
      toast.error(await toastMsg('SettingsPage.remove', err, 'Failed to remove member'));
    }
  };

  /* ── Access control ─────────────────────────────────────────────── */
  const toggleClientAccess = (memberId, clientId) => {
    setAccessMap(prev => {
      const current = prev[memberId] || [];
      return {
        ...prev,
        [memberId]: current.includes(clientId)
          ? current.filter(id => id !== clientId)
          : [...current, clientId],
      };
    });
  };

  const saveAccess = async (member) => {
    setAccessSaving(prev => ({ ...prev, [member.Id]: true }));
    try {
      const assigned = (accessMap[member.Id] || []).join(',');
      await axios.put(`${API}/team/${member.Id}`, { assigned_clients: assigned }, getAuthHeaders());
      toast.success(`Access updated for ${member.name} — they must log in again for changes to take effect`);
    } catch (err) {
      toast.error(await toastMsg('SettingsPage.access', err, 'Failed to save access'));
    } finally {
      setAccessSaving(prev => ({ ...prev, [member.Id]: false }));
    }
  };

  const consultants = members.filter(m => m.role === 'consultant');

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900" />
    </div>
  );

  /* ═══ RENDER ════════════════════════════════════════════════════════ */
  return (
    <div className="animate-fade-in max-w-4xl">

      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-description">Manage your team, roles and client access</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-50 rounded-xl p-1 w-fit">
        {[
          { key: 'team',   label: 'Team Members', icon: Users  },
          { key: 'access', label: 'Access Control', icon: Shield },
        ].map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    tab === key ? 'bg-gray-900 text-white shadow-sm' : 'text-gray-800 hover:bg-gray-200'
                  }`}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {/* ── TEAM MEMBERS TAB ─────────────────────────────────────── */}
      {tab === 'team' && (
        <div className="space-y-6">
          {/* Role legend */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {ROLES.map(({ value, label, icon: Icon, color, desc }) => (
              <div key={value} className="card p-4 flex items-start gap-3">
                <div className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border flex-shrink-0 ${color}`}>
                  <Icon size={11} /> {label}
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

          {/* Team list header */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">
              Team Members <span className="text-sm font-normal text-gray-400 ml-1">({members.length})</span>
            </h2>
            {isAdmin && (
              <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2 text-sm py-2 px-4">
                <Plus size={15} /> Add Member
              </button>
            )}
          </div>

          {/* Member cards */}
          <div className="space-y-3">
            {members.map((m, i) => {
              const rc = getRoleConfig(m.role);
              const RoleIcon = rc.icon;
              const isSelf = m.id === currentUser.id || m.email === currentUser.email;

              return (
                <div key={m.Id || i} className="card p-5 flex items-center gap-4">
                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
                       style={{ background: GRADIENTS[i % GRADIENTS.length] }}>
                    {initials(m.name)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-gray-900">{m.name}</p>
                      {isSelf && <span className="text-xs bg-gray-50 text-gray-700 px-2 py-0.5 rounded-full font-semibold">You</span>}
                    </div>
                    <p className="text-sm text-gray-500">{m.email}</p>
                  </div>

                  {/* Role selector */}
                  {isAdmin && !isSelf ? (
                    <div className="relative flex-shrink-0">
                      <select value={m.role || 'consultant'}
                              onChange={e => handleRoleChange(m, e.target.value)}
                              className={`text-xs font-semibold pl-6 pr-7 py-1.5 rounded-full border cursor-pointer focus:outline-none focus:ring-2 focus:ring-gray-900 appearance-none ${rc.color}`}>
                        {ROLES.filter(r => r.value !== 'admin').map(r => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                      <RoleIcon size={11} className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  ) : (
                    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border flex-shrink-0 ${rc.color}`}>
                      <RoleIcon size={11} /> {rc.label}
                    </span>
                  )}

                  {/* Actions */}
                  {isAdmin && !isSelf && (
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => { setResetTarget(m); setNewPwd(''); setShowNewPwd(false); }}
                              title="Reset password"
                              className="p-2 hover:bg-gray-50 rounded-lg transition-colors">
                        <Key size={15} className="text-gray-700" />
                      </button>
                      <button onClick={() => handleRemove(m)} title="Remove member"
                              className="p-2 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 size={15} className="text-red-500" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {members.length === 0 && (
              <div className="card p-12 text-center text-gray-400">No team members yet</div>
            )}
          </div>
        </div>
      )}

      {/* ── ACCESS CONTROL TAB ──────────────────────────────────── */}
      {tab === 'access' && (
        <div className="space-y-6">
          {/* Info */}
          <div className="card p-5 flex gap-4 bg-gray-50 border-gray-200">
            <Shield size={20} className="text-gray-700 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-gray-900 mb-1">How access control works</p>
              <p className="text-sm text-gray-800 leading-relaxed">
                Admins and Managers see all data. Consultants only see the clients assigned to them —
                their services, calendar entries and leads are filtered automatically.
                After changing access, the consultant must <strong>log out and log back in</strong> for changes to take effect.
              </p>
            </div>
          </div>

          {!isAdmin && (
            <div className="card p-5 text-center text-gray-500">
              <AlertCircle size={32} className="mx-auto mb-2 text-gray-300" />
              Only admins can manage access control
            </div>
          )}

          {isAdmin && consultants.length === 0 && (
            <div className="card p-10 text-center text-gray-400">
              <UserCheck size={36} className="mx-auto mb-2 text-gray-200" />
              <p>No consultants in your team yet.</p>
              <p className="text-sm mt-1">Add a team member with the Consultant role first.</p>
            </div>
          )}

          {isAdmin && consultants.map((m, i) => {
            const assigned = accessMap[m.Id] || [];
            return (
              <div key={m.Id || i} className="card p-5">
                {/* Consultant header */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold flex-shrink-0"
                       style={{ background: GRADIENTS[i % GRADIENTS.length] }}>
                    {initials(m.name)}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-gray-900">{m.name}</p>
                    <p className="text-xs text-gray-500">{m.email} · Consultant</p>
                  </div>
                  <span className="text-xs text-gray-400 mr-2">
                    {assigned.length}/{clients.length} clients
                  </span>
                  <button onClick={() => saveAccess(m)} disabled={accessSaving[m.Id]}
                          className="btn-primary text-sm py-2 px-4 flex items-center gap-2">
                    {accessSaving[m.Id] ? '...' : <><CheckCircle size={14} /> Save</>}
                  </button>
                </div>

                {/* Client checkboxes */}
                {clients.length === 0 ? (
                  <p className="text-sm text-gray-400">No clients yet — add clients first.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {clients.map(c => {
                      const isOn = assigned.includes(String(c.Id));
                      return (
                        <button key={c.Id} type="button"
                                onClick={() => toggleClientAccess(m.Id, String(c.Id))}
                                className={`flex items-center gap-2.5 p-2.5 rounded-xl border-2 text-left transition-all text-sm ${
                                  isOn ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-500 bg-white'
                                }`}>
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                            isOn ? 'bg-gray-900 border-gray-900' : 'border-gray-300'
                          }`}>
                            {isOn && <span className="text-white text-xs leading-none">✓</span>}
                          </div>
                          <div className="min-w-0">
                            <p className={`font-medium truncate ${isOn ? 'text-gray-900' : 'text-gray-700'}`}>{c.name}</p>
                            {c.company && <p className="text-xs text-gray-400 truncate">{c.company}</p>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Add Member Modal ─────────────────────────────────────── */}
      {showModal && (() => {
        const strength = pwdStrength(form.password);
        const checks   = pwdChecks(form.password);
        const emailOk  = !form.email || emailRx.test(form.email.trim());
        const strengthColor = ['#E5E7EB','#EF4444','#F59E0B','#3B82F6','#10B981'][strength];
        const strengthLabel = ['','Weak','Fair','Good','Strong'][strength];
        return (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 bg-gray-900">
                <h2 className="text-lg font-bold text-white">Add Team Member</h2>
                <button onClick={() => setShowModal(false)} className="text-white/70 hover:text-white hover:bg-white/15 p-1.5 rounded-lg"><X size={20} /></button>
              </div>

              <form onSubmit={handleAddMember} noValidate autoComplete="off" className="p-6 space-y-4">
                <div>
                  <label className="label">Full Name *</label>
                  <input type="text" className="input-field" placeholder="e.g. Rahul Sharma" autoFocus
                         autoComplete="off"
                         value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>

                <div>
                  <label className="label">Email Address *</label>
                  <input type="text" inputMode="email"
                         autoComplete="off"
                         className={`input-field ${form.email && !emailOk ? 'error' : ''}`}
                         placeholder="rahul@yourfirm.com"
                         value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                  {form.email && !emailOk && <p className="error-msg">Enter a valid email (e.g. name@domain.com)</p>}
                </div>

                <div>
                  <label className="label">Initial Password *</label>
                  <div className="relative">
                    <input type={showPwd ? 'text' : 'password'} className="input-field pr-10" placeholder="Min 8 characters"
                           autoComplete="new-password"
                           value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
                    <button type="button" onClick={() => setShowPwd(v => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {form.password && (
                    <div className="mt-2 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1 flex-1">
                          {[1,2,3,4].map(n => (
                            <div key={n} className="h-1.5 flex-1 rounded-full transition-all duration-300"
                                 style={{ background: n <= strength ? strengthColor : '#E5E7EB' }} />
                          ))}
                        </div>
                        <span className="text-xs font-semibold" style={{ color: strengthColor }}>{strengthLabel}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                        {Object.entries(PWD_LABELS).map(([key, label]) => (
                          <div key={key} className={`flex items-center gap-1.5 text-xs ${checks[key] ? 'text-green-600' : 'text-gray-400'}`}>
                            <span>{checks[key] ? '✓' : '○'}</span> {label}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-gray-400 mt-1">Share this with the team member. They can change it later.</p>
                </div>

                <div>
                  <label className="label">Role *</label>
                  <div className="grid grid-cols-2 gap-2">
                    {ROLES.filter(r => r.value !== 'admin').map(({ value, label, icon: Icon, desc }) => (
                      <button key={value} type="button" onClick={() => setForm(f => ({ ...f, role: value }))}
                              className={`flex items-start gap-2 p-3 rounded-xl border-2 text-left transition-all ${
                                form.role === value ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-400'
                              }`}>
                        <Icon size={16} className={form.role === value ? 'text-gray-900 mt-0.5' : 'text-gray-400 mt-0.5'} />
                        <div>
                          <p className={`text-sm font-semibold ${form.role === value ? 'text-gray-900' : 'text-gray-700'}`}>{label}</p>
                          <p className="text-xs text-gray-400 leading-tight">{desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-1">
                  <button type="submit" disabled={saving} className="btn-primary flex-1">
                    {saving ? 'Adding…' : 'Add Member'}
                  </button>
                  <button type="button" onClick={() => setShowModal(false)} className="btn-outline flex-1">Cancel</button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* ── Reset Password Modal ─────────────────────────────────── */}
      {resetTarget && (() => {
        const strength = pwdStrength(newPwd);
        const checks   = pwdChecks(newPwd);
        const strengthColor = ['#E5E7EB','#EF4444','#F59E0B','#3B82F6','#10B981'][strength];
        const strengthLabel = ['','Weak','Fair','Good','Strong'][strength];
        return (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 bg-gray-900">
                <h2 className="text-lg font-bold text-white">Reset Password</h2>
                <button onClick={() => setResetTarget(null)} className="text-white/70 hover:text-white hover:bg-white/15 p-1.5 rounded-lg"><X size={20} /></button>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-sm text-gray-600">Setting new password for <strong>{resetTarget.name}</strong></p>
                <div>
                  <label className="label">New Password</label>
                  <div className="relative">
                    <input type={showNewPwd ? 'text' : 'password'} className="input-field pr-10"
                           placeholder="Min 8 characters" value={newPwd} onChange={e => setNewPwd(e.target.value)} autoFocus />
                    <button type="button" onClick={() => setShowNewPwd(v => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showNewPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {newPwd && (
                    <div className="mt-2 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1 flex-1">
                          {[1,2,3,4].map(n => (
                            <div key={n} className="h-1.5 flex-1 rounded-full transition-all duration-300"
                                 style={{ background: n <= strength ? strengthColor : '#E5E7EB' }} />
                          ))}
                        </div>
                        <span className="text-xs font-semibold" style={{ color: strengthColor }}>{strengthLabel}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                        {Object.entries(PWD_LABELS).map(([key, label]) => (
                          <div key={key} className={`flex items-center gap-1.5 text-xs ${checks[key] ? 'text-green-600' : 'text-gray-400'}`}>
                            <span>{checks[key] ? '✓' : '○'}</span> {label}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex gap-3">
                  <button onClick={handleResetPassword} className="btn-primary flex-1">Reset Password</button>
                  <button onClick={() => setResetTarget(null)} className="btn-outline flex-1">Cancel</button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
