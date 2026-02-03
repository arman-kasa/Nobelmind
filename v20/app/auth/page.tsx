'use client';
import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link'; // ۱. اضافه شد
import { createClient } from '../../lib/supabase';
import { secureHash, generateGhostEmail, copyToClipboard } from '../../lib/utils';
// ۲. اضافه شدن ArrowLeft به ایمپورت‌ها
import { Lock, AlertTriangle, Check, Copy, ChevronRight, QrCode, Download, X, Shield, Bot, EyeOff, ArrowLeft } from 'lucide-react';
import { Button, AuroraBackground } from '../../components/ui/shared';

// --- SHARED: QR CODE MODAL ---
const QRCodeModal = ({ data, onClose }: { data: string, onClose: () => void }) => {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(data)}`;

    const handleDownloadFile = () => {
        const element = document.createElement("a");
        const file = new Blob([data], {type: 'text/plain'});
        element.href = URL.createObjectURL(file);
        element.download = "anonwork-recovery-phrase.txt";
        document.body.appendChild(element);
        element.click();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl relative flex flex-col items-center text-center">
                <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-slate-100 rounded-full hover:bg-slate-200 text-slate-500">
                    <X className="w-4 h-4" />
                </button>
                <h3 className="text-lg md:text-xl font-bold text-slate-900 mb-2">Recovery QR Code</h3>
                <p className="text-xs md:text-sm text-slate-500 mb-6">Scan to save your phrase or download as file.</p>
                <div className="bg-white p-2 rounded-xl border-2 border-slate-100 mb-6 shadow-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qrUrl} alt="QR Code" className="w-40 h-40 md:w-48 md:h-48 object-contain" />
                </div>
                <div className="flex gap-2 w-full">
                    <Button onClick={handleDownloadFile} variant="outline" className="flex-1 text-[10px] md:text-xs gap-2">
                        <Download className="w-3 h-3" /> Download .txt
                    </Button>
                    <Button onClick={onClose} variant="primary" className="flex-1 text-[10px] md:text-xs">Done</Button>
                </div>
            </div>
        </div>
    );
};

// --- SHARED: WORD GRID COMPONENT ---
const WordGrid = ({ words, setWords, readOnly = false }: any) => {
    const handleChange = (index: number, value: string) => {
        if(readOnly) return;
        if (value.includes(' ') || value.includes('\n') || value.length > 20) {
             const extractedWords = value.toLowerCase().trim().split(/[\s,\n]+/).filter(Boolean).slice(0, 12);
             if (extractedWords.length > 1) {
                 const newWords = [...words];
                 const startIndex = extractedWords.length >= 10 ? 0 : index;
                 extractedWords.forEach((w, i) => { if (startIndex + i < 12) newWords[startIndex + i] = w; });
                 setWords(newWords);
                 return;
             }
        }
        const newWords = [...words];
        newWords[index] = value.trim().toLowerCase();
        setWords(newWords);
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        if(readOnly) return;
        e.preventDefault();
        const text = e.clipboardData.getData('text');
        if (!text) return;
        const pastedWords = text.toLowerCase().trim().split(/[\s,\n]+/).filter(Boolean).slice(0, 12);
        if(pastedWords.length > 0) {
            const newWords = [...words];
            pastedWords.forEach((w, i) => { if(i < 12) newWords[i] = w; });
            setWords(newWords);
        }
    };

    return (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 md:gap-3 mb-6">
            {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="relative">
                    <span className="absolute top-1.5 left-2 text-[8px] md:text-[9px] text-slate-400 font-mono select-none pointer-events-none">{i + 1}</span>
                    <input
                        value={words[i] || ''}
                        onChange={(e) => handleChange(i, e.target.value)}
                        onPaste={handlePaste}
                        readOnly={readOnly}
                        autoCapitalize="none"
                        autoCorrect="off"
                        autoComplete="off"
                        spellCheck="false"
                        inputMode="email"
                        className={`w-full p-1.5 pt-5 md:pt-6 text-center text-[10px] md:text-sm font-bold font-mono rounded-lg border outline-none transition-all
                            ${readOnly 
                                ? 'bg-slate-50 border-slate-200 text-slate-600' 
                                : 'bg-white border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-slate-800 placeholder:text-slate-300'
                            }`}
                        placeholder={readOnly ? '' : '...'}
                    />
                </div>
            ))}
        </div>
    );
};

// -- LOGIN COMPONENT --
const RecoveryLogin = ({ onToggleMode }: any) => {
  const [words, setWords] = useState<string[]>(Array(12).fill(''));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    
    const cleanWords = words.map(w => w.trim().toLowerCase()).filter(Boolean);
    if (cleanWords.length < 12) {
      setError('Please fill in all 12 words.');
      setLoading(false);
      return;
    }

    try {
      const phrase = cleanWords.join(' ');
      const normalized = phrase.split(/\s+/).sort().join(' ');
      const hash = await secureHash(normalized);
      const email = generateGhostEmail(hash);

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email, password: hash
      });

      if (signInError) throw signInError;
      
      if (data.user) {
          // Check if profile exists, if not create (fallback)
          const { data: existingProf } = await supabase.from('profiles').select('*').eq('id', data.user.id).single();
          
          if (!existingProf) {
              // Generate generic ID if recovery happens without profile
              const randomSuffix = Math.floor(Math.random() * 10000);
              const ghostId = `U-${hash.substring(0,5)}-${randomSuffix}`;
              
              await supabase.from('profiles').upsert({
                  id: data.user.id,
                  ghost_id: ghostId,
                  user_type: 'freelancer', // Default fallback
                  trust_score: 100,
                  skills: []
              });
          }
          router.push('/dashboard');
      }
    } catch (err: any) {
      console.error("Login error:", err);
      setError(err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white/90 backdrop-blur-xl border border-slate-200 rounded-3xl p-5 md:p-10 max-w-xl w-full shadow-2xl">
       <div className="flex flex-col items-center mb-6">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 mb-4">
                <Lock className="w-5 h-5 md:w-6 md:h-6" />
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-slate-900">Sign In</h2>
            <p className="text-slate-500 text-xs md:text-sm">Enter your 12-word recovery phrase</p>
        </div>
        
        <WordGrid words={words} setWords={setWords} />
        
        {error && <p className="text-red-500 mb-4 text-center text-xs md:text-sm bg-red-50 p-3 rounded-lg border border-red-100">{error}</p>}
        
        <Button onClick={handleLogin} variant="primary" className="w-full h-10 md:h-11 text-xs md:text-sm" disabled={loading}>
          {loading ? 'Verifying...' : 'Restore Identity'}
        </Button>
        <button onClick={onToggleMode} className="w-full mt-4 text-slate-400 text-xs md:text-sm hover:text-slate-600 py-2">
            Create new identity
        </button>
    </div>
  );
};

// -- REGISTRATION COMPONENT --
const TerminalStep = ({ role = 'freelancer', onToggleMode }: any) => {
  const router = useRouter();
  const supabase = createClient();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [words, setWords] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [isEntering, setIsEntering] = useState(false); 

  useEffect(() => {
    const dict = ["abandon", "jungle", "orbit", "bunker", "shadow", "pixel", "crypto", "tunnel", "matrix", "echo", "system", "void", "alpha", "bravo", "delta", "nebula", "protocol", "signal", "vector", "prism", "flux", "cyber", "node", "core"];
    setWords(dict.sort(() => 0.5 - Math.random()).slice(0, 12));
  }, []);

  const handleCopy = async () => {
      const success = await copyToClipboard(words.join(' '));
      if (success) {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
      } else {
          alert("Please select and copy text manually.");
      }
  };

  const handleCreateAccount = async () => {
     setLoading(true);
     try {
         const phrase = words.join(' ');
         const normalized = phrase.toLowerCase().trim().split(/\s+/).sort().join(' ');
         const hash = await secureHash(normalized);
         const email = generateGhostEmail(hash);

         // Generate ID based on Role (C-xxxx or F-yyyy)
         const prefix = role === 'client' ? 'C' : 'F';
         const randomSuffix = Math.floor(Math.random() * 100000);
         // Format: C-abc12-999 or F-abc12-999
         const ghostId = `${prefix}-${hash.substring(0,5)}-${randomSuffix}`;

         let { data: authData, error: authError } = await supabase.auth.signUp({
            email, password: hash,
         });

         if (authError && !authError.message.includes("already registered")) throw authError;

         if (!authData.session) {
             const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({ email, password: hash });
             if (loginError) throw loginError;
             authData = loginData;
         }

         if (authData.user) {
             let profileSuccess = false;
             let attempts = 0;
             const maxAttempts = 3;

             while (!profileSuccess && attempts < maxAttempts) {
                 const { error: profileError } = await supabase.from('profiles').upsert({
                    id: authData.user.id,
                    ghost_id: ghostId,
                    user_type: role,
                    trust_score: 100,
                    skills: []
                 }, { onConflict: 'id' });

                 if (!profileError) {
                     profileSuccess = true;
                 } else {
                     await new Promise(r => setTimeout(r, 1000));
                     attempts++;
                 }
             }
             
             setStep(2);
         }
     } catch (err: any) {
         console.error("Registration failed:", err);
         alert('Error: ' + (err.message || "Unknown error"));
     } finally {
         setLoading(false);
     }
  };

  const handleEnterDashboard = async () => {
      setIsEntering(true);
      router.push('/dashboard');
  };

  if (step === 2) {
      return (
        <div className="bg-white/90 backdrop-blur-xl border border-slate-200 rounded-3xl p-6 md:p-10 max-w-xl w-full shadow-2xl text-center animate-in zoom-in-95">
             <div className="w-16 h-16 md:w-20 md:h-20 bg-emerald-100 rounded-full mx-auto mb-6 flex items-center justify-center">
                  <Check className="w-8 h-8 md:w-10 md:h-10 text-emerald-600" />
              </div>
              <h3 className="text-xl md:text-2xl font-bold text-slate-900 mb-2">Your Anonymous Identity Is Live</h3>
              <p className="text-slate-500 text-xs md:text-sm mb-8">Access granted securely.</p>
              
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-6 text-left space-y-3 mb-8">
                  <div className="flex items-center gap-3 text-xs md:text-sm text-slate-700 font-medium">
                      <EyeOff className="w-4 h-4 md:w-5 md:h-5 text-blue-500" />
                      Real identity hidden
                  </div>
                  <div className="flex items-center gap-3 text-xs md:text-sm text-slate-700 font-medium">
                      <Shield className="w-4 h-4 md:w-5 md:h-5 text-emerald-500" />
                      Payments protected by Escrow
                  </div>
                  <div className="flex items-center gap-3 text-xs md:text-sm text-slate-700 font-medium">
                      <Bot className="w-4 h-4 md:w-5 md:h-5 text-purple-500" />
                      AI monitors fraud & abuse
                  </div>
              </div>

              <div className="space-y-3">
                  <Button 
                    variant="primary" 
                    className="w-full h-10 md:h-11 text-xs md:text-sm" 
                    onClick={handleEnterDashboard}
                    disabled={isEntering}
                  >
                    {isEntering ? 'Verifying...' : 'Enter Dashboard'}
                  </Button>
                  <Button 
                    variant="secondary" 
                    className="w-full h-10 md:h-11 text-xs md:text-sm" 
                    onClick={() => window.open('/guarantee', '_blank')}
                  >
                    Learn How We Protect You
                  </Button>
              </div>
        </div>
      );
  }

  return (
    <>
        <div className="bg-white/90 backdrop-blur-xl border border-slate-200 rounded-3xl p-5 md:p-10 max-w-xl w-full shadow-2xl">
        <div className="flex justify-between items-center mb-1">
            <h2 className="text-lg md:text-xl font-bold text-slate-900">Generate Identity</h2>
            <span className="text-[10px] md:text-xs font-mono bg-slate-100 px-2 py-1 rounded text-slate-500">ROLE: {role.toUpperCase()}</span>
        </div>
        <p className="text-xs md:text-sm text-slate-500 mb-6">Save your anonymous access key.</p>
        
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4 relative">
            <WordGrid words={words} setWords={setWords} readOnly={true} />
        </div>
        
        <div className="bg-red-50 border border-red-100 rounded-lg p-3 md:p-4 flex gap-3 mb-6">
            <AlertTriangle className="w-4 h-4 md:w-5 md:h-5 text-red-500 flex-shrink-0" />
            <div className="space-y-1">
                <p className="text-[10px] md:text-xs text-red-700 font-bold leading-relaxed">
                    This is the only way to access your account later.
                </p>
                <p className="text-[10px] md:text-xs text-red-600 leading-relaxed">
                    We don’t store emails, names, or passwords.
                </p>
            </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
            <Button onClick={handleCopy} variant="outline" className="text-[10px] md:text-xs gap-2 h-9 md:h-10">
                {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />} {copied ? 'Copied' : 'Copy Text'}
            </Button>
            <Button onClick={() => setShowQR(true)} variant="outline" className="text-[10px] md:text-xs gap-2 h-9 md:h-10">
                <QrCode className="w-3 h-3" /> Save via QR
            </Button>
        </div>

        <Button variant="primary" onClick={handleCreateAccount} disabled={loading} className="w-full text-[10px] md:text-xs gap-2 h-9 md:h-10">
            {loading ? 'Encrypting...' : 'I Have Saved It, Continue'} <ChevronRight className="w-3 h-3" />
        </Button>
        
        <button onClick={onToggleMode} className="w-full mt-4 text-slate-400 text-[10px] md:text-xs hover:text-slate-600 py-2">Login instead</button>
        </div>

        {showQR && <QRCodeModal data={words.join(' ')} onClose={() => setShowQR(false)} />}
    </>
  );
};

function AuthContent() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<'login'|'register'>('login');

  useEffect(() => {
    if (searchParams.get('role')) setMode('register');
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
        <AuroraBackground />
        
        {/* ۳. دکمه بازگشت به صفحه اصلی */}
        <Link 
          href="/" 
          className="absolute top-6 right-6 z-50 flex items-center gap-2 bg-white/50 hover:bg-white/90 backdrop-blur-sm border border-slate-200 px-4 py-2 rounded-full text-slate-600 hover:text-slate-900 text-xs md:text-sm font-medium transition-all"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </Link>

        <div className="relative z-10 w-full flex justify-center">
            {mode === 'login' ? <RecoveryLogin onToggleMode={() => setMode('register')} /> : <TerminalStep role={searchParams.get('role') || 'freelancer'} onToggleMode={() => setMode('login')} />}
        </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-slate-500 text-xs">Loading...</div>}>
      <AuthContent />
    </Suspense>
  );
}