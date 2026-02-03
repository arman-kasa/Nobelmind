// [FILE: app/dashboard/projects/[id]/page.tsx]
'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { ethers } from 'ethers'; // Client-Side Web3 Interaction (Ethers v6)
import { 
    ArrowLeft, Send, Lock, CheckCircle, AlertTriangle, 
    Shield, User, DollarSign, Star, MessageSquare, 
    X, Check, Eye, Trash2, CreditCard, 
    FileText, Gift, Loader2, Copy ,ExternalLink, 
    RefreshCw, LayoutList, Clock, ArrowRight, Briefcase, 
    Ban, Scale, Building, MapPin, Globe, Info, HelpCircle, 
    ChevronRight, Paperclip, MoreVertical, Flag, Upload, 
    Download, CheckCircle2, Wallet, ChevronDown,
    FileIcon, DownloadCloud
} from 'lucide-react';

// Shared UI Components (Mocked imports based on context)
import { Button, Badge, SpotlightCard, useToast } from '@/components/ui/shared';
// Milestone Card Component
import { MilestoneCard, Milestone as MilestoneType, MilestoneStatus } from '@/components/milestone/MilestoneCard'; 

// Server Actions
import { 
    verifyDepositAction, 
    initiateDepositAction, 
    rejectProposalAction, 
    cancelProjectAction, 
    createDisputeAction, 
    sendMessageAction,
    updateMilestoneStatusAction, 
    acceptProposalAction, 
    approveMilestoneAction,
    registerDepositTxAction,
    saveProjectFilesAction, 
    getProjectFilesAction,
    requestRevisionAction
} from '@/app/actions'; 

// =================================================================
// 1. TYPE DEFINITIONS & INTERFACES
// =================================================================

/**
 * Represents a user's public profile data linked to a proposal.
 */
interface UserProfile {
    id: string;
    ghost_id: string;
    full_name?: string;
    role: string;
    trust_score: number;
    experience_years?: number;
    projects_completed?: number;
    bio?: string;
    skills?: string[];
    avatar_url?: string;
    wallet_address?: string; // Required for Smart Contract Deposit
}

/**
 * Represents a proposal submitted by a freelancer.
 */
interface Proposal {
    id: string;
    project_id: string;
    freelancer_id: string;
    cover_letter: string;
    proposed_budget: number;
    timeline: string;
    status: 'pending' | 'accepted' | 'rejected';
    proposed_milestones?: any[];
    profile?: UserProfile;
    created_at: string;
}

/**
 * Represents the main Project entity.
 */
interface Project {
    id: string;
    title: string;
    description: string;
    budget: number;
    status: 'open' | 'hired' | 'in_progress' | 'review' | 'completed' | 'cancelled' | 'disputed';
    client_id: string;
    freelancer_id?: string;
    skills_required: string[];
    escrow_status: 'none' | 'locked' | 'released' | 'refunded' | 'disputed';
    deposit_address?: string;
    wallet_index?: number;
    created_at: string;
    deadline?: string;
    deposit_tx_hash?: string;
}

/**
 * Represents a chat message.
 * Updated to include 'proposal' and 'workspace' types for chat isolation.
 */
interface Message {
    id: number;
    content: string;
    sender_id: string;
    recipient_id?: string;
    created_at: string;
    type: 'text' | 'system' | 'dispute' | 'proposal' | 'workspace'; 
}

/**
 * Scope Definition for Chat Context
 */
type ChatScope = 'proposal' | 'workspace' | 'dispute';

// =================================================================
// 2. SUB-COMPONENTS (UI MODULES)
// =================================================================

/**
 * 2.1 DISPUTE MODAL (UPDATED)
 * Now supports selecting a specific milestone or raising a global project dispute.
 */
interface DisputeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (subject: string, description: string, milestoneId?: string) => Promise<void>;
    submitting: boolean;
    milestones: MilestoneType[];
}

const DisputeModal = ({ isOpen, onClose, onSubmit, submitting, milestones }: DisputeModalProps) => {
    const [subject, setSubject] = useState('');
    const [description, setDescription] = useState('');
    const [disputeType, setDisputeType] = useState<'project' | 'milestone'>('project');
    const [selectedMilestoneId, setSelectedMilestoneId] = useState<string>('');

    useEffect(() => {
        if (isOpen) {
            setSubject('');
            setDescription('');
            setDisputeType('project');
            setSelectedMilestoneId('');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSubmit = () => {
        if (disputeType === 'milestone' && !selectedMilestoneId) return;
        onSubmit(subject, description, disputeType === 'milestone' ? selectedMilestoneId : undefined);
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden transform transition-all scale-100 flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="bg-red-50 p-5 md:p-6 border-b border-red-100 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="bg-red-100 p-2 rounded-full border border-red-200">
                            <Flag className="w-5 h-5 text-red-600"/>
                        </div>
                        <h3 className="text-lg font-bold text-red-900">Report an Issue</h3>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="text-slate-400 hover:text-slate-600 transition-colors p-2 hover:bg-red-100 rounded-full"
                    >
                        <X className="w-5 h-5"/>
                    </button>
                </div>

                {/* Body - Scrollable */}
                <div className="p-5 md:p-6 space-y-5 overflow-y-auto">
                    <div className="bg-red-50/50 p-3 rounded-lg border border-red-100 text-xs text-red-800 flex items-start gap-2">
                        <Info className="w-4 h-4 shrink-0 mt-0.5" />
                        <p>
                            Raising a dispute will notify administrators and <b>freeze relevant funds</b> until resolved. 
                            Please provide detailed evidence in the chat room after submission.
                        </p>
                    </div>

                    {/* Dispute Scope Selection */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase mb-2 ml-1">Dispute Scope</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setDisputeType('project')}
                                className={`p-3 rounded-xl border text-sm font-bold transition-all ${
                                    disputeType === 'project' 
                                    ? 'bg-red-50 border-red-300 text-red-700 ring-1 ring-red-200' 
                                    : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                                }`}
                            >
                                Full Project
                                <span className="block text-[10px] font-normal opacity-70 mt-1">Freezes entire budget</span>
                            </button>
                            <button
                                onClick={() => setDisputeType('milestone')}
                                className={`p-3 rounded-xl border text-sm font-bold transition-all ${
                                    disputeType === 'milestone' 
                                    ? 'bg-red-50 border-red-300 text-red-700 ring-1 ring-red-200' 
                                    : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                                }`}
                            >
                                Specific Milestone
                                <span className="block text-[10px] font-normal opacity-70 mt-1">Freezes specific amount</span>
                            </button>
                        </div>
                    </div>

                    {/* Milestone Selector (Conditional) */}
                    {disputeType === 'milestone' && (
                        <div className="animate-in fade-in slide-in-from-top-2">
                            <label className="block text-xs font-bold text-slate-700 uppercase mb-1 ml-1">Select Milestone</label>
                            <div className="relative">
                                <select
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-red-400 focus:ring-1 focus:ring-red-200 appearance-none"
                                    value={selectedMilestoneId}
                                    onChange={(e) => setSelectedMilestoneId(e.target.value)}
                                >
                                    <option value="" disabled>-- Select a milestone --</option>
                                    {milestones.filter(m => m.status !== 'approved' && m.status !== 'cancelled').map((m) => (
                                        <option key={m.id} value={m.id}>
                                            {m.title} (${m.amount}) - {m.status}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-3 top-3.5 w-4 h-4 text-slate-400 pointer-events-none"/>
                            </div>
                        </div>
                    )}
                    
                    <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1 ml-1">Subject / Reason</label>
                        <input 
                            type="text" 
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-red-400 focus:ring-1 focus:ring-red-200 transition-all placeholder:text-slate-400"
                            placeholder="e.g., Lack of communication, Poor quality deliverables..."
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                        />
                    </div>
                    
                    <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1 ml-1">Detailed Description</label>
                        <textarea 
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-red-400 focus:ring-1 focus:ring-red-200 transition-all min-h-[120px] resize-none placeholder:text-slate-400"
                            placeholder="Describe the issue in detail. Include dates and specific examples..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-slate-50 flex flex-col-reverse md:flex-row justify-end gap-3 border-t border-slate-100 shrink-0">
                    <Button variant="ghost" onClick={onClose} className="hover:bg-slate-200 text-slate-600 font-medium w-full md:w-auto h-11 md:h-10">
                        Cancel
                    </Button>
                    <Button 
                        onClick={handleSubmit} 
                        disabled={submitting || !subject.trim() || !description.trim() || (disputeType === 'milestone' && !selectedMilestoneId)}
                        className="bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-200 font-bold px-6 w-full md:w-auto h-11 md:h-10"
                    >
                        {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : <AlertTriangle className="w-4 h-4 mr-2" />}
                        {submitting ? 'Submitting...' : 'Submit Dispute'}
                    </Button>
                </div>
            </div>
        </div>
    );
};

/**
 * 2.2 PROPOSAL DETAILS MODAL
 * Displays detailed information about a freelancer's proposal and their profile.
 */
const ProposalDetailsModal = ({ isOpen, onClose, proposal, onReject, onHire, onChat }: {
    isOpen: boolean;
    onClose: () => void;
    proposal: Proposal | null;
    onReject: (id: string) => void;
    onHire: (proposal: Proposal) => void;
    onChat: (id: string) => void;
}) => {
    const [viewMode, setViewMode] = useState<'proposal' | 'profile'>('proposal');

    useEffect(() => {
        if (isOpen) setViewMode('proposal');
    }, [isOpen, proposal]);

    if (!isOpen || !proposal) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-0 md:p-4 animate-in fade-in duration-300">
            <div 
                className="bg-white md:rounded-2xl w-full max-w-3xl h-full md:max-h-[85vh] flex flex-col shadow-2xl overflow-hidden transform transition-all"
                role="dialog"
                aria-modal="true"
            >
                {/* Header Section */}
                <div className="p-4 md:p-5 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white sticky top-0 z-10 shrink-0">
                    <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4 w-full md:w-auto">
                        <div className="flex justify-between items-start w-full md:w-auto">
                            <div>
                                <h2 className="text-lg md:text-xl font-bold text-slate-900">
                                    {viewMode === 'proposal' ? 'Proposal Details' : 'Freelancer Profile'}
                                </h2>
                                <p className="text-sm text-slate-500 mt-0.5">
                                    Applicant: <span className="font-bold text-[#1F3C88] bg-blue-50 px-2 py-0.5 rounded text-xs break-all">{proposal.profile?.ghost_id}</span>
                                </p>
                            </div>
                            <button 
                                onClick={onClose} 
                                className="md:hidden p-2 -mr-2 text-slate-400"
                                aria-label="Close Modal"
                            >
                                <X className="w-6 h-6"/>
                            </button>
                        </div>
                        
                        {/* View Switcher Toggle */}
                        <div className="flex bg-slate-100 rounded-lg p-1 border border-slate-200 self-start md:self-auto w-full md:w-auto">
                            <button 
                                onClick={() => setViewMode('proposal')}
                                className={`flex-1 md:flex-none px-4 py-1.5 text-xs font-bold rounded-md transition-all duration-200 text-center ${
                                    viewMode === 'proposal' 
                                    ? 'bg-white shadow-sm text-[#1F3C88] ring-1 ring-black/5' 
                                    : 'text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                Proposal
                            </button>
                            <button 
                                onClick={() => setViewMode('profile')}
                                className={`flex-1 md:flex-none px-4 py-1.5 text-xs font-bold rounded-md transition-all duration-200 text-center ${
                                    viewMode === 'profile' 
                                    ? 'bg-white shadow-sm text-[#1F3C88] ring-1 ring-black/5' 
                                    : 'text-slate-500 hover:text-slate-700'
                                }`}
                            >
                                View Profile
                            </button>
                        </div>
                    </div>
                    
                    <button 
                        onClick={onClose} 
                        className="hidden md:block p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                        aria-label="Close Modal"
                    >
                        <X className="w-5 h-5"/>
                    </button>
                </div>

                {/* Scrollable Body Content */}
                <div className="p-4 md:p-6 space-y-6 flex-1 overflow-y-auto bg-[#F8FAFC]">
                    
                    {viewMode === 'proposal' ? (
                        <div className="space-y-6 animate-in slide-in-from-right-2 duration-300">
                            {/* Cover Letter Section */}
                            <div className="bg-white p-4 md:p-6 rounded-xl border border-slate-200 shadow-sm">
                                <h4 className="text-xs font-bold text-slate-500 uppercase mb-4 flex items-center gap-2 border-b border-slate-100 pb-2">
                                    <FileText className="w-4 h-4 text-blue-500"/> Cover Letter
                                </h4>
                                <p className="text-sm text-slate-700 leading-7 whitespace-pre-wrap font-medium">
                                    {proposal.cover_letter}
                                </p>
                            </div>

                            {/* Key Stats Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="p-5 border border-slate-200 rounded-xl bg-white shadow-sm flex flex-col justify-center">
                                    <span className="text-xs text-slate-400 block mb-1 uppercase tracking-wider font-semibold">Total Bid Amount</span>
                                    <div className="flex items-center gap-2">
                                        <DollarSign className="w-5 h-5 text-emerald-500" />
                                        <span className="text-2xl font-bold text-slate-900">${proposal.proposed_budget.toLocaleString()}</span>
                                    </div>
                                </div>
                                <div className="p-5 border border-slate-200 rounded-xl bg-white shadow-sm flex flex-col justify-center">
                                    <span className="text-xs text-slate-400 block mb-1 uppercase tracking-wider font-semibold">Estimated Timeline</span>
                                    <div className="flex items-center gap-2">
                                        <Clock className="w-5 h-5 text-blue-500" />
                                        <span className="text-2xl font-bold text-slate-900">{proposal.timeline}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Milestones Table - Responsive Wrapper */}
                            <div>
                                <h4 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-2">
                                    <LayoutList className="w-4 h-4 text-purple-500"/> Proposed Milestones
                                </h4>
                                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-left min-w-[500px]">
                                            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                                                <tr>
                                                    <th className="p-4 w-1/4 whitespace-nowrap">Phase Title</th>
                                                    <th className="p-4 w-1/6 whitespace-nowrap">Amount</th>
                                                    <th className="p-4 w-1/6 whitespace-nowrap">Est. Days</th>
                                                    <th className="p-4 min-w-[200px]">Deliverables</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {proposal.proposed_milestones && proposal.proposed_milestones.length > 0 ? (
                                                    proposal.proposed_milestones.map((m: any, idx: number) => (
                                                        <tr key={idx} className="bg-white hover:bg-slate-50 transition-colors">
                                                            <td className="p-4 font-bold text-slate-900">{m.title}</td>
                                                            <td className="p-4">
                                                                <span className="font-mono text-[#1F3C88] bg-blue-50 px-2 py-1 rounded font-bold">
                                                                    ${m.amount}
                                                                </span>
                                                            </td>
                                                            <td className="p-4 text-slate-600">
                                                                {m.days || m.duration || '7'} Days
                                                            </td>
                                                            <td className="p-4 text-slate-500 text-xs">
                                                                {m.deliverables || "Standard deliverables included."}
                                                            </td>
                                                        </tr>
                                                    ))
                                                ) : (
                                                    <tr>
                                                        <td colSpan={4} className="p-6 text-center text-slate-400 italic">
                                                            No specific milestones broken down.
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        // PROFILE VIEW
                        <div className="space-y-6 animate-in slide-in-from-right-2 duration-300">
                             <div className="flex flex-col md:flex-row items-center gap-6 mb-6 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                <div className="w-20 h-20 md:w-24 md:h-24 bg-gradient-to-br from-[#1F3C88] to-[#2E5BCC] rounded-full flex items-center justify-center text-white text-3xl md:text-4xl font-bold shadow-lg shrink-0">
                                    {proposal.profile?.ghost_id?.substring(0, 1) || "U"}
                                </div>
                                <div className="text-center md:text-left">
                                    <h3 className="text-xl md:text-2xl font-bold text-slate-900 break-all">{proposal.profile?.full_name || 'Anonymous User'}</h3>
                                    <p className="text-slate-500 font-mono text-sm mb-3">@{proposal.profile?.ghost_id}</p>
                                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                                            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-emerald-200">
                                                <Shield className="w-3 h-3 mr-1"/> Trust Score: {proposal.profile?.trust_score || 0}/100
                                            </Badge>
                                            <Badge variant="outline" className="text-slate-600 border-slate-300 bg-slate-50">
                                                {proposal.profile?.role || 'Freelancer'}
                                            </Badge>
                                    </div>
                                </div>
                             </div>

                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm hover:border-blue-200 transition-colors">
                                    <div className="flex items-center gap-2 mb-2 text-slate-500">
                                        <Briefcase className="w-4 h-4 text-blue-500"/> <span className="text-xs font-bold uppercase">Experience</span>
                                    </div>
                                    <p className="font-bold text-xl text-slate-800">{proposal.profile?.experience_years || 0} <span className="text-sm font-normal text-slate-500">Years</span></p>
                                </div>
                                <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm hover:border-blue-200 transition-colors">
                                    <div className="flex items-center gap-2 mb-2 text-slate-500">
                                        <Globe className="w-4 h-4 text-purple-500"/> <span className="text-xs font-bold uppercase">Completed Projects</span>
                                    </div>
                                    <p className="font-bold text-xl text-slate-800">{proposal.profile?.projects_completed || 0} <span className="text-sm font-normal text-slate-500">Jobs</span></p>
                                </div>
                             </div>

                             <div className="bg-white p-6 border border-slate-200 rounded-xl shadow-sm">
                                <h4 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                                    <User className="w-4 h-4 text-slate-400"/> Bio & Skills
                                </h4>
                                <p className="text-slate-600 text-sm mb-6 leading-relaxed bg-slate-50 p-4 rounded-lg border border-slate-100">
                                    {proposal.profile?.bio || "This user has not added a bio yet."}
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {proposal.profile?.skills && proposal.profile.skills.length > 0 ? (
                                        proposal.profile.skills.map((skill: string) => (
                                            <Badge key={skill} variant="secondary" className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 shadow-sm">{skill}</Badge>
                                        ))
                                    ) : <span className="text-slate-400 text-xs italic">No specific skills tags listed</span>}
                                </div>
                             </div>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="p-4 md:p-5 border-t border-slate-200 flex flex-col md:flex-row gap-3 justify-end bg-white sticky bottom-0 z-10 shrink-0">
                    <Button 
                        onClick={() => onReject(proposal.id)} 
                        variant="outline" 
                        className="order-3 md:order-1 text-red-500 border-red-200 hover:bg-red-50 hover:text-red-600 transition-colors h-11 md:h-10 w-full md:w-auto"
                    >
                        <Ban className="w-4 h-4 mr-2"/> Reject Proposal
                    </Button>
                    <Button 
                        onClick={() => onChat(proposal.freelancer_id)} 
                        variant="outline" 
                        className="order-2 md:order-2 text-[#1F3C88] border-[#1F3C88]/30 hover:bg-blue-50 transition-colors h-11 md:h-10 w-full md:w-auto"
                    >
                        <MessageSquare className="w-4 h-4 mr-2"/> Chat Before Hiring
                    </Button>
                    <Button 
                        onClick={() => onHire(proposal)} 
                        className="order-1 md:order-3 bg-[#1F3C88] text-white px-8 hover:bg-[#162a60] shadow-lg shadow-blue-900/20 transition-all active:scale-95 h-11 md:h-10 w-full md:w-auto"
                    >
                        <Check className="w-4 h-4 mr-2"/> Hire Freelancer
                    </Button>
                </div>
            </div>
        </div>
    );
};

/**
 * 2.3 CRYPTO DEPOSIT CARD (FINAL ROBUST VERSION)
 * Automatically adds the 5% fee on top of the budget so the freelancer gets the full amount.
 * Validates Wallet, Network (Polygon), and Token Approval.
 */
const CryptoDepositCard = ({ project, freelancerAddress, onCheckDeposit }: { project: Project, freelancerAddress: string | undefined, onCheckDeposit: () => Promise<void> }) => {
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [checking, setChecking] = useState(false);
    const [step, setStep] = useState<'connect' | 'approve' | 'deposit' | 'verifying'>('connect');
    const [txHash, setTxHash] = useState<string | null>(null);
    const [manualCheckLoading, setManualCheckLoading] = useState(false);

    // POLYGON MAINNET CONFIG
    const USDT_ADDRESS = "0xc2132D05D31c914a87C6611C10748AEb04B58e8F"; 
    const ESCROW_ADDRESS = process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ADDRESS; 
    const PLATFORM_FEE_PERCENT = 0.05; // 5% Fee

    const ERC20_ABI = [
        "function approve(address spender, uint256 amount) public returns (bool)",
        "function allowance(address owner, address spender) public view returns (uint256)",
        "function balanceOf(address owner) view returns (uint256)"
    ];
    const ESCROW_ABI = [
        "function deposit(string projectId, address freelancer, uint256 amount) external"
    ];

    // CALCULATIONS: Gross Up Logic
    // Formula: Total = Budget / (1 - FeeRate)
    const netBudget = project.budget;
    const grossTotal = netBudget / (1 - PLATFORM_FEE_PERCENT);
    const platformFee = grossTotal - netBudget;

    const getGrossAmountWei = () => {
        // Use 6 decimals for USDT and toFixed(6) to ensure precision
        return ethers.parseUnits(grossTotal.toFixed(6), 6);
    };

    // Manual Verification Handler
    const handleManualVerify = async () => {
        setManualCheckLoading(true);
        try {
            showToast("Checking Blockchain... This may take a moment.", "info");
            await onCheckDeposit();
        } catch (e) {
            console.error(e);
        } finally {
            setManualCheckLoading(false);
        }
    };

    // Check status on load/connect
    const checkStatus = async (provider: any, userAddress: string) => {
        if (!ESCROW_ADDRESS) {
            console.error("Missing ESCROW ADDRESS");
            return;
        }
        setChecking(true);
        try {
            const usdtContract = new ethers.Contract(USDT_ADDRESS, ERC20_ABI, provider);
            
            // Required amount is the Gross Amount
            const requiredAmount = getGrossAmountWei();
            
            // 1. Check Balance
            const balance = await usdtContract.balanceOf(userAddress);
            if (balance < requiredAmount) {
                showToast(`Insufficient USDT Balance! You need ${grossTotal.toFixed(2)} USDT.`, "error");
            }

            // 2. Check Allowance
            const allowance = await usdtContract.allowance(userAddress, ESCROW_ADDRESS);
            console.log(`Allowance: ${ethers.formatUnits(allowance, 6)} USDT | Required: ${grossTotal.toFixed(2)}`);

            if (allowance >= requiredAmount) {
                setStep('deposit');
            } else {
                setStep('approve');
            }
        } catch (error) {
            console.error("Check Status Error:", error);
        } finally {
            setChecking(false);
        }
    };

    const connectWallet = async () => {
        if (!(window as any).ethereum) {
            alert("Please install MetaMask!");
            return;
        }
        try {
            const provider = new ethers.BrowserProvider((window as any).ethereum);
            await provider.send("eth_requestAccounts", []);
            const signer = await provider.getSigner();
            const network = await provider.getNetwork();
            
            // Force Polygon Chain
            if (network.chainId !== 137n) {
                try {
                    await (window as any).ethereum.request({
                        method: 'wallet_switchEthereumChain',
                        params: [{ chainId: '0x89' }], 
                    });
                } catch (err: any) {
                    if (err.code === 4902) alert("Please add Polygon Network to MetaMask.");
                    return;
                }
            }
            
            await checkStatus(provider, await signer.getAddress());

        } catch (error) {
            console.error("Connection Error:", error);
        }
    };

    const handleApprove = async () => {
        setLoading(true);
        try {
            const provider = new ethers.BrowserProvider((window as any).ethereum);
            const signer = await provider.getSigner();
            const usdtContract = new ethers.Contract(USDT_ADDRESS, ERC20_ABI, signer);
            
            const amountWei = getGrossAmountWei(); // Approve Gross Amount
            
            // Send Approve Transaction
            const tx = await usdtContract.approve(ESCROW_ADDRESS, amountWei);
            showToast("Approval Sent. Waiting for confirmation...", "info");
            
            // CRITICAL: Wait for transaction to be mined
            await tx.wait();
            
            showToast("USDT Approved! You can now deposit.", "success");
            setStep('deposit');
            
        } catch (error: any) {
            console.error("Approval Error:", error);
            showToast("Approval Failed: " + (error.reason || error.message), "error");
        } finally {
            setLoading(false);
        }
    };

    const handleDeposit = async () => {
        // Validation Checks
        if (!ESCROW_ADDRESS) return showToast("System Error: Contract Address Missing", "error");
        
        if (!freelancerAddress || freelancerAddress.length < 42) {
            showToast("Error: Freelancer has not linked a valid wallet yet.", "error");
            return;
        }

        setLoading(true);
        try {
            const provider = new ethers.BrowserProvider((window as any).ethereum);
            const signer = await provider.getSigner();
            const escrowContract = new ethers.Contract(ESCROW_ADDRESS, ESCROW_ABI, signer);
            const usdtContract = new ethers.Contract(USDT_ADDRESS, ERC20_ABI, provider);

            const amountWei = getGrossAmountWei(); // Deposit Gross Amount
            const userAddress = await signer.getAddress();

            // DOUBLE CHECK ALLOWANCE BEFORE CALLING
            const currentAllowance = await usdtContract.allowance(userAddress, ESCROW_ADDRESS);
            if (currentAllowance < amountWei) {
                showToast("Allowance not ready. Please approve again.", "error");
                setStep('approve');
                setLoading(false);
                return;
            }

            console.log("Depositing:", {
                id: project.id,
                freelancer: freelancerAddress,
                amount: amountWei.toString()
            });

            // Call Deposit
            const tx = await escrowContract.deposit(project.id, freelancerAddress, amountWei);
            showToast("Deposit Transaction Sent...", "info");
            setTxHash(tx.hash);
            
            await tx.wait();
            showToast("Deposit Confirmed on Blockchain!", "success");
            setStep('verifying');
            const serverResult = await registerDepositTxAction(
                project.id,
                tx.hash,        // Real TX hash
                project.budget  // Deposited amount
            );
            await onCheckDeposit();

        } catch (error: any) {
            console.error("Deposit Error Details:", error);
            
            // Detailed Error Handling
            if (error.code === 'CALL_EXCEPTION') {
                showToast("Transaction Reverted by Contract. Check if you have enough MATIC for gas or USDT balance.", "error");
            } else {
                showToast("Deposit Failed: " + (error.reason || error.message), "error");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <SpotlightCard className="mb-6 md:mb-8 !bg-gradient-to-br from-[#0F172A] to-[#1E293B] text-white border-0 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#2ECC71]/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
            
            <div className="flex flex-col md:flex-row justify-between items-start mb-6 z-10 relative border-b border-white/10 pb-6 gap-4">
                <div>
                    <h2 className="text-xl font-bold flex items-center gap-2 text-white">
                        <Wallet className="w-6 h-6 text-[#2ECC71]" />
                        Secure Escrow Deposit
                    </h2>
                    <p className="text-slate-400 text-sm mt-2 max-w-lg leading-relaxed">
                        Funds will be locked in the Smart Contract on <b>Polygon Network</b>.
                        <br/>
                        <span className="text-[10px] text-slate-500">Platform fee is included to ensure full payout.</span>
                    </p>
                </div>
                <div className="mt-2 md:mt-0 text-left md:text-right w-full md:w-auto bg-white/5 md:bg-transparent p-3 md:p-0 rounded-lg">
                     <p className="text-xs text-slate-400 uppercase tracking-widest font-bold mb-1">Total To Pay</p>
                     <p className="text-3xl font-bold text-[#2ECC71] font-mono tracking-tight flex items-baseline gap-2 md:justify-end">
                        ${grossTotal.toFixed(2)} <span className="text-sm text-white font-sans">USDT</span>
                     </p>
                     <div className="text-[10px] text-slate-400 mt-1 flex flex-col md:items-end">
                        <span>Project Budget: ${netBudget.toFixed(2)}</span>
                        <span>Platform Fee (5%): ${platformFee.toFixed(2)}</span>
                     </div>
                </div>
            </div>

            <div className="flex flex-col items-center justify-center gap-6 z-10 relative bg-white/5 p-6 md:p-8 rounded-xl border border-white/10">
                
                {/* Status: Freelancer Wallet Missing */}
                {!freelancerAddress && (
                    <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-lg flex items-center gap-3 text-red-200 text-sm w-full">
                        <AlertTriangle className="w-5 h-5 shrink-0" />
                        <div>
                            <strong>Cannot Deposit Yet:</strong> The freelancer has not set up their wallet address in their profile. Please message them to add it.
                        </div>
                    </div>
                )}
                
                <div className="w-full bg-blue-500/10 border border-blue-500/20 p-4 rounded-lg flex flex-col md:flex-row items-center justify-between gap-4 mb-4">
                    <div className="flex items-center gap-2 text-sm text-blue-200">
                        <Info className="w-4 h-4 shrink-0" />
                        <span>Transaction confirmed but screen reset?</span>
                    </div>
                    <Button 
                        onClick={handleManualVerify} 
                        disabled={manualCheckLoading}
                        variant="ghost" 
                        className="text-blue-300 hover:text-white hover:bg-blue-500/20 text-xs h-8 w-full md:w-auto"
                    >
                        {manualCheckLoading ? <Loader2 className="w-3 h-3 animate-spin mr-1"/> : <RefreshCw className="w-3 h-3 mr-1"/>}
                        Check Status Again
                    </Button>
                </div>

                {step === 'connect' && (
                    <Button onClick={connectWallet} disabled={!freelancerAddress} className="w-full max-w-md bg-[#F6851B] hover:bg-[#e2761b] text-white font-bold h-12 shadow-lg">
                        <img src="https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg" className="w-5 h-5 mr-2" alt="MetaMask"/>
                        Connect MetaMask
                    </Button>
                )}

                {step === 'approve' && (
                    <div className="text-center w-full max-w-md space-y-4 animate-in fade-in">
                        {checking ? <Loader2 className="animate-spin w-6 h-6 mx-auto text-blue-400"/> : (
                            <>
                                <div className="p-4 bg-blue-900/30 rounded-lg border border-blue-500/30 text-sm text-blue-100">
                                    Step 1: Approve Smart Contract to spend <b>{grossTotal.toFixed(2)} USDT</b>.
                                </div>
                                <Button onClick={handleApprove} disabled={loading} className="w-full bg-[#1F3C88] hover:bg-[#162a60] text-white font-bold h-12 shadow-lg">
                                    {loading ? <Loader2 className="animate-spin mr-2"/> : `Approve ${grossTotal.toFixed(2)} USDT`}
                                </Button>
                            </>
                        )}
                    </div>
                )}

                {step === 'deposit' && (
                    <div className="text-center w-full max-w-md space-y-4 animate-in fade-in">
                        <div className="p-4 bg-green-900/30 rounded-lg border border-green-500/30 text-sm text-green-100">
                            Step 2: Transfer funds to Escrow.
                        </div>
                        <Button onClick={handleDeposit} disabled={loading} className="w-full bg-[#2ECC71] hover:bg-[#27ae60] text-white font-bold h-12 shadow-lg">
                            {loading ? <Loader2 className="animate-spin mr-2"/> : `Confirm Deposit (${grossTotal.toFixed(2)})`}
                        </Button>
                    </div>
                )}
                
                {step === 'verifying' && (
                     <div className="text-center animate-pulse py-4">
                        <CheckCircle2 className="w-16 h-16 text-[#2ECC71] mx-auto mb-4"/>
                        <h3 className="text-2xl font-bold text-white">Deposit Successful!</h3>
                        <p className="text-slate-400 mt-2">Syncing...</p>
                        {/* {txHash && (
                            <a href={`https://polygonscan.com/tx/${txHash}`} target="_blank" rel="noreferrer" className="block mt-4 text-xs text-blue-400 hover:text-blue-300 underline">
                                View Transaction
                            </a>
                        )} */}
                     </div>
                )}
            </div>
        </SpotlightCard>
    );
};

/**
 * 2.4 PROJECT STATUS TRACKER
 */
const ProjectStatusTracker = ({ project }: { project: Project }) => {
    let currentStep = 0;
    if (project.status === 'hired') currentStep = 0;
    else if (project.status === 'in_progress') currentStep = 1; 
    else if (project.status === 'review') currentStep = 2;
    else if (project.status === 'completed') currentStep = 3;
    
    // Dispute Status Handling
    if (project.status === 'disputed') {
        return (
            <div className="mb-6 md:mb-8 p-6 bg-red-50 border border-red-200 rounded-2xl flex flex-col md:flex-row items-center justify-center gap-6 animate-in fade-in shadow-sm">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center shrink-0 border-4 border-red-50 shadow-inner">
                    <AlertTriangle className="w-8 h-8 text-red-600 animate-pulse" />
                </div>
                <div className="text-center md:text-left">
                    <h3 className="text-red-900 font-bold text-xl mb-1">Project Paused (Dispute Active)</h3>
                    <p className="text-red-700 text-sm max-w-lg">
                        An issue has been reported. Platform admins are reviewing the case in the Dispute Room. 
                        Funds are currently frozen in the smart contract to ensure fairness.
                    </p>
                </div>
            </div>
        );
    }
    
    // Cancelled Status Handling
    if (project.status === 'cancelled') {
        return (
            <div className="mb-6 md:mb-8 p-6 bg-slate-100 border border-slate-200 rounded-2xl flex items-center justify-center gap-4 opacity-75 grayscale">
                 <Ban className="w-8 h-8 text-slate-400" />
                 <div>
                    <h3 className="text-slate-700 font-bold">Project Cancelled</h3>
                    <p className="text-slate-500 text-sm">This project was cancelled and is no longer active.</p>
                 </div>
            </div>
        );
    }

    const steps = [
        { id: 0, title: 'Contract Signed', icon: FileText, desc: 'Hired' },
        { id: 1, title: 'Escrow Funded', icon: CreditCard, desc: 'Locked' },
        { id: 2, title: 'Execution', icon: Loader2, desc: 'In Progress' },
        { id: 3, title: 'Completed', icon: Gift, desc: 'Funds Released' }
    ];

    return (
        <div className="mb-6 md:mb-8 py-8 md:py-10 px-4 md:px-6 bg-white border border-slate-100 rounded-2xl shadow-sm relative overflow-hidden group">
            {/* Horizontal Scroll wrapper for Mobile */}
            <div className="overflow-x-auto hide-scrollbar snap-x snap-mandatory">
                 <div className="min-w-[600px] md:min-w-0 relative">
                    <div className="absolute top-1/2 left-10 right-10 h-[4px] bg-slate-100 -translate-y-1/2 z-0 rounded-full" />
                    <div 
                        className="absolute top-1/2 left-10 h-[4px] bg-[#1F3C88] -translate-y-1/2 z-0 rounded-full transition-all duration-1000 ease-out"
                        style={{ width: `calc(${Math.min((currentStep / 3) * 100, 100)}% - 20px)` }} 
                    />

                    <div className="relative z-10 flex justify-between">
                        {steps.map((step, idx) => {
                            const isCompleted = idx <= currentStep;
                            const isCurrent = idx === currentStep;
                            const Icon = step.icon;
                            return (
                                <div key={idx} className="flex flex-col items-center gap-4 group cursor-default w-full snap-center">
                                    <div className={`
                                        w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center border-4 transition-all duration-500 bg-white z-10
                                        ${isCompleted 
                                            ? 'border-[#1F3C88] text-[#1F3C88] shadow-xl shadow-blue-100 scale-100' 
                                            : 'border-slate-100 text-slate-300'
                                        }
                                        ${isCurrent && project.status !== 'completed' ? 'ring-4 ring-blue-50 animate-pulse border-blue-500' : ''}
                                    `}>
                                        {idx < currentStep ? <Check className="w-5 h-5 md:w-6 md:h-6 stroke-[3]" /> : <Icon className="w-5 h-5 md:w-6 md:h-6" />}
                                    </div>
                                    <div className="text-center">
                                        <p className={`text-xs md:text-sm font-bold transition-colors ${isCompleted ? 'text-slate-900' : 'text-slate-300'}`}>
                                            {step.title}
                                        </p>
                                        <p className="text-[10px] uppercase tracking-wider text-slate-400 mt-1 font-semibold">{step.desc}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

/**
 * 2.5 CHAT AREA (UPDATED)
 * Now handles display filtering implicitly via the message props and style adjustments.
 */
const ChatArea = ({ currentUser, project, messages, onSendMessage, recipientId, loadingMessages, isDisputeMode }: {
    currentUser: any;
    project: Project;
    messages: Message[];
    onSendMessage: (content: string, recipientId: string) => void;
    recipientId: string | null;
    loadingMessages: boolean;
    isDisputeMode: boolean;
}) => {
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || !recipientId) return;
        setSending(true);
        await onSendMessage(input, recipientId);
        setInput('');
        setSending(false);
    };

    const renderSystemMessage = (content: string, type: string) => {
        const isDisputeMsg = type === 'dispute';
        return (
            <div className="flex justify-center my-6 animate-in zoom-in-95 duration-300">
                <div className={`flex flex-col items-center gap-2 p-3 rounded-xl border shadow-sm max-w-[90%] md:max-w-sm text-center ${
                    isDisputeMsg ? 'bg-red-50 border-red-100 text-red-600' : 'bg-slate-50 border-slate-100 text-slate-600'
                }`}>
                    {isDisputeMsg && <AlertTriangle className="w-4 h-4 mb-1" />}
                    <span className="text-xs font-bold">{content}</span>
                </div>
            </div>
        );
    };

    return (
        <div className={`flex flex-col h-[70vh] md:h-[600px] bg-white border rounded-2xl overflow-hidden shadow-sm transition-colors ${isDisputeMode ? 'border-red-200 ring-2 ring-red-50' : 'border-slate-200'}`}>
            {/* Chat Header */}
            <div className={`p-4 border-b flex justify-between items-center ${isDisputeMode ? 'bg-red-50 border-red-100' : 'bg-[#F7F8FA] border-slate-100'}`}>
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm ${isDisputeMode ? 'bg-red-600' : 'bg-[#1F3C88]'}`}>
                        {isDisputeMode ? <Scale className="w-5 h-5"/> : project.title.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                        <h3 className={`font-bold text-sm ${isDisputeMode ? 'text-red-900' : 'text-slate-900'} line-clamp-1`}>
                            {isDisputeMode ? 'Dispute Resolution Room' : project.title}
                        </h3>
                        <p className={`text-xs flex items-center gap-1 ${isDisputeMode ? 'text-red-500' : 'text-slate-500'}`}>
                            {isDisputeMode ? 'Official Admin Channel' : <><Lock className="w-3 h-3" /> End-to-End Encrypted</>}
                        </p>
                    </div>
                </div>
            </div>

            {/* Chat Messages Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white relative">
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
                     style={{ backgroundImage: 'radial-gradient(#1F3C88 1px, transparent 1px)', backgroundSize: '24px 24px' }}>
                </div>
                
                {loadingMessages ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-200"/> 
                        <span className="text-xs">Decrypting secure channel...</span>
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 opacity-60">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                            <MessageSquare className="w-8 h-8 opacity-30"/>
                        </div>
                        <p className="text-sm font-medium">No messages yet.</p>
                        <p className="text-xs">Start the conversation securely.</p>
                    </div>
                ) : (
                    messages.map((m: any) => {
                        const isMe = m.sender_id === currentUser.id;
                        if (m.type === 'system' || m.type === 'dispute') return <div key={m.id}>{renderSystemMessage(m.content, m.type)}</div>;
                        return (
                            <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}>
                                <div className={`max-w-[85%] md:max-w-[75%] rounded-2xl px-4 py-3 text-sm shadow-sm relative z-10 ${
                                    isMe 
                                    ? 'bg-[#1F3C88] text-white rounded-tr-none' 
                                    : 'bg-slate-100 text-slate-700 border border-slate-200 rounded-tl-none'
                                }`}>
                                    <p className="leading-relaxed whitespace-pre-wrap">{m.content}</p>
                                    <div className={`flex items-center gap-1 justify-end mt-1.5 ${isMe ? 'opacity-70' : 'opacity-40'}`}>
                                        <p className="text-[9px]">
                                            {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                        {isMe && <Check className="w-3 h-3"/>}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            {project.status !== 'cancelled' && (
                <div className="p-3 bg-white border-t border-slate-100 flex gap-2 items-end">
                    <textarea 
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => { 
                            if(e.key === 'Enter' && !e.shiftKey) { 
                                e.preventDefault(); 
                                handleSend(); 
                            }
                        }}
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-[#1F3C88] resize-none max-h-32 min-h-[50px] focus:ring-1 focus:ring-blue-100 transition-all placeholder:text-slate-400"
                        placeholder={isDisputeMode ? "Provide evidence to admin..." : "Type a secure message..."}
                        rows={1}
                        disabled={sending}
                    />
                    <Button 
                        onClick={handleSend} 
                        disabled={!input.trim() || sending}
                        className={`h-[50px] w-[50px] !p-0 rounded-xl flex items-center justify-center transition-all shrink-0 ${
                            isDisputeMode 
                            ? 'bg-red-600 hover:bg-red-700' 
                            : 'bg-[#1F3C88] hover:bg-[#162a60]'
                        } ${(!input.trim() || sending) ? 'opacity-50 cursor-not-allowed' : 'shadow-lg'}`}
                    >
                        {sending ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <Send className="w-5 h-5 text-white" />}
                    </Button>
                </div>
            )}
        </div>
    );
};

/**
 * 2.6 REVIEW MODAL
 */
const ReviewModal = ({ isOpen, onClose, onSubmit, submitting, isClient }: any) => {
    const [rating, setRating] = useState(5);
    const [comment, setComment] = useState('');
    
    if (!isOpen) return null;
    
    return (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-md p-6 md:p-8 shadow-2xl animate-in fade-in zoom-in-95 overflow-y-auto max-h-[90vh]">
                <div className="text-center mb-6">
                    <h3 className="text-2xl font-bold text-slate-900 mb-2">
                        {isClient ? 'Rate Freelancer' : 'Rate Client'}
                    </h3>
                    <p className="text-sm text-slate-500">
                        How was your experience working on this project?
                    </p>
                </div>

                <div className="flex justify-center gap-2 mb-8">
                    {[1, 2, 3, 4, 5].map((star) => (
                        <button 
                            key={star} 
                            onClick={() => setRating(star)} 
                            className="focus:outline-none hover:scale-110 transition-transform p-1 group"
                        >
                            <Star className={`w-8 h-8 md:w-10 md:h-10 transition-colors ${
                                star <= rating 
                                ? 'fill-[#F39C12] text-[#F39C12] drop-shadow-sm' 
                                : 'text-slate-200 group-hover:text-slate-300'
                            }`} />
                        </button>
                    ))}
                </div>

                <div className="mb-6">
                    <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Comment (Optional)</label>
                    <textarea 
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-[#1F3C88] min-h-[120px] resize-none"
                        placeholder="Share details about the collaboration..."
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                    />
                </div>

                <div className="flex flex-col-reverse md:flex-row gap-4">
                    <Button variant="ghost" onClick={onClose} className="flex-1 hover:bg-slate-50 text-slate-500 h-12 md:h-11">
                        Cancel
                    </Button>
                    <Button 
                        variant="primary" 
                        onClick={() => onSubmit(rating, comment)} 
                        disabled={submitting} 
                        className="flex-1 bg-[#1F3C88] h-12 md:h-11 text-base shadow-lg shadow-blue-900/10"
                    >
                        {submitting ? 'Submitting...' : 'Submit Review'}
                    </Button>
                </div>
            </div>
        </div>
    );
};

// =================================================================
// 3. MAIN PAGE COMPONENT
// =================================================================

export default function ProjectPage({ params }: { params: { id: string } }) {
    const [supabase] = useState(() => createClient());
    const router = useRouter();
    const searchParams = useSearchParams();
    const { showToast } = useToast();
    const [uploading, setUploading] = useState(false);
    const [projectFiles, setProjectFiles] = useState<any[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    // Core Data State
    const [user, setUser] = useState<any>(null);
    const [project, setProject] = useState<Project | null>(null);
    const [freelancerWallet, setFreelancerWallet] = useState<string | undefined>(undefined);
    const [loading, setLoading] = useState(true);

    // Proposals State (Client Only)
    const [proposals, setProposals] = useState<Proposal[]>([]); 
    const [rejectedProposals, setRejectedProposals] = useState<Proposal[]>([]); 
    const [selectedCandidate, setSelectedCandidate] = useState<Proposal | null>(null);
    
    // UI State
    const [activeTab, setActiveTab] = useState<'details' | 'proposals' | 'rejected' | 'workspace' | 'dispute'>('details');
    const [userHasApplied, setUserHasApplied] = useState(false);

    // Chat State
    const [messages, setMessages] = useState<Message[]>([]);
    const [chatRecipientId, setChatRecipientId] = useState<string | null>(null);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [chatScope, setChatScope] = useState<ChatScope>('workspace');

    // Modals State
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [showDisputeModal, setShowDisputeModal] = useState(false);
    const [reviewSubmitting, setReviewSubmitting] = useState(false);
    const [disputeSubmitting, setDisputeSubmitting] = useState(false);
    const [hasReviewed, setHasReviewed] = useState(false);

    // Milestones Data
    const [milestones, setMilestones] = useState<MilestoneType[]>([]);

    // ----------------------------------------------------------------
    // 4. DATA FETCHING & INITIALIZATION
    // ----------------------------------------------------------------
    
    // Initial Load Effect
    useEffect(() => {
        let mounted = true;
        
        const fetchData = async () => {
            try {
                // 1. Authenticate User
                const { data: { user: u } } = await supabase.auth.getUser();
                if (!u) { 
                    if(mounted) router.replace('/auth'); 
                    return; 
                }
                if(mounted) setUser(u);

                // 2. Fetch Project Metadata
                const { data: proj } = await supabase.from('projects').select('*').eq('id', params.id).single();
                if (!proj) { 
                    if(mounted) router.replace('/dashboard'); 
                    return; 
                }
                if(mounted) setProject(proj);

                const isClient = u.id === proj.client_id;
                const isProjectOpen = proj.status === 'open';

                // 3. Fetch Freelancer Wallet if Hired (Needed for Deposit)
                if (proj.freelancer_id) {
                    const { data: fProfile } = await supabase
                        .from('profiles')
                        .select('wallet_address')
                        .eq('id', proj.freelancer_id)
                        .maybeSingle();
                    if(mounted && fProfile) setFreelancerWallet(fProfile.wallet_address);
                }

                // 4. Check if current freelancer has already applied
                if (!isClient) {
                    const { data: existingProp } = await supabase
                        .from('proposals')
                        .select('id')
                        .eq('project_id', params.id)
                        .eq('freelancer_id', u.id)
                        .maybeSingle();
                    
                    if (mounted && existingProp) {
                        setUserHasApplied(true);
                        // If applied, default chat scope should be proposal for them until hired
                        if (isProjectOpen) setChatScope('proposal');
                    }
                }

                // 5. Check if user has already reviewed
                const { data: existingReview } = await supabase
                    .from('reviews')
                    .select('id')
                    .eq('project_id', params.id)
                    .eq('reviewer_id', u.id)
                    .maybeSingle();
                
                if (mounted && existingReview) setHasReviewed(true);

                // 6. Determine Active Tab logic
                const urlTab = searchParams.get('tab');
                if (urlTab) setActiveTab(urlTab as any);
                else if (proj.status === 'disputed') setActiveTab('dispute');
                else if (isClient && isProjectOpen) setActiveTab('proposals');
                else if (!isClient) setActiveTab('details'); 
                else if (!isProjectOpen) setActiveTab('workspace');

                // 7. Fetch Proposals (If Client & Open)
                if (isClient && isProjectOpen) {
                    const { data: props } = await supabase.from('proposals').select('*').eq('project_id', params.id);
                    if (props && props.length > 0) {
                        const freelancerIds = props.map((p: any) => p.freelancer_id);
                        const { data: profiles } = await supabase.from('profiles').select('*').in('id', freelancerIds);
                        
                        const fullProposals = props.map((p: any) => ({
                            ...p,
                            profile: profiles?.find((prof: any) => prof.id === p.freelancer_id)
                        }));

                        if(mounted) {
                            setProposals(fullProposals.filter((p: any) => p.status !== 'rejected'));
                            setRejectedProposals(fullProposals.filter((p: any) => p.status === 'rejected'));
                        }
                    }
                }

                // 8. Load Workspace Data (If Active Project)
                if (proj.status !== 'open') {
                      const { data: m } = await supabase
                        .from('milestones')
                        .select('*')
                        .eq('project_id', params.id)
                        .order('created_at', { ascending: true });
                      
                      if (m && mounted) setMilestones(m as MilestoneType[]);
                }

                // 9. Subscribe to Milestone Updates (Realtime)
                const milestoneSub = supabase
                    .channel('milestone-updates')
                    .on('postgres_changes', { 
                        event: '*', 
                        schema: 'public', 
                        table: 'milestones', 
                        filter: `project_id=eq.${params.id}` 
                    }, (payload) => {
                        if (payload.new) {
                           setMilestones(prev => {
                               const exists = prev.find(p => p.id === (payload.new as any).id);
                               if (exists) return prev.map(p => p.id === (payload.new as any).id ? (payload.new as MilestoneType) : p);
                               return [...prev, (payload.new as MilestoneType)];
                           });
                        }
                    })
                    .subscribe();

                return () => { milestoneSub.unsubscribe(); }

            } catch (err) { 
                console.error("Initialization Error:", err); 
            } finally { 
                if(mounted) setLoading(false); 
            }
        };

        fetchData();
        return () => { mounted = false; };
    }, [params.id, router, supabase, searchParams]);

// Chat Logic Side Effect: Trigger message fetch when tab/scope/project changes
    useEffect(() => {
        if (!user || !project) return;
        
        // محاسبه طرف مقابل گفتگو
        const otherId = user.id === project.client_id ? project.freelancer_id : project.client_id;

        if (activeTab === 'dispute') {
            fetchMessages(user.id, project, 'dispute', otherId);
        } 
        else if (activeTab === 'workspace') {
            // Ensure we don't accidentally switch to workspace scope if viewing a proposal chat
            if (chatScope !== 'proposal') {
                fetchMessages(user.id, project, 'workspace', otherId);
            }
            const loadFiles = async () => {
                        const res = await getProjectFilesAction(params.id as string);
                        if (res.success) setProjectFiles(res.data);
                    };
            loadFiles();
        } 
        else if (activeTab === 'proposals' && selectedCandidate) {
            // Handled by handleChatWithCandidate logic primarily
        }
        // ============================================================
        // FIX: فعال‌سازی چت برای فریلنسر در تب Project Details
        // ============================================================
        else if (activeTab === 'details' && chatScope === 'proposal') {
            // اینجا فریلنسر است و می‌خواهد با کلاینت (otherId) چت کند
            fetchMessages(user.id, project, 'proposal', otherId);
        }
        
    }, [activeTab, project, user, chatScope]);

    // ----------------------------------------------------------------
    // File Upload Handle
    // ----------------------------------------------------------------

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!project) return;
        if (!e.target.files || e.target.files.length === 0) return;
        
        setUploading(true);
        const files = Array.from(e.target.files);
        const uploadedFilesData: { name: string; url: string; size: number; type: string }[] = [];
        const supabaseClient = createClient(); // کلاینت سمت کاربر (Browser Client)

        try {
            for (const file of files) {
                // ایجاد نام منحصر به فرد برای فایل
                const fileExt = file.name.split('.').pop();
                const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
                const filePath = `${project.id}/${fileName}`;

                // 1. آپلود در Supabase Storage
                const { error: uploadError } = await supabaseClient
                    .storage
                    .from('project_files')
                    .upload(filePath, file);

                if (uploadError) throw uploadError;

                // 2. دریافت لینک عمومی
                const { data: { publicUrl } } = supabaseClient
                    .storage
                    .from('project_files')
                    .getPublicUrl(filePath);

                uploadedFilesData.push({
                    name: file.name,
                    url: publicUrl,
                    size: file.size,
                    type: file.type
                });
            }

            // 3. ذخیره در دیتابیس (Server Action)
            const res = await saveProjectFilesAction(project.id, uploadedFilesData);

            if (res.success) {
                showToast("Files uploaded successfully!");
                // رفرش لیست فایل‌ها
                const updatedList = await getProjectFilesAction(project.id);
                if (updatedList.success) setProjectFiles(updatedList.data);
            } else {
                showToast("Database save failed: " + res.error);
            }

        } catch (error: any) {
            console.error("Upload Error:", error);
            showToast("Upload failed: " + error.message);
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = ''; // پاک کردن اینپوت
        }
    };
    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };
    // ----------------------------------------------------------------
    // 5. MESSAGE HANDLING LOGIC (ISOLATED & SECURE)
    // ----------------------------------------------------------------
    
    /**
     * Fetches messages based on the active scope (Proposal vs Workspace vs Dispute).
     * Filters messages both via DB query and client-side Subscription to ensure isolation.
     */
    const fetchMessages = async (userId: string, proj: any, scope: ChatScope, specificRecipientId?: string) => {
        setLoadingMessages(true);
        setChatScope(scope);

        const recipient = specificRecipientId || (userId === proj.client_id ? proj.freelancer_id : proj.client_id);
        setChatRecipientId(recipient);

        // --- 1. Fetch Historical Messages ---
        let query = supabase
            .from('messages')
            .select('*')
            .eq('project_id', proj.id)
            .order('created_at', { ascending: true });

        if (scope === 'dispute') {
            // Only show dispute/system messages
            query = query.in('type', ['dispute', 'system']);
        } 
        else if (scope === 'proposal') {
            // Only proposal messages between specific users
            query = query.eq('type', 'proposal');
            if (specificRecipientId) {
                query = query.or(`and(sender_id.eq.${userId},recipient_id.eq.${specificRecipientId}),and(sender_id.eq.${specificRecipientId},recipient_id.eq.${userId})`);
            }
        } 
        else {
            // Workspace messages (Post-hire)
            // Explicitly exclude proposal and dispute messages from main workspace view
            query = query.in('type', ['workspace', 'text', 'system']);
        }
        
        const { data, error } = await query;
        if (!error) {
            setMessages(data || []);
        } else {
            console.error("Message Fetch Error:", error);
        }
        
        // --- 2. Realtime Subscription with Strict Filtering ---
        // Clean up previous channel
        supabase.removeChannel(supabase.channel(`chat-room-${proj.id}`)); 

        const channel = supabase.channel(`chat-room-${proj.id}-${scope}-${Date.now()}`)
            .on('postgres_changes', { 
                event: 'INSERT', 
                schema: 'public', 
                table: 'messages', 
                filter: `project_id=eq.${proj.id}` 
            }, (payload) => {
                const newMessage = payload.new as Message;
                
                // === Strict Client-Side Filtering ===
                let allowMessage = false;

                if (scope === 'dispute') {
                    if (newMessage.type === 'dispute' || newMessage.type === 'system') allowMessage = true;
                }
                else if (scope === 'proposal') {
                    if (newMessage.type === 'proposal') {
                         // Double check: relevant to this specific conversation?
                         const isRelevant = (newMessage.sender_id === userId && newMessage.recipient_id === recipient) || 
                                            (newMessage.sender_id === recipient && newMessage.recipient_id === userId);
                         if (isRelevant) allowMessage = true;
                    }
                }
                else if (scope === 'workspace') {
                    if (newMessage.type === 'workspace' || newMessage.type === 'text' || newMessage.type === 'system') {
                        allowMessage = true;
                    }
                }

                if (allowMessage) {
                    setMessages(prev => {
                        if (prev.some(m => m.id === newMessage.id)) return prev; 
                        return [...prev, newMessage];
                    });
                }
            })
            .subscribe();

        setLoadingMessages(false);
        return () => { supabase.removeChannel(channel); }
    };

    /**
     * Sends a message with the correct type based on current scope.
     */
    const handleSendMessageAction = async (content: string, recipientId: string) => {
        if (!project || !user) return;
        
        // Determine Type based on Scope
        let type: 'text' | 'system' | 'dispute' | 'proposal' | 'workspace' = 'text'; 
        if (chatScope === 'dispute') type = 'dispute';
        else if (chatScope === 'proposal') type = 'proposal';
        else if (chatScope === 'workspace') type = 'workspace';
        
        const tempId = Date.now();
        // Optimistic Update
        setMessages(prev => [...prev, {
            id: tempId, 
            content, 
            sender_id: user.id, 
            created_at: new Date().toISOString(), 
            type: type
        }]);

        // Call Server Action
        const res = await sendMessageAction(project.id, recipientId, content, type);
        
        if (res.error) {
            console.error("Message send failed:", res.error);
            showToast("Failed to send message", "error");
            setMessages(prev => prev.filter(m => m.id !== tempId));
        }
    };

    // ----------------------------------------------------------------
    // 6. MILESTONE & DISPUTE HANDLERS
    // ----------------------------------------------------------------
    
    const handleUploadDeliverable = async (milestoneId: string, file: File) => {
        // Mock Upload Logic
        const mockUrl = `https://storage.example.com/${file.name}`;
        showToast("Uploading deliverable...", "info");
        
        const { error } = await supabase.from('milestones').update({
            deliverables: file.name, 
            submission_file_url: mockUrl,
            submission_note: "File uploaded via workspace."
        }).eq('id', milestoneId);

        if(error) showToast("Failed to upload file record", "error");
    };

    const handleSubmitWork = async (milestoneId: string) => {
        const res = await updateMilestoneStatusAction(milestoneId, 'SUBMITTED');
        if(res.success) {
            showToast("Work submitted for review", "success");
        } else {
            showToast(res.error || "Failed to submit work", "error");
        }
    };

    const handleApproveMilestone = async (milestoneId: string) => {
        if(!project) return;
        if(!confirm("Are you sure? This will release the funds to the freelancer via Smart Contract.")) return;
        
        const res = await approveMilestoneAction(milestoneId, project.id);
        
        if(res && res.error) {
            showToast(res.error, "error");
        } else {
             showToast("Milestone approved & funds released on Blockchain!", "success");
        }
    };

    const handleRequestRevision = async (milestoneId: string, feedback: string) => {
        if (!project) return;
        // نمایش لودینگ (اختیاری)
        const toastId = showToast("Sending revision request...");

        try {
            const res = await requestRevisionAction(milestoneId, project.id, feedback);
            
            if (res.success) {
                showToast("Revision requested successfully. Feedback sent to freelancer.");
                // رفرش کردن صفحه برای دیدن تغییر وضعیت
                router.refresh(); 
            } else {                
                showToast("Failed to request revision: " + res.error);
            }
        } catch (error) {            
            console.error(error);
            showToast("An error occurred.");
        }
    };
    // --- Dispute Logic ---

    const handleCreateDispute = async () => {
        setShowDisputeModal(true);
    };

    /**
     * Submits a dispute. Now handles optional milestoneId for granular disputes.
     */
    const handleSubmitDispute = async (subject: string, description: string, milestoneId?: string) => {
        if(!project) return;
        setDisputeSubmitting(true);
        
        try {
            // Call the updated createDisputeAction which handles scope logic
            const res = await createDisputeAction(project.id, `${subject}: ${description}`, milestoneId);
            
            if(res && 'success' in res && res.success) {
                showToast(milestoneId ? "Milestone dispute logged." : "Full project dispute opened.", "info");
                setShowDisputeModal(false);
                // Force a hard refresh to update status
                window.location.reload();
            } else {
                showToast(res?.error || "Failed to create dispute.", "error");
            }
        } catch (error: any) {
            console.error("Dispute Error:", error);
            showToast("Unexpected error creating dispute.", "error");
        } finally {
            setDisputeSubmitting(false);
        }
    };

    // ----------------------------------------------------------------
    // 7. USER & PROJECT ACTIONS
    // ----------------------------------------------------------------

    const handleCancelProject = async () => {
        if(!project) return;
        if(!confirm("Are you sure you want to cancel this project? This cannot be undone.")) return;
        
        const res = await cancelProjectAction(project.id);
        if(res && res.success) {
            showToast("Project cancelled successfully.", "info");
            window.location.reload();
        } else {
            showToast(res?.error || "Failed to cancel", "error");
        }
    };

    const handleHire = async (candidate: Proposal) => {
        if(!project) return;
        if (!confirm(`Confirm hiring ${candidate.profile?.ghost_id}? This will lock the contract milestones.`)) return;
        
        try {
            const result = await acceptProposalAction(candidate.id, project!.id);
            if(result.error) {
                showToast(result.error, "error");
            } else {
                showToast("Hired successfully!", "success");
                window.location.reload();
            }
        } catch (e: any) {
            showToast(e.message, "error");
        }
    };

    const handleRejectProposal = async (proposalId: string) => {
        if(!project) return;
        if (!confirm("Are you sure you want to reject this proposal?")) return;
        
        const res = await rejectProposalAction(proposalId, project.id);
        if (res?.error) {
            showToast(res.error, "error");
        } else {
            showToast("Proposal rejected.", "info");
            setProposals(prev => prev.filter(p => p.id !== proposalId));
            setSelectedCandidate(null); 
        }
    };

    /**
     * Initiates chat with candidate before hiring.
     * Sets scope to 'proposal' so messages are private to this pre-hire context.
     */
    const handleChatWithCandidate = (freelancerId: string) => {
        if(!project || !user) return;
        setSelectedCandidate(null);
        setChatScope('proposal'); 
        setActiveTab('workspace'); 
        
        fetchMessages(user.id, project, 'proposal', freelancerId);
    };

    const handleCheckDeposit = async () => {
        if(!project) return;
        const res = await verifyDepositAction(project.id);
        if(res.success) {
            showToast("Deposit verified!", "success");
            window.location.reload();
        } else {
            showToast(res.message || "Failed", "error");
        }
    };

    const handleReviewSubmit = async (rating: number, comment: string) => {
        if(!project || !user) return;
        setReviewSubmitting(true);
        
        const revieweeId = user.id === project.client_id ? project.freelancer_id : project.client_id;
        
        const { error } = await supabase.from('reviews').insert({ 
            reviewer_id: user.id, 
            reviewee_id: revieweeId, 
            project_id: project.id, 
            rating, 
            comment 
        });

        if (!error) { 
            setHasReviewed(true); 
            setShowReviewModal(false); 
            showToast("Review submitted successfully", "success"); 
        } else {
            showToast("Failed to submit review", "error");
        }
        setReviewSubmitting(false);
    };

    // ----------------------------------------------------------------
    // 8. RENDER LOGIC
    // ----------------------------------------------------------------

    if (loading) return (
        <div className="flex flex-col items-center justify-center h-screen bg-[#F7F8FA]">
            <Loader2 className="animate-spin w-10 h-10 text-blue-600 mb-4"/>
            <p className="text-slate-500 font-medium animate-pulse">Loading Project Workspace...</p>
        </div>
    );
    
    if (!project) return null;
    
    const isClient = user?.id === project.client_id;
    const isProjectActive = ['hired', 'in_progress', 'review', 'completed', 'disputed'].includes(project.status);
    const userRole = isClient ? 'CLIENT' : 'FREELANCER';

    // --- TAB: DETAILS ---
    const renderDetailsTab = () => (
        <div className="space-y-6 animate-in slide-in-from-bottom-2">
            <SpotlightCard className="p-6 md:p-8">
                <h3 className="font-bold text-slate-900 mb-4 text-lg border-b border-slate-100 pb-2">Project Description</h3>
                <p className="text-slate-600 text-sm leading-7 whitespace-pre-wrap mb-8 font-normal">
                    {project.description}
                </p>
                
                <div className="p-4 md:p-6 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="text-xs text-slate-400 font-bold uppercase block mb-3 tracking-wider">Skills Required</span>
                    <div className="flex flex-wrap gap-2">
                        {project.skills_required.map(s => <Badge key={s} variant="secondary">{s}</Badge>)}
                    </div>
                </div>
            </SpotlightCard>

            {/* Application / Chat Section for Freelancer */}
            {!isClient && project.status === 'open' && (
                <div className="space-y-6">
                    <SpotlightCard className="p-6 md:p-8 border-blue-100 bg-blue-50/30 flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="mb-6 md:mb-0"> 
                            <h3 className="font-bold text-slate-900 flex items-center gap-2 text-lg">
                                <Briefcase className="w-6 h-6 text-[#1F3C88]" /> 
                                {userHasApplied ? "Application Status" : "Interested in this project?"}
                            </h3>
                            <p className="text-sm text-slate-500 mt-2 max-w-xl">
                                {userHasApplied 
                                    ? "You have submitted a proposal. You can discuss details with the client below."
                                    : "Submit a comprehensive proposal including your budget and timeline. Clients prioritize detailed milestones and clear communication."
                                }
                            </p>
                        </div>
                        {userHasApplied ? (
                            <Button disabled variant="outline" className="w-full md:w-auto bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed h-12 px-6">
                                <CheckCircle className="w-5 h-5 mr-2" /> Application Sent
                            </Button>
                        ) : (
                            <Button 
                                onClick={() => router.push(`/dashboard/projects/${project.id}/proposal`)} 
                                className="w-full md:w-auto bg-[#1F3C88] hover:bg-[#162a60] text-white px-8 font-bold shadow-lg shadow-blue-900/10 h-12 transition-all hover:scale-105"
                            >
                                Submit Proposal <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                        )}
                    </SpotlightCard>

                    {/* Chat Area for Freelancer (Proposal Scope) */}
                    {userHasApplied && (
                        <div className="animate-in slide-in-from-bottom-4">
                            <div className="flex items-center gap-2 mb-4 px-1">
                                <MessageSquare className="w-5 h-5 text-[#1F3C88]"/>
                                <h3 className="text-lg font-bold text-slate-900">Before Hire Chat</h3>
                            </div>
                            <ChatArea 
                                currentUser={user} 
                                project={project} 
                                messages={messages} 
                                onSendMessage={handleSendMessageAction} 
                                recipientId={project.client_id} // Freelancer chats with client
                                loadingMessages={loadingMessages}
                                isDisputeMode={false} 
                            />
                        </div>
                    )}
                </div>
            )}
        </div>
    );

    // --- TAB: PROPOSALS (Client Only) ---
    const renderProposalsTab = () => (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {proposals.length === 0 ? (
                <div className="col-span-full flex flex-col items-center justify-center py-20 bg-white border border-dashed border-slate-300 rounded-xl">
                    <User className="w-12 h-12 text-slate-200 mb-3"/>
                    <p className="text-slate-400 text-sm font-medium">No active proposals yet.</p>
                </div>
            ) : (
                proposals.map(prop => (
                    <div key={prop.id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:border-blue-300 hover:shadow-lg transition-all duration-300 group">
                        <div className="flex justify-between items-start mb-5">
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 bg-gradient-to-br from-slate-100 to-slate-200 rounded-full flex items-center justify-center text-slate-500 font-bold text-xl shadow-inner shrink-0">
                                    {prop.profile?.ghost_id?.substring(0, 1) || <User className="w-6 h-6" />}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-base font-bold text-slate-900 group-hover:text-blue-700 transition-colors truncate">
                                        {prop.profile?.ghost_id || 'Unknown'}
                                    </p>
                                    <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-1">
                                        <span className="text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 whitespace-nowrap">
                                            Trust: {prop.profile?.trust_score}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="text-right pl-2">
                                <span className="block text-xl font-bold text-[#1F3C88]">${prop.proposed_budget.toLocaleString()}</span>
                                <span className="text-xs text-slate-400 font-medium">{prop.timeline}</span>
                            </div>
                        </div>
                        
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 mb-5 min-h-[60px]">
                            <p className="text-xs text-slate-600 line-clamp-2 italic leading-relaxed">
                                "{prop.cover_letter}"
                            </p>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <Button 
                                onClick={() => setSelectedCandidate(prop)} 
                                variant="outline" 
                                className="w-full text-xs h-10 font-bold hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition-colors"
                            >
                                <Eye className="w-3 h-3 mr-2" /> View Full Proposal
                            </Button>
                        </div>
                    </div>
                ))
            )}
        </div>
    );

    // --- TAB: WORKSPACE (Main Interaction) ---
    const renderWorkspaceTab = () => (
        <div className="animate-in slide-in-from-bottom-4 duration-500">
            {/* 1. STATUS TRACKER */}
            {isProjectActive && <ProjectStatusTracker project={project} />}
            
            {/* 2. CRYPTO DEPOSIT (Client Only when Hired) */}
            {isClient && project.status === 'hired' && project.escrow_status !== 'locked' && (
                <div className="mb-8 md:mb-10 animate-in fade-in zoom-in-95">
                      <div className="flex items-center gap-2 mb-4">
                        <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded">Action Required</span>
                        <h3 className="text-lg font-bold text-slate-800">Fund Escrow to Activate Project</h3>
                      </div>
                      <CryptoDepositCard 
                          project={project} 
                          freelancerAddress={freelancerWallet}
                          onCheckDeposit={handleCheckDeposit} 
                      />
                </div>
            )}

            {/* 3. MILESTONES & CHAT SPLIT */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
                
                {/* LEFT COLUMN: MILESTONES & CHAT */}
                <div className="lg:col-span-2 space-y-6 md:space-y-8 order-2 lg:order-1">
                    {/* Milestones Section */}
                    {isProjectActive && (
                        <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-6 shadow-sm">
                            <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-50">
                                <div>
                                    <h3 className="font-bold text-[#1F3C88] text-lg flex items-center gap-2">
                                        <LayoutList className="w-5 h-5" /> Project Milestones
                                    </h3>
                                    <p className="text-xs text-slate-400 mt-1 ml-0 md:ml-7">
                                        Funds are released sequentially upon approval of each phase.
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    {project.status === 'in_progress' && (
                                        <Badge className="bg-green-100 text-green-700 animate-pulse">Active</Badge>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-4">
                                {milestones.length === 0 ? (
                                    <div className="text-center p-8 md:p-12 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
                                        <LayoutList className="w-8 h-8 text-slate-300 mx-auto mb-2"/>
                                        <p className="text-slate-400 text-sm font-medium">No milestones defined for this contract.</p>
                                    </div>
                                ) : (
                                    milestones.map((m, index) => (
                                        <MilestoneCard 
                                            key={m.id} 
                                            milestone={m} 
                                            index={index}
                                            projectId={project.id}
                                            isClient={isClient}
                                            userRole={userRole}
                                            isLast={index === milestones.length - 1}
                                            onApprove={handleApproveMilestone}
                                            onRequestRevision={handleRequestRevision}
                                            onReleaseFunds={handleApproveMilestone}
                                        />
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {/* Workspace Chat (or Proposal Chat if pre-hire) */}
                    <div className="flex flex-col gap-2">
                         <div className="flex items-center justify-between px-1">
                            <h3 className="font-bold text-slate-700 flex items-center gap-2">
                                <MessageSquare className="w-4 h-4 text-blue-500"/>
                                {chatScope === 'proposal' ? 'Proposal Discussion' : 'Workspace Chat'}
                            </h3>
                            {chatScope === 'proposal' && (
                                <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded border border-blue-100">
                                    Pre-Hire Phase
                                </span>
                            )}
                         </div>
                        <ChatArea 
                            currentUser={user} 
                            project={project} 
                            messages={messages} 
                            onSendMessage={handleSendMessageAction} 
                            recipientId={chatRecipientId} 
                            loadingMessages={loadingMessages}
                            isDisputeMode={false} 
                        />
                    </div>
                </div>

                {/* RIGHT COLUMN: ACTIONS & INFO */}
                <div className="space-y-6 order-1 lg:order-2">
                    <SpotlightCard className="border-t-4 border-t-[#1F3C88] p-6 bg-white shadow-md">
                        <h3 className="font-bold text-slate-900 mb-5 flex items-center gap-2">
                            <RefreshCw className="w-4 h-4 text-slate-400"/> Quick Actions
                        </h3>
                        <div className="space-y-3">
                            {isClient ? (
                                <>
                                    {project.status === 'hired' && (
                                        <div className="text-xs text-[#1F3C88] font-bold p-3 bg-blue-50 rounded border border-blue-100 flex items-start gap-2 animate-pulse">
                                            <CreditCard className="w-4 h-4 shrink-0 mt-0.5" />
                                            <span>Pending: Please fund the escrow to unlock freelancer workspace.</span>
                                        </div>
                                    )}
                                    {project.status === 'completed' && !hasReviewed && (
                                        <Button 
                                            onClick={() => setShowReviewModal(true)} 
                                            className="w-full justify-start bg-[#F39C12] hover:bg-[#e67e22] text-white font-bold shadow-lg shadow-orange-100 transition-transform hover:scale-[1.02]"
                                        >
                                            <Star className="w-4 h-4 mr-2" /> Rate Freelancer
                                        </Button>
                                    )}
                                </>
                            ) : (
                                <>
                                     {project.status === 'hired' && (
                                        <div className="text-xs text-slate-500 italic p-3 text-center bg-slate-50 rounded border border-slate-100">
                                            <Clock className="w-3 h-3 inline mr-1"/> Waiting for client to fund escrow...
                                        </div>
                                     )}
                                     {project.status === 'completed' && !hasReviewed && (
                                        <Button 
                                            onClick={() => setShowReviewModal(true)} 
                                            className="w-full justify-start bg-[#F39C12] hover:bg-[#e67e22] text-white font-bold transition-transform hover:scale-[1.02]"
                                        >
                                            <Star className="w-4 h-4 mr-2" /> Rate Client
                                        </Button>
                                     )}
                                </>
                            )}
                            
                            {['in_progress', 'review', 'hired'].includes(project.status) && (
                                <Button 
                                    onClick={handleCreateDispute} 
                                    variant="outline" 
                                    className="w-full justify-start text-[#E74C3C] border-[#E74C3C]/30 hover:bg-[#E74C3C]/5 text-xs font-bold mt-4"
                                >
                                    <AlertTriangle className="w-4 h-4 mr-2" /> Report Project Issue
                                </Button>
                            )}
                            {/* {project.deposit_tx_hash && (
                                <div className="pt-4 mt-4 border-t border-slate-100">
                                    <a 
                                        href={`https://polygonscan.com/tx/${project.deposit_tx_hash}`} 
                                        target="_blank" 
                                        rel="noreferrer" 
                                        className="group flex items-center justify-between p-3 text-xs font-bold text-[#1F3C88] bg-blue-50/50 border border-blue-100 rounded-lg hover:bg-blue-50 hover:border-blue-200 transition-all"
                                    >
                                        <span className="flex items-center gap-2">
                                            <ExternalLink className="w-4 h-4" /> View Blockchain Receipt
                                        </span>
                                        <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform opacity-50"/>
                                    </a>
                                </div>
                            )} */}
                        </div>
                    </SpotlightCard>
                    
                    <div className="bg-gradient-to-br from-[#1F3C88] to-[#152a61] rounded-xl p-6 text-white text-center shadow-lg relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
                        <Shield className="w-10 h-10 mx-auto mb-4 opacity-90 group-hover:scale-110 transition-transform" />
                        <h4 className="font-bold text-sm mb-2">Protected by Noble</h4>
                        <p className="text-[11px] text-blue-100 leading-relaxed opacity-80">
                            Funds are held in a secure smart contract escrow. 
                            Payments are only released when you approve the work.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );

    // --- TAB: DISPUTE ROOM ---
    const renderDisputeTab = () => {
        // تشخیص اینکه آیا دیسپیوت هنوز باز است یا بسته شده
        const isActiveDispute = project.status === 'disputed';

        return (
            <div className="animate-in slide-in-from-bottom-2">
                <ProjectStatusTracker project={project} />
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
                    <div className="lg:col-span-2 order-2 lg:order-1">
                        <ChatArea 
                            currentUser={user} 
                            project={project} 
                            messages={messages} 
                            onSendMessage={handleSendMessageAction} 
                            recipientId={chatRecipientId} 
                            loadingMessages={loadingMessages}
                            isDisputeMode={true} 
                        />
                    </div>

                    <div className="space-y-6 order-1 lg:order-2">
                        {/* تغییر رنگ و متن بر اساس وضعیت دیسپیوت */}
                        <SpotlightCard className={`p-6 ${isActiveDispute ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-slate-50'}`}>
                            <div className="flex items-center gap-3 mb-4">
                                <div className={`${isActiveDispute ? 'bg-red-200' : 'bg-slate-200'} p-2 rounded-full`}>
                                    <Scale className={`w-5 h-5 ${isActiveDispute ? 'text-red-700' : 'text-slate-700'}`}/>
                                </div>
                                <h3 className={`font-bold ${isActiveDispute ? 'text-red-900' : 'text-slate-900'}`}>
                                    {isActiveDispute ? 'Dispute Center' : 'Dispute Resolved'}
                                </h3>
                            </div>
                            
                            {isActiveDispute ? (
                                <p className="text-xs text-red-800 leading-relaxed mb-4">
                                    This project is currently under review by Noble Administrators.
                                    Funds relevant to the dispute are frozen in the smart contract.
                                </p>
                            ) : (
                                <div className="space-y-3">
                                    <p className="text-xs text-slate-600 leading-relaxed">
                                        This dispute case has been closed. You can view the chat history for reference.
                                    </p>
                                    {/* اگر نتیجه دیسپیوت را در دیتابیس دارید اینجا نمایش دهید */}
                                    {/* <div className="bg-white p-3 rounded border border-slate-200">
                                        <span className="font-bold text-xs block mb-1">Outcome:</span>
                                        <p className="text-sm">{project.dispute_outcome || 'Resolved'}</p>
                                    </div> 
                                    */}
                                </div>
                            )}
                        </SpotlightCard>

                        <div className="p-4 bg-white border border-slate-200 rounded-xl">
                            <span className="text-xs font-bold text-slate-500 uppercase block mb-3">Affected Scope</span>
                            <div className="space-y-2">
                                {/* نمایش مایلستون‌های دیسپیوت شده */}
                                {milestones.filter(m => m.status === 'disputed' || m.status === 'DISPUTED').length > 0 ? (
                                    milestones.filter(m => m.status === 'disputed' || m.status === 'DISPUTED').map(m => (
                                        <div key={m.id} className="text-xs p-2 bg-red-50 text-red-700 border border-red-100 rounded flex justify-between items-center">
                                            <span>{m.title}</span>
                                            <span className="font-bold">${m.amount}</span>
                                        </div>
                                    ))
                                ) : (
                                    <div className={`text-xs p-3 border rounded-lg flex items-center gap-2 ${isActiveDispute ? 'bg-red-100 text-red-800 border-red-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                        <AlertTriangle className="w-3 h-3"/>
                                        <span>Full Project Dispute (History)</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };
    
    return (
        <div className="max-w-7xl mx-auto px-4 md:px-6 mt-6 md:mt-8 pb-12">
            {/* Scrollable Tabs for Mobile */}
            <div className="flex border-b border-slate-200 mb-6 gap-6 overflow-x-auto hide-scrollbar sticky top-[60px] md:top-[80px] z-30 bg-[#F7F8FA] pt-2 px-1 -mx-4 md:mx-0 md:px-0 scroll-smooth">
                 {/* Spacer for mobile left padding */}
                <div className="w-2 md:hidden shrink-0"></div>
                
                <button onClick={() => setActiveTab('details')} className={`pb-3 text-sm font-bold uppercase tracking-wide border-b-[3px] transition-all whitespace-nowrap shrink-0 ${activeTab === 'details' ? 'border-[#1F3C88] text-[#1F3C88]' : 'border-transparent text-slate-400'}`}>Project Details</button>
                {isClient && project.status === 'open' && <button onClick={() => setActiveTab('proposals')} className={`pb-3 text-sm font-bold uppercase tracking-wide border-b-[3px] transition-all whitespace-nowrap shrink-0 ${activeTab === 'proposals' ? 'border-[#1F3C88] text-[#1F3C88]' : 'border-transparent text-slate-400'}`}>Proposals</button>}
                <button onClick={() => setActiveTab('workspace')} className={`pb-3 text-sm font-bold uppercase tracking-wide border-b-[3px] transition-all whitespace-nowrap shrink-0 ${activeTab === 'workspace' ? 'border-[#1F3C88] text-[#1F3C88]' : 'border-transparent text-slate-400'}`}>Workspace</button>
                {/*{project.status === 'disputed' && <button onClick={() => setActiveTab('dispute')} className={`pb-3 text-sm font-bold uppercase tracking-wide border-b-[3px] transition-all whitespace-nowrap shrink-0 flex items-center ${activeTab === 'dispute' ? 'border-red-600 text-red-600' : 'border-transparent text-red-400'}`}><AlertTriangle className="w-4 h-4 mr-1"/> Dispute Room</button>}*/}
                {(project.status === 'disputed' || project.escrow_status === 'disputed' || /* شرط جدید شما: */ project.status === 'completed') && (
                    <button onClick={() => setActiveTab('dispute')} className={`pb-3 text-sm font-bold uppercase tracking-wide border-b-[3px] transition-all whitespace-nowrap shrink-0 flex items-center ${activeTab === 'dispute' ? 'border-red-600 text-red-600' : 'border-transparent text-red-400'}`}>
                        <AlertTriangle className="w-4 h-4 mr-1"/> Dispute Room
                    </button>
                )}                
                {/* Spacer for mobile right padding */}
                <div className="w-2 md:hidden shrink-0"></div>
            </div>

            <div className="min-h-[400px]">
                {activeTab === 'details' && renderDetailsTab()}
                {activeTab === 'proposals' && renderProposalsTab()}
                {activeTab === 'workspace' && renderWorkspaceTab()}
                {activeTab === 'dispute' && renderDisputeTab()}
            </div>

            <ProposalDetailsModal 
                isOpen={!!selectedCandidate} 
                onClose={() => setSelectedCandidate(null)} 
                proposal={selectedCandidate} 
                onReject={handleRejectProposal} 
                onHire={handleHire} 
                onChat={handleChatWithCandidate} 
            />
            <DisputeModal 
                isOpen={showDisputeModal} 
                onClose={() => setShowDisputeModal(false)} 
                onSubmit={handleSubmitDispute} 
                submitting={disputeSubmitting} 
                milestones={milestones}
            />
            <ReviewModal 
                isOpen={showReviewModal} 
                onClose={() => setShowReviewModal(false)} 
                onSubmit={handleReviewSubmit} 
                submitting={reviewSubmitting} 
                isClient={isClient} 
            />
        </div>
    );
}