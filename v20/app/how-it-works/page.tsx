'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { FilePlus, Lock, Flag, PackageCheck, BrainCircuit, CheckCircle, ArrowLeft } from 'lucide-react';
// اصلاح مسیر: دو پله به عقب
import { Button, AuroraBackground } from '../../components/ui/shared';

export default function HowItWorksPage() {
  const router = useRouter();

  const steps = [
    { id: 1, title: 'Transaction Created', icon: FilePlus, desc: 'Project terms and budget agreed upon.' },
    { id: 2, title: 'Funds Locked', icon: Lock, desc: 'Client deposits funds into secure escrow.' },
    { id: 3, title: 'Milestones Defined', icon: Flag, desc: 'Work broken down into verifiable steps.' },
    { id: 4, title: 'Delivery Submitted', icon: PackageCheck, desc: 'Freelancer uploads evidence of work.' },
    { id: 5, title: 'System Evaluates', icon: BrainCircuit, desc: 'AI analyzes delivery against requirements.' },
    { id: 6, title: 'Auto Release', icon: CheckCircle, desc: 'Funds released or dispute raised instantly.' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-6 md:p-12 relative overflow-hidden">
      <AuroraBackground />
      
      <div className="relative z-10 max-w-7xl mx-auto">
        <Button variant="ghost" className="mb-8 pl-0" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>

        <div className="text-center mb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4 tracking-tight">How It Works</h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">Automated trust from agreement to payout.</p>
        </div>

        {/* Desktop Horizontal Timeline */}
        <div className="hidden lg:flex justify-between items-start relative mt-12">
          {/* Connecting Line */}
          <div className="absolute top-8 left-0 w-full h-1 bg-gradient-to-r from-slate-200 via-blue-200 to-slate-200 -z-10 rounded-full" />
          
          {steps.map((step) => (
            <div key={step.id} className="relative flex flex-col items-center w-48 group cursor-pointer">
              <div className="w-16 h-16 bg-white border-4 border-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:border-blue-100 group-hover:text-blue-600 group-hover:scale-110 transition-all duration-300 shadow-lg z-10 mb-6">
                <step.icon className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">{step.title}</h3>
              <p className="text-xs text-center text-slate-500 px-2 leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>

        {/* Mobile Vertical Timeline */}
        <div className="lg:hidden space-y-12 relative pl-8 border-l-2 border-slate-200 ml-4">
          {steps.map((step) => (
            <motion.div 
              key={step.id}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="relative pl-8"
            >
              <div className="absolute -left-[42px] top-0 w-12 h-12 bg-white border-2 border-slate-100 rounded-xl flex items-center justify-center text-blue-600 shadow-md">
                <step.icon className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">{step.title}</h3>
              <p className="text-slate-600 text-sm leading-relaxed">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}