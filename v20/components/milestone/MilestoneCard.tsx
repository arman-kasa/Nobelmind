// [FILE: components/milestone/MilestoneCard.tsx]
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase'; // کلاینت برای آپلود مستقیم
import { 
    CheckCircle, 
    Clock, 
    FileText, 
    Upload, 
    AlertTriangle, 
    ChevronDown, 
    ShieldCheck, 
    Download, 
    ExternalLink, 
    Play, 
    BrainCircuit, 
    XCircle,
    Lock,
    CheckCircle2,
    Loader2,
    Gavel,
    History,
    Paperclip,
    Trash2 // آیکون جدید برای حذف فایل از لیست
} from 'lucide-react';
import { Button, Badge } from '@/components/ui/shared';
// اطمینان حاصل کنید که این اکشن‌ها در فایل actions.ts وجود دارند و آپدیت شده‌اند
import { 
    submitMilestoneWorkAction, 
    approveMilestoneAction, 
    processMilestoneDecisionAction,
    createDisputeAction,
    getMilestoneFilesAction // <--- اکشن جدید برای دریافت فایل‌ها
} from '@/app/actions';

// =============================================================================
// 1. EXPORTED TYPES & INTERFACES
// =============================================================================

/**
 * Defines the possible statuses for a milestone.
 * Includes both lowercase (legacy) and uppercase (DB enum) variants to ensure compatibility.
 */
export type MilestoneStatus = 
    | 'pending' 
    | 'funded' 
    | 'submitted' 
    | 'approved' 
    | 'released' 
    | 'disputed' 
    | 'cancelled'
    | 'LOCKED'      
    | 'ACTIVE'      
    | 'SUBMITTED'   
    | 'COMPLETED'   
    | 'DISPUTED';

/**
 * Represents the data structure of a single Milestone.
 * This interface is exported so it can be imported in page.tsx.
 */
export interface Milestone {
    id: string;
    title: string;
    description?: string; 
    amount: number;
    status: MilestoneStatus;
    due_date: string;
    deliverables?: string;
    verification_method?: 'file' | 'link' | 'manual';
    submission_note?: string;
    submission_file_url?: string; // نگه داشته شده برای سازگاری عقب‌گرد
    engine_decision?: {
        action: string;
        decision_hash?: string;
        scores?: {
            delivery_score: number;
            risk_score: number;
            behavior_score?: number;
        };
    };
    decision_hash?: string; // هش تراکنش بلاکچین یا تصمیم سیستم
    order_index?: number;
    created_at?: string;
    updated_at?: string;
}

/**
 * Props for the MilestoneCard component.
 */
export interface MilestoneCardProps {
    milestone: Milestone;
    isClient?: boolean; 
    userRole?: 'CLIENT' | 'FREELANCER'; 
    projectId?: string; 
    
    // Additional handlers passed from parent (Optional)
    index?: number;
    isLast?: boolean;
    onUploadDeliverable?: (id: string, file: File) => void;
    onSubmitWork?: (id: string) => void;
    onApprove?: (id: string) => void;
    onRequestRevision?: (id: string, feedback: string) => void;
    onReleaseFunds?: (id: string) => void;
}

// =============================================================================
// 2. MAIN COMPONENT
// =============================================================================

export const MilestoneCard = ({ 
    milestone, 
    isClient, 
    userRole,
    projectId,
    index,
    isLast,
    // Converting props to internal logic if needed
    onUploadDeliverable,
    onSubmitWork,
    onApprove,
    onRequestRevision
}: MilestoneCardProps) => {
    
    // Determine effective role (support both boolean and string prop)
    const effectiveIsClient = isClient ?? (userRole === 'CLIENT');
    const effectiveProjectId = projectId || '';

    // Local State
    const [expanded, setExpanded] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [isDisputing, setIsDisputing] = useState(false); // New state for dispute loading
    const [isApproving, setIsApproving] = useState(false);
    
    // Freelancer Submission State
    const [submissionText, setSubmissionText] = useState('');
    
    // [NEW] Multi-file States
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]); // فایل‌های انتخاب شده برای آپلود
    const [submittedFiles, setSubmittedFiles] = useState<any[]>([]); // فایل‌های دریافت شده از دیتابیس
    const fileInputRef = useRef<HTMLInputElement>(null);

    // -------------------------------------------------------------------------
    // EFFECT: LOAD SUBMITTED FILES
    // -------------------------------------------------------------------------
    useEffect(() => {
        // فقط زمانی فایل‌ها را لود کن که مایل‌ستون در وضعیتی باشد که فایلی دارد
        const activeStatuses = ['submitted', 'approved', 'released', 'COMPLETED', 'SUBMITTED', 'disputed', 'DISPUTED'];
        if (activeStatuses.includes(milestone.status)) {
            const fetchFiles = async () => {
                try {
                    const res = await getMilestoneFilesAction(milestone.id);
                    if (res.success && res.data) {
                        setSubmittedFiles(res.data);
                    }
                } catch (e) {
                    console.error("Failed to load milestone files", e);
                }
            };
            fetchFiles();
        }
    }, [milestone.id, milestone.status]);
    
    // -------------------------------------------------------------------------
    // HELPER: FORMAT HASH
    // -------------------------------------------------------------------------
    const formatHash = (hash?: string) => {
        if (!hash) return "";
        return `${hash.substring(0, 8)}...${hash.substring(hash.length - 6)}`;
    };

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const SCAN_URL = "https://polygonscan.com/tx/"; // Or usage of env variable

    // -------------------------------------------------------------------------
    // STATUS & COLOR MAPPING
    // -------------------------------------------------------------------------
    
    // Updated color map to handle both lowercase and uppercase statuses
    const colors: Record<string, string> = {
        pending: 'bg-slate-100 text-slate-500 border-slate-200',
        LOCKED: 'bg-slate-100 text-slate-500 border-slate-200',
        
        funded: 'bg-indigo-50 text-indigo-600 border-indigo-200',
        ACTIVE: 'bg-blue-100 text-blue-700 border-blue-200',
        
        submitted: 'bg-blue-50 text-[#1F3C88] border-blue-100',
        SUBMITTED: 'bg-purple-100 text-purple-700 border-purple-200',
        
        approved: 'bg-[#2ECC71]/10 text-[#2ECC71] border-[#2ECC71]/20',
        COMPLETED: 'bg-[#2ECC71]/10 text-[#2ECC71] border-[#2ECC71]/20',
        
        released: 'bg-[#2ECC71]/10 text-[#2ECC71] border-[#2ECC71]/20',
        
        disputed: 'bg-[#E74C3C]/10 text-[#E74C3C] border-[#E74C3C]/20',
        DISPUTED: 'bg-[#E74C3C]/10 text-[#E74C3C] border-[#E74C3C]/20',
        
        cancelled: 'bg-gray-100 text-gray-400 border-gray-200'
    };

    const statusColor = colors[milestone.status] || colors.pending;
    const engineData = milestone.engine_decision;

    // -------------------------------------------------------------------------
    // HANDLERS: FREELANCER (REAL UPLOAD)
    // -------------------------------------------------------------------------

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            // Append new files to existing selection
            setSelectedFiles(prev => [...prev, ...Array.from(e.target.files!)]);
        }
    };

    const removeSelectedFile = (indexToRemove: number) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== indexToRemove));
    };

    const handleFreelancerSubmit = async () => {
        // If parent provided a submit handler, use it (Legacy support)
        if (onSubmitWork) {
            onSubmitWork(milestone.id);
            return;
        }

        // Internal Logic
        if (!submissionText && selectedFiles.length === 0) {
            alert("Please provide text notes or attach files.");
            return;
        }
        if (!confirm("Submit this work for review? You cannot edit after submission.")) return;
        
        setUploading(true);
        const supabase = createClient();
        const uploadedData: { name: string; url: string; size: number; type: string }[] = [];
        
        try {
            // 1. Upload Loop
            for (const file of selectedFiles) {
                const fileExt = file.name.split('.').pop();
                // مسیر فایل: projectId/milestoneId/filename
                const fileName = `${effectiveProjectId}/${milestone.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
                
                const { error: uploadError } = await supabase.storage
                    .from('project_files') // نام باکت
                    .upload(fileName, file);

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                    .from('project_files')
                    .getPublicUrl(fileName);
                
                uploadedData.push({
                    name: file.name,
                    url: publicUrl,
                    size: file.size,
                    type: file.type
                });
            }

            const finalNote = submissionText || "Files attached via platform.";

            // 2. Call Server Action
            if (effectiveProjectId) {
                const res = await submitMilestoneWorkAction(
                    milestone.id, 
                    effectiveProjectId, 
                    finalNote, 
                    uploadedData // لیست فایل‌های واقعی
                );

                if(res && typeof res === 'object' && 'error' in res) {
                    alert(res.error);
                } else {
                    window.location.reload(); 
                }
            }
        } catch (error: any) {
            console.error("Submission error:", error);
            alert("Failed to submit work: " + error.message);
        } finally {
            setUploading(false);
        }
    };

    // -------------------------------------------------------------------------
    // HANDLERS: CLIENT
    // -------------------------------------------------------------------------

    const handleApproveInternal = async () => {
        // If parent handler provided
        if (onApprove) {
            onApprove(milestone.id);
            return;
        }

        if (!confirm("Are you sure? This will release the locked funds to the freelancer immediately.")) return;
        
        setIsApproving(true);
        try {
            if (effectiveProjectId) {
                const res = await approveMilestoneAction(milestone.id, effectiveProjectId);
                if (res && typeof res === 'object' && 'error' in res) {
                    alert("Error: " + res.error);
                } else {
                    window.location.reload();
                }
            }
        } catch (error) {
            console.error(error);
            alert("Approval failed.");
        } finally {
            setIsApproving(false);
        }
    };

    // [UPDATED] Smart Dispute Handler
    const handleDisputeInternal = async () => {
        const reason = prompt("Please provide a specific reason for disputing this milestone. This will notify the admin:");
        
        if (!reason || reason.length < 5) {
            if (reason !== null) alert("Please provide a clearer reason.");
            return;
        }

        if (!effectiveProjectId) return;

        setIsDisputing(true);
        try {
            // Calling the NEW smart action that supports milestone-level disputes
            const res = await createDisputeAction(effectiveProjectId, reason, milestone.id);
            
            if (res && typeof res === 'object' && 'error' in res) {
                alert("Error raising dispute: " + res.error);
            } else {
                alert("Dispute raised. Admin has been notified.");
                window.location.reload();
            }
        } catch (error) {
            console.error("Dispute error:", error);
            alert("Failed to raise dispute.");
        } finally {
            setIsDisputing(false);
        }
    };

    const handleRequestRevisionInternal = () => {
        const feedback = prompt("Enter feedback for revision:");
        if (feedback && onRequestRevision) {
            onRequestRevision(milestone.id, feedback);
        }
    };

    const handleRunAnalysis = async () => {
        if (!effectiveProjectId) return;
        const res = await processMilestoneDecisionAction(milestone.id, effectiveProjectId);
        if(res.success && res.analysis) {
            alert(`AI Analysis Complete.\nRecommendation: ${res.analysis.action}\nScore: ${res.analysis.scores?.delivery_score}`);
            window.location.reload();
        }
    };

    // Helper to render Status Icon based on string
    const renderStatusIcon = () => {
        const s = milestone.status;
        if (s === 'approved' || s === 'released' || s === 'COMPLETED') return <CheckCircle2 className="w-5 h-5" />;
        if (s === 'disputed' || s === 'DISPUTED') return <Gavel className="w-5 h-5" />; // Changed to Gavel
        if (s === 'submitted' || s === 'SUBMITTED') return <Play className="w-5 h-5 fill-current" />;
        if (s === 'cancelled') return <XCircle className="w-5 h-5"/>;
        if (s === 'ACTIVE' || s === 'funded') return <Clock className="w-5 h-5 animate-pulse" />;
        return <Lock className="w-5 h-5" />;
    };

    // -------------------------------------------------------------------------
    // RENDER
    // -------------------------------------------------------------------------

    return (
        <div className={`bg-white border rounded-xl overflow-hidden shadow-sm mb-4 transition-all hover:shadow-md ${expanded ? 'border-[#1F3C88]/30 ring-1 ring-[#1F3C88]/10' : 'border-slate-200'}`}>
            
            {/* 1. Header / Summary Card */}
            <div className="p-5 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => setExpanded(!expanded)}>
                <div className="flex items-center gap-4">
                    {/* Status Icon */}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center border ${statusColor}`}>
                        {renderStatusIcon()}
                    </div>
                    
                    {/* Title & Meta */}
                    <div>
                        <h4 className="font-bold text-slate-900 text-sm md:text-base flex items-center gap-2">
                            {milestone.title}
                            {(milestone.order_index !== undefined || index !== undefined) && (
                                <span className="text-[10px] text-slate-400 font-normal">
                                    #{milestone.order_index !== undefined ? milestone.order_index + 1 : (index || 0) + 1}
                                </span>
                            )}
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                            <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider border ${statusColor}`}>
                                {milestone.status}
                            </span>
                            {milestone.due_date && (
                                <span className="text-xs text-slate-400 flex items-center gap-1">
                                    Due: {new Date(milestone.due_date).toLocaleDateString()}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                
                {/* Amount & Arrow */}
                <div className="flex items-center gap-6">
                    <div className="text-right hidden md:block">
                        <span className="block font-bold text-lg text-slate-900">${milestone.amount.toLocaleString()}</span>
                        <span className="text-xs text-slate-400 font-medium uppercase tracking-wide">
                            {['approved', 'released', 'COMPLETED'].includes(milestone.status) ? 'Paid' : 'Locked'}
                        </span>
                    </div>
                    <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} />
                </div>
            </div>

            {/* 2. Progress Bar (Visual Indicator) */}
            <div className="w-full h-[2px] bg-slate-50">
                <div 
                    className={`h-full transition-all duration-1000 ${
                        ['approved', 'released', 'COMPLETED'].includes(milestone.status) ? 'bg-[#2ECC71] w-full' : 
                        ['submitted', 'SUBMITTED'].includes(milestone.status) ? 'bg-[#1F3C88] w-[60%]' : 
                        ['disputed', 'DISPUTED'].includes(milestone.status) ? 'bg-[#E74C3C] w-full' : 'w-0'
                    }`} 
                />
            </div>

            {/* 3. Expanded Content Body */}
            {expanded && (
                <div className="p-6 bg-[#F7F8FA] border-t border-slate-100 animate-in slide-in-from-top-1">
                    
                    {/* Deliverables Description */}
                    <div className="mb-6">
                        <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-2">
                            <FileText className="w-3 h-3"/> Required Deliverables
                        </h5>
                        <div className="bg-white p-4 rounded-lg border border-slate-200 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed shadow-sm">
                            {milestone.deliverables || milestone.description || "No specific deliverables listed."}
                        </div>
                    </div>

                    {/* AI DECISION ENGINE INSIGHTS (Visible to Admin/Client) */}
                    {engineData && (
                        <div className="mb-6 p-4 bg-indigo-50 border border-indigo-100 rounded-lg flex items-center justify-between shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="bg-indigo-100 p-2 rounded-full">
                                    <BrainCircuit className="w-5 h-5 text-indigo-600" />
                                </div>
                                <div className="text-xs text-indigo-900">
                                    <span className="font-bold block mb-1 text-sm">Smart Engine Analysis</span>
                                    <div className="flex gap-4 text-[11px] opacity-80 font-mono mt-1">
                                        <span>Rec: <b>{engineData.action}</b></span>
                                        {engineData.scores && (
                                            <>
                                                <span>Risk: {engineData.scores.risk_score}/100</span>
                                                <span>Quality: {engineData.scores.delivery_score}/100</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- FREELANCER VIEW: Submission Form (REAL UPLOAD) --- */}
                    {!effectiveIsClient && (milestone.status === 'pending' || milestone.status === 'funded' || milestone.status === 'ACTIVE') && (
                        <div className="bg-white p-6 rounded-xl border border-dashed border-slate-300 text-center shadow-sm">
                            <h5 className="text-sm font-bold text-slate-900 mb-2">Ready to submit work?</h5>
                            <p className="text-xs text-slate-500 mb-6 max-w-md mx-auto">
                                Upload your evidence (files, links, or GitHub repos) to verify completion. Once submitted, the client will review it.
                            </p>
                            
                            <div className="max-w-md mx-auto space-y-4">
                                <textarea
                                    className="w-full p-3 border border-slate-200 rounded-lg text-sm focus:border-blue-500 outline-none transition-all"
                                    placeholder="Add notes, GitHub links, or description..."
                                    rows={3}
                                    value={submissionText}
                                    onChange={(e) => setSubmissionText(e.target.value)}
                                />
                                
                                {milestone.verification_method !== 'link' && (
                                    <div className="space-y-3">
                                        {/* File Input & Button */}
                                        <div className="flex gap-2 justify-center">
                                            <input 
                                                type="file" 
                                                multiple // <--- Allow Multiple
                                                ref={fileInputRef}
                                                className="hidden"
                                                onChange={handleFileSelect}
                                            />
                                            <Button 
                                                onClick={() => fileInputRef.current?.click()}
                                                type="button" 
                                                variant="outline" 
                                                className="w-full border-dashed text-slate-500 hover:text-blue-600 hover:border-blue-300 text-xs py-3"
                                            >
                                                <Paperclip className="w-4 h-4 mr-2"/> Attach Files
                                            </Button>
                                        </div>

                                        {/* Selected Files Preview */}
                                        {selectedFiles.length > 0 && (
                                            <div className="space-y-2">
                                                {selectedFiles.map((file, i) => (
                                                    <div key={i} className="flex items-center justify-between p-2 bg-slate-50 rounded border border-slate-100 text-xs">
                                                        <div className="flex items-center gap-2 truncate">
                                                            <div className="w-6 h-6 bg-white border rounded flex items-center justify-center text-[10px] font-bold text-slate-500 uppercase">
                                                                {file.name.split('.').pop()}
                                                            </div>
                                                            <span className="truncate max-w-[150px] text-slate-700" title={file.name}>{file.name}</span>
                                                            <span className="text-slate-400 text-[10px]">({formatFileSize(file.size)})</span>
                                                        </div>
                                                        <button 
                                                            onClick={() => removeSelectedFile(i)}
                                                            className="text-slate-400 hover:text-red-500 transition-colors p-1"
                                                        >
                                                            <Trash2 className="w-3 h-3"/>
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                <Button 
                                    onClick={handleFreelancerSubmit} 
                                    disabled={uploading} 
                                    className="w-full bg-[#1F3C88] hover:bg-[#162a60] text-white shadow-lg shadow-blue-900/10 font-bold py-2"
                                >
                                    {uploading ? (
                                        <><Loader2 className="w-4 h-4 mr-2 animate-spin"/> Uploading & Submitting...</>
                                    ) : (
                                        <><Upload className="w-4 h-4 mr-2" /> Submit for Review</>
                                    )}
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* --- CLIENT VIEW: Approval / Dispute Actions --- */}
                    {effectiveIsClient && (milestone.status === 'submitted' || milestone.status === 'SUBMITTED') && (
                        <div className="bg-white p-5 rounded-xl border border-blue-100 shadow-md ring-4 ring-blue-50">
                            <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-50">
                                <div>
                                    <h5 className="font-bold text-[#1F3C88] flex items-center gap-2">
                                        <Play className="w-4 h-4 fill-current"/> Freelancer Submitted Work
                                    </h5>
                                    <p className="text-xs text-slate-500 mt-1">Review the evidence below carefully.</p>
                                </div>
                                <div className="text-right">
                                     <p className="text-[10px] text-slate-400 uppercase tracking-wide">Auto-Approve: 48h</p>
                                </div>
                            </div>

                            {/* Evidence Display (Updated for Real Files) */}
                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-6 flex flex-col gap-4">
                                {/* Notes */}
                                <div className="flex items-start gap-3">
                                    <FileText className="w-5 h-5 text-blue-400 mt-1 shrink-0" />
                                    <div className="overflow-hidden w-full">
                                        <p className="text-sm font-medium text-slate-900 break-words leading-relaxed">
                                            {milestone.submission_note || "No notes provided."}
                                        </p>
                                    </div>
                                </div>

                                {/* [NEW] Files List */}
                                <div className="pl-8">
                                    {submittedFiles.length > 0 ? (
                                        <div className="grid grid-cols-1 gap-2">
                                            {submittedFiles.map((file) => (
                                                <div key={file.id} className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-slate-200 hover:shadow-sm transition-all group">
                                                    <div className="flex items-center gap-3 overflow-hidden">
                                                        <div className="bg-blue-50 p-1.5 rounded text-blue-600 font-bold text-[10px] uppercase w-8 h-8 flex items-center justify-center border border-blue-100">
                                                            {file.file_type?.split('/')[1] || 'FILE'}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-xs font-bold text-slate-700 truncate max-w-[200px]" title={file.file_name}>
                                                                {file.file_name}
                                                            </p>
                                                            <p className="text-[10px] text-slate-400 font-mono">
                                                                {formatFileSize(file.file_size)} • {new Date(file.created_at).toLocaleDateString()}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <a 
                                                        href={file.file_url} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer"
                                                        className="flex items-center gap-1 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-md transition-colors"
                                                    >
                                                        <Download className="w-3 h-3"/> Download
                                                    </a>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        // Fallback for legacy single file or no file
                                        milestone.submission_file_url ? (
                                            <div className="mt-2 flex items-center gap-2 p-2 bg-white rounded border border-slate-200 w-fit">
                                                <Download className="w-3 h-3 text-slate-400"/>
                                                <span className="text-xs font-mono text-slate-600 truncate max-w-[200px]">
                                                    {milestone.submission_file_url}
                                                </span>
                                                <a href={milestone.submission_file_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-xs flex items-center font-bold ml-2">
                                                    Open <ExternalLink className="w-3 h-3 ml-1" />
                                                </a>
                                            </div>
                                        ) : (
                                            <p className="text-xs text-slate-400 italic mt-2">No files attached.</p>
                                        )
                                    )}
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-3 justify-end items-center flex-wrap">
                                <button 
                                    onClick={handleRunAnalysis} 
                                    className="mr-auto text-[10px] text-indigo-400 hover:text-indigo-600 underline flex items-center gap-1"
                                >
                                    <BrainCircuit className="w-3 h-3"/> Analyze Risk (Beta)
                                </button>

                                {onRequestRevision && (
                                    <Button onClick={handleRequestRevisionInternal} variant="outline" className="text-orange-500 border-orange-200 hover:bg-orange-50 font-bold text-xs">
                                        Request Revision
                                    </Button>
                                )}

                                {/* Dispute Button with Loading State */}
                                <Button 
                                    onClick={handleDisputeInternal} 
                                    disabled={isDisputing || isApproving}
                                    variant="outline" 
                                    className="text-[#E74C3C] border-[#E74C3C]/30 hover:bg-[#E74C3C]/5 font-bold text-xs"
                                >
                                    {isDisputing ? (
                                        <><Loader2 className="w-4 h-4 mr-2 animate-spin"/> Processing...</>
                                    ) : (
                                        <><AlertTriangle className="w-4 h-4 mr-2"/> Reject / Dispute</>
                                    )}
                                </Button>
                                
                                {/* Approve Button with Loading State */}
                                <Button 
                                    onClick={handleApproveInternal} 
                                    disabled={isDisputing || isApproving}
                                    className="bg-[#2ECC71] hover:bg-[#27ae60] text-white border-0 shadow-lg shadow-green-900/20 font-bold px-6"
                                >
                                    {isApproving ? (
                                        <><Loader2 className="w-4 h-4 mr-2 animate-spin"/> Releasing...</>
                                    ) : (
                                        <><ShieldCheck className="w-4 h-4 mr-2"/> Approve & Release</>
                                    )}
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* --- READ ONLY: Approved State --- */}
                    {['approved', 'released', 'COMPLETED'].includes(milestone.status) && (
                        <div className="flex flex-col md:flex-row items-center justify-between p-6 bg-[#2ECC71]/5 border border-[#2ECC71]/20 rounded-xl text-[#2ECC71] text-sm font-bold gap-3 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-[#2ECC71]/10 rounded-full">
                                    <ShieldCheck className="w-6 h-6" />
                                </div>
                                <div>
                                    <span className="block text-lg">Funds Released</span>
                                    <span className="text-xs opacity-80 font-normal">Funds transferred to freelancer wallet.</span>
                                </div>
                            </div>
                            
                            {/* Transaction Hash Display */}
                            {milestone.decision_hash && (
                                <a 
                                    href={`${SCAN_URL}${milestone.decision_hash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-[#2ECC71]/30 hover:border-[#2ECC71] transition-colors text-xs text-slate-600 font-mono"
                                >
                                    <span>TX: {formatHash(milestone.decision_hash)}</span>
                                    <ExternalLink className="w-3 h-3 text-slate-400" />
                                </a>
                            )}
                        </div>
                    )}
                      
                    {/* --- READ ONLY: Disputed State --- */}
                    {['disputed', 'DISPUTED'].includes(milestone.status) && (
                        <div className="p-5 bg-[#E74C3C]/5 border border-[#E74C3C]/20 rounded-xl">
                            <div className="flex items-center gap-2 text-[#E74C3C] text-sm font-bold mb-3">
                                <Gavel className="w-5 h-5" />
                                Dispute Active
                            </div>
                            <p className="text-xs text-slate-600 leading-relaxed mb-3">
                                An admin has been notified and is reviewing the case in the Dispute Room. 
                                Funds for this milestone are currently frozen in the smart contract.
                            </p>
                            
                            {/* History or Reason Display */}
                             <div className="bg-white p-3 rounded border border-red-100 flex flex-col gap-2">
                                <div className="flex items-center gap-2 text-xs text-slate-400">
                                    <History className="w-3 h-3" />
                                    <span>Status History</span>
                                </div>
                                <p className="text-xs text-slate-500 italic">
                                    <span className="font-bold text-slate-700 not-italic">Last Note:</span> {milestone.submission_note || "Dispute raised by user."}
                                </p>
                             </div>
                        </div>
                    )}

                </div>
            )}
        </div>
    );
}