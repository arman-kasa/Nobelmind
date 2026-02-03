'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Brain, Gavel, FileSearch, Plug, Users, ArrowLeft } from 'lucide-react';
// اصلاح مسیر: دو پله به عقب برای رسیدن به پوشه components
import { Button, AuroraBackground, SpotlightCard } from '../../components/ui/shared';

export default function FeaturesPage() {
  const router = useRouter();

  const features = [
    {
      title: "Automated Escrow",
      desc: "Funds are held securely until strict cryptographic or manual conditions are met.",
      icon: Shield,
      tooltip: "Smart contract based holding",
    },
    {
      title: "Behavioral Decision Engine",
      desc: "Risk scoring based on user interaction patterns, history, and communication tone.",
      icon: Brain,
      tooltip: "AI Risk Assessment",
    },
    {
      title: "Evidence-based Resolution",
      desc: "Upload files, logs, and chat history. System analyzes them to resolve disputes.",
      icon: Gavel,
      tooltip: "Data-driven Justice",
    },
    {
      title: "Explainable Decisions",
      desc: "Every automated decision comes with a generated audit log explaining the 'Why'.",
      icon: FileSearch,
      tooltip: "Transparent Audit Trail",
    },
    {
      title: "Platform API Integration",
      desc: "Connect your existing marketplace to our trust engine via simple REST hooks.",
      icon: Plug,
      tooltip: "Coming Soon",
    },
    {
      title: "Role-Based Access",
      desc: "Granular permissions for Freelancers, Clients, Mediators, and Admins.",
      icon: Users,
      tooltip: "Secure Authorization",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-6 md:p-12 relative overflow-hidden">
      <AuroraBackground />
      
      <div className="relative z-10 max-w-7xl mx-auto">
        <Button variant="ghost" className="mb-8 pl-0" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>

        <div className="text-center mb-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6 tracking-tight">Platform Features</h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Comprehensive tools for enforceable digital agreements, designed for anonymity and trust.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((item, idx) => (
            <SpotlightCard key={idx} className="group !p-8 h-full">
              <div className="flex justify-between items-start mb-6">
                <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300 shadow-sm">
                  <item.icon className="w-7 h-7" />
                </div>
                <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider">
                    {item.tooltip}
                </span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">{item.title}</h3>
              <p className="text-slate-500 leading-relaxed text-sm">{item.desc}</p>
            </SpotlightCard>
          ))}
        </div>
      </div>
    </div>
  );
}