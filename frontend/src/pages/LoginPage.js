import React, { useState } from 'react';
import { toast } from 'sonner';
import { Mail, Lock, User } from 'lucide-react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'https://emergent-dd-2b7s.vercel.app';
const API = `${BACKEND_URL}/api`;

export default function LoginPage({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const endpoint = isLogin ? '/auth/login' : '/auth/register';
      const response = await axios.post(`${API}${endpoint}`, formData);
      
      toast.success(isLogin ? 'Welcome back!' : 'Account created successfully!');
      onLogin(response.data.access_token, response.data.user, response.data.organization);
    } catch (error) {
      toast.error(error.response?.data?.detail || error.response?.data?.error || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex animate-fade-in">
      {/* Left side - Brand */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center p-12 relative overflow-hidden"
           style={{ background: 'linear-gradient(135deg, #111827 0%, #374151 50%, #7C3AED 100%)' }}>
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-72 h-72 rounded-full opacity-10"
             style={{ background: 'radial-gradient(circle, #A855F7 0%, transparent 70%)', transform: 'translate(30%, -30%)' }} />
        <div className="absolute bottom-0 left-0 w-56 h-56 rounded-full opacity-10"
             style={{ background: 'radial-gradient(circle, #EC4899 0%, transparent 70%)', transform: 'translate(-30%, 30%)' }} />
        <div className="absolute top-1/4 right-12 w-32 h-32 rounded-full border-4 border-white/10" />
        <div className="absolute bottom-1/4 left-12 w-20 h-20 rounded-full border-2 border-white/10" />
        <div className="absolute top-1/2 left-1/2 w-48 h-48 rounded-full border border-white/5"
             style={{ transform: 'translate(-50%, -50%)' }} />
        {/* Floating geometric shapes */}
        <div className="absolute top-20 left-16 w-8 h-8 rotate-45 bg-white/10 rounded-sm animate-float" />
        <div className="absolute bottom-24 right-20 w-6 h-6 rotate-12 bg-purple-300/20 rounded-sm animate-float"
             style={{ animationDelay: '1s' }} />
        {/* Dot pattern */}
        <svg className="absolute inset-0 w-full h-full opacity-5" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="login-dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.5" fill="white" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#login-dots)" />
        </svg>

        <div className="text-white max-w-lg z-10 animate-slide-in">
          <div className="mb-8">
            <div className="w-16 h-16 rounded-2xl mb-6 flex items-center justify-center text-white text-3xl font-bold shadow-2xl"
                 style={{ background: 'linear-gradient(135deg, #A855F7 0%, #EC4899 100%)' }}>
              D
            </div>
          </div>
          <h1 className="text-6xl font-bold mb-6 tracking-tight">DueDate</h1>
          <p className="text-xl leading-relaxed text-white/80">
            Never miss a compliance deadline. Automate reminders, collaborate with your team, and stay organized.
          </p>
          <div className="mt-12 space-y-4">
            {['Multi-user collaboration', 'Automated email reminders', 'Bulk client import'].map(f => (
              <div key={f} className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-purple-300 rounded-full shadow-sm" />
                <span className="text-white/75 font-medium">{f}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md animate-scale-in">
          <div className="mb-10">
            <h2 className="text-4xl font-bold text-black mb-3">
              {isLogin ? 'Welcome Back' : 'Get Started'}
            </h2>
            <p className="text-gray-600 text-lg">
              {isLogin ? 'Sign in to manage your compliance deadlines' : 'Create your account to begin'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
              <div>
                <label className="label">Full Name</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User size={20} className="text-gray-400" />
                  </div>
                  <input
                    type="text"
                    data-testid="name-input"
                    className="input-field pl-11"
                    placeholder="John Doe"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required={!isLogin}
                  />
                </div>
              </div>
            )}

            <div>
              <label className="label">Email Address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail size={20} className="text-gray-400" />
                </div>
                <input
                  type="email"
                  data-testid="email-input"
                  className="input-field pl-11"
                  placeholder="your@email.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock size={20} className="text-gray-400" />
                </div>
                <input
                  type="password"
                  data-testid="password-input"
                  className="input-field pl-11"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              data-testid="submit-button"
              className="btn-primary w-full py-3.5 text-base mt-2"
              disabled={loading}
            >
              {loading ? 'Please wait...' : (isLogin ? 'Sign In' : 'Create Account')}
            </button>
          </form>

          <div className="mt-8 text-center">
            <button
              type="button"
              data-testid="toggle-auth-mode"
              onClick={() => setIsLogin(!isLogin)}
              className="text-black hover:text-gray-600 font-semibold transition-colors"
            >
              {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
