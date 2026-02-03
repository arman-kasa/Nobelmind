'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Scale, Gavel, Clock, CheckSquare, ShieldAlert } from 'lucide-react';
// اصلاح مسیر: سه پله به عقب (app/legal/terms -> root)
import { Button, AuroraBackground, SpotlightCard, Badge } from '../../../components/ui/shared';

export default function TermsPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-6 md:p-12 relative overflow-hidden">
      <AuroraBackground />
      
      <div className="relative z-10 max-w-4xl mx-auto">
        <Button variant="ghost" className="mb-8 pl-0" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>

        <div className="text-center mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="inline-flex items-center justify-center p-3 bg-indigo-100 rounded-2xl mb-6">
                <Scale className="w-8 h-8 text-indigo-600" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4 tracking-tight">Terms of Service</h1>
            <p className="text-lg text-slate-600">The rules of engagement for a trustless world.</p>
            <div className="mt-4">
                <Badge variant="outline" className="bg-white/50 backdrop-blur">Effective Date: January 1, 2025</Badge>
            </div>
        </div>

        <div className="space-y-6">
            <SpotlightCard className="!p-8 bg-white/60 backdrop-blur-md">
                <p className="text-slate-700 leading-relaxed text-lg">
                    By using the Nobel Mind platform, you agree that code is law where applicable, and our dispute resolution policies govern where human judgment is required. Please read carefully.
                </p>
            </SpotlightCard>

            <div className="grid gap-6">
                {/* Section 1 */}
                <div className="bg-white rounded-2xl p-6 md:p-8 border border-slate-200 shadow-sm flex gap-6 items-start hover:shadow-md transition-shadow">
                    <div className="hidden md:flex w-12 h-12 bg-slate-100 rounded-xl items-center justify-center flex-shrink-0 text-slate-500">
                        <CheckSquare className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-slate-900 mb-2">1. Platform Role & Neutrality</h3>
                        <p className="text-slate-600 leading-relaxed text-sm">
                            The Platform acts as a neutral decision engine and escrow agent, not as an arbitrator of subjective taste. Our decisions are based on the objective evidence provided (logs, files, chat history). We facilitate the transaction but do not employ the freelancers.
                        </p>
                    </div>
                </div>

                {/* Section 2 */}
                <div className="bg-white rounded-2xl p-6 md:p-8 border border-slate-200 shadow-sm flex gap-6 items-start hover:shadow-md transition-shadow">
                    <div className="hidden md:flex w-12 h-12 bg-slate-100 rounded-xl items-center justify-center flex-shrink-0 text-slate-500">
                        <Gavel className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-slate-900 mb-2">2. Automated Enforcement</h3>
                        <p className="text-slate-600 leading-relaxed text-sm">
                            You acknowledge that funds may be released or refunded automatically based on the pre-defined rules and the outcome of the Automated Dispute Resolution system. Once a smart contract executes a payout, it is irreversible.
                        </p>
                    </div>
                </div>

                {/* Section 3 */}
                <div className="bg-white rounded-2xl p-6 md:p-8 border border-slate-200 shadow-sm flex gap-6 items-start hover:shadow-md transition-shadow">
                    <div className="hidden md:flex w-12 h-12 bg-red-50 rounded-xl items-center justify-center flex-shrink-0 text-red-500">
                        <ShieldAlert className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-slate-900 mb-2">3. Limited Liability</h3>
                        <p className="text-slate-600 leading-relaxed text-sm">
                            We are not liable for losses resulting from incorrect data input by users (e.g., wrong wallet address), third-party banking failures, or protocol exploits outside our control. Our liability is capped at the service fee collected for the disputed transaction.
                        </p>
                    </div>
                </div>

                {/* Section 4 */}
                <div className="bg-white rounded-2xl p-6 md:p-8 border border-slate-200 shadow-sm flex gap-6 items-start hover:shadow-md transition-shadow">
                    <div className="hidden md:flex w-12 h-12 bg-amber-50 rounded-xl items-center justify-center flex-shrink-0 text-amber-500">
                        <Clock className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-slate-900 mb-2">4. Dispute Escalation & Appeals</h3>
                        <p className="text-slate-600 leading-relaxed text-sm">
                            Users may appeal an automated decision within 48 hours. Appeals are reviewed by a human mediator (DAO member) and incur an additional processing fee of 5% or $50, whichever is higher, payable by the losing party.
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex justify-center mt-12">
                <p className="text-xs text-slate-400">
                    If you do not agree with these terms, please disconnect your wallet and cease using the platform immediately.
                </p>
            </div>
        </div>
      </div>
    </div>
  );
}