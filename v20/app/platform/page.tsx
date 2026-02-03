'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowRight, Search, Briefcase, Lock, Shield, Coins, CheckCircle 
} from 'lucide-react';
import { LandingNavbar, HowItWorks, FeaturesGrid, GuaranteeSection, Footer } from '@/components/landing/sections';
import { AuroraBackground, Badge, SpotlightCard } from '@/components/ui/shared';

// --- Custom Hero for Platform Page (Trust Focused) ---
const PlatformHero = ({ onRoleSelect }: any) => {
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
           <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Enterprise Grade Security</Badge>
        </div>
        <div style={{ transform: `translate(${xOffset * -1}px, ${yOffset * -1}px)` }} className="transition-transform duration-100 ease-out">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter text-slate-900 mb-6 leading-[0.95]">
            Trust Infrastructure for <br/>
            <span className="text-blue-600">Enforceable Digital Transactions</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-600 mb-8 font-medium max-w-2xl mx-auto">
             Reduce disputes, fraud, and transaction risk with our automated enforcement engine. 
             Secure escrow, deterministic dispute resolution, and immutable audit logs.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-center gap-4 mb-16">
            <button onClick={() => onRoleSelect('client')} className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-200 transition-all flex items-center gap-2">
                Start Pilot <ArrowRight className="w-4 h-4" />
            </button>
            <button onClick={() => window.location.href = 'mailto:sales@nobelmind.com'} className="px-8 py-4 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl font-bold transition-all">
                Contact Sales
            </button>
        </div>
        
        {/* Service Pillars (New UI/UX) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto w-full text-left">
            {[
                { title: "Controlled Escrow", desc: "Funds released only based on verified system decisions.", icon: Lock, color: "text-blue-600", bg: "bg-blue-50" },
                { title: "Automated Resolution", desc: "Rule-based logic minimizes human bias in disputes.", icon: Shield, color: "text-emerald-600", bg: "bg-emerald-50" },
                { title: "Behavioral Scoring", desc: "Pre-emptive risk detection using behavioral analysis.", icon: Coins, color: "text-amber-600", bg: "bg-amber-50" }
            ].map((item, i) => (
                <SpotlightCard key={i} className="border-0 shadow-md">
                    <div className={`w-12 h-12 ${item.bg} rounded-xl flex items-center justify-center mb-4 ${item.color}`}>
                        <item.icon className="w-6 h-6" />
                    </div>
                    <h3 className="font-bold text-slate-900 mb-2">{item.title}</h3>
                    <p className="text-slate-600 text-sm leading-relaxed">{item.desc}</p>
                </SpotlightCard>
            ))}
        </div>
      </div>
    </section>
  );
};

export default function PlatformPage() {
  const router = useRouter();

  const handleSignIn = () => { router.push('/auth'); };
  const handleLaunchApp = () => { router.push('/dashboard'); };
  const handleRoleSelect = (role: 'client' | 'freelancer') => { router.push(`/auth?role=${role}`); };

  return (
    <main className="min-h-screen bg-white selection:bg-blue-100 selection:text-blue-900 font-sans relative">
      <AuroraBackground />
      <LandingNavbar onSignIn={handleSignIn} onLaunchApp={handleLaunchApp} />
      
      {/* Custom Hero for Platform Page */}
      <PlatformHero onRoleSelect={handleRoleSelect} />

      {/* Reuse other components */}
      <FeaturesGrid />
      <GuaranteeSection />
      <Footer />
    </main>
  );
}