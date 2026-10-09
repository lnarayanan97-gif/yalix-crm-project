import React, { useState } from 'react';
import { Shield, Lock, Mail, ArrowRight, AlertCircle, Sparkles, KeyRound, CheckCircle2 } from 'lucide-react';
import { useAuth, INITIAL_ADMIN_EMAIL } from '../../context/AuthContext';
import { YalixWordmark } from '../common/YalixWordmark';

export function LoginView() {
  const { signInWithGoogle, signInWithEmail, createInitialAdminAccount, authError, setAuthError } = useAuth();

  const [mode, setMode] = useState<'signin' | 'activate'>('signin');
  const [email, setEmail] = useState(INITIAL_ADMIN_EMAIL);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setAuthError('Please enter both email and CRM password.');
      return;
    }
    setSubmitting(true);
    try {
      await signInWithEmail(email, password);
    } catch {
      // Handled in context
    } finally {
      setSubmitting(false);
    }
  };

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setAuthError('Please choose a CRM password.');
      return;
    }
    if (password.length < 8) {
      setAuthError('CRM password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setAuthError('Passwords do not match. Please re-enter.');
      return;
    }

    setSubmitting(true);
    try {
      await createInitialAdminAccount(password);
    } catch {
      // Handled in context
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleClick = async () => {
    setGoogleSubmitting(true);
    try {
      await signInWithGoogle();
    } finally {
      setGoogleSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Decorative ambient background */}
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-teal-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full relative z-10">
        {/* Brand Banner */}
        <div className="text-center mb-7">
          <div className="flex items-center justify-center mb-3">
            <YalixWordmark size="xl" />
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            YALIX <span className="text-emerald-400 font-bold">CRM</span>
          </h1>
          <p className="text-xs text-slate-400 font-medium tracking-wider uppercase mt-1">
            Private Corporate Customer Intelligence System
          </p>
        </div>

        {/* Login Box */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 backdrop-blur-md">
          {/* Designated Administrator Badge */}
          <div className="mb-5 p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/40 flex items-start gap-3">
            <Shield className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-[11px] text-slate-300 leading-relaxed">
              <span className="text-white font-semibold block mb-0.5">
                Designated Administrator: <span className="text-emerald-300 font-mono">{INITIAL_ADMIN_EMAIL}</span>
              </span>
              <span>Role: <strong className="text-emerald-400">ADMIN</strong>. Public registration is permanently disabled.</span>
            </div>
          </div>

          {/* Password Independence Notice */}
          <div className="mb-5 p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>
              Your CRM password is independent from your actual email inbox credentials.
            </span>
          </div>

          {authError && (
            <div className="mb-5 p-3 rounded-xl bg-rose-950/40 border border-rose-800/40 flex items-start gap-2.5 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{authError}</span>
            </div>
          )}

          {/* Mode Switcher Tabs */}
          <div className="flex rounded-xl bg-slate-950 p-1 mb-5 border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setAuthError(null);
              }}
              className={`flex-1 py-1.5 rounded-lg font-medium transition-all ${
                mode === 'signin'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('activate');
                setAuthError(null);
              }}
              className={`flex-1 py-1.5 rounded-lg font-medium transition-all ${
                mode === 'activate'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              First-Time Activation
            </button>
          </div>

          {mode === 'signin' ? (
            /* Sign In Form */
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Authorized Administrator Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="lakshmi@yalixvalor.com"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-950/60 border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Private CRM Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-950/60 border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-emerald-950/50 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                <span>{submitting ? 'Verifying Admin Credentials...' : 'Sign In as Administrator'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          ) : (
            /* First-Time Activation Form */
            <form onSubmit={handleActivate} className="space-y-4">
              <div className="p-3 bg-emerald-950/20 border border-emerald-800/30 rounded-xl text-xs text-emerald-300 leading-relaxed">
                <span className="font-semibold block mb-0.5">Initial Administrator Setup</span>
                Configure your private CRM password for <strong className="text-white">{INITIAL_ADMIN_EMAIL}</strong>. This account will be created directly in Firebase Authentication and granted full <strong>ADMIN</strong> permissions.
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Administrator Email (Fixed)
                </label>
                <input
                  type="email"
                  readOnly
                  disabled
                  value={INITIAL_ADMIN_EMAIL}
                  className="w-full px-3 py-2 text-xs bg-slate-950/90 border border-slate-800 rounded-xl text-emerald-400 font-mono cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Create Independent CRM Password (Min. 8 characters)
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter independent CRM password"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-950/60 border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Confirm CRM Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter CRM password"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-950/60 border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-emerald-950/50 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>{submitting ? 'Creating Admin in Firebase...' : 'Activate Admin & Enter CRM'}</span>
              </button>
            </form>
          )}

          <div className="relative my-6 text-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-800" />
            </div>
            <span className="relative bg-slate-900 px-3 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Or authorized Google account
            </span>
          </div>

          {/* Google SSO Button */}
          <button
            onClick={handleGoogleClick}
            disabled={googleSubmitting}
            className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 text-slate-900 font-semibold text-xs rounded-xl shadow-sm border border-slate-200 transition-all flex items-center justify-center gap-3 disabled:opacity-60 cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.14z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.97 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
              />
            </svg>
            <span>{googleSubmitting ? 'Authenticating...' : 'Sign in with Authorized Google Account'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
