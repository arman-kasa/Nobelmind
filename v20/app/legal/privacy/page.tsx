'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Shield, EyeOff, Lock, Database, Server, FileText } from 'lucide-react';
// اصلاح مسیر: سه پله به عقب (app/legal/privacy -> root)
import { Button, AuroraBackground, SpotlightCard, Badge } from '../../../components/ui/shared';

export default function PrivacyPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-6 md:p-12 relative overflow-hidden">
      <AuroraBackground />
      
      <div className="relative z-10 max-w-4xl mx-auto">
        <Button variant="ghost" className="mb-8 pl-0" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>

        <div className="text-center mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="inline-flex items-center justify-center p-3 bg-blue-100 rounded-2xl mb-6">
                <Shield className="w-8 h-8 text-blue-600" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4 tracking-tight">Privacy Policy</h1>
            <p className="text-lg text-slate-600">Your identity is yours alone. We protect the data that matters.</p>
            <div className="mt-4">
                <Badge variant="outline" className="bg-white/50 backdrop-blur">Last updated: December 2025</Badge>
            </div>
        </div>

        <div className="space-y-6">
            <SpotlightCard className="!p-8">
                <p className="text-slate-600 leading-relaxed text-lg">
                    At Nobel Mind, we believe in <strong>Zero-Knowledge Architecture</strong>. We don't just promise privacy; we build our infrastructure so that we cannot know your real identity even if we wanted to. This policy outlines the minimal data we touch.
                </p>
            </SpotlightCard>

            <div className="grid md:grid-cols-2 gap-6">
                <SpotlightCard className="!p-6 h-full">
                    <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center mb-4 text-emerald-600">
                        <Database className="w-5 h-5" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-2">1. Minimal Data Collection</h3>
                    <p className="text-sm text-slate-500 leading-relaxed">
                        We collect transaction metadata, behavioral signals (interaction patterns), and uploaded evidence files solely for the purpose of contract enforcement and dispute resolution. We do not collect names, addresses, or phone numbers.
                    </p>
                </SpotlightCard>

                <SpotlightCard className="!p-6 h-full">
                    <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center mb-4 text-purple-600">
                        <EyeOff className="w-5 h-5" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-2">2. No Identity Resale</h3>
                    <p className="text-sm text-slate-500 leading-relaxed">
                        Your personal identity and financial data are never sold to third-party advertisers. We operate a strict "No-Ad" model. Your "FreeLancer or Client ID" is the only public identifier.
                    </p>
                </SpotlightCard>

                <SpotlightCard className="!p-6 h-full">
                    <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center mb-4 text-blue-600">
                        <Lock className="w-5 h-5" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-2">3. Military-Grade Encryption</h3>
                    <p className="text-sm text-slate-500 leading-relaxed">
                        All sensitive evidence files and financial details are encrypted at rest using AES-256 and in transit via TLS 1.3. Direct messages are End-to-End encrypted.
                    </p>
                </SpotlightCard>

                <SpotlightCard className="!p-6 h-full">
                    <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center mb-4 text-amber-600">
                        <Server className="w-5 h-5" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-2">4. Retention & Purging</h3>
                    <p className="text-sm text-slate-500 leading-relaxed">
                        Transaction records are retained for 7 years for legal compliance (smart contract logs). Dispute evidence files are retained for 1 year after case closure, then permanently purged from our storage buckets.
                    </p>
                </SpotlightCard>
            </div>

            <div className="bg-slate-900 text-slate-300 p-8 rounded-3xl text-center mt-8">
                <FileText className="w-8 h-8 mx-auto mb-4 text-slate-500" />
                <p className="text-sm">
                    For specific data removal requests (Right to be Forgotten), please contact our legal DAO using your FreeLancer or Client ID signature.<br/>
                    We cannot recover accounts if you lose your recovery phrase.
                </p>
            </div>
        </div>
      </div>
    </div>
  );
}