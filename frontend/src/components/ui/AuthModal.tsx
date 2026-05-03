'use client';

import { useState } from 'react';
import { useUserAuth } from '@/contexts/UserAuthContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { login, register } = useUserAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Login fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Register fields
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regAddress, setRegAddress] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm, setRegConfirm] = useState('');

  if (!isOpen) return null;

  const resetFields = () => {
    setEmail(''); setPassword('');
    setRegName(''); setRegEmail(''); setRegPhone(''); setRegAddress(''); setRegPassword(''); setRegConfirm('');
    setError('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSubmitting(true);
    try {
      await login(email, password);
      resetFields();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally { setSubmitting(false); }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (regPassword !== regConfirm) { setError('Passwords do not match'); return; }
    if (regPassword.length < 6) { setError('Password must be at least 6 characters'); return; }
    setSubmitting(true);
    try {
      await register({ name: regName, email: regEmail, phone: regPhone || undefined, address: regAddress || undefined, password: regPassword, confirmPassword: regConfirm });
      resetFields();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b">
          <div className="flex gap-1">
            <button
              onClick={() => { setMode('login'); setError(''); }}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${mode === 'login' ? 'bg-accent-red text-white' : 'text-gray-500 hover:bg-gray-100'}`}
            >
              உள்நுழைய
            </button>
            <button
              onClick={() => { setMode('register'); setError(''); }}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${mode === 'register' ? 'bg-accent-red text-white' : 'text-gray-500 hover:bg-gray-100'}`}
            >
              பதிவு செய்ய
            </button>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400" aria-label="Close">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-5">
          {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

          {/* Login Form */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">மின்னஞ்சல்</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="your@email.com" className="w-full border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-accent-red/30 focus:border-accent-red" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">கடவுச்சொல்</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••" className="w-full border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-accent-red/30 focus:border-accent-red" />
              </div>
              <button type="submit" disabled={submitting} className="w-full bg-accent-red text-white py-2.5 rounded-lg text-sm font-bold hover:bg-accent-red/90 disabled:opacity-50 transition-colors">
                {submitting ? 'உள்நுழைகிறது...' : 'உள்நுழைய'}
              </button>
              <p className="text-center text-xs text-gray-500">
                கணக்கு இல்லையா? <button type="button" onClick={() => { setMode('register'); setError(''); }} className="text-accent-red font-medium hover:underline">பதிவு செய்யவும்</button>
              </p>
            </form>
          )}

          {/* Register Form */}
          {mode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">பெயர் *</label>
                <input type="text" value={regName} onChange={(e) => setRegName(e.target.value)} required placeholder="Your name" className="w-full border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-accent-red/30 focus:border-accent-red" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">மின்னஞ்சல் *</label>
                <input type="email" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} required placeholder="your@email.com" className="w-full border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-accent-red/30 focus:border-accent-red" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">தொலைபேசி</label>
                <input type="tel" value={regPhone} onChange={(e) => setRegPhone(e.target.value)} placeholder="+94 77 123 4567" className="w-full border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-accent-red/30 focus:border-accent-red" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">முகவரி</label>
                <input type="text" value={regAddress} onChange={(e) => setRegAddress(e.target.value)} placeholder="Your address" className="w-full border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-accent-red/30 focus:border-accent-red" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">கடவுச்சொல் *</label>
                <input type="password" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} required placeholder="Min 6 characters" className="w-full border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-accent-red/30 focus:border-accent-red" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">கடவுச்சொல் உறுதிப்படுத்தல் *</label>
                <input type="password" value={regConfirm} onChange={(e) => setRegConfirm(e.target.value)} required placeholder="Confirm password" className="w-full border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-accent-red/30 focus:border-accent-red" />
              </div>
              <button type="submit" disabled={submitting} className="w-full bg-accent-red text-white py-2.5 rounded-lg text-sm font-bold hover:bg-accent-red/90 disabled:opacity-50 transition-colors">
                {submitting ? 'பதிவு செய்கிறது...' : 'பதிவு செய்ய'}
              </button>
              <p className="text-center text-xs text-gray-500">
                ஏற்கனவே கணக்கு உள்ளதா? <button type="button" onClick={() => { setMode('login'); setError(''); }} className="text-accent-red font-medium hover:underline">உள்நுழையவும்</button>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
