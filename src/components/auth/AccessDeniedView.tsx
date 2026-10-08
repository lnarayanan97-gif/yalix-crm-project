import React from 'react';
import { ShieldAlert, LogOut, MailCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export function AccessDeniedView() {
  const { currentUser, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-950 border border-rose-900/60 rounded-2xl shadow-2xl p-6 sm:p-8 text-center text-slate-300">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 mx-auto flex items-center justify-center mb-4">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-white tracking-tight">Access Restricted</h2>
        <p className="text-xs text-rose-300 font-medium uppercase tracking-wider mt-1">
          YALIX CRM — Private Internal System
        </p>

        <div className="mt-5 p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-left text-xs space-y-2">
          <p className="text-slate-300 leading-relaxed">
            Signed in as: <strong className="text-white">{currentUser?.email}</strong>
          </p>
          <p className="text-slate-400 leading-relaxed">
            This account is not authorized. YALIX CRM is exclusively restricted to the authorized administrator (<strong className="text-emerald-400">lakshmi@yalixvalor.com</strong>).
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-2.5">
          <button
            onClick={() => signOut()}
            className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out and Switch Account</span>
          </button>
        </div>

        <p className="text-[11px] text-slate-500 mt-5">
          To request access, please contact the YALIX CRM Administrator at lnarayanan97@gmail.com
        </p>
      </div>
    </div>
  );
}
