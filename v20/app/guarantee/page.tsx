'use client';
import React from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Lock, Scale, CheckCircle, XCircle, ArrowLeft, EyeOff } from 'lucide-react';
import { Button, AuroraBackground, SpotlightCard } from '../../components/ui/shared';

export default function GuaranteePage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans overflow-x-hidden p-6 md:p-12">
      <AuroraBackground />
      <div className="relative z-10 max-w-4xl mx-auto">
        <Button variant="ghost" className="mb-8 pl-0" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>

        <div className="text-center mb-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="inline-flex items-center justify-center p-3 bg-emerald-100 rounded-2xl mb-6">
                <Shield className="w-8 h-8 text-emerald-600" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4 tracking-tight leading-tight">
                Your money is protected.<br/>
                <span className="text-slate-400">Not promised.</span> Protected.
            </h1>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                Security and anonymity are not mutually exclusive. We deliver both.
            </p>
        </div>

        {/* Quote Section */}
        <div className="text-center p-8 md:p-10 rounded-3xl bg-slate-900 text-slate-300 mb-16 shadow-2xl">
            <p className="text-xl md:text-2xl font-serif italic leading-relaxed">
                "We cannot reveal your identity — because we don’t have it in a readable form."
            </p>
        </div>

        {/* Section 1: How Guarantee Works */}
        <div className="mb-16">
            <h2 className="text-2xl font-bold text-slate-900 mb-8 text-center">How Our Guarantee Works</h2>
            <div className="grid md:grid-cols-3 gap-6">
                {[
                    { icon: Lock, title: "1. Payment Lock", desc: "When you fund a project, the money is locked securely. No one can access it — not even us." },
                    { icon: EyeOff, title: "2. Anonymous Delivery", desc: "The freelancer delivers work without revealing identity. Reputation is based on performance." },
                    { icon: Scale, title: "3. Platform Intervention", desc: "If something goes wrong, we review evidence and refund or resolve per policy." }
                ].map((item, i) => (
                    <SpotlightCard key={i} className="text-center !p-8 h-full">
                        <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mx-auto mb-4 text-blue-600">
                            <item.icon className="w-6 h-6" />
                        </div>
                        <h3 className="font-bold text-lg mb-3 text-slate-900">{item.title}</h3>
                        <p className="text-sm text-slate-500 leading-relaxed">{item.desc}</p>
                    </SpotlightCard>
                ))}
            </div>
        </div>

        {/* Section 2: Do's and Don'ts */}
        <div className="bg-white rounded-3xl p-8 md:p-10 shadow-xl border border-slate-200 mb-16">
            <div className="grid md:grid-cols-2 gap-10">
                <div>
                    <h3 className="flex items-center gap-2 font-bold text-emerald-700 mb-6 text-lg bg-emerald-50 w-fit px-4 py-2 rounded-lg"><CheckCircle className="w-5 h-5"/> What We Do</h3>
                    <ul className="space-y-4 text-slate-700">
                        <li className="flex gap-3 items-start"><CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5"/> 
                            <span><strong>Protect payments</strong> in escrow until terms are met.</span>
                        </li>
                        <li className="flex gap-3 items-start"><CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5"/> 
                            <span><strong>Review delivery proof</strong> objectively during disputes.</span>
                        </li>
                        <li className="flex gap-3 items-start"><CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5"/> 
                            <span><strong>Resolve clear fraud</strong> or non-delivery incidents.</span>
                        </li>
                    </ul>
                </div>
                <div>
                    <h3 className="flex items-center gap-2 font-bold text-red-700 mb-6 text-lg bg-red-50 w-fit px-4 py-2 rounded-lg"><XCircle className="w-5 h-5"/> What We Don't</h3>
                    <ul className="space-y-4 text-slate-700">
                        <li className="flex gap-3 items-start"><XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5"/> 
                            <span>Reveal identities of either party.</span>
                        </li>
                        <li className="flex gap-3 items-start"><XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5"/> 
                            <span>Share personal data with third parties.</span>
                        </li>
                        <li className="flex gap-3 items-start"><XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5"/> 
                            <span>Take sides without technical evidence.</span>
                        </li>
                    </ul>
                </div>
            </div>
        </div>

      </div>
    </div>
  );
}