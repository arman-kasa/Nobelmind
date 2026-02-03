// [FILE: app/dashboard/projects/[id]/proposal/page.tsx]
'use client';

/**
 * ============================================================================
 * PROPOSAL SUBMISSION PAGE (Duration & Budget Based)
 * ============================================================================
 * * This page allows freelancers to submit a proposal for a specific project.
 * Unlike standard forms, this implementation utilizes a "Dual Validation System":
 * * 1. Budget Validation: The sum of all milestone prices must equal the Total Bid.
 * 2. Time Validation: The sum of all milestone durations (days) must equal the Total Duration.
 * * The previous "Calendar Date" logic has been replaced entirely with a numeric 
 * "Days" logic to better support agile estimation and database storage of 
 * relative durations rather than fixed dates.
 * * @module ProposalPage
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { 
    ArrowLeft, 
    Send, 
    DollarSign, 
    Clock, 
    Plus, 
    Trash2, 
    ShieldCheck, 
    FileText, 
    CheckCircle2, 
    LayoutList, 
    AlertTriangle, 
    Info, 
    Hourglass,
    Calculator,
    Briefcase
} from 'lucide-react';
import { Button, useToast, SpotlightCard, Badge } from '@/components/ui/shared';
import { submitProposalAction } from '@/app/actions';

// =================================================================
// 1. TYPE DEFINITIONS
// =================================================================

/**
 * ProjectData
 * Represents the immutable project details fetched from the database.
 */
interface ProjectData {
    id: string;
    title: string;
    description: string;
    budget: number;
    currency?: string;
    skills_required?: string[];
    client_id: string;
    created_at?: string;
}

/**
 * MilestoneDraft
 * Represents a single phase in the proposal.
 * * Changes from previous version:
 * - Removed `due_date` (string)
 * - Added `days` (string) to handle numeric duration input
 */
interface MilestoneDraft {
    /** Unique identifier for the UI list (timestamp based) */
    id: number;
    
    /** The name of the phase (e.g., "Design", "Backend") */
    title: string;
    
    /** The monetary value of this phase */
    amount: string; 
    
    /** The duration of this phase in days */
    days: string;   
    
    /** What will be delivered */
    deliverables: string;
}

// =================================================================
// 2. HELPER COMPONENTS
// =================================================================

/**
 * InputLabel
 * A reusable accessible label component with optional right-side hint.
 */
const InputLabel = ({ 
    label, 
    icon: Icon, 
    hint,
    required = false 
}: { 
    label: string; 
    icon?: React.ElementType; 
    hint?: React.ReactNode;
    required?: boolean;
}) => (
    <div className="flex justify-between items-end mb-2">
        <label className="text-[11px] uppercase tracking-wider font-bold text-slate-500 flex items-center gap-1.5">
            {Icon && <Icon className="w-3.5 h-3.5" />}
            {label}
            {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        {hint && <span className="text-[10px] text-slate-400 font-medium">{hint}</span>}
    </div>
);

/**
 * StatBox
 * Displays a summary statistic (Budget or Time) in the footer.
 */
const StatBox = ({
    label,
    current,
    target,
    isValid,
    unit = '',
    prefix = ''
}: {
    label: string;
    current: number;
    target: number;
    isValid: boolean;
    unit?: string;
    prefix?: string;
}) => {
    const diff = (target - current);
    const diffFormatted = Number.isInteger(diff) ? diff : diff.toFixed(2);
    
    // Determine colors based on validity
    const valueColor = isValid 
        ? 'text-slate-700' 
        : diff > 0 
            ? 'text-amber-600' // Under allocated
            : 'text-red-600';  // Over allocated

    return (
        <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase font-bold text-slate-400 mb-1">{label}</span>
            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                <span className={`font-mono text-sm font-bold ${valueColor}`}>
                    {prefix}{current.toLocaleString()}{unit}
                </span>
                <span className="text-slate-300">/</span>
                <span className="font-mono text-sm text-slate-500">
                    {prefix}{target.toLocaleString()}{unit}
                </span>
            </div>
            {!isValid && (
                <span className="text-[10px] font-medium mt-1 text-red-500 animate-pulse">
                    Diff: {diff > 0 ? '-' : '+'}{Math.abs(Number(diffFormatted))}{unit}
                </span>
            )}
        </div>
    );
};

/**
 * MilestoneRow Component
 * * Renders the input fields for a single milestone.
 * Handles the logic for "Price Percentage" and "Time Percentage" visualization.
 */
const MilestoneRow = ({ 
    milestone, 
    index, 
    totalBid, 
    totalDuration,
    onUpdate, 
    onRemove, 
    canRemove 
}: { 
    milestone: MilestoneDraft; 
    index: number; 
    totalBid: number;
    totalDuration: number;
    onUpdate: (id: number, field: keyof MilestoneDraft, value: string) => void; 
    onRemove: (id: number) => void;
    canRemove: boolean;
}) => {
    // --- Calculations for Budget Validation ---
    const amountVal = parseFloat(milestone.amount) || 0;
    const pricePercentage = totalBid > 0 ? ((amountVal / totalBid) * 100).toFixed(1) : '0';
    const isOverBudget = totalBid > 0 && amountVal > totalBid;

    // --- Calculations for Time Validation ---
    const daysVal = parseFloat(milestone.days) || 0;
    const timePercentage = totalDuration > 0 ? ((daysVal / totalDuration) * 100).toFixed(1) : '0';
    const isOverTime = totalDuration > 0 && daysVal > totalDuration;

    return (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 relative group transition-all hover:border-blue-300 hover:shadow-lg hover:shadow-blue-900/5 animate-in slide-in-from-bottom-2 duration-300">
            
            {/* Row Number Badge (Visual Only) */}
            <div className="absolute -left-3 top-6 w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold shadow-md z-10">
                {index + 1}
            </div>

            <div className="flex flex-col gap-5">
                
                {/* 1. TOP SECTION: Title */}
                <div className="w-full">
                    <InputLabel label="Phase Title" icon={LayoutList} />
                    <input 
                        type="text" 
                        placeholder={`e.g. Phase ${index + 1}: Implementation & Testing`}
                        value={milestone.title}
                        onChange={(e) => onUpdate(milestone.id, 'title', e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:bg-white focus:border-[#1F3C88] focus:ring-4 focus:ring-blue-50 transition-all placeholder:text-slate-300 font-medium text-slate-800"
                    />
                </div>

                {/* 2. MIDDLE SECTION: Budget & Time (Side-by-Side) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    
                    {/* Budget Allocation Input */}
                    <div className="relative">
                        <InputLabel 
                            label="Budget Allocation" 
                            hint={`${pricePercentage}% of Total`} 
                            icon={DollarSign} 
                        />
                        <div className="flex items-center">
                            <div className="absolute left-0 top-7 bottom-0 w-10 flex items-center justify-center pointer-events-none z-10">
                                <span className="text-slate-400 font-bold">$</span>
                            </div>
                            <input 
                                type="number" 
                                placeholder="0.00"
                                value={milestone.amount}
                                onChange={(e) => onUpdate(milestone.id, 'amount', e.target.value)}
                                className={`w-full pl-9 pr-20 py-3 bg-white border rounded-xl text-sm outline-none focus:ring-4 transition-all font-bold ${
                                    isOverBudget 
                                    ? 'border-red-300 text-red-600 focus:border-red-500 focus:ring-red-100' 
                                    : 'border-slate-200 text-slate-800 focus:border-emerald-500 focus:ring-emerald-50'
                                }`}
                            />
                            {/* Percentage Badge Inside Input */}
                            <div className="absolute right-2 top-[34px]">
                                <Badge 
                                    variant="secondary" 
                                    className={`h-6 text-[10px] ${isOverBudget ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'}`}
                                >
                                    {pricePercentage}%
                                </Badge>
                            </div>
                        </div>
                    </div>

                    {/* Time Allocation Input (Numeric Days) */}
                    <div className="relative">
                        <InputLabel 
                            label="Time Allocation" 
                            hint={`${timePercentage}% of Duration`} 
                            icon={Hourglass} 
                        />
                        <div className="flex items-center">
                             <div className="absolute left-0 top-7 bottom-0 w-10 flex items-center justify-center pointer-events-none z-10">
                                <Clock className="w-4 h-4 text-slate-400" />
                            </div>
                            <input 
                                type="number" 
                                placeholder="0"
                                value={milestone.days}
                                onChange={(e) => onUpdate(milestone.id, 'days', e.target.value)}
                                className={`w-full pl-10 pr-20 py-3 bg-white border rounded-xl text-sm outline-none focus:ring-4 transition-all font-bold ${
                                    isOverTime
                                    ? 'border-red-300 text-red-600 focus:border-red-500 focus:ring-red-100' 
                                    : 'border-slate-200 text-slate-800 focus:border-purple-500 focus:ring-purple-50'
                                }`}
                            />
                             <div className="absolute right-2 top-[34px] flex items-center gap-1">
                                <span className="text-xs font-medium text-slate-400 mr-1">Days</span>
                                <Badge 
                                    variant="secondary" 
                                    className={`h-6 text-[10px] ${isOverTime ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'}`}
                                >
                                    {timePercentage}%
                                </Badge>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. BOTTOM SECTION: Deliverables */}
                <div>
                    <InputLabel label="Deliverables & Acceptance Criteria" icon={FileText} />
                    <textarea 
                        placeholder="Define clear deliverables for this phase (e.g. 'Homepage Design Figma File', 'API Endpoint Documentation')..."
                        value={milestone.deliverables}
                        onChange={(e) => onUpdate(milestone.id, 'deliverables', e.target.value)}
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:bg-white focus:border-[#1F3C88] focus:ring-4 focus:ring-blue-50 resize-none h-24 transition-all leading-relaxed placeholder:text-slate-400"
                    />
                </div>

                {/* 4. ACTIONS: Delete Button */}
                <div className="flex justify-end pt-2 border-t border-slate-100 mt-2">
                     <button 
                        onClick={() => onRemove(milestone.id)} 
                        disabled={!canRemove}
                        className={`text-xs flex items-center gap-1 px-3 py-2 rounded-lg transition-all ${
                            canRemove 
                            ? 'text-slate-400 hover:bg-red-50 hover:text-red-600' 
                            : 'text-slate-200 cursor-not-allowed'
                        }`}
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                        {canRemove ? "Remove Phase" : "Minimum 1 Phase Required"}
                    </button>
                </div>
            </div>
        </div>
    );
};

// =================================================================
// 3. MAIN PAGE COMPONENT
// =================================================================

export default function SubmitProposalPage({ params }: { params: { id: string } }) {
    // --- Hooks & State ---
    const [supabase] = useState(() => createClient());
    const router = useRouter();
    const { showToast } = useToast();
    
    // Core Data State
    const [project, setProject] = useState<ProjectData | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    
    // Form Data State
    const [coverLetter, setCoverLetter] = useState('');
    const [totalBid, setTotalBid] = useState<string>('');
    const [totalDuration, setTotalDuration] = useState<string>(''); // Numeric string for total days
    
    // Milestones State (Initialized with one empty milestone)
    // Note: 'due_date' is removed from initialization
    const [milestones, setMilestones] = useState<MilestoneDraft[]>([
        { 
            id: Date.now(), 
            title: 'Phase 1: Mobilization & Setup', 
            amount: '', 
            days: '', 
            deliverables: '' 
        }
    ]);

    // ----------------------------------------------------------------
    // COMPUTED VALUES & VALIDATION LOGIC
    // ----------------------------------------------------------------

    /**
     * Calculate total allocated budget from milestones.
     */
    const calculatedTotalBid = useMemo(() => {
        return milestones.reduce((sum, m) => sum + (parseFloat(m.amount) || 0), 0);
    }, [milestones]);

    /**
     * Calculate total allocated days from milestones.
     */
    const calculatedTotalDays = useMemo(() => {
        return milestones.reduce((sum, m) => sum + (parseFloat(m.days) || 0), 0);
    }, [milestones]);

    /**
     * Validate Budget: Mismatch allowed margin is small (0.1 for float errors).
     */
    const bidDifference = useMemo(() => {
        const bid = parseFloat(totalBid) || 0;
        return (bid - calculatedTotalBid).toFixed(2);
    }, [totalBid, calculatedTotalBid]);
    const isBidMatching = Math.abs(parseFloat(bidDifference)) < 0.1;

    /**
     * Validate Time: Mismatch allowed margin is small.
     */
    const daysDifference = useMemo(() => {
        const days = parseFloat(totalDuration) || 0;
        return (days - calculatedTotalDays).toFixed(1);
    }, [totalDuration, calculatedTotalDays]);
    const isTimeMatching = Math.abs(parseFloat(daysDifference)) < 0.1;

    /**
     * Overall Form Validity Flag
     */
    const isFormValid = isBidMatching && isTimeMatching && totalBid !== '' && totalDuration !== '';

    // ----------------------------------------------------------------
    // EFFECTS: DATA LOADING
    // ----------------------------------------------------------------
    useEffect(() => {
        let mounted = true;
        
        const loadData = async () => {
            try {
                // 1. Authenticate User
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) { 
                    if(mounted) router.replace('/auth/login'); 
                    return; 
                }

                // 2. Fetch Project Data
                const { data: proj, error } = await supabase
                    .from('projects')
                    .select('*')
                    .eq('id', params.id)
                    .single();

                if (error || !proj) { 
                    console.error("Project fetch error:", error);
                    if(mounted) router.replace('/dashboard'); 
                    return; 
                }

                // 3. Check for Previous Proposals (Duplicate Check)
                const { data: existing } = await supabase.from('proposals')
                    .select('id')
                    .eq('project_id', params.id)
                    .eq('freelancer_id', user.id)
                    .maybeSingle();

                if (existing) {
                    showToast("You have already submitted a proposal for this project.", "info");
                    if(mounted) router.replace(`/dashboard/projects/${params.id}`);
                    return;
                }

                // 4. Initialize State with Project Defaults
                if (mounted) {
                    setProject(proj);
                    // Pre-fill bid with project budget as a suggestion
                    setTotalBid(proj.budget.toString());
                    // Default duration placeholder
                    setTotalDuration('14'); 
                    
                    // Update the first milestone to match these defaults automatically
                    setMilestones(prev => [{ 
                        ...prev[0], 
                        amount: proj.budget.toString(),
                        days: '14' 
                    }]);
                    
                    setLoading(false);
                }
            } catch (err) {
                console.error("Critical Load Error:", err);
                if(mounted) setLoading(false);
            }
        };

        loadData();
        return () => { mounted = false; };
    }, [params.id, router, supabase, showToast]);

    // ----------------------------------------------------------------
    // HANDLERS: MILESTONE MANAGEMENT
    // ----------------------------------------------------------------

    const addMilestone = () => {
        const newId = Date.now();
        const nextIndex = milestones.length + 1;
        
        // When adding a new milestone, we initialize it empty
        // The user must adjust other milestones to make the math work
        setMilestones([...milestones, { 
            id: newId, 
            title: `Phase ${nextIndex}: `, 
            amount: '', 
            days: '', 
            deliverables: '' 
        }]);
    };

    const removeMilestone = (id: number) => {
        if (milestones.length <= 1) {
            showToast("At least one milestone is required.", "error");
            return;
        }
        setMilestones(milestones.filter(m => m.id !== id));
    };

    const updateMilestone = (id: number, field: keyof MilestoneDraft, value: string) => {
        setMilestones(milestones.map(m => m.id === id ? { ...m, [field]: value } : m));
    };

    // ----------------------------------------------------------------
    // HANDLER: FORM SUBMISSION
    // ----------------------------------------------------------------

    const handleSubmit = async (e?: React.MouseEvent) => {
        // --- STEP 1: DEEP VALIDATION ---
        if (e && e.preventDefault) {
            e.preventDefault();
        }
        // 1.1 Cover Letter
        if (!coverLetter.trim() || coverLetter.length < 50) {
            showToast("Cover letter is too short. Please add more details (min 50 chars).", "error");
            return;
        }

        // 1.2 Basic numeric checks
        if (!totalBid || parseFloat(totalBid) <= 0) {
            showToast("Please enter a valid total bid amount.", "error");
            return;
        }
        if (!totalDuration || parseFloat(totalDuration) <= 0) {
            showToast("Please enter a valid project duration.", "error");
            return;
        }

        // 1.3 Logic checks (Sum vs Total)
        if (!isBidMatching) {
            showToast(`Budget Allocation Error: Milestones sum is off by $${bidDifference}.`, "error");
            return;
        }
        if (!isTimeMatching) {
            showToast(`Time Allocation Error: Days sum is off by ${daysDifference} days.`, "error");
            return;
        }

        // 1.4 Content checks
        const areMilestonesComplete = milestones.every(m => 
            m.title.trim().length >= 3 && 
            parseFloat(m.amount) > 0 && 
            parseFloat(m.days) > 0 &&
            m.deliverables.trim().length > 0
        );

        if (!areMilestonesComplete) {
            showToast("Incomplete Milestones: Please ensure all phases have a title, amount, duration, and deliverables.", "error");
            return;
        }

        // --- STEP 2: PAYLOAD CONSTRUCTION ---
        setSubmitting(true);
        
        try {
            const formData = new FormData();
            
            // Core Text Fields
            formData.append('coverLetter', coverLetter);
            
            // Numeric Fields (Sent as strings, parsed by backend)
            formData.append('price', totalBid);
            
            // NOTE: We now send just the number of days or a string like "14 Days"
            // The backend should store this as the estimated project duration.
            formData.append('duration', `${totalDuration} Days`);
            
            // Construct Clean Milestone JSON
            // IMPORTANT: logic has changed to send 'duration' instead of 'due_date'
            const cleanMilestones = milestones.map(m => ({
                title: m.title.trim(),
                amount: parseFloat(m.amount),
                // Database will now store 'duration' or 'days' instead of a hard calendar date
                duration: parseFloat(m.days), 
                deliverables: m.deliverables.trim(),
            }));

            formData.append('milestones', JSON.stringify(cleanMilestones));

            // Server Action Call
            const result = await submitProposalAction(params.id, formData);

            if (result?.error) {
                showToast(result.error, "error");
            } else {
                showToast("Proposal sent successfully! Redirecting...", "success");
                // Delay for UX
                setTimeout(() => {
                    router.replace(`/dashboard/projects/${params.id}`);
                }, 1500);
            }
        } catch (error) {
            console.error("Submission failed:", error);
            showToast("An unexpected network error occurred.", "error");
        } finally {
            setSubmitting(false);
        }
    };

    // ----------------------------------------------------------------
    // RENDER UI
    // ----------------------------------------------------------------

    if (loading) return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center text-slate-400 gap-4">
            <div className="w-12 h-12 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin"></div>
            <p className="text-sm font-medium animate-pulse">Retrieving project specifications...</p>
        </div>
    );
    
    if (!project) return null;

    return (
        <div className="max-w-5xl mx-auto pb-32 px-4 md:px-6 lg:px-8 pt-8">
            
            {/* --- PAGE HEADER --- */}
            <header className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <Button 
                        variant="ghost" 
                        onClick={() => router.back()} 
                        className="pl-0 hover:bg-transparent hover:text-blue-700 text-slate-500 mb-2"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" /> Cancel & Return to Project
                    </Button>
                    <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                        Submit Proposal
                    </h1>
                    <p className="text-slate-500 mt-2 flex items-center gap-2">
                        Applying for: <span className="font-semibold text-blue-700">{project.title}</span>
                        <Badge variant="outline" className="ml-2 bg-slate-100 text-slate-600">
                            Budget: ${project.budget.toLocaleString()}
                        </Badge>
                    </p>
                </div>
                
            </header>

            <div className="grid gap-10">
                
                {/* --- SECTION 1: PROPOSAL STRATEGY --- */}
                <section>
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">1</div>
                        <h2 className="text-xl font-bold text-slate-800">Proposal Strategy</h2>
                    </div>

                    <SpotlightCard className="!p-0 overflow-hidden border-t-4 border-t-[#1F3C88] shadow-xl shadow-slate-200/50">
                        <div className="p-8 space-y-8">
                            
                            {/* Cover Letter Field */}
                            <div className="space-y-3">
                                <div className="flex justify-between items-baseline">
                                    <label className="text-sm font-bold text-slate-700">Cover Letter</label>
                                    <span className={`text-xs font-mono ${coverLetter.length < 50 ? "text-amber-500" : "text-emerald-600"}`}>
                                        {coverLetter.length} characters
                                    </span>
                                </div>
                                <div className="relative group">
                                    <FileText className="absolute left-4 top-4 w-5 h-5 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                                    <textarea 
                                        value={coverLetter}
                                        onChange={(e) => setCoverLetter(e.target.value)}
                                        className="w-full h-56 pl-12 p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:bg-white focus:border-[#1F3C88] focus:ring-4 focus:ring-blue-50 resize-none transition-all leading-relaxed"
                                        placeholder="Explain your approach, relevant experience, and why you are the best fit for this project..."
                                    />
                                </div>
                            </div>

                            <div className="h-px bg-slate-100 w-full my-6"></div>

                            {/* Top Level Estimates (Bid & Time) */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                
                                {/* Total Bid Input */}
                                <div className="space-y-3">
                                    <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                        <DollarSign className="w-4 h-4 text-emerald-600" />
                                        Total Project Bid
                                    </label>
                                    <div className="relative group">
                                        <input 
                                            type="number"
                                            value={totalBid}
                                            onChange={(e) => setTotalBid(e.target.value)}
                                            className="w-full px-4 py-4 bg-white border border-slate-200 rounded-xl text-xl outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-50 font-bold text-slate-900 placeholder:text-slate-300 transition-all shadow-sm"
                                            placeholder="0.00"
                                        />
                                        <div className="absolute right-4 top-4 text-sm font-medium text-slate-400">USD</div>
                                    </div>
                                    <p className="text-xs text-slate-500 leading-relaxed">
                                        This is the total amount the client will pay. Your milestones must add up to this exact amount.
                                    </p>
                                </div>

                                {/* Total Duration Input (Days) */}
                                <div className="space-y-3">
                                    <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                        <Clock className="w-4 h-4 text-purple-600" />
                                        Estimated Duration
                                    </label>
                                    <div className="relative group">
                                        <input 
                                            type="number"
                                            value={totalDuration}
                                            onChange={(e) => setTotalDuration(e.target.value)}
                                            className="w-full px-4 py-4 bg-white border border-slate-200 rounded-xl text-xl outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-50 font-bold text-slate-900 placeholder:text-slate-300 transition-all shadow-sm"
                                            placeholder="e.g. 15"
                                        />
                                        <div className="absolute right-4 top-4 text-sm font-medium text-slate-400">Days</div>
                                    </div>
                                    <p className="text-xs text-slate-500 leading-relaxed">
                                        Total working days required. Your milestones duration must add up to this exact number.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </SpotlightCard>
                </section>

                {/* --- SECTION 2: MILESTONE BREAKDOWN --- */}
                <section>
                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">2</div>
                            <div>
                                <h2 className="text-xl font-bold text-slate-800">Scope Breakdown</h2>
                                <p className="text-sm text-slate-500">Define the phases of work. Validation checks automatically.</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button 
                                onClick={addMilestone} 
                                size="sm" 
                                className="bg-[#1F3C88] hover:bg-[#162a60] text-white text-xs shadow-lg shadow-blue-900/10"
                            >
                                <Plus className="w-3 h-3 mr-1" /> Add Phase
                            </Button>
                        </div>
                    </div>

                    <div className="space-y-6">
                        {milestones.map((m, index) => (
                            <MilestoneRow 
                                key={m.id}
                                index={index}
                                milestone={m}
                                totalBid={parseFloat(totalBid) || 0}
                                totalDuration={parseFloat(totalDuration) || 0}
                                onUpdate={updateMilestone}
                                onRemove={removeMilestone}
                                canRemove={milestones.length > 1}
                            />
                        ))}
                    </div>
                </section>

                {/* --- SECTION 3: SUMMARY FOOTER --- */}
                <section className="sticky bottom-6 z-40">
                    <SpotlightCard className="!p-0 overflow-hidden shadow-2xl border-t border-white/20 backdrop-blur-xl bg-white/90 supports-[backdrop-filter]:bg-white/80">
                        <div className="p-2">
                            <div className={`rounded-xl p-5 border transition-all duration-500 ${
                                isFormValid 
                                ? 'bg-emerald-50/50 border-emerald-100' 
                                : 'bg-slate-50/80 border-slate-200'
                            }`}>
                                <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                                    
                                    {/* Status Message */}
                                    <div className="flex items-center gap-4 w-full md:w-auto">
                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                                            isFormValid ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-400'
                                        }`}>
                                            {isFormValid 
                                                ? <CheckCircle2 className="w-6 h-6" /> 
                                                : <Calculator className="w-6 h-6" />
                                            }
                                        </div>
                                        <div>
                                            <h3 className={`font-bold text-sm ${isFormValid ? 'text-emerald-900' : 'text-slate-700'}`}>
                                                {isFormValid ? "Proposal Ready" : "Allocation Pending"}
                                            </h3>
                                            <p className="text-xs text-slate-500 mt-0.5">
                                                {isFormValid 
                                                    ? "All funds and days are perfectly distributed." 
                                                    : "Ensure your milestones match your totals."}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Vertical Divider (Desktop) */}
                                    <div className="hidden md:block w-px h-12 bg-slate-200"></div>

                                    {/* Stats Grid */}
                                    <div className="flex gap-8 w-full md:w-auto justify-between md:justify-end">
                                        
                                        {/* Budget Stat */}
                                        <StatBox 
                                            label="Budget Check"
                                            current={calculatedTotalBid}
                                            target={parseFloat(totalBid) || 0}
                                            isValid={isBidMatching}
                                            prefix="$"
                                        />

                                        {/* Time Stat */}
                                        <StatBox 
                                            label="Duration Check"
                                            current={calculatedTotalDays}
                                            target={parseFloat(totalDuration) || 0}
                                            isValid={isTimeMatching}
                                            unit="d"
                                        />
                                    </div>

                                    {/* Submit Button Area */}
                                    <div className="w-full md:w-auto pl-0 md:pl-6 md:border-l md:border-slate-200">
                                        <Button 
                                            onClick={handleSubmit} 
                                            disabled={submitting || !isFormValid} 
                                            className={`w-full md:w-auto h-12 px-8 text-sm font-bold shadow-lg transition-all active:scale-95 ${
                                                !isFormValid 
                                                ? 'bg-slate-300 cursor-not-allowed text-slate-500 shadow-none' 
                                                : 'bg-[#1F3C88] hover:bg-[#162a60] text-white hover:shadow-blue-900/20'
                                            }`}
                                        >
                                            {submitting ? (
                                                <span className="flex items-center gap-2">
                                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                                    Submitting...
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-2">
                                                    Submit Proposal <Send className="w-4 h-4" />
                                                </span>
                                            )}
                                        </Button>
                                    </div>
                                </div>

                                {/* Error Detail Hint */}
                                {!isFormValid && (
                                    <div className="mt-4 pt-3 border-t border-slate-200/50 flex flex-wrap gap-x-6 gap-y-2">
                                        {!isBidMatching && (
                                            <p className="text-[11px] text-red-500 font-medium flex items-center gap-1.5 bg-red-50 px-2 py-1 rounded">
                                                <AlertTriangle className="w-3 h-3" />
                                                Adjust milestone amounts to match Total Bid.
                                            </p>
                                        )}
                                        {!isTimeMatching && (
                                            <p className="text-[11px] text-red-500 font-medium flex items-center gap-1.5 bg-red-50 px-2 py-1 rounded">
                                                <AlertTriangle className="w-3 h-3" />
                                                Adjust milestone days to match Total Duration.
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </SpotlightCard>
                </section>

                {/* Footer Info */}
                <div className="text-center pb-8 opacity-50">
                    <p className="text-xs text-slate-400 flex items-center justify-center gap-2">
                        <Briefcase className="w-3 h-3" />
                        By submitting, you agree to the platform terms of service regarding project delivery.
                    </p>
                </div>

            </div>
        </div>
    );
}