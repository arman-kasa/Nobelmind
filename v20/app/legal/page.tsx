'use client'

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

export default function LegalPage() {
  return (
    <div className="min-h-screen bg-white pt-24 pb-20">
      <div className="max-w-3xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-slate-900 mb-8">Legal Center</h1>
        
        <div className="bg-slate-50 rounded-2xl border border-slate-200 divide-y divide-slate-200">
          <Link href="/legal/privacy" className="flex items-center justify-between p-6 hover:bg-slate-100 transition-colors">
            <div>
              <h3 className="font-semibold text-slate-900 text-lg">Privacy Policy</h3>
              <p className="text-slate-500 text-sm mt-1">Data collection, encryption, and retention policies.</p>
            </div>
            <ChevronRight className="text-slate-400" />
          </Link>
          
          <Link href="/legal/terms" className="flex items-center justify-between p-6 hover:bg-slate-100 transition-colors">
            <div>
              <h3 className="font-semibold text-slate-900 text-lg">Terms of Service</h3>
              <p className="text-slate-500 text-sm mt-1">Platform rules, liability, and dispute escalation.</p>
            </div>
            <ChevronRight className="text-slate-400" />
          </Link>

          <div className="flex items-center justify-between p-6 hover:bg-slate-100 transition-colors cursor-pointer">
            <div>
              <h3 className="font-semibold text-slate-900 text-lg">Escrow Agreement Summary</h3>
              <p className="text-slate-500 text-sm mt-1">PDF Download (Coming Soon)</p>
            </div>
            <span className="text-xs font-medium bg-slate-200 text-slate-600 px-2 py-1 rounded">PDF</span>
          </div>
        </div>
      </div>
    </div>
  )
}