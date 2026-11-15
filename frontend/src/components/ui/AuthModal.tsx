'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useUserAuth } from '@/contexts/UserAuthContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { login, requestRegistrationCode, verifyRegistrationCode, loginWithGoogle } = useUserAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [verificationCodeSent, setVerificationCodeSent] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [googleClientId, setGoogleClientId] = useState('');
  const googleButtonRef = useRef<HTMLDivElement>(null);

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

  const resetFields = useCallback(() => {
    setEmail(''); setPassword('');
    setRegName(''); setRegEmail(''); setRegPhone(''); setRegAddress(''); setRegPassword(''); setRegConfirm('');
    setVerificationCode(''); setVerificationCodeSent(false);
    setError('');
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    fetch('/api/public-auth/config')
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not load sign-in options');
        return response.json();
      })
      .then((config: { googleClientId?: string }) => {
        if (active) setGoogleClientId(config.googleClientId || '');
      })
      .catch(() => {
        if (active) setGoogleClientId('');
      });
    return () => { active = false; };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !googleClientId) return;
    let cancelled = false;
    const handleGoogleSignIn = async (credential: string) => {
      setError('');
      setSubmitting(true);
      try {
        await loginWithGoogle(credential);
        resetFields();
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Google sign-in failed');
      } finally {
        setSubmitting(false);
      }
    };
    window.oorumGoogleSignInCallback = handleGoogleSignIn;
    const renderGoogleButton = () => {
      if (cancelled || !window.google || !googleButtonRef.current) return;
      googleButtonRef.current.replaceChildren();
      if (window.oorumGoogleInitializedClientId !== googleClientId) {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: ({ credential }) => {
            void window.oorumGoogleSignInCallback?.(credential);
          },
        });
        window.oorumGoogleInitializedClientId = googleClientId;
      }
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        width: 360,
      });
    };

    if (window.google) {
      renderGoogleButton();
    } else {
      const scriptId = 'google-identity-services';
      let script = document.getElementById(scriptId) as HTMLScriptElement | null;
      if (!script) {
        script = document.createElement('script');
        script.id = scriptId;
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
      script.addEventListener('load', renderGoogleButton);
      return () => {
        cancelled = true;
        if (window.oorumGoogleSignInCallback === handleGoogleSignIn) {
          window.oorumGoogleSignInCallback = undefined;
        }
        script?.removeEventListener('load', renderGoogleButton);
      };
    }

    return () => {
      cancelled = true;
      if (window.oorumGoogleSignInCallback === handleGoogleSignIn) {
        window.oorumGoogleSignInCallback = undefined;
      }
    };
  }, [isOpen, googleClientId, loginWithGoogle, onClose, resetFields]);

  if (!isOpen) return null;

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

  const registrationData = () => ({
    name: regName,
    email: regEmail,
    phone: regPhone || undefined,
    address: regAddress || undefined,
    password: regPassword,
    confirmPassword: regConfirm,
  });

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (verificationCodeSent) {
        await verifyRegistrationCode({ ...registrationData(), verificationCode });
        resetFields();
        onClose();
      } else {
        if (regPassword !== regConfirm) throw new Error('Passwords do not match');
        if (regPassword.length < 6) throw new Error('Password must be at least 6 characters');
        if (!/[a-zA-Z]/.test(regPassword) || !/[0-9]/.test(regPassword)) {
          throw new Error('Password must contain at least one letter and one number');
        }
        await requestRegistrationCode(registrationData());
        setVerificationCodeSent(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally { setSubmitting(false); }
  };

  const handleResendCode = async () => {
    setError('');
    setSubmitting(true);
    try {
      await requestRegistrationCode(registrationData());
      setVerificationCode('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend verification code');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] max-h-[90dvh] overscroll-contain overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b">
          <div className="flex gap-1">
            <button
              onClick={() => { setMode('login'); setVerificationCodeSent(false); setVerificationCode(''); setError(''); }}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${mode === 'login' ? 'bg-accent-red text-white' : 'text-gray-500 hover:bg-gray-100'}`}
            >
              உள்நுழைய
            </button>
            <button
              onClick={() => { setMode('register'); setVerificationCodeSent(false); setVerificationCode(''); setError(''); }}
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
              {verificationCodeSent ? (
                <>
                  <p className="text-sm text-gray-600" role="status">
                    We sent a verification code to <strong>{regEmail}</strong>. Enter it below to finish creating your account.
                  </p>
                  <div>
                    <label className="block text-sm font-medium mb-1" htmlFor="signup-verification-code">Email verification code</label>
                    <input
                      id="signup-verification-code"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                      required
                      placeholder="6-digit code"
                      className="w-full border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-accent-red/30 focus:border-accent-red"
                    />
                  </div>
                  <button type="submit" disabled={submitting || verificationCode.length !== 6} className="w-full bg-accent-red text-white py-2.5 rounded-lg text-sm font-bold hover:bg-accent-red/90 disabled:opacity-50 transition-colors">
                    {submitting ? 'Verifying...' : 'Verify email and create account'}
                  </button>
                  <div className="flex items-center justify-between text-xs">
                    <button type="button" disabled={submitting} onClick={handleResendCode} className="text-accent-red font-medium hover:underline disabled:opacity-50">
                      Resend code
                    </button>
                    <button type="button" onClick={() => { setVerificationCodeSent(false); setVerificationCode(''); setError(''); }} className="text-gray-500 hover:underline">
                      Edit registration details
                    </button>
                  </div>
                </>
              ) : (
                <>
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
                {submitting ? 'Sending code...' : 'Send verification code'}
              </button>
              <p className="text-center text-xs text-gray-500">
                ஏற்கனவே கணக்கு உள்ளதா? <button type="button" onClick={() => { setMode('login'); setError(''); }} className="text-accent-red font-medium hover:underline">உள்நுழையவும்</button>
              </p>
                </>
              )}
            </form>
          )}

          {googleClientId && !(mode === 'register' && verificationCodeSent) && (
            <div className="mt-5">
              <div className="mb-3 flex items-center gap-3 text-xs text-gray-400">
                <span className="h-px flex-1 bg-gray-200" />
                <span>or continue with Google</span>
                <span className="h-px flex-1 bg-gray-200" />
              </div>
              <div ref={googleButtonRef} className="flex justify-center" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
