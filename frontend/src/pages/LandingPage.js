import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle, Calendar, Users, Shield, ArrowRight,
  Clock, FileText, BarChart2, ChevronDown, Check,
} from 'lucide-react';

const FEATURES = [
  {
    icon: FileText,
    title: 'Full Compliance Tracking',
    desc: 'Track every service — GST, ITR, TDS, ROC, Payroll — for every client in one place. Never lose sight of what's due.',
  },
  {
    icon: Clock,
    title: 'Deadline Management',
    desc: 'Internal and regulatory due dates on a single calendar. Overdue services highlighted automatically.',
  },
  {
    icon: Users,
    title: 'Team & Role Management',
    desc: 'Admin, Manager, Consultant roles with configurable permissions. Assign clients to consultants with one click.',
  },
  {
    icon: Shield,
    title: 'Access Control',
    desc: 'Consultants only see their assigned clients. Sensitive data stays within the right hands.',
  },
  {
    icon: BarChart2,
    title: 'Leads Pipeline',
    desc: 'Track prospects from first contact to converted client. Never let a follow-up slip through.',
  },
  {
    icon: Calendar,
    title: 'Recurring Services',
    desc: 'Monthly, quarterly, annual services auto-advance when marked done. Billing status tracked separately.',
  },
];

const PLANS = [
  {
    name: 'Starter',
    price: '₹999',
    period: '/month',
    tagline: 'Perfect for solo practitioners',
    highlight: false,
    features: [
      'Up to 3 team members',
      'Up to 50 clients',
      'Compliance service tracking',
      'Deadline calendar',
      'Leads pipeline',
      'Email support',
    ],
  },
  {
    name: 'Growth',
    price: '₹2,499',
    period: '/month',
    tagline: 'For growing CA firms',
    highlight: true,
    badge: 'Most Popular',
    features: [
      'Up to 15 team members',
      'Up to 500 clients',
      'Everything in Starter',
      'Role-based access control',
      'Consultant client assignment',
      'Excel import & export',
      'Priority support',
    ],
  },
  {
    name: 'Scale',
    price: '₹4,999',
    period: '/month',
    tagline: 'For large multi-partner firms',
    highlight: false,
    features: [
      'Unlimited team members',
      'Unlimited clients',
      'Everything in Growth',
      'Custom service categories',
      'Timesheet tracking',
      'Advanced reporting',
      'Dedicated account manager',
    ],
  },
];

const COMPLIANCE_TAGS = ['GST Filing', 'ITR', 'TDS / TCS', 'ROC Filing', 'Payroll', 'Audit', 'Annual Filing', 'Advisory'];

export default function LandingPage() {
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState(null);

  const FAQS = [
    { q: 'Can multiple team members use the same account?', a: 'Yes. Each plan supports a set number of team members, each with their own login and role-based access.' },
    { q: 'Can a consultant see all clients?', a: 'No. Consultants only see clients explicitly assigned to them by the admin. Admins and Managers have full visibility.' },
    { q: 'What happens when a recurring service is marked done?', a: 'The next period is automatically created with the due date advanced. The completed service moves to your archive once marked Post Payment.' },
    { q: 'Is there a free trial?', a: 'Yes — contact us to request a 14-day free trial on any plan. No credit card required.' },
  ];

  return (
    <div className="min-h-screen bg-white text-gray-900" style={{ fontFamily: 'Inter, sans-serif' }}>

      {/* ── Navbar ─────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">D</span>
            </div>
            <span className="font-bold text-xl tracking-tight">DueDate</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="#pricing" className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors hidden sm:block">
              Pricing
            </a>
            <button
              onClick={() => navigate('/login')}
              className="flex items-center gap-2 bg-gray-900 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
            >
              Login <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-24 text-center">
        <div className="inline-flex items-center gap-2 bg-gray-100 text-gray-600 text-xs font-semibold px-3 py-1.5 rounded-full mb-8">
          <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
          Built for CA & Tax Professionals in India
        </div>

        <h1 className="text-5xl sm:text-6xl font-bold text-gray-900 leading-tight tracking-tight mb-6">
          Never miss a<br />
          <span className="relative">
            compliance deadline
            <span className="absolute -bottom-1 left-0 right-0 h-1 bg-gray-900 rounded-full" />
          </span>
          <span className="block mt-2">again.</span>
        </h1>

        <p className="text-lg text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed">
          DueDate is the all-in-one compliance management portal for CA firms.
          Track every service, deadline, client and team member — in one clean workspace.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => navigate('/login')}
            className="flex items-center justify-center gap-2 bg-gray-900 text-white font-semibold px-7 py-3.5 rounded-xl hover:bg-gray-700 transition-all hover:-translate-y-0.5 shadow-lg shadow-gray-200"
          >
            Get Started Free <ArrowRight size={16} />
          </button>
          <a href="#pricing"
             className="flex items-center justify-center gap-2 bg-white text-gray-700 font-semibold px-7 py-3.5 rounded-xl border border-gray-200 hover:border-gray-400 transition-all hover:-translate-y-0.5">
            View Pricing
          </a>
        </div>

        {/* Compliance tags */}
        <div className="mt-14">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-widest mb-4">Covers all major compliance areas</p>
          <div className="flex flex-wrap justify-center gap-2">
            {COMPLIANCE_TAGS.map(tag => (
              <span key={tag}
                    className="flex items-center gap-1.5 text-xs font-medium bg-gray-50 text-gray-700 border border-gray-200 px-3 py-1.5 rounded-full">
                <Check size={11} className="text-gray-400" /> {tag}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────── */}
      <section className="bg-gray-50 border-y border-gray-100 py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Everything your firm needs</h2>
            <p className="text-gray-500 max-w-xl mx-auto">
              From first client meeting to archived compliance — DueDate handles the full workflow.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-white rounded-2xl p-6 border border-gray-100 hover:border-gray-300 hover:shadow-sm transition-all">
                <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center mb-4">
                  <Icon size={18} className="text-white" />
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ─────────────────────────────────────────────── */}
      <section id="pricing" className="py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Simple, transparent pricing</h2>
            <p className="text-gray-500">No hidden fees. Cancel anytime.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-2xl p-8 flex flex-col transition-all ${
                  plan.highlight
                    ? 'bg-gray-900 text-white shadow-2xl shadow-gray-200 scale-105'
                    : 'bg-white border border-gray-200 hover:border-gray-300 hover:shadow-sm'
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-white text-gray-900 text-xs font-bold px-3 py-1 rounded-full border border-gray-200 shadow-sm whitespace-nowrap">
                      {plan.badge}
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <p className={`text-sm font-semibold mb-1 ${plan.highlight ? 'text-gray-400' : 'text-gray-500'}`}>
                    {plan.name}
                  </p>
                  <div className="flex items-end gap-1 mb-2">
                    <span className={`text-4xl font-bold ${plan.highlight ? 'text-white' : 'text-gray-900'}`}>
                      {plan.price}
                    </span>
                    <span className={`text-sm pb-1 ${plan.highlight ? 'text-gray-400' : 'text-gray-500'}`}>
                      {plan.period}
                    </span>
                  </div>
                  <p className={`text-sm ${plan.highlight ? 'text-gray-400' : 'text-gray-500'}`}>
                    {plan.tagline}
                  </p>
                </div>

                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2.5 text-sm">
                      <CheckCircle
                        size={15}
                        className={`flex-shrink-0 mt-0.5 ${plan.highlight ? 'text-white' : 'text-gray-400'}`}
                      />
                      <span className={plan.highlight ? 'text-gray-200' : 'text-gray-700'}>{f}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => navigate('/login')}
                  className={`w-full py-3 rounded-xl font-semibold text-sm transition-all hover:-translate-y-0.5 ${
                    plan.highlight
                      ? 'bg-white text-gray-900 hover:bg-gray-100'
                      : 'bg-gray-900 text-white hover:bg-gray-700'
                  }`}
                >
                  Get started
                </button>
              </div>
            ))}
          </div>

          <p className="text-center text-sm text-gray-400 mt-8">
            All prices exclude GST · 14-day free trial available · No credit card required to start
          </p>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────── */}
      <section className="bg-gray-50 border-t border-gray-100 py-24">
        <div className="max-w-2xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">Frequently asked questions</h2>
          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-6 py-4 text-left font-semibold text-gray-900 hover:bg-gray-50 transition-colors"
                >
                  {faq.q}
                  <ChevronDown
                    size={16}
                    className={`text-gray-400 flex-shrink-0 ml-4 transition-transform ${openFaq === i ? 'rotate-180' : ''}`}
                  />
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-4 text-sm text-gray-500 leading-relaxed border-t border-gray-50">
                    <div className="pt-3">{faq.a}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────── */}
      <section className="py-24">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Ready to get organised?
          </h2>
          <p className="text-gray-500 mb-8">
            Join CA firms already managing their compliance workflow on DueDate.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="inline-flex items-center gap-2 bg-gray-900 text-white font-semibold px-8 py-4 rounded-xl hover:bg-gray-700 transition-all hover:-translate-y-0.5 shadow-lg shadow-gray-200"
          >
            Start for free <ArrowRight size={16} />
          </button>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer className="border-t border-gray-100 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gray-900 rounded-md flex items-center justify-center">
              <span className="text-white font-bold text-xs">D</span>
            </div>
            <span className="font-bold text-gray-900">DueDate</span>
          </div>
          <p className="text-xs text-gray-400">© {new Date().getFullYear()} DueDate. All rights reserved.</p>
          <button onClick={() => navigate('/login')} className="text-xs font-semibold text-gray-600 hover:text-gray-900 transition-colors">
            Login →
          </button>
        </div>
      </footer>

    </div>
  );
}
