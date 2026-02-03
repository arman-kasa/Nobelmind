// [FILE: app/dashboard/profile/page.tsx]
'use client';

import React, { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase';
import { 
    User, Layers, Briefcase, Plus, Trash2, Link as LinkIcon, 
    Star, Building, Check, X, Wallet, Lock, AlertTriangle, 
    Loader2, Info, Shield, Award, MousePointerClick
} from 'lucide-react';
import { Button, SpotlightCard, useToast } from '@/components/ui/shared';

// =================================================================
// CONFIGURATION & CONSTANTS
// =================================================================

const ALL_SKILLS = [
    "React", "Next.js", "TypeScript", "Node.js", "Tailwind CSS", 
    "Solidity", "Web3.js", "Python", "DeFi", "NFTs", "Rust", "Go", 
    "Smart Contracts", "UI/UX Design", "Figma", "PostgreSQL", 
    "MongoDB", "AWS", "Docker", "Kubernetes", "GraphQL", "Flutter",
    "Dart", "C++", "C#", "Unity", "Unreal Engine", "Blockchain Architecture"
];

// =================================================================
// 1. SUB-COMPONENTS
// =================================================================

/**
 * Optimized Skill Selector Component
 * Handles adding/removing skills and displays the locked state.
 */
const SkillSelector = ({ 
    selected, 
    onToggle, 
    disabled 
}: { 
    selected: string[], 
    onToggle: (skill: string) => void, 
    disabled: boolean 
}) => {
    const [input, setInput] = useState('');
    const [isOpen, setIsOpen] = useState(false);

    // Filter suggestions based on input and already selected skills
    const suggestions = input 
        ? ALL_SKILLS.filter(s => s.toLowerCase().includes(input.toLowerCase()) && !selected.includes(s))
        : ALL_SKILLS.filter(s => !selected.includes(s)).slice(0, 5); 

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (disabled) return;
        if (e.key === 'Enter' && input.trim()) {
            e.preventDefault(); 
            e.stopPropagation();
            onToggle(input.trim()); 
            setInput(''); 
            setIsOpen(false);
        }
    };

    return (
        <div className="w-full relative group space-y-3">
            {/* Active Skills List */}
            <div className="flex flex-wrap gap-2 min-h-[40px]">
                {selected.length === 0 && disabled && (
                    <span className="text-sm text-slate-400 italic">No skills recorded.</span>
                )}
                
                {selected.map((skill) => (
                    <span 
                        key={skill} 
                        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium animate-in fade-in zoom-in-95 border transition-colors
                        ${disabled 
                            ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed' 
                            : 'bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-100'
                        }`}
                    >
                        {skill} 
                        {!disabled && (
                            <button 
                                onClick={() => onToggle(skill)} 
                                className="ml-1 hover:text-red-500 focus:outline-none p-0.5 rounded-full hover:bg-blue-200/50 transition-colors"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        )}
                    </span>
                ))}
            </div>

            {/* Input Field (Hidden if Locked) */}
            {!disabled ? (
                <div className="relative z-50">
                    <div className="relative">
                        <input 
                            value={input} 
                            onChange={(e) => { setInput(e.target.value); setIsOpen(true); }} 
                            onFocus={() => setIsOpen(true)} 
                            onBlur={() => setTimeout(() => setIsOpen(false), 200)} 
                            onKeyDown={handleKeyDown} 
                            placeholder="Type a skill to add (e.g. React)..." 
                            className="w-full p-3 pl-4 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all relative z-20" 
                        />
                        <div className="absolute right-3 top-3 text-slate-400">
                            <Plus className="w-4 h-4" />
                        </div>
                    </div>
                    
                    {/* Suggestions Dropdown */}
                    {isOpen && suggestions.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl shadow-slate-200/50 z-50 max-h-60 overflow-y-auto animate-in slide-in-from-top-2 duration-200">
                            {suggestions.map(skill => (
                                <button 
                                    key={skill} 
                                    onClick={() => { onToggle(skill); setInput(''); setIsOpen(false); }} 
                                    className="w-full text-left px-4 py-3 hover:bg-slate-50 text-slate-700 text-sm transition-colors flex items-center justify-between group border-b border-slate-50 last:border-none"
                                >
                                    <span>{skill}</span>
                                    <Plus className="w-3 h-3 opacity-0 group-hover:opacity-100 text-blue-500 transition-opacity" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            ) : (
                <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500">
                    <Lock className="w-4 h-4 text-slate-400" />
                    <span>Skills are permanently locked. Create a new ID to add different skills.</span>
                </div>
            )}
        </div>
    );
};

/**
 * Reviews List Component
 * Fetches and displays user reviews.
 */
const ReviewsList = ({ userId }: { userId: string }) => {
    const [reviews, setReviews] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [supabase] = useState(() => createClient());

    useEffect(() => {
        const fetchReviews = async () => {
            if (!userId) return;
            const { data } = await supabase
                .from('reviews')
                // [CHANGED] دریافت ghost_id نویسنده نظر (reviewer)
                // فرض بر این است که reviewer_id کلید خارجی به جدول profiles است
                .select('*, reviewer:reviewer_id(ghost_id)') 
                .eq('reviewee_id', userId)
                .order('created_at', { ascending: false });
            
            if (data) setReviews(data);
            setLoading(false);
        };
        fetchReviews();
    }, [userId, supabase]);

    if (loading) return (
        <div className="flex items-center gap-2 text-xs text-slate-400 mt-6 justify-center py-4">
            <Loader2 className="w-3 h-3 animate-spin" /> Loading reviews...
        </div>
    );

    return (
        <div className="mt-8 border-t border-slate-100 pt-6">
            <div className="flex items-center gap-2 mb-6">
                <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                <h3 className="text-lg font-bold text-slate-900">Reviews & Reputation</h3>
            </div>
            
            <div className="space-y-4">
                {reviews.length === 0 ? (
                    <div className="p-8 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 text-center flex flex-col items-center gap-2">
                        <span className="p-3 bg-white rounded-full shadow-sm">
                             <Star className="w-5 h-5 text-slate-300" />
                        </span>
                        <p className="text-sm text-slate-500 font-medium">No reviews received yet.</p>
                        <p className="text-xs text-slate-400">Complete projects to build your reputation.</p>
                    </div>
                ) : (
                    reviews.map((r) => (
                        <div key={r.id} className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 bg-gradient-to-br from-slate-100 to-slate-200 rounded-full flex items-center justify-center">
                                        <User className="w-4 h-4 text-slate-500" />
                                    </div>
                                    <div>
                                        {/* [CHANGED] نمایش Ghost ID به جای متن ثابت */}
                                        <p className="font-bold text-sm text-slate-800 font-mono">
                                            {r.reviewer?.ghost_id || 'Anonymous Client'}
                                        </p>
                                        <p className="text-[10px] text-slate-400">{new Date(r.created_at).toLocaleDateString()}</p>
                                    </div>
                                </div>
                                <div className="flex text-amber-400 bg-amber-50 px-2 py-1 rounded-lg">
                                    {[...Array(5)].map((_, i) => (
                                        <Star key={i} className={`w-3 h-3 ${i < r.rating ? 'fill-current' : 'text-slate-300'}`} />
                                    ))}
                                </div>
                            </div>
                            <p className="text-sm text-slate-600 leading-relaxed pl-10">"{r.comment}"</p>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
/**
 * Wallet Confirmation Modal
 */
const WalletConfirmModal = ({ isOpen, onClose, onConfirm, address, isSaving }: any) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl scale-100 animate-in zoom-in-95">
                <div className="flex items-center gap-3 mb-4 text-amber-600">
                    <div className="p-2 bg-amber-100 rounded-full"><AlertTriangle className="w-6 h-6"/></div>
                    <h3 className="text-lg font-bold text-slate-900">Confirm Wallet Address</h3>
                </div>
                <p className="text-slate-600 text-sm mb-4 leading-relaxed">
                    You are setting your payout wallet to: <br/>
                    <span className="font-mono bg-slate-100 px-3 py-1.5 rounded-lg text-slate-800 text-xs break-all border border-slate-200 block mt-2 shadow-inner">
                        {address}
                    </span>
                </p>
                <div className="bg-red-50 p-4 rounded-xl border border-red-100 mb-6 flex gap-3">
                    <Lock className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                    <p className="text-red-700 text-xs font-medium leading-relaxed">
                        <strong className="block mb-1">Warning: Permanent Action</strong>
                        This address CANNOT be changed later for security reasons. Please verify it is a valid Polygon (MATIC) address.
                    </p>
                </div>
                <div className="flex gap-3 justify-end">
                    <Button variant="ghost" onClick={onClose} disabled={isSaving}>Cancel</Button>
                    <Button onClick={onConfirm} disabled={isSaving} className="bg-amber-600 hover:bg-amber-700 text-white">
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Check className="w-4 h-4 mr-2"/>}
                        Confirm & Lock
                    </Button>
                </div>
            </div>
        </div>
    );
};

/**
 * Skill Warning Modal
 * Displays critical warnings before locking skills.
 */
const SkillsWarningModal = ({ isOpen, onClose, onConfirm, isSaving }: any) => {
    if (!isOpen) return null;
  
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-300">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-red-100 scale-100 animate-in zoom-in-95 duration-200">
          
          {/* Header */}
          <div className="bg-red-50 p-6 border-b border-red-100 flex items-center gap-4">
            <div className="p-3 bg-white rounded-full shrink-0 shadow-sm border border-red-100">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-red-900">Important: Skill Lock</h3>
              <p className="text-xs text-red-700 font-medium opacity-90">Read carefully before proceeding</p>
            </div>
          </div>
  
          {/* Body */}
          <div className="p-6 space-y-5">
            <div className="flex gap-4 text-sm text-slate-700 leading-relaxed">
              <div className="p-2 bg-slate-100 rounded-lg h-fit">
                 <Lock className="w-5 h-5 text-slate-500" />
              </div>
              <p>
                <span className="font-bold text-slate-900 block mb-1">Immutability Protocol</span>
                Skills you record now are <span className="underline decoration-red-300 decoration-2 font-bold">permanent</span>. To add or change skills in the future, you will be required to create a completely new account ID.
              </p>
            </div>
  
            <div className="flex gap-4 text-sm text-slate-700 leading-relaxed p-4 bg-amber-50 rounded-xl border border-amber-100 shadow-sm">
              <div className="p-2 bg-amber-100 rounded-lg h-fit">
                 <Award className="w-5 h-5 text-amber-600" />
              </div>
              <p>
                <span className="font-bold text-amber-900 block mb-1">Trust Score Impact</span>
                Recording skills that you do not actively use or complete projects for will result in a 
                <span className="font-bold text-red-600 mx-1">deduction of your Total Trust Score</span>. 
                Only list skills you are proficient in.
              </p>
            </div>
            
            <p className="text-xs text-center text-slate-500 font-medium">
              Are you sure these skills are accurate and final?
            </p>
          </div>
  
          {/* Footer */}
          <div className="p-5 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200/50 rounded-xl transition-colors"
              disabled={isSaving}
            >
              Back to Edit
            </button>
            <button
              onClick={onConfirm}
              disabled={isSaving}
              className="px-6 py-2.5 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-lg shadow-red-600/20 transition-all flex items-center gap-2"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Check className="w-4 h-4"/>}
              Yes, Lock Skills
            </button>
          </div>
        </div>
      </div>
    );
  };

// =================================================================
// 2. MAIN PAGE COMPONENT
// =================================================================

export default function ProfilePage() {
    const [supabase] = useState(() => createClient());
    const { showToast } = useToast();
    
    // -- User Data State --
    const [profile, setProfile] = useState<any>(null);
    const [skills, setSkills] = useState<string[]>([]);
    const [bio, setBio] = useState('');
    const [portfolio, setPortfolio] = useState<any[]>([]);
    
    // -- Logic Flags & Security State --
    const [isSkillsLocked, setIsSkillsLocked] = useState(false);
    const [isWalletLocked, setIsWalletLocked] = useState(false);
    
    // -- Inputs --
    const [walletAddress, setWalletAddress] = useState('');
    const [newPortTitle, setNewPortTitle] = useState('');
    const [newPortLink, setNewPortLink] = useState('');
    
    // -- Modals --
    const [showWalletModal, setShowWalletModal] = useState(false);
    const [showSkillWarning, setShowSkillWarning] = useState(false);
    const [saving, setSaving] = useState(false);

    // Initialization ref
    const isInitialized = useRef(false);

    // ----------------------------------------------------------------
    // Data Fetching
    // ----------------------------------------------------------------
    useEffect(() => {
        let mounted = true;
        const fetchUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if(user) {
                const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
                if (mounted && data) {
                    setProfile(data);
                    
                    if (!isInitialized.current) {
                        // 1. Load Skills & Lock Status
                        const dbSkills = data.skills || [];
                        setSkills(dbSkills);
                        if (dbSkills.length > 0) {
                            setIsSkillsLocked(true); // Lock if skills exist
                        }

                        // 2. Load Bio & Portfolio
                        setBio(data.bio || '');
                        setPortfolio(data.portfolio || []);
                        
                        // 3. Load Wallet & Lock Status
                        if (data.wallet_address) {
                            setWalletAddress(data.wallet_address);
                            setIsWalletLocked(true);
                        }
                        
                        isInitialized.current = true;
                    }
                }
            }
        };
        fetchUser();
        return () => { mounted = false; };
    }, [supabase]);

    // ----------------------------------------------------------------
    // Handlers: Generic Save (Bio & Portfolio)
    // ----------------------------------------------------------------
    const saveGenericData = async () => {
        if (!profile) return;
        setSaving(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ bio, portfolio, updated_at: new Date().toISOString() })
                .eq('id', profile.id);
            
            if (error) throw error;
            showToast("Profile information updated successfully", "success");
        } catch (err: any) {
            showToast("Error saving profile: " + err.message, "error");
        } finally {
            setSaving(false);
        }
    };

    // ----------------------------------------------------------------
    // Handlers: Skill Management (Strict Locking)
    // ----------------------------------------------------------------
    const toggleSkill = (skill: string) => {
        if (isSkillsLocked) return; // Prevent toggling if locked
        setSkills(prev => {
            if (prev.includes(skill)) return prev.filter(s => s !== skill);
            return [...prev, skill];
        });
    };

    const handleSaveSkillsClick = () => {
        if (isSkillsLocked) {
            showToast("Skills are permanently locked and cannot be changed.", "error");
            return;
        }
        if (skills.length === 0) {
            showToast("Please add at least one skill before saving.", "error");
            return;
        }
        // Open the Warning Modal
        setShowSkillWarning(true);
    };

    const finalizeSkillSave = async () => {
        if (!profile) return;
        setSaving(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ skills: skills, updated_at: new Date().toISOString() })
                .eq('id', profile.id);

            if (error) throw error;

            // Lock immediately on frontend
            setIsSkillsLocked(true);
            setShowSkillWarning(false);
            showToast("Skills saved and locked successfully.", "success");

        } catch (err: any) {
            showToast("Failed to save skills: " + err.message, "error");
        } finally {
            setSaving(false);
        }
    };

    // ----------------------------------------------------------------
    // Handlers: Wallet Management
    // ----------------------------------------------------------------
    const handleWalletSubmit = () => {
        const isValid = /^0x[a-fA-F0-9]{40}$/.test(walletAddress);
        if (!isValid) {
            showToast("Invalid Wallet Address format. Must start with 0x...", "error");
            return;
        }
        setShowWalletModal(true);
    };

    const confirmSaveWallet = async () => {
        if (!profile) return;
        setSaving(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ wallet_address: walletAddress })
                .eq('id', profile.id);

            if (error) throw error;

            setIsWalletLocked(true);
            setShowWalletModal(false);
            showToast("Wallet address locked successfully.", "success");
        } catch (error: any) {
            showToast("Failed to save wallet: " + error.message, "error");
        } finally {
            setSaving(false);
        }
    };

    // ----------------------------------------------------------------
    // Rendering
    // ----------------------------------------------------------------
    if (!profile) return <div className="flex h-screen items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600"/></div>;
    const isClient = profile.user_type === 'client';

    return (
        <div className="max-w-5xl mx-auto animate-in fade-in duration-500 pb-24 px-4 md:px-6 pt-6">
            
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Your Profile</h1>
                    <p className="text-slate-500 mt-1">Manage your public identity, wallet, and expertise.</p>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-full text-sm font-medium border border-indigo-100">
                    <Shield className="w-4 h-4" />
                    <span>{isClient ? 'Client Account' : 'Freelancer Account'}</span>
                </div>
            </div>
            
            <div className="flex flex-col lg:grid lg:grid-cols-12 gap-8">
                
                {/* --- Left Column (Identity & Wallet) --- */}
                <div className="lg:col-span-5 space-y-6">
                    
                    {/* Identity Card */}
                    <SpotlightCard className="!p-6 md:!p-8">
                        <div className="flex items-center gap-3 mb-6">
                            <div className={`p-3 rounded-xl shadow-sm ${isClient ? 'bg-blue-50 text-blue-600' : 'bg-indigo-50 text-indigo-600'}`}>
                                {isClient ? <Building className="w-6 h-6" /> : <User className="w-6 h-6" />}
                            </div>
                            <h2 className="text-lg md:text-xl font-bold text-slate-900">{isClient ? 'Client Identity' : 'Freelancer ID'}</h2>
                        </div>
                        <div className="space-y-4">
                            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/60 group relative overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent translate-x-[-100%] group-hover:animate-shimmer" />
                                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-2 flex items-center gap-1">
                                    <Lock className="w-3 h-3" /> Public ID Hash
                                </p>
                                <p className="text-xs font-mono text-slate-600 break-all select-all leading-relaxed bg-white p-2 rounded border border-slate-100">{profile.ghost_id}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-white border border-slate-200 rounded-xl text-center shadow-sm">
                                    <p className="text-[10px] text-slate-400 uppercase mb-1 font-bold">Trust Score</p>
                                    <div className="flex items-center justify-center gap-1 text-emerald-600">
                                        <Award className="w-5 h-5" />
                                        <p className="text-2xl font-bold">{profile.trust_score}</p>
                                    </div>
                                </div>
                                <div className="p-4 bg-white border border-slate-200 rounded-xl text-center shadow-sm">
                                    <p className="text-[10px] text-slate-400 uppercase mb-1 font-bold">Role</p>
                                    <p className="text-lg font-bold text-slate-900 capitalize">{profile.user_type}</p>
                                </div>
                            </div>
                        </div>
                    </SpotlightCard>

                    {/* Wallet Card (Critical) */}
                    <SpotlightCard className={`!p-6 md:!p-8 transition-colors ${isWalletLocked ? 'border-green-200 bg-green-50/10' : 'border-amber-200 bg-amber-50/10'}`}>
                        <div className="flex items-center justify-between mb-5">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${isWalletLocked ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'}`}>
                                    <Wallet className="w-5 h-5" />
                                </div>
                                <h2 className="text-lg font-bold text-slate-900">Payout Wallet</h2>
                            </div>
                            {isWalletLocked && (
                                <span className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-[10px] font-bold uppercase rounded tracking-wide">
                                    <Lock className="w-3 h-3" /> Locked
                                </span>
                            )}
                        </div>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 flex items-center justify-between">
                                    <span>Polygon (USDT) Address</span>
                                    {!isWalletLocked && <span className="text-amber-600 text-[10px] normal-case">Not set yet</span>}
                                </label>
                                <div className="relative">
                                    <input 
                                        value={walletAddress} 
                                        onChange={(e) => setWalletAddress(e.target.value)} 
                                        disabled={isWalletLocked}
                                        placeholder="0x..." 
                                        className={`w-full p-3 pl-4 font-mono text-sm border rounded-xl outline-none transition-all ${
                                            isWalletLocked 
                                            ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed shadow-inner' 
                                            : 'bg-white border-slate-300 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10'
                                        }`} 
                                    />
                                    {isWalletLocked && (
                                        <Check className="absolute right-3 top-3 w-4 h-4 text-green-600" />
                                    )}
                                </div>
                                <p className="text-[10px] text-slate-400 mt-2 leading-normal">
                                    All payments and milestone releases will be sent to this Polygon address.
                                </p>
                            </div>
                            
                            {!isWalletLocked && (
                                <Button 
                                    onClick={handleWalletSubmit} 
                                    disabled={!walletAddress}
                                    className="w-full bg-amber-600 hover:bg-amber-700 text-white shadow-lg shadow-amber-900/10 h-11"
                                >
                                    Verify & Lock Address
                                </Button>
                            )}
                        </div>
                    </SpotlightCard>

                    {/* Bio Card */}
                    <SpotlightCard className="!p-6 md:!p-8">
                         <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-slate-100 rounded-lg text-slate-600"><Briefcase className="w-5 h-5" /></div>
                            <h2 className="text-lg font-bold text-slate-900">{isClient ? 'Company Bio' : 'About Me'}</h2>
                        </div>
                        <textarea 
                            value={bio} 
                            onChange={(e) => setBio(e.target.value)} 
                            className="w-full h-32 p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 resize-none transition-all" 
                            placeholder={isClient ? "Describe your organization..." : "Describe your experience and skills..."} 
                        />
                        <div className="mt-4 flex justify-end">
                            <Button onClick={saveGenericData} variant="primary" disabled={saving} className="text-xs h-9">
                                {saving ? 'Saving...' : 'Save Bio'}
                            </Button>
                        </div>
                    </SpotlightCard>
                </div>

                {/* --- Right Column (Skills & Portfolio) --- */}
                <div className="lg:col-span-7 space-y-6">
                    {!isClient ? (
                        <>
                            {/* Skills Matrix Card */}
                            <SpotlightCard className={`!p-6 md:!p-8 !overflow-visible transition-colors ${isSkillsLocked ? 'bg-slate-50/50' : 'bg-white'}`}> 
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                                            <Layers className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-bold text-slate-900">Skills Matrix</h2>
                                            {isSkillsLocked && <span className="text-xs text-slate-400">Verified & Locked</span>}
                                        </div>
                                    </div>
                                    
                                    {!isSkillsLocked && (
                                        <div className="flex items-center gap-1 text-[10px] text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-100">
                                            <Info className="w-3 h-3" />
                                            <span>Permanent once saved</span>
                                        </div>
                                    )}
                                    {isSkillsLocked && (
                                        <Lock className="w-5 h-5 text-slate-300" />
                                    )}
                                </div>
                                
                                <SkillSelector selected={skills} onToggle={toggleSkill} disabled={isSkillsLocked} />
                                
                                {!isSkillsLocked ? (
                                    <div className="mt-6 flex justify-end">
                                        <Button 
                                            onClick={handleSaveSkillsClick} 
                                            disabled={saving} 
                                            className="text-sm h-10 w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20"
                                        >
                                            {saving ? 'Processing...' : 'Save & Lock Skills'}
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="mt-6 pt-4 border-t border-slate-200">
                                        <p className="text-xs text-slate-400 italic flex items-center gap-1.5">
                                            <Shield className="w-3 h-3" />
                                            Skills are verified and cannot be modified to ensure platform integrity.
                                        </p>
                                    </div>
                                )}
                            </SpotlightCard>

                            {/* Portfolio Card */}
                            <SpotlightCard className="!p-6 md:!p-8 relative z-0">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
                                        <LinkIcon className="w-5 h-5" />
                                    </div>
                                    <h2 className="text-lg font-bold text-slate-900">Portfolio & Links</h2>
                                </div>
                                
                                {/* Portfolio Items List */}
                                <div className="space-y-3 mb-6">
                                    {portfolio.length === 0 && (
                                        <div className="text-center p-4 border border-dashed border-slate-200 rounded-xl bg-slate-50 text-slate-400 text-sm">
                                            No portfolio items added yet.
                                        </div>
                                    )}
                                    {portfolio.map((item, idx) => (
                                        <div key={idx} className="flex justify-between items-center p-3 bg-white hover:bg-slate-50 rounded-xl border border-slate-200 text-sm group transition-colors shadow-sm">
                                            <div className="overflow-hidden mr-4">
                                                <p className="font-semibold text-slate-800 truncate">{item.title}</p>
                                                <a href={item.link} target="_blank" rel="noreferrer" className="text-blue-500 text-xs truncate block hover:underline flex items-center gap-1 mt-0.5">
                                                    {item.link} <LinkIcon className="w-3 h-3" />
                                                </a>
                                            </div>
                                            <button 
                                                onClick={() => setPortfolio(prev => prev.filter((_, i) => i !== idx))}
                                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                {/* Add New Item */}
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
                                    <p className="text-xs font-bold text-slate-500 uppercase">Add New Project</p>
                                    <input 
                                        placeholder="Project Title (e.g. E-commerce App)" 
                                        className="w-full p-3 text-sm bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20" 
                                        value={newPortTitle} 
                                        onChange={e => setNewPortTitle(e.target.value)} 
                                    />
                                    <div className="flex gap-2">
                                        <input 
                                            placeholder="Link (e.g. github.com/...)" 
                                            className="flex-1 p-3 text-sm bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20" 
                                            value={newPortLink} 
                                            onChange={e => setNewPortLink(e.target.value)} 
                                        />
                                        <Button 
                                            onClick={() => { 
                                                if(newPortTitle && newPortLink) {
                                                    setPortfolio(prev => [...prev, {title: newPortTitle, link: newPortLink}]); 
                                                    setNewPortTitle(''); 
                                                    setNewPortLink(''); 
                                                }
                                            }} 
                                            variant="secondary" 
                                            className="aspect-square !p-0 w-11 flex items-center justify-center bg-white border border-slate-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200"
                                        >
                                            <Plus className="w-5 h-5" />
                                        </Button>
                                    </div>
                                </div>
                                <div className="mt-4 flex justify-end">
                                    <Button onClick={saveGenericData} variant="outline" className="w-full md:w-auto h-9 text-xs">
                                        Save Portfolio Changes
                                    </Button>
                                </div>
                            </SpotlightCard>
                            
                            <ReviewsList userId={profile.id} />
                        </>
                    ) : (
                        // Client View
                        <SpotlightCard className="!p-6 md:!p-8">
                             <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600"><Check className="w-5 h-5" /></div>
                                <h2 className="text-lg font-bold text-slate-900">Account Status</h2>
                            </div>
                             <div className="bg-emerald-50 text-emerald-800 p-5 rounded-xl text-sm flex items-start gap-3 border border-emerald-100">
                                <Check className="w-5 h-5 flex-shrink-0 mt-0.5" /> 
                                <div>
                                    <p className="font-bold mb-1">Verified Client Account</p>
                                    <p className="opacity-80 text-xs leading-relaxed">Your account allows for unrestricted project posting and escrow deposits. Maintain a high trust score to attract top talent.</p>
                                </div>
                            </div>
                             
                             <ReviewsList userId={profile.id} />
                        </SpotlightCard>
                    )}
                </div>
            </div>

            {/* Modals */}
            <WalletConfirmModal 
                isOpen={showWalletModal} 
                onClose={() => setShowWalletModal(false)} 
                onConfirm={confirmSaveWallet} 
                address={walletAddress}
                isSaving={saving}
            />

            <SkillsWarningModal
                isOpen={showSkillWarning}
                onClose={() => setShowSkillWarning(false)}
                onConfirm={finalizeSkillSave}
                isSaving={saving}
            />

        </div>
    );
}