// [FILE: V13/components/milestone/MilestoneModal.tsx]
'use client';

import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, Calendar, DollarSign, FileText, Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/shared';
// This import works because we added it to actions.ts
import { createMilestoneAction } from '@/app/actions';

interface MilestoneModalProps {
    isOpen: boolean;
    onClose: () => void;
    projectId: string;
}

export default function MilestoneModal({ isOpen, onClose, projectId }: MilestoneModalProps) {
    const [title, setTitle] = useState('');
    const [amount, setAmount] = useState('');
    const [calculatedTotal, setCalculatedTotal] = useState<string>('0.00');
    const [date, setDate] = useState('');
    const [deliverables, setDeliverables] = useState('');
    const [loading, setLoading] = useState(false);

    // Fee Configuration (5%)
    const FEE_PERCENTAGE = 0.01; 

    // Update calculated total whenever amount changes
    useEffect(() => {
        if (!amount || isNaN(parseFloat(amount))) {
            setCalculatedTotal('0.00');
            return;
        }
        
        const numericAmount = parseFloat(amount);
        // Formula: Total = Amount / (1 - Fee)
        // This ensures that after fee deduction, the freelancer gets exactly the entered amount.
        // Example: Want 100 USDT. Fee 5%.
        // Total to Deposit = 100 / 0.95 = 105.263...
        // Check: 105.26 * 5% = 5.26. Remaining = 100.
        const totalRequired = numericAmount / (1 - FEE_PERCENTAGE);
        
        // Round to 2 decimal places for display, but keep precision for logic if needed
        setCalculatedTotal(totalRequired.toFixed(2));
    }, [amount]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title || !amount || !date) {
            alert("Please fill all required fields");
            return;
        }

        const numericAmount = parseFloat(amount);
        if (isNaN(numericAmount) || numericAmount <= 0) {
             alert("Please enter a valid amount");
             return;
        }

        setLoading(true);
        
        try {
            // NOTE: We send the 'net' amount (freelancer share) to the backend/smart contract action.
            // The Smart Contract or Frontend logic during deposit will calculate the required total 
            // (Net + Fee) based on this net amount.
            // However, to be safe and clear, we usually store the "Project Budget" as the gross amount.
            // But based on your previous issue, the contract deducts fee from what is sent.
            // So here we create the milestone with the NET amount (what freelancer sees).
            // The 'deposit' logic in page.tsx will need to handle the gross up if needed, 
            // OR we store the Gross Amount here.
            
            // Let's store the NET amount as that's what the milestone value IS for the freelancer.
            
            const result = await createMilestoneAction(
                projectId,
                title,
                numericAmount, // Sending the NET amount
                new Date(date).toISOString(), 
                deliverables || '' 
            );

            if (result?.error) {
                alert(result.error);
            } else {
                // Success - Close modal (page will redirect/refresh from action)
                // Reset form
                setTitle('');
                setAmount('');
                setCalculatedTotal('0.00');
                setDate('');
                setDeliverables('');
                onClose();
            }
        } catch (err) {
            console.error("Failed to create milestone:", err);
            alert("An unexpected error occurred.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col overflow-hidden">
                
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                            <Plus className="w-5 h-5 text-[#1F3C88]" /> Add New Milestone
                        </h2>
                        <p className="text-xs text-slate-500">Define a new phase of work and its value.</p>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    
                    {/* Title */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">Milestone Title</label>
                        <input 
                            type="text" 
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                            placeholder="e.g. Backend API Development"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                        />
                    </div>

                    {/* Amount & Date Row */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 flex items-center gap-1">
                                <DollarSign className="w-3 h-3"/> Amount (Net)
                            </label>
                            <input 
                                type="number" 
                                min="1"
                                step="0.01"
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none transition-all font-mono"
                                placeholder="0.00"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                            />
                            <p className="text-[10px] text-slate-400 mt-1">Freelancer receives this.</p>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 flex items-center gap-1">
                                <Calendar className="w-3 h-3"/> Due Date
                            </label>
                            <input 
                                type="date" 
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Deliverables */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 flex items-center gap-1">
                            <FileText className="w-3 h-3"/> Expected Deliverables
                        </label>
                        <textarea 
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all min-h-[100px] resize-none"
                            placeholder="Describe what needs to be delivered for this milestone to be marked complete..."
                            value={deliverables}
                            onChange={(e) => setDeliverables(e.target.value)}
                        />
                    </div>

                    {/* Info Box with Fee Calculation */}
                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 space-y-2">
                        <div className="flex items-start gap-3">
                            <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                            <p className="text-xs text-blue-800 leading-relaxed">
                                <strong>Smart Contract Lock:</strong> The funds will be securely locked on Polygon. 
                                A 5% platform fee is applied.
                            </p>
                        </div>
                        
                        {/* Cost Breakdown */}
                        {parseFloat(amount) > 0 && (
                            <div className="mt-2 pt-2 border-t border-blue-200/50 flex flex-col gap-1 text-xs">
                                <div className="flex justify-between text-blue-700">
                                    <span>Freelancer Amount:</span>
                                    <span className="font-mono">{parseFloat(amount).toFixed(2)} USDT</span>
                                </div>
                                <div className="flex justify-between text-blue-700">
                                    <span>Platform Fee (~5%):</span>
                                    <span className="font-mono">{(parseFloat(calculatedTotal) - parseFloat(amount)).toFixed(2)} USDT</span>
                                </div>
                                <div className="flex justify-between font-bold text-blue-900 text-sm pt-1">
                                    <span>Total to Deposit:</span>
                                    <span className="font-mono">{calculatedTotal} USDT</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                        <Button 
                            type="button" 
                            variant="ghost" 
                            onClick={onClose}
                            className="flex-1"
                        >
                            Cancel
                        </Button>
                        <Button 
                            type="submit" 
                            className="flex-1 bg-[#1F3C88] hover:bg-[#162a60] text-white shadow-lg shadow-blue-900/10"
                            disabled={loading}
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                            {loading ? 'Creating...' : 'Create Milestone'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}