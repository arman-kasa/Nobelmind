'use client';
import React, { useState, useEffect, memo } from 'react';
import { 
  ArrowRight, Search, Briefcase, Terminal, User, Wallet, 
  Lock, Zap, MessageSquare, Hexagon, LayoutGrid, Shield, Coins, CheckCircle
} from 'lucide-react';
import Link from 'next/link';
import { Button, Badge, SpotlightCard } from '../ui/shared';

// --- Navbar ---
// Updated: Added Platform Link
export const LandingNavbar = memo(({ onSignIn }: any) => (
  <div className="fixed top-4 md:top-6 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none">
    <nav className="w-full max-w-5xl bg-white/80 backdrop-blur-xl border border-slate-200 rounded-2xl shadow-lg shadow-slate-200/50 px-6 h-16 flex items-center justify-between pointer-events-auto">
      <div className="flex items-center gap-3">
        <Link href="/" className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md">
            <LayoutGrid className="w-5 h-5" />
            </div>
            <span className="text-lg font-bold tracking-tight text-slate-800">Noble Mind</span>
        </Link>
      </div>
      <div className="hidden md:flex items-center gap-8">
        <Link href="/platform" className="text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors">
            Platform
        </Link>
        <Link href="/how-it-works" className="text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors">
            How it Works
        </Link>
        <Link href="/features" className="text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors">
            Features
        </Link>
        <Link href="/guarantee" className="text-sm font-medium text-slate-500 hover:text-blue-600 transition-colors">
            Guarantee
        </Link>
      </div>
      <div className="flex items-center gap-3">
        <Button onClick={onSignIn} variant="primary" className="!py-2 !px-6 !h-9 text-xs !rounded-lg shadow-blue-200">
          Sign In
        </Button>
      </div>
    </nav>
  </div>
));
LandingNavbar.displayName = 'LandingNavbar';

// --- Hero Section (REVERTED TO ORIGINAL) ---
export const Hero = memo(({ onRoleSelect }: any) => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  
  useEffect(() => {
    const updateMousePosition = (ev: MouseEvent) => setMousePosition({ x: ev.clientX, y: ev.clientY });
    window.addEventListener('mousemove', updateMousePosition);
    return () => window.removeEventListener('mousemove', updateMousePosition);
  }, []);

  const xOffset = (mousePosition.x / (typeof window !== 'undefined' ? window.innerWidth : 1000) - 0.5) * 20;
  const yOffset = (mousePosition.y / (typeof window !== 'undefined' ? window.innerHeight : 1000) - 0.5) * 20;

  return (
    <section className="relative pt-32 md:pt-48 pb-20 min-h-screen flex flex-col items-center justify-center overflow-hidden">
      <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
        <div className="flex justify-center mb-8">
          <Badge>Anonymous Freelance Platform</Badge>
        </div>
        <div style={{ transform: `translate(${xOffset * -1}px, ${yOffset * -1}px)` }} className="transition-transform duration-100 ease-out">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter text-slate-900 mb-6 leading-[0.95]">
            Stay anonymous. <span className="text-blue-600">Your money</span><br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-emerald-500">stays protected, Always.</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-600 mb-2 font-medium max-w-3xl mx-auto">
             Privacy for workers. Protection for clients.
          </p>
          <p className="text-sm text-slate-500 mb-10 font-light max-w-3xl mx-auto">
            Payments are secured by escrow and platform guarantee.
          </p>
        </div>

        {/* Trust Badges */}
        <div className="flex flex-col items-center mb-12">
            <div className="flex flex-wrap justify-center gap-4 md:gap-8 mb-3">
                <div className="flex items-center gap-2 text-slate-700 font-medium text-sm md:text-base">
                    <Lock className="w-5 h-5 text-blue-500" />
                    <span>Anonymous by Design</span>
                </div>
                <div className="flex items-center gap-2 text-slate-700 font-medium text-sm md:text-base">
                    <Shield className="w-5 h-5 text-emerald-500" />
                    <span>Escrow-Protected Payments</span>
                </div>
                <div className="flex items-center gap-2 text-slate-700 font-medium text-sm md:text-base">
                    <Coins className="w-5 h-5 text-amber-500" />
                    <span>Platform Guarantee</span>
                </div>
            </div>
            <Link href="/guarantee" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                🔒 How we protect your payment <ArrowRight className="w-3 h-3"/>
            </Link>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto w-full mb-12">
          {/* Client Card */}
          <button onClick={() => onRoleSelect('client')} className="group w-full text-left focus:outline-none active:scale-[0.98] transition-all">
            <SpotlightCard className="h-full border-l-4 border-l-transparent hover:border-l-emerald-500">
              <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center mb-6 text-emerald-600 group-hover:scale-110 transition-transform">
                <Search className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2">I Need Talent</h3>
              <div className="space-y-2 mb-6 text-sm text-slate-500">
                  <div className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" /> Pay into secure escrow</div>
                  <div className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" /> Money released only after approval</div>
                  <div className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" /> Platform covers disputes</div>
              </div>
              <div className="mt-auto flex items-center text-xs font-bold text-white bg-emerald-600 w-fit px-4 py-2 rounded-lg group-hover:bg-emerald-700 transition-colors">
                <span>Start a risk-free test project</span>
                <ArrowRight className="w-3 h-3 ml-2 group-hover:translate-x-1 transition-transform" />
              </div>
            </SpotlightCard>
          </button>

          {/* Freelancer Card */}
          <button onClick={() => onRoleSelect('freelancer')} className="group w-full text-left focus:outline-none active:scale-[0.98] transition-all">
            <SpotlightCard className="h-full border-l-4 border-l-transparent hover:border-l-blue-500">
              <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mb-6 text-blue-600 group-hover:scale-110 transition-transform">
                <Briefcase className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2">I Need Work</h3>
              <div className="space-y-2 mb-6 text-sm text-slate-500">
                  <div className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" /> No name, no profile, no exposure</div>
                  <div className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" /> Reputation without identity</div>
                  <div className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" /> Guaranteed payments</div>
              </div>
              <div className="mt-auto flex items-center text-xs font-bold text-white bg-blue-600 w-fit px-4 py-2 rounded-lg group-hover:bg-blue-700 transition-colors">
                <span>Start working anonymously</span>
                <ArrowRight className="w-3 h-3 ml-2 group-hover:translate-x-1 transition-transform" />
              </div>
            </SpotlightCard>
          </button>
        </div>
      </div>
    </section>
  );
});
Hero.displayName = 'Hero';

// --- How It Works ---
export const HowItWorks = memo(() => (
  <section className="py-20 relative z-10 bg-white">
    <div className="max-w-7xl mx-auto px-6">
      <div className="text-center mb-16">
        <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">How It Works</h2>
        <div className="w-20 h-1 bg-blue-600 mx-auto rounded-full mb-4" />
        <p className="text-slate-500 text-sm">If something goes wrong, the platform steps in.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { icon: Terminal, title: "1. Generate", desc: "Get 12 recovery words to create your unique FreeLancer or Client ID." },
          { icon: User, title: "2. Build", desc: "Create your skill profile without revealing personal info." },
          { icon: Briefcase, title: "3. Work", desc: "Find projects or talent based purely on requirements." },
          { icon: Wallet, title: "4. Earn", desc: "Get paid anonymously via crypto escrow contracts." }
        ].map((step, idx) => (
          <div key={idx} className="p-6 rounded-2xl bg-slate-50 border border-slate-100 hover:shadow-lg transition-shadow">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center mb-4 text-blue-600 shadow-sm border border-slate-100">
              <step.icon className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">{step.title}</h3>
            <p className="text-sm text-slate-500 leading-relaxed">{step.desc}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
));
HowItWorks.displayName = 'HowItWorks';

// --- Features ---
export const FeaturesGrid = memo(() => (
  <section className="py-32 relative z-10 bg-slate-50/50">
    <div className="max-w-7xl mx-auto px-6">
        <div className="mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6 tracking-tight">Features</h2>
            <p className="text-lg text-slate-500">A complete ecosystem designed for privacy-first collaboration.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <SpotlightCard className="md:col-span-2 min-h-[300px]">
                <div className="relative z-10 h-full flex flex-col justify-end">
                    <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mb-6 text-blue-600">
                        <Lock className="w-7 h-7" />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900 mb-4">Zero-Personal-Data Auth</h3>
                    <p className="text-slate-500 text-lg max-w-lg leading-relaxed">
                        We utilize ZK-proofs to verify skills without revealing identity. Your "Client ID or Freelancer ID" allows you to build a portable reputation.
                    </p>
                </div>
            </SpotlightCard>
            <SpotlightCard className="md:row-span-2">
                <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mb-6 text-emerald-600">
                    <Zap className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-4">Smart Contract Escrow</h3>
                <p className="text-slate-500 mb-8 leading-relaxed">
                    Funds are locked in immutable smart contracts. Release happens automatically when code passes CI/CD checks.
                </p>
                <div className="mt-auto bg-slate-900 rounded-xl p-4 border border-slate-800 font-mono text-xs text-slate-400">
                     <p><span className="text-purple-400">function</span> <span className="text-blue-400">release</span>() {'{'}</p>
                    <p className="pl-4">require(verified);</p>
                    <p className="pl-4">pay(worker);</p>
                    <p>{'}'}</p>
                </div>
            </SpotlightCard>
            <SpotlightCard>
                <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center mb-4 text-indigo-600">
                    <MessageSquare className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Encrypted Comms</h3>
                <p className="text-slate-500 text-sm">End-to-end encrypted chat and file sharing.</p>
            </SpotlightCard>
            <SpotlightCard>
                <div className="w-12 h-12 bg-pink-50 rounded-2xl flex items-center justify-center mb-4 text-pink-600">
                    <Hexagon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Community DAO</h3>
                <p className="text-slate-500 text-sm">Platform rules are decided by token holders.</p>
            </SpotlightCard>
        </div>
    </div>
  </section>
));
FeaturesGrid.displayName = 'FeaturesGrid';

// --- Guarantee Section ---
export const GuaranteeSection = memo(() => (
    <section className="py-20 relative z-10 bg-white">
        <div className="max-w-4xl mx-auto px-6">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-3xl p-8 md:p-12 border border-blue-100 text-center">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                    <Shield className="w-8 h-8 text-blue-600" />
                </div>
                <h2 className="text-3xl font-bold text-slate-900 mb-4">Our Guarantee</h2>
                <p className="text-lg text-slate-600 leading-relaxed max-w-2xl mx-auto">
                    If a project fails due to fraud or non-delivery, we refund the client according to our policy. 
                    Your funds are safe, and your anonymity is preserved.
                </p>
                <div className="mt-8">
                    <Link href="/guarantee" className="text-blue-600 font-bold hover:underline">Read the policy →</Link>
                </div>
            </div>
        </div>
    </section>
));
GuaranteeSection.displayName = 'GuaranteeSection';

// --- Footer ---
export const Footer = memo(() => (
    <footer className="relative border-t border-slate-200 bg-white py-16 mt-32">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 text-center md:text-left">
          
          {/* Column 1: Logo & Tagline */}
          <div className="flex flex-col items-center md:items-start">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-md">
                <LayoutGrid className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-slate-900 tracking-tight">Noble Mind</span>
            </div>
            <p className="text-sm text-slate-500 max-w-xs mb-4">Stay anonymous. Your money stays protected, Always.</p>
            
            {/* [MODIFIED LINK] Link to Platform Page */}
            <Link href="/platform" className="text-xs text-blue-600 font-bold hover:underline mb-2 block">
                Looking to integrate escrow & trust into your platform?
            </Link>

            {/* [NEW LINK] Separate Contact Us Link */}
            <Link href="/contact" className="text-xs text-slate-400 hover:text-blue-600 hover:underline transition-colors block">
                Contact us
            </Link>
          </div>

          {/* Column 2: Platform Links */}
          <div className="flex flex-col items-center md:items-start">
            <Link href="/platform" className="hover:text-blue-600 transition-colors">
                 <h4 className="text-sm font-semibold text-slate-900 mb-4">Platform</h4>
            </Link>
            <div className="space-y-2 text-sm text-slate-500">
              <Link href="/how-it-works" className="block hover:text-blue-600 transition">How it Works</Link>
              <Link href="/features" className="block hover:text-blue-600 transition">Features</Link>
            </div>
          </div>

          {/* Column 3: Legal Links */}
          <div className="flex flex-col items-center md:items-start">
            <h4 className="text-sm font-semibold text-slate-900 mb-4">Legal</h4>
            <div className="space-y-2 text-sm text-slate-500">
              <Link href="/legal/privacy" className="block hover:text-blue-600 transition">Privacy Policy</Link>
              <Link href="/legal/terms" className="block hover:text-blue-600 transition">Terms of Service</Link>
              <Link href="/guarantee" className="block hover:text-blue-600 transition">Guarantee & Dispute Policy</Link>
            </div>
          </div>
        </div>
        
        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-400">
          <div>© 2025 Noble Mind. All rights reserved.</div>
          <div className="flex items-center gap-6 font-medium">
            <span className="flex items-center gap-2"><Lock className="w-3.5 h-3.5" /> End-to-end encryption</span>
          </div>
        </div>
      </div>
    </footer>
  ));
Footer.displayName = 'Footer';