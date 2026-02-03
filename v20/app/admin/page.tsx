// [FILE: app/admin/page.tsx]
'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '../../lib/supabase'
import { 
    verifyAdminPassword, 
    adminResolveDisputeAction, 
    toggleUserBlockAction, 
    getAdminUsersListAction,
    getDisputeEvidenceAction,
    toggleProjectBlockAction,
    getAdminProjectsListAction
} from '../actions'
import { 
    LayoutDashboard, Users, AlertOctagon, FileText, Activity, 
    Search, ShieldAlert, Gavel, Database, Lock, CheckCircle2, 
    XCircle, Eye, Ban, Unlock, Fingerprint, Copy, ArrowRightLeft,
    ChevronRight, Terminal, RefreshCw, Server, ShieldCheck,Briefcase,
    MessageSquare, FileJson, Layers, CreditCard, X, Loader2, User, Bot
} from 'lucide-react'
import { MessageCircle, Send, User as UserIcon } from 'lucide-react'; // مطمئن شوید این‌ها ایمپورت شده‌اند
// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface UserStats {
    user_id: string;
    email: string;
    user_type: 'client' | 'freelancer';
    full_name: string;
    trust_score: number;
    is_blocked: boolean;
    created_at: string;
    total_projects: number;
    total_volume: number;
}

interface Project {
    id: string;
    title: string;
    budget: number;
    status: string;
    escrow_status: string;
    client_id: string;
    freelancer_id: string;
    created_at: string;
}

interface Log {
    id: number;
    created_at: string;
    event_type: string;
    actor_id: string | null;
    project_id: string;
    prev_state: any;
    next_state: any;
    final_decision: string;
    is_override: boolean;
    log_hash: string;
    projects?: { title: string };
    profiles?: { user_type: string };
    rule_version?: string;
    system_hash?: string;
    rule_id?: string;
    confidence_score?: number;
    recommendation?: string;
}

// [NEW] Interface for Raw Events
interface EventLog {
    id: string;
    project_id: string;
    event_type: string;
    actor_role: string;
    created_at: string;
    actor_id?: string;
    payload: any;
    projects?: { title: string };
}

// [NEW] Interface for Admin Overrides
interface OverrideLog {
    id: string;
    project_id: string;
    original_decision: string;
    new_decision: string;
    reason: string;
    created_at: string;
    admin_id?: string;
    admin?: { email: string; full_name?: string };
    projects?: { title: string };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const copyToClipboard = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
}

const truncateHash = (hash: string) => {
    if (!hash) return 'PENDING_GENERATION';
    return `${hash.substring(0, 10)}...${hash.substring(hash.length - 8)}`;
}

const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('en-US', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
}

// ============================================================================
// UI COMPONENTS
// ============================================================================
// [NEW COMPONENT] Helper to find and render copyable fields like TX Hash or IDs
const SmartDataParser = ({ data, onCopy }: { data: any, onCopy: (text: string, label: string) => void }) => {
    if (!data || typeof data !== 'object') return null;

    // فیلدهایی که می‌خواهیم دکمه کپی داشته باشند
    const targetKeys = ['tx', 'hash', 'transaction', 'milestone_id', 'id', 'project_id'];

    const copyableItems = Object.entries(data).filter(([key, value]) => {
        const k = key.toLowerCase();
        // شرط: کلید شامل کلمات هدف باشد و مقدارش استرینگ باشد
        return targetKeys.some(target => k.includes(target)) && typeof value === 'string' && value.length > 5;
    });

    if (copyableItems.length === 0) return null;

    return (
        <div className="flex flex-wrap gap-1 mb-1.5">
            {copyableItems.map(([key, value]) => (
                <button
                    key={key}
                    onClick={(e) => { e.stopPropagation(); onCopy(String(value), key); }}
                    className="flex items-center gap-1 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 px-1.5 py-0.5 rounded text-[9px] font-mono transition-colors"
                    title={`Click to copy ${key}`}
                >
                    <Copy className="w-2.5 h-2.5" />
                    <span className="opacity-70">{key}:</span>
                    <span className="font-bold">{String(value).slice(0, 6)}...</span>
                </button>
            ))}
        </div>
    );
};
// [NEW COMPONENT] Parses text to find and copy hashes (0x...) inside sentences
const SmartTextParser = ({ text, onCopy }: { text: string, onCopy: (text: string) => void }) => {
    if (!text) return null;

    // الگوی پیدا کردن آدرس کیف پول (42 کاراکتر) یا هش تراکنش (66 کاراکتر)
    const regex = /(0x[a-fA-F0-9]{40,64})/g;
    const parts = text.split(regex);

    return (
        <span className="inline-block break-words">
            {parts.map((part, i) => {
                // بررسی اینکه آیا این بخش یک هش است؟
                const isHash = part.startsWith('0x') && (part.length === 42 || part.length === 66);
                
                if (isHash) {
                    return (
                        <button
                            key={i}
                            onClick={(e) => { 
                                e.stopPropagation(); 
                                onCopy(part); 
                            }}
                            className="inline-flex items-center gap-1 mx-1 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 px-1.5 py-0 rounded text-[10px] font-mono font-bold transition-all align-middle cursor-copy"
                            title="Click to Copy Hash"
                        >
                            <Copy className="w-3 h-3 opacity-70" />
                            {part.slice(0, 6)}...{part.slice(-4)}
                        </button>
                    );
                }
                // اگر متن معمولی بود
                return <span key={i}>{part}</span>;
            })}
        </span>
    );
};
// 1. Toast Notification Component
const Toast = ({ message, type, onClose }: { message: string, type: 'success' | 'error', onClose: () => void }) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 3000);
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <div className={`fixed bottom-6 right-6 px-6 py-4 rounded-xl shadow-2xl border flex items-center gap-3 animate-in slide-in-from-bottom-5 z-50 transition-all duration-300 ${
            type === 'success' ? 'bg-white border-emerald-200 text-emerald-800' : 'bg-white border-rose-200 text-rose-800'
        }`}>
            {type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-600"/> : <XCircle className="w-5 h-5 text-rose-600"/>}
            <span className="font-medium text-sm">{message}</span>
        </div>
    );
}

// 2. Metric Box Component for AI Stats
function MetricBox({ label, value, color }: { label: string, value: string, color: 'green' | 'blue' | 'red' }) {
    const colors = { 
        green: "text-emerald-700 bg-emerald-50 border-emerald-100 ring-emerald-500/20", 
        blue: "text-blue-700 bg-blue-50 border-blue-100 ring-blue-500/20", 
        red: "text-rose-700 bg-rose-50 border-rose-100 ring-rose-500/20" 
    };
    return (
        <div className={`p-4 rounded-xl text-center border ring-1 ring-inset ${colors[color] || colors.blue} transition-all duration-300 hover:shadow-sm`}>
            <div className="text-[10px] uppercase font-bold opacity-70 tracking-widest mb-1.5">{label}</div>
            <div className="text-xl font-black tracking-tight">{value}</div>
        </div>
    )
}

// 3. User Card Component
function UserCard({ title, profile, role }: any) {
    return (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${role === 'client' ? 'bg-blue-500' : 'bg-purple-500'}`}>
                    <User className="w-5 h-5" />
                </div>
                <div>
                    <h4 className="font-bold text-slate-800 text-sm">{title}</h4>
                    <p className="text-xs text-slate-500 font-mono">
                        {profile?.ghost_id || 'Unknown ID'}
                    </p>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-50 p-2 rounded">
                    <span className="block text-slate-400">Trust Score</span>
                    <span className="font-bold text-slate-800">{profile?.trust_score || 0}%</span>
                </div>
                <div className="bg-slate-50 p-2 rounded">
                    <span className="block text-slate-400">Wallet</span>
                    <span className="font-bold text-slate-800 truncate block w-24 font-mono">
                        {profile?.wallet_address ? `${profile.wallet_address.slice(0, 6)}...` : 'N/A'}
                    </span>
                </div>
            </div>
        </div>
    );
}

// 4. Tab Button Component
function TabButton({ active, onClick, icon: Icon, label }: any) {
    return (
        <button 
            onClick={onClick}
            className={`flex items-center gap-2 py-4 text-xs font-bold border-b-2 transition-all ${
                active ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
        >
            <Icon className="w-4 h-4" />
            {label}
        </button>
    );
}

// 5. Evidence Viewer Panel (Connected to Real Data)
// ============================================================================
// [NEW] EVIDENCE PANEL COMPONENT (REAL DATA)
// ============================================================================
function EvidencePanel({ project, onClose }: { project: any, onClose: () => void }) {
    const [loading, setLoading] = useState(true);
    // [UPDATED] Tabs for extended logs
    const [activeTab, setActiveTab] = useState<'overview' | 'events' | 'decisions' | 'overrides' | 'chat' | 'milestones'>('overview');
    const [evidenceData, setEvidenceData] = useState<any>(null);
    const [supportTickets, setSupportTickets] = useState<any[]>([]);
    const supabase = createClient();
    // Fetch Real Data on Mount
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            const res = await getDisputeEvidenceAction(project.id);
            if (res.success) {
                setEvidenceData(res.data);
            } else {
                alert("Failed to load evidence: " + res.error);
            }
            const { data: tickets } = await supabase
                .from('support_tickets')
                .select('*, profiles(role)')
                .order('last_message_at', { ascending: false });
            setSupportTickets(tickets || []);
            setLoading(false);
        };
        fetchData();
    }, [project.id]);

    if (!project) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-6xl h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
                
                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="bg-red-100 text-red-600 text-[10px] font-bold px-2 py-0.5 rounded-full border border-red-200 uppercase tracking-wide">
                                Dispute Room
                            </span>
                            <span className="text-xs text-slate-400 font-mono">ID: {project.id.slice(0, 8)}</span>
                        </div>
                        <h2 className="text-xl font-bold text-slate-800">{project.title}</h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-100 px-6 gap-6 bg-white overflow-x-auto">
                    <TabButton active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon={FileJson} label="Overview & Stats" />
                    <TabButton active={activeTab === 'events'} onClick={() => setActiveTab('events')} icon={Activity} label="Raw Event Logs" />
                    <TabButton active={activeTab === 'decisions'} onClick={() => setActiveTab('decisions')} icon={Bot} label="System Decisions" />
                    <TabButton active={activeTab === 'overrides'} onClick={() => setActiveTab('overrides')} icon={ShieldAlert} label="Admin Overrides" />
                    <TabButton active={activeTab === 'chat'} onClick={() => setActiveTab('chat')} icon={MessageSquare} label="Chat History" />
                    <TabButton active={activeTab === 'milestones'} onClick={() => setActiveTab('milestones')} icon={Layers} label="Milestones & Files" />
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto bg-slate-50/50 p-6">
                    {loading ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3">
                            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                            <p className="text-sm font-medium">Gathering Evidence from Blockchain & DB...</p>
                        </div>
                    ) : (
                        <>
                            {/* TAB: OVERVIEW & AI SCORES */}
                            {activeTab === 'overview' && evidenceData && (
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                    {/* AI Score Card */}
                                    <div className="col-span-1 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                                        <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                                            <Bot className="w-4 h-4 text-purple-600"/> Latest AI Verdict
                                        </h3>
                                        {evidenceData.decisionLogs?.[0] ? (
                                            <div className="space-y-4">
                                                <div className="flex justify-between items-center pb-2 border-b border-slate-50">
                                                    <span className="text-sm text-slate-500">Risk Score</span>
                                                    <span className={`text-lg font-black ${evidenceData.decisionLogs[0].risk_score > 50 ? 'text-red-500' : 'text-emerald-500'}`}>
                                                        {evidenceData.decisionLogs[0].risk_score}/100
                                                    </span>
                                                </div>
                                                <div className="flex justify-between items-center pb-2 border-b border-slate-50">
                                                    <span className="text-sm text-slate-500">Recommendation</span>
                                                    <span className="text-xs font-bold bg-slate-100 px-2 py-1 rounded">
                                                        {evidenceData.decisionLogs[0].recommendation}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between items-center pb-2 border-b border-slate-50">
                                                    <span className="text-sm text-slate-500">Action</span>
                                                    <span className="font-mono font-bold bg-blue-100 text-blue-700 px-2 py-1 rounded">
                                                        {evidenceData.decisionLogs[0].final_decision}
                                                    </span>
                                                </div>
                                                <div className="text-xs text-slate-400 font-mono mt-2 break-all bg-slate-50 p-2 rounded">
                                                    Hash: {evidenceData.decisionLogs[0].system_hash || 'N/A'}
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="text-sm text-slate-400 italic">No system decisions recorded yet.</p>
                                        )}
                                    </div>

                                    {/* User Stats */}
                                    <div className="col-span-1 lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {evidenceData.project ? (
                                            <>
                                                <UserCard title="Client" profile={evidenceData.project?.client} role="client" />
                                                <UserCard title="Freelancer" profile={evidenceData.project?.freelancer} role="freelancer" />
                                            </>
                                        ) : (
                                            <div className="col-span-2 text-center text-red-500 p-4 border border-red-100 rounded-xl bg-red-50">
                                                Project data could not be loaded.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* TAB: RAW EVENTS (NEW) */}
                            {activeTab === 'events' && (
                                <div className="space-y-3">
                                    {evidenceData.events?.map((e: any) => (
                                        <div key={e.id} className="bg-white p-4 rounded-xl border border-slate-200 flex gap-4">
                                            <div className="bg-slate-100 p-3 rounded-lg h-fit">
                                                <Activity className="w-5 h-5 text-slate-500"/>
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex justify-between mb-1">
                                                    <span className="font-bold text-slate-800 text-sm">{e.event_type}</span>
                                                    <span className="text-xs text-slate-400">{new Date(e.created_at).toLocaleString()}</span>
                                                </div>
                                                <pre className="text-[10px] bg-slate-900 text-green-400 p-3 rounded-lg overflow-x-auto font-mono custom-scrollbar">
                                                    {JSON.stringify(e.payload, null, 2)}
                                                </pre>
                                            </div>
                                        </div>
                                    ))}
                                    {evidenceData.events?.length === 0 && <p className="text-center text-slate-400">No raw events recorded.</p>}
                                </div>
                            )}

                            {/* TAB: DECISIONS (UPDATED) */}
                            {activeTab === 'decisions' && (
                                <div className="space-y-4">
                                    {evidenceData.decisionLogs?.map((log: any) => (
                                        <div key={log.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                                            <div className="bg-slate-50 px-4 py-2 border-b flex justify-between items-center">
                                                <span className="text-xs font-bold text-slate-500">ID: {log.id}</span>
                                                <span className="text-xs font-mono bg-purple-100 text-purple-700 px-2 py-0.5 rounded">Rule: {log.rule_id || 'LEGACY'}</span>
                                            </div>
                                            <div className="p-4 grid grid-cols-2 gap-4">
                                                <div>
                                                    <div className="text-xs text-slate-500 uppercase font-bold mb-1">Decision</div>
                                                    <div className="text-sm font-bold text-slate-800">{log.final_decision}</div>
                                                    <div className="text-xs text-slate-500 mt-2">{log.recommendation}</div>
                                                </div>
                                                <div>
                                                    <div className="text-xs text-slate-500 uppercase font-bold mb-1">Cryptographic Proof</div>
                                                    <div className="text-[10px] font-mono bg-slate-100 p-2 rounded break-all border text-slate-600">
                                                        {log.system_hash || log.log_hash || 'PENDING_HASHING'}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {evidenceData.decisionLogs?.length === 0 && <p className="text-center text-slate-400">No decision logs.</p>}
                                </div>
                            )}

                            {/* TAB: OVERRIDES (NEW) */}
                            {activeTab === 'overrides' && (
                                <div className="space-y-3">
                                    {evidenceData.overrideLogs?.map((ov: any) => (
                                        <div key={ov.id} className="bg-rose-50 border border-rose-100 p-4 rounded-xl">
                                            <div className="flex items-center gap-2 mb-2">
                                                <ShieldAlert className="w-5 h-5 text-rose-600"/>
                                                <span className="font-bold text-rose-800 text-sm">Admin Intervention</span>
                                                <span className="ml-auto text-xs text-rose-400">{new Date(ov.created_at).toLocaleString()}</span>
                                            </div>
                                            <div className="text-xs text-rose-700 mb-2">
                                                Changed verdict from <strong className="line-through opacity-60">{ov.original_decision}</strong> to <strong className="bg-rose-200 px-1 rounded">{ov.new_decision}</strong>
                                            </div>
                                            <div className="bg-white p-3 rounded border border-rose-100 text-xs italic text-slate-600">
                                                "{ov.reason}"
                                            </div>
                                            <div className="mt-2 text-[10px] text-slate-400">Admin: {ov.admin?.email}</div>
                                        </div>
                                    ))}
                                    {evidenceData.overrideLogs?.length === 0 && (
                                        <div className="text-center p-10 border-2 border-dashed border-slate-200 rounded-xl">
                                            <CheckCircle2 className="w-10 h-10 text-emerald-200 mx-auto mb-2"/>
                                            <p className="text-slate-400 text-sm">No admin overrides found. System logic is respected.</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* TAB: CHAT HISTORY */}
                            {activeTab === 'chat' && (
                                <div className="space-y-4 max-w-3xl mx-auto">
                                    {evidenceData?.messages?.length === 0 ? (
                                        <div className="text-center text-slate-400 py-10">No messages exchanged.</div>
                                    ) : (
                                        evidenceData?.messages?.map((msg: any) => (
                                            <div key={msg.id} className={`flex ${msg.sender_id === evidenceData.project.client_id ? 'justify-end' : 'justify-start'}`}>
                                                <div className={`max-w-[80%] rounded-2xl p-4 text-sm ${
                                                    msg.sender_id === evidenceData.project.client_id 
                                                    ? 'bg-blue-600 text-white rounded-tr-none' 
                                                    : 'bg-white border border-slate-200 text-slate-700 rounded-tl-none'
                                                }`}>
                                                    <div className="mb-1 text-[10px] opacity-70 flex justify-between gap-4">
                                                        <span>{msg.sender_id === evidenceData.project.client_id ? 'Client' : 'Freelancer'}</span>
                                                        <span>{new Date(msg.created_at).toLocaleString()}</span>
                                                    </div>
                                                    {msg.content}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}

                            {/* TAB: MILESTONES */}
                            {activeTab === 'milestones' && (
                                <div className="space-y-3">
                                    {evidenceData?.milestones?.map((m: any) => (
                                        <div key={m.id} className="bg-white p-4 rounded-xl border border-slate-200 flex justify-between items-center">
                                            <div>
                                                <div className="font-bold text-slate-700">{m.title}</div>
                                                <div className="text-xs text-slate-500">Amount: ${m.amount} | Status: {m.status}</div>
                                                {m.submission_file_url && (
                                                    <a href={m.submission_file_url} target="_blank" className="text-xs text-blue-600 underline mt-1 block">
                                                        View Submitted File
                                                    </a>
                                                )}
                                            </div>
                                            <div className={`text-xs font-bold px-3 py-1 rounded-full ${
                                                m.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 
                                                m.status === 'disputed' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'
                                            }`}>
                                                {m.status.toUpperCase()}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="p-4 bg-white border-t border-slate-200 flex justify-end gap-3">
                    <button onClick={onClose} className="px-6 py-2 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors">
                        Close Evidence
                    </button>
                </div>
            </div>
        </div>
    );
}

// 6. Sidebar Navigation Item
function SidebarItem({ icon: Icon, label, active, onClick, count, alert }: any) {
    return (
        <button 
            onClick={onClick}
            className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl text-sm font-bold transition-all duration-200 group relative overflow-hidden
            ${active 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 ring-1 ring-blue-500' 
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}
        >
            <div className="flex items-center gap-3 relative z-10">
                <Icon className={`w-5 h-5 transition-colors ${active ? 'text-white' : 'text-slate-400 group-hover:text-blue-600'}`} />
                {label}
            </div>
            {count > 0 && (
                <span className={`relative z-10 text-[10px] px-2 py-0.5 rounded-md font-extrabold transition-colors ${
                    active 
                        ? 'bg-white/20 text-white' 
                        : alert ? 'bg-rose-500 text-white shadow-sm shadow-rose-200' : 'bg-slate-200 text-slate-600'
                }`}>
                    {count}
                </span>
            )}
        </button>
    )
}

// 7. Dashboard Statistic Card
function StatCard({ title, value, icon: Icon, color, trend, alert }: any) {
    const theme: any = {
        blue: { bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-100" },
        indigo: { bg: "bg-indigo-50", text: "text-indigo-600", border: "border-indigo-100" },
        red: { bg: "bg-rose-50", text: "text-rose-600", border: "border-rose-100" },
        emerald: { bg: "bg-emerald-50", text: "text-emerald-600", border: "border-emerald-100" }
    };
    
    const t = theme[color];

    return (
        <div className={`bg-white p-6 rounded-[2rem] border transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${alert ? 'border-rose-200 shadow-rose-50 ring-2 ring-rose-100' : 'border-slate-200 shadow-sm'}`}>
            <div className="flex justify-between items-start mb-6">
                <div className={`p-4 rounded-2xl ${t.bg}`}>
                    <Icon className={`w-6 h-6 ${t.text}`} />
                </div>
                {trend && (
                    <span className={`text-[10px] font-bold px-3 py-1.5 rounded-full border ${
                        color === 'red' 
                            ? 'bg-rose-50 text-rose-700 border-rose-100' 
                            : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                    }`}>
                        {trend}
                    </span>
                )}
            </div>
            <h3 className="text-4xl font-black text-slate-900 mb-2 tracking-tight">{value}</h3>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{title}</p>
        </div>
    )
}

// 8. Action Dropdown Component
function ActionDropdown({ projectId }: { projectId: string }) {
    const execute = async (verdict: 'refund_client' | 'pay_freelancer') => {
        const reason = prompt(`CRITICAL ACTION REQUIRED:\n\nYou are about to execute a blockchain transaction to FORCE ${verdict}.\nThis action is irreversible and recorded on-chain.\n\nPlease type the reason for the audit log:`);
        if(!reason) return;
        
        const res = await adminResolveDisputeAction(projectId, reason, verdict);
        if(res.success) alert("BLOCKCHAIN CONFIRMED: Action executed successfully. Transaction Hash generated.");
        else alert(`ERROR: ${res.error}`);
    }

    return (
        <div className="flex gap-2">
            <button 
                onClick={() => execute('refund_client')} 
                className="px-3 py-2 bg-white border border-rose-200 text-rose-600 text-xs font-bold rounded-lg hover:bg-rose-50 hover:border-rose-300 transition-all shadow-sm"
            >
                Refund Client
            </button>
            <button 
                onClick={() => execute('pay_freelancer')} 
                className="px-3 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-200 transition-all shadow-md"
            >
                Release Funds
            </button>
        </div>
    )
}
// ============================================================================
// Support Messages
// ============================================================================
function SupportChatArea({ ticketId }: { ticketId: string }) {
    const [messages, setMessages] = useState<any[]>([]);
    const [msgText, setMsgText] = useState('');
    const [loading, setLoading] = useState(false);
    const supabase = createClient();
    const scrollRef = useRef<HTMLDivElement>(null);

    // Fetch Initial Messages
    useEffect(() => {
        const fetchMsgs = async () => {
            const { data } = await supabase
                .from('support_messages')
                .select('*')
                .eq('ticket_id', ticketId)
                .order('created_at', { ascending: true });
            if (data) setMessages(data);
            setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        };
        fetchMsgs();

        // Realtime Subscription
        const channel = supabase.channel(`admin_chat_${ticketId}`)
            .on('postgres_changes', 
                { event: 'INSERT', schema: 'public', table: 'support_messages', filter: `ticket_id=eq.${ticketId}` },
                (payload) => {
                    setMessages(prev => [...prev, payload.new]);
                    setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [ticketId]);

    const sendReply = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!msgText.trim()) return;
        setLoading(true);
        
        await supabase.from('support_messages').insert([{
            ticket_id: ticketId,
            content: msgText,
            sender_type: 'admin' // ادمین ارسال می‌کند
        }]);
        
        // آپدیت زمان آخرین پیام تیکت
        await supabase.from('support_tickets').update({ last_message_at: new Date() }).eq('id', ticketId);
        
        setMsgText('');
        setLoading(false);
    };

    return (
        <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                {messages.map((m) => (
                    <div key={m.id} className={`flex ${m.sender_type === 'admin' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[70%] p-3 rounded-xl text-sm ${
                            m.sender_type === 'admin' 
                            ? 'bg-blue-600 text-white rounded-br-none' 
                            : 'bg-white border border-slate-200 text-slate-700 rounded-bl-none shadow-sm'
                        }`}>
                            {m.content}
                            <div className={`text-[10px] mt-1 opacity-70 ${m.sender_type === 'admin' ? 'text-blue-100' : 'text-slate-400'}`}>
                                {new Date(m.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </div>
                        </div>
                    </div>
                ))}
                <div ref={scrollRef} />
            </div>
            <form onSubmit={sendReply} className="mt-4 flex gap-2">
                <input 
                    className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 shadow-sm"
                    placeholder="Type your reply..."
                    value={msgText}
                    onChange={e => setMsgText(e.target.value)}
                />
                <button disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white px-4 rounded-xl transition-colors disabled:opacity-50">
                    <Send className="w-5 h-5" />
                </button>
            </form>
        </div>
    );
}
// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================
export default function EnterpriseAdminDashboard() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [pass, setPass] = useState('');
    const [supabase] = useState(() => createClient());
    const [allProjects, setAllProjects] = useState<any[]>([]); // لیست همه پروژه‌ها
    const [projectFilter, setProjectFilter] = useState<'all' | 'active' | 'blocked'>('all'); // فیلتر تب‌ها
    const [selectedDesc, setSelectedDesc] = useState<{title: string, content: string} | null>(null);
    // Data States
    const [stats, setStats] = useState<any>({});
    const [disputes, setDisputes] = useState<Project[]>([]);
    const [logs, setLogs] = useState<Log[]>([]);
    const [events, setEvents] = useState<EventLog[]>([]); // [NEW]
    const [overrides, setOverrides] = useState<OverrideLog[]>([]); // [NEW]
    const [users, setUsers] = useState<UserStats[]>([]);
    const [selectedCase, setSelectedCase] = useState<Project | null>(null);
    const [loadingAuth, setLoadingAuth] = useState(false);
    const [activeTab, setActiveTab] = useState('overview');
    const [supportTickets, setSupportTickets] = useState<any[]>([]);
    const [activeTicket, setActiveTicket] = useState<any>(null);
    // Toast State
    const [toast, setToast] = useState<{msg: string, type: 'success' | 'error'} | null>(null);

    // --- AUTHENTICATION HANDLER ---
    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoadingAuth(true);
        // Simulate secure handshake delay
        await new Promise(r => setTimeout(r, 1200));
        const res = await verifyAdminPassword(pass);
        setLoadingAuth(false);
        
        if (res.success) setIsAuthenticated(true);
        else setToast({ msg: "Access Denied: Invalid Secure Credentials", type: 'error' });
    }

    // --- DATA FETCHING ---
    const fetchData = async () => {
        // 1. Users Data (Using the new RPC logic with user_id)
        const usersRes = await getAdminUsersListAction();
        if (usersRes.data) setUsers(usersRes.data);

        // 2. Project Stats
        const { count: projectCount } = await supabase.from('projects').select('*', { count: 'exact', head: true });
        const { data: activeDisputes } = await supabase.from('projects').select('*').eq('status', 'disputed');
        
        // 3. Raw Event Stream [NEW]
        const { data: rawEvents } = await supabase
            .from('event_logs')
            .select('*, projects(title)')
            .order('created_at', { ascending: false })
            .limit(50);

        // 4. Secure Decisions (Immutable Ledger) [UPDATED]
        const { data: auditLogs } = await supabase
            .from('decision_logs')
            .select('*, projects(title), profiles(user_type)')
            .order('created_at', { ascending: false })
            .limit(50);
        // [UPDATED] استفاده از اکشن سرور برای اطمینان از دریافت دیتا
        const projectsRes = await getAdminProjectsListAction();
        if (projectsRes.success && projectsRes.data) {
            setAllProjects(projectsRes.data);
        } else {
            console.error("Failed to load projects:", projectsRes.error);
        }

        // 5. Admin Overrides [NEW]
        const { data: overrideData, error } = await supabase
            .from('admin_override_logs')
            // تلاش برای گرفتن تایتل پروژه، اگر رابطه پروژه در دیتابیس درست باشد کار میکند
            // اگر admin_id به پروفایل وصل است، آن را هم تست کنید، اگر نه فعلا حذف کنید
            .select('*, projects(title)') 
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) console.error("Override Error:", error);
        setOverrides(overrideData || []);
        // 6. Support Messages
        const { data: ticketsData } = await supabase
            .from('support_tickets')
            .select('*')
            .order('last_message_at', { ascending: false });
        setStats({
            users: usersRes.data?.length || 0,
            projects: projectCount || 0,
            disputes: activeDisputes?.length || 0,
            tvl: activeDisputes?.reduce((acc: number, p: any) => acc + (p.budget || 0), 0) || 0
        });
        setDisputes(activeDisputes || []);
        setLogs(auditLogs || []);
        setEvents(rawEvents || []);
        setOverrides(overrideData || []);
        setSupportTickets(ticketsData || []);
    };
        const handleProjectBlockToggle = async (projectId: string, currentStatus: boolean) => {
            const action = currentStatus ? "Unblock" : "Block"; // اگر بلاک است آن‌بلاک کن و برعکس
            let reason = "";

            if (!currentStatus) { // اگر قرار است بلاک شود، دلیل بپرس
                reason = prompt("Please enter the reason for blocking this project (Notification will be sent to client):") || "";
                if (!reason) return; // اگر کنسل کرد یا خالی گذاشت
            } else {
                if(!confirm("Are you sure you want to reactivate this project?")) return;
            }

            const res = await toggleProjectBlockAction(projectId, !currentStatus, reason);
            
            if (res.success) {
                setToast({ msg: `Project ${action}ed successfully`, type: 'success' });
                // آپدیت لوکال برای نمایش سریع
                setAllProjects(prev => prev.map(p => p.id === projectId ? { ...p, is_blocked: !currentStatus, block_reason: reason } : p));
            } else {
                setToast({ msg: "Action Failed: " + res.error, type: 'error' });
            }
        };
    // --- EFFECTS ---
    useEffect(() => {
        if (!isAuthenticated) return;
        
        fetchData();
        
        // Realtime Subscription Setup
        const channel = supabase.channel('admin_realtime_v4_comprehensive')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, fetchData)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'decision_logs' }, fetchData)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, fetchData)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'event_logs' }, fetchData)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_override_logs' }, fetchData)
            .subscribe();

        return () => { supabase.removeChannel(channel); }
    }, [isAuthenticated, supabase]);

    // --- USER ACTIONS ---
    const handleUserToggle = async (userId: string, currentStatus: boolean) => {
        const action = currentStatus ? "Unblock" : "Block";
        // Security Confirmation
        if(!confirm(`SECURITY WARNING:\n\nYou are about to ${action.toUpperCase()} a user.\nThis will immediately affect their access.\n\nProceed?`)) return;
        
        const res = await toggleUserBlockAction(userId, !currentStatus, `Admin Manual ${action}`);
        if(res.success) {
            setToast({ msg: `User ${action}ed successfully`, type: 'success' });
            // Optimistic update using user_id
            setUsers(users.map(u => u.user_id === userId ? { ...u, is_blocked: !currentStatus } : u));
        } else {
            setToast({ msg: "Action Failed: Database Consistency Error", type: 'error' });
        }
    }
    const handleCloseTicket = async () => {
        if (!activeTicket) return;
        
        const confirmed = window.confirm("آیا از بستن این تیکت اطمینان دارید؟");
        if (!confirmed) return;

        // آپدیت وضعیت در دیتابیس
        const { error } = await supabase
            .from('support_tickets')
            .update({ status: 'closed' })
            .eq('id', activeTicket.id);

        if (error) {
            alert("خطا در بستن تیکت");
            return;
        }

        // آپدیت استیت محلی (UI)
        setSupportTickets(prev => prev.map(t => 
            t.id === activeTicket.id ? { ...t, status: 'closed' } : t
        ));
        setActiveTicket(null); // بستن پنجره چت فعال
    }
    // ========================================================================
    // LOGIN VIEW
    // ========================================================================
    if (!isAuthenticated) return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden font-sans">
            {/* Ambient Background Effects */}
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 z-10"></div>
            <div className="absolute top-0 left-0 w-full h-full bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 z-0"></div>
            <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[100px] animate-pulse"></div>
            <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[100px]"></div>

            <div className="bg-slate-900/60 backdrop-blur-2xl p-10 rounded-[2.5rem] border border-slate-800 shadow-2xl w-full max-w-[420px] relative z-20 overflow-hidden">
                <div className="flex flex-col items-center mb-12">
                    <div className="w-20 h-20 bg-gradient-to-tr from-slate-800 to-slate-900 rounded-3xl flex items-center justify-center shadow-2xl border border-slate-700/50 mb-6 group">
                        <Lock className="w-8 h-8 text-blue-500 group-hover:text-blue-400 transition-colors" />
                    </div>
                    <h2 className="text-3xl font-black text-white tracking-tight mb-2">Noble Mind</h2>
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Secure Terminal v2.5</p>
                    </div>
                </div>
                
                <form onSubmit={handleLogin} className="space-y-6">
                    <div className="space-y-3">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Access Credentials</label>
                        <div className="relative group">
                            <input 
                                type="password" 
                                value={pass} 
                                onChange={e => setPass(e.target.value)} 
                                className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl p-5 text-white text-center text-xl tracking-[0.5em] outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all placeholder:text-slate-800 group-hover:border-slate-700" 
                                placeholder="••••••" 
                            />
                            <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/5 pointer-events-none"></div>
                        </div>
                    </div>
                    <button 
                        disabled={loadingAuth}
                        className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-5 rounded-2xl transition-all shadow-xl shadow-blue-900/20 disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-3 active:scale-[0.98]"
                    >
                        {loadingAuth ? (
                            <>
                                <RefreshCw className="w-5 h-5 animate-spin"/>
                                <span className="tracking-wide">Verifying...</span>
                            </>
                        ) : (
                            <>
                                <ShieldCheck className="w-5 h-5"/>
                                <span className="tracking-wide">Access System</span>
                            </>
                        )}
                    </button>
                </form>
                
                {toast && (
                    <div className="mt-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-xs text-center font-medium animate-in fade-in slide-in-from-bottom-2">
                        {toast.msg}
                    </div>
                )}
            </div>
        </div>
    );

    // ========================================================================
    // DASHBOARD VIEW
    // ========================================================================
    return (
        <div className="min-h-screen bg-[#F1F5F9] flex font-sans text-slate-900 selection:bg-blue-100 selection:text-blue-900">
            {toast && <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
            
            {/* Sidebar */}
            <aside className="w-80 bg-white border-r border-slate-200 flex-shrink-0 sticky top-0 h-screen flex flex-col z-30 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.1)]">
                <div className="p-8">
                    <div className="flex items-center gap-4 mb-2">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200 ring-4 ring-blue-50">
                            <ShieldAlert className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none mb-1">Noble Mind</h1>
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded">Admin Console</span>
                        </div>
                    </div>
                </div>
                
                <nav className="flex-1 px-6 space-y-2.5">
                    <SidebarItem active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} icon={LayoutDashboard} label="Mission Control" />
                    <SidebarItem active={activeTab === 'users'} onClick={() => setActiveTab('users')} icon={Users} label="User Directory" />
                    <SidebarItem active={activeTab === 'projects_manage'} onClick={() => setActiveTab('projects_manage')} icon={Briefcase} label="Project Manager" />
                    <SidebarItem active={activeTab === 'disputes'} onClick={() => setActiveTab('disputes')} icon={Gavel} label="Dispute Resolution" count={stats.disputes} alert={stats.disputes > 0} />
                    
                    {/* [NEW] Expanded Sections */}
                    <div className="my-2 border-t border-slate-100 mx-4"></div>
                    <SidebarItem active={activeTab === 'events'} onClick={() => setActiveTab('events')} icon={Activity} label="Live Event Stream" />
                    <SidebarItem active={activeTab === 'logs'} onClick={() => setActiveTab('logs')} icon={Bot} label="AI Decisions" />
                    <SidebarItem active={activeTab === 'overrides'} onClick={() => setActiveTab('overrides')} icon={ShieldAlert} label="Admin Interventions" />
                    
                    <div className="my-2 border-t border-slate-100 mx-4"></div>
                    <SidebarItem active={activeTab === 'rules'} onClick={() => setActiveTab('rules')} icon={FileText} label="Rule Config" />
                    <SidebarItem active={activeTab === 'support'} onClick={() => setActiveTab('support')} icon={FileText} label="Support Messages" />
                </nav>

                <div className="p-6 mt-auto border-t border-slate-100 bg-slate-50/50">
                    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 mb-4 uppercase tracking-widest">
                            <Activity className="w-3 h-3 text-emerald-500" /> Infrastructure
                        </div>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center text-[11px] text-slate-600 font-medium">
                                <span>PostgreSQL DB</span>
                                <span className="flex items-center gap-1.5 text-emerald-700 font-bold bg-emerald-100 px-2.5 py-1 rounded-md">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Online
                                </span>
                            </div>
                            <div className="flex justify-between items-center text-[11px] text-slate-600 font-medium">
                                <span>Polygon Chain</span>
                                <span className="flex items-center gap-1.5 text-blue-700 font-bold bg-blue-100 px-2.5 py-1 rounded-md">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> Synced
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 p-12 overflow-y-auto scroll-smooth">
                <header className="flex justify-between items-end mb-12">
                    <div>
                        <h2 className="text-4xl font-black text-slate-800 tracking-tight mb-3">
                            {activeTab === 'overview' && 'System Overview'}
                            {activeTab === 'users' && 'User Directory'}
                            {activeTab === 'disputes' && 'Dispute Center'}
                            {activeTab === 'events' && 'Live Event Stream'}
                            {activeTab === 'logs' && 'Immutable Audit Trail'}
                            {activeTab === 'overrides' && 'Admin Interventions'}
                            {activeTab === 'rules' && 'Logic Configuration'}
                            {activeTab === 'support' && 'Support Messages.'}
                        </h2>
                        <p className="text-slate-500 font-medium max-w-2xl text-sm leading-relaxed">
                            {activeTab === 'overview' && 'Real-time platform metrics, performance indicators, and financial overview.'}
                            {activeTab === 'users' && 'Manage identities, access permissions, and account status with granular control.'}
                            {activeTab === 'disputes' && 'Resolve conflicts with binding blockchain execution power. Actions are irreversible.'}
                            {activeTab === 'events' && 'Raw data ingestion pipeline monitoring from all smart contracts and client interactions.'}
                            {activeTab === 'logs' && 'Cryptographically secured administrative action history for compliance and auditing.'}
                            {activeTab === 'overrides' && 'Log of all manual overrides performed by administrators breaking standard logic flow.'}
                            {activeTab === 'rules' && 'View the current active version of the decision engine logic and thresholds.'}
                            {activeTab === 'support' && 'View the Support Messages.'}
                        </p>
                    </div>
                    <div className="flex gap-4">
                        <div className="bg-white px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold font-mono text-slate-600 flex items-center shadow-sm">
                            <span className="w-2 h-2 bg-emerald-500 rounded-full mr-3 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]"></span>
                            SECURE_CONNECTION_ESTABLISHED
                        </div>
                    </div>
                </header>

                {/* ============================================================ */}
                {/* TAB: OVERVIEW */}
                {/* ============================================================ */}
                {activeTab === 'overview' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <StatCard title="Total Users" value={stats.users} icon={Users} color="blue" trend="+12% growth" />
                            <StatCard title="Projects Created" value={stats.projects} icon={FileText} color="indigo" />
                            <StatCard title="Active Disputes" value={stats.disputes} icon={AlertOctagon} color="red" alert={stats.disputes > 0} />
                            <StatCard title="Escrow Locked" value={`$${stats.tvl?.toLocaleString()}`} icon={Lock} color="emerald" trend="Polygon Mainnet" />
                        </div>
                        
                        {/* Add more overview widgets here if needed */}
                        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-[2.5rem] p-10 text-white shadow-2xl relative overflow-hidden">
                             <div className="absolute top-0 right-0 p-40 bg-blue-500/20 rounded-full blur-[100px] -mr-20 -mt-20"></div>
                             <div className="relative z-10 flex justify-between items-center">
                                <div>
                                    <h3 className="text-2xl font-bold mb-2">Platform Health</h3>
                                    <p className="text-slate-400">All systems operational. No critical anomalies detected.</p>
                                </div>
                                <div className="flex gap-4">
                                    <button onClick={() => fetchData()} className="bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2">
                                        <RefreshCw className="w-4 h-4"/> Refresh Data
                                    </button>
                                </div>
                             </div>
                        </div>
                    </div>
                )}

                {/* ============================================================ */}
                {/* TAB: USER MANAGEMENT */}
                {/* ============================================================ */}
                {activeTab === 'users' && (
                    <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-200/50 overflow-hidden animate-in fade-in duration-500">
                        <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                            <div className="relative w-80 group">
                                <Search className="w-4 h-4 absolute left-4 top-3.5 text-slate-400 group-focus-within:text-blue-500 transition-colors"/>
                                <input placeholder="Search directory..." className="w-full pl-11 pr-5 py-3 text-sm bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all shadow-sm" />
                            </div>
                            <div className="flex gap-3 text-xs font-bold text-slate-600 bg-white px-4 py-2.5 rounded-xl border border-slate-200 shadow-sm">
                                <Users className="w-4 h-4 text-blue-500" />
                                {users.length} Active Records
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50/80 text-slate-500 font-bold border-b border-slate-100 uppercase tracking-wider text-[11px]">
                                    <tr>
                                        <th className="px-8 py-5">User Identity</th>
                                        <th className="px-6 py-5">Role Type</th>
                                        <th className="px-6 py-5">Trust Score</th>
                                        <th className="px-6 py-5">Performance Stats</th>
                                        <th className="px-6 py-5">Account Status</th>
                                        <th className="px-8 py-5 text-right">Admin Controls</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {users.map(u => (
                                        <tr key={u.user_id} className="hover:bg-blue-50/20 transition-colors group">
                                            <td className="px-8 py-5">
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-white shadow-md text-lg ${u.is_blocked ? 'bg-slate-400' : 'bg-gradient-to-br from-blue-500 to-indigo-600'}`}>
                                                        {u.full_name?.[0] || u.email?.[0]?.toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-slate-900 text-base">{u.full_name || 'Anonymous'}</p>
                                                        <p className="text-xs text-slate-500 font-medium mt-0.5">{u.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <span className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize border ${
                                                    u.user_type === 'client' 
                                                        ? 'bg-purple-50 text-purple-700 border-purple-100' 
                                                        : 'bg-orange-50 text-orange-700 border-orange-100'
                                                }`}>
                                                    {u.user_type}
                                                </span>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="w-36">
                                                    <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1.5">
                                                        <span>Reputation</span>
                                                        <span>{u.trust_score || 100}%</span>
                                                    </div>
                                                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                                                        <div 
                                                            className={`h-full rounded-full transition-all duration-1000 ${
                                                                (u.trust_score || 100) > 80 ? 'bg-emerald-500' : (u.trust_score || 100) > 50 ? 'bg-amber-500' : 'bg-rose-500'
                                                            }`} 
                                                            style={{width: `${u.trust_score || 100}%`}}
                                                        ></div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                                        <CheckCircle2 className="w-3 h-3 text-slate-400"/> {u.total_projects || 0} Projects
                                                    </span>
                                                    <span className="text-[10px] text-slate-500 font-mono bg-slate-100 px-1.5 py-0.5 rounded w-fit">
                                                        ${(u.total_volume || 0).toLocaleString()}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                {u.is_blocked ? (
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-50 text-rose-700 text-xs font-bold border border-rose-100">
                                                        <Ban className="w-3 h-3"/> Restricted
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-100">
                                                        <CheckCircle2 className="w-3 h-3"/> Active
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-8 py-5 text-right">
                                                <button 
                                                    onClick={() => handleUserToggle(u.user_id, u.is_blocked)}
                                                    className={`p-2.5 rounded-xl border transition-all shadow-sm ${
                                                        u.is_blocked 
                                                            ? 'border-emerald-200 text-emerald-600 hover:bg-emerald-50 bg-white' 
                                                            : 'border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 bg-white'
                                                    }`}
                                                    title={u.is_blocked ? "Unblock User" : "Block User"}
                                                >
                                                    {u.is_blocked ? <Unlock className="w-4 h-4"/> : <Ban className="w-4 h-4"/>}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {users.length === 0 && (
                                        <tr><td colSpan={6} className="p-16 text-center text-slate-400 text-sm italic">No users found in directory.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
                {/* ============================================================ */}
                {/* TAB: PROJECT MANAGER */}
                {/* ============================================================ */}
                {activeTab === 'projects_manage' && (
                    <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden animate-in fade-in duration-500">
                        
                        {/* Header & Filters */}
                        <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                            <div>
                                <h3 className="font-bold text-base text-slate-800">Project Directory</h3>
                                <p className="text-xs text-slate-400 mt-1">Manage, monitor, and moderate all platform projects.</p>
                            </div>
                            
                            {/* Filter Tabs */}
                            <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                                {(['all', 'active', 'blocked'] as const).map((f) => (
                                    <button
                                        key={f}
                                        onClick={() => setProjectFilter(f)}
                                        className={`px-4 py-2 rounded-lg text-xs font-bold capitalize transition-all ${
                                            projectFilter === f 
                                            ? 'bg-blue-600 text-white shadow-md' 
                                            : 'text-slate-500 hover:bg-slate-50'
                                        }`}
                                    >
                                        {/* اگر می‌خواهید متن دکمه "Open" باشد ولی مقدار "active" بماند: */}
                                        {f === 'active' ? 'Open' : f} ({allProjects.filter(p => 
                                            f === 'all' ? true : 
                                            f === 'blocked' ? p.is_blocked : 
                                            (p.status === 'open' && !p.is_blocked)
                                        ).length})
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Projects Table */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50/80 text-slate-500 font-bold border-b border-slate-100 uppercase tracking-wider text-[11px]">
                                    <tr>
                                        <th className="px-6 py-5">Project Details</th>
                                        <th className="px-6 py-5">Description</th>
                                        <th className="px-6 py-5">Budget</th>
                                        <th className="px-6 py-5">Status</th>
                                        <th className="px-6 py-5">Moderation</th>
                                        <th className="px-6 py-5 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {allProjects
                                        .filter(p => projectFilter === 'all' ? true : projectFilter === 'blocked' ? p.is_blocked : (p.status === 'open' && !p.is_blocked))
                                        .map(project => (
                                        <tr key={project.id} className={`transition-colors group ${project.is_blocked ? 'bg-red-50/30 hover:bg-red-50/50' : 'hover:bg-slate-50'}`}>
                                            <td className="px-6 py-5">
                                                <div className="font-bold text-slate-900 mb-1 truncate max-w-[200px]" title={project.title}>
                                                    {project.title}
                                                </div>
                                                <div className="text-[10px] text-slate-400 font-mono">
                                                    ID: {project.id.slice(0, 8)}...
                                                </div>
                                                {project.is_blocked && (
                                                    <div className="mt-2 text-[10px] text-red-600 bg-red-100 px-2 py-1 rounded border border-red-200 w-fit">
                                                        Reason: {project.block_reason}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-5">
                                                {project.description ? (
                                                    <button 
                                                        onClick={() => setSelectedDesc({ title: project.title, content: project.description })}
                                                        className="group text-left w-full"
                                                    >
                                                        <div className="text-xs text-slate-600 line-clamp-2 leading-relaxed group-hover:text-blue-600 transition-colors">
                                                            {project.description}
                                                        </div>
                                                        <span className="text-[10px] text-blue-500 font-bold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 mt-1">
                                                            <FileText className="w-3 h-3"/> Read Full Description
                                                        </span>
                                                    </button>
                                                ) : (
                                                    <span className="text-xs text-slate-400 italic">No description provided.</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-5 font-mono font-bold text-slate-700">
                                                ${project.budget?.toLocaleString()}
                                            </td>
                                            <td className="px-6 py-5">
                                                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase border ${
                                                    project.status === 'open' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                    project.status === 'hired' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                                    'bg-slate-100 text-slate-500 border-slate-200'
                                                }`}>
                                                    {project.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-5">
                                                {project.is_blocked ? (
                                                    <span className="flex items-center gap-1 text-red-600 font-bold text-xs">
                                                        <Ban className="w-3 h-3"/> BLOCKED
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center gap-1 text-emerald-600 font-bold text-xs">
                                                        <CheckCircle2 className="w-3 h-3"/> Active
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-5 text-right">
                                                <button 
                                                    onClick={() => handleProjectBlockToggle(project.id, project.is_blocked)}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-2 ml-auto ${
                                                        project.is_blocked 
                                                        ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700 shadow-sm' 
                                                        : 'bg-white text-red-600 border-red-200 hover:bg-red-50'
                                                    }`}
                                                >
                                                    {project.is_blocked ? (
                                                        <> <Unlock className="w-3 h-3"/> Unblock </>
                                                    ) : (
                                                        <> <Ban className="w-3 h-3"/> Block Project </>
                                                    )}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {allProjects.length === 0 && (
                                        <tr><td colSpan={6} className="p-10 text-center text-slate-400">No projects found.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
                {/* ============================================================ */}
                {/* TAB: Support Messages */}
                {/* ============================================================ */}
                {activeTab === 'support' && (
                    <div className="h-[calc(100vh-140px)] bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden flex animate-in fade-in duration-500">
                        
                        {/* لیست تیکت‌ها (سایدبار چپ) */}
                        <div className="w-80 border-r border-slate-100 flex flex-col bg-slate-50/50">
                            <div className="p-6 border-b border-slate-100">
                                <h3 className="font-bold text-slate-800">Support Inbox</h3>
                                <p className="text-xs text-slate-400">Visitor & User Inquiries</p>
                            </div>
                            <div className="flex-1 overflow-y-auto">
                                {supportTickets.map((ticket: any) => {
                                    // --- [شروع تغییرات] ---
                                    // ۱. تشخیص پیشوند بر اساس نقش (C برای کلاینت، F برای فریلنسر)
                                    const rolePrefix = ticket.profiles?.role === 'CLIENT' ? 'C-' : 
                                                    ticket.profiles?.role === 'FREELANCER' ? 'F-' : 'U-';
                                    
                                    // ۲. اگر user_id دارد یعنی ثبت نام کرده، پس آیدی را بساز. اگر نه بنویس Guest Visitor
                                    const displayName = ticket.user_id 
                                        ? `${rolePrefix}${ticket.user_id.slice(0, 8).toUpperCase()}` 
                                        : 'Guest Visitor';
                                    // --- [پایان تغییرات] ---

                                    return (
                                        <button 
                                            key={ticket.id}
                                            onClick={() => setActiveTicket(ticket)}
                                            className={`w-full text-left p-4 border-b border-slate-100 transition-colors hover:bg-white ${activeTicket?.id === ticket.id ? 'bg-white border-l-4 border-l-blue-600 shadow-sm' : ''}`}
                                        >
                                            <div className="flex justify-between mb-1">
                                                {/* در اینجا متغیر ساخته شده را نمایش می‌دهیم */}
                                                <span className={`font-bold text-sm ${ticket.user_id ? 'text-blue-600 font-mono' : 'text-slate-700'}`}>
                                                    {displayName}
                                                </span>
                                                
                                                <span className="text-[10px] text-slate-400">
                                                    {new Date(ticket.last_message_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                </span>
                                            </div>
                                            
                                            <div className="text-xs text-slate-500 truncate font-mono">
                                                {/* نمایش آیدی خود تیکت */}
                                                Ticket: {ticket.id.slice(0,8)}
                                            </div>
                                            
                                            <div className={`mt-2 text-[10px] uppercase font-bold px-2 py-0.5 rounded w-fit ${ticket.status === 'open' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-500'}`}>
                                                {ticket.status}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* منطقه چت (سمت راست) */}
                        <div className="flex-1 flex flex-col bg-white">
                            {activeTicket ? (
                                <>
                                    {/* هدر چت */}
                                    <div className="p-4 border-b border-slate-100 flex justify-between items-center">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white">
                                                <UserIcon className="w-5 h-5"/>
                                            </div>
                                            <div>
                                                <div className="font-bold text-slate-800 text-sm">Visitor Session</div>
                                                <div className="text-xs text-slate-400 font-mono">ID: {activeTicket.id}</div>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={handleCloseTicket}
                                            className="text-xs font-bold text-slate-500 hover:text-red-600 border px-3 py-1 rounded-lg hover:bg-red-50 transition"
                                        >
                                        Close Ticket
                                        </button>
                                    </div>

                                    {/* پیام‌ها */}
                                    <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/30">
                                        {/* اینجا باید یک useEffect جداگانه بنویسید که پیام‌های activeTicket رو بگیره */}
                                        {/* فعلا برای نمونه: */}
                                        <div className="flex justify-center">
                                        <span className="text-xs bg-slate-100 text-slate-400 px-3 py-1 rounded-full">Start of conversation</span>
                                        </div>
                                        <SupportChatArea ticketId={activeTicket.id} /> 
                                    </div>
                                </>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                                    <MessageCircle className="w-16 h-16 mb-4 opacity-20"/>
                                    <p>Select a ticket to start chatting</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
                {/* ============================================================ */}
                {/* TAB: LIVE EVENTS (RAW) */}
                {/* ============================================================ */}
                {activeTab === 'events' && (
                    <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden animate-in fade-in duration-500">
                        <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                            <div>
                                <h3 className="font-bold text-base text-slate-800">System Event Stream</h3>
                                <p className="text-xs text-slate-400 mt-1">Real-time raw data ingestion from all contracts.</p>
                            </div>
                            <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                                <span className="relative flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                </span>
                                Live Feed
                            </div>
                        </div>
                        <table className="w-full text-left">
                            <thead className="bg-slate-50/80 border-b border-slate-200 text-[11px] text-slate-500 uppercase font-bold">
                                <tr>
                                    <th className="p-5">Event Type</th>
                                    <th className="p-5">Project Context</th>
                                    <th className="p-5">Actor</th>
                                    <th className="p-5">Raw Payload (Preview)</th>
                                    <th className="p-5 text-right">Time</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-sm">
                                {events.map(ev => (
                                    <tr key={ev.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-5">
                                            <span className="font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded text-xs border border-slate-200">
                                                {ev.event_type}
                                            </span>
                                        </td>
                                        <td className="p-5">
                                            <div className="font-bold text-blue-600 text-xs truncate max-w-[150px]">
                                                {ev.projects?.title || 'Unknown Project'}
                                            </div>
                                            <button 
                                                onClick={() => {
                                                    copyToClipboard(ev.project_id);
                                                    setToast({ msg: "Project ID Copied to Clipboard", type: 'success' });
                                                }}
                                                className="text-[10px] text-slate-400 font-mono mt-0.5 hover:text-blue-600 hover:bg-blue-50 px-1 -ml-1 rounded transition-colors flex items-center gap-1 cursor-copy"
                                                title="Click to Copy Full ID"
                                            >
                                                {ev.project_id.slice(0, 8)}... <Copy className="w-2.5 h-2.5 opacity-50"/>
                                            </button>
                                        </td>
                                        <td className="p-5">
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation(); // جلوگیری از تداخل با کلیک‌های دیگر سطر
                                                    if (ev.actor_id) {
                                                        copyToClipboard(ev.actor_id);
                                                        setToast({ msg: `${ev.actor_role || 'Actor'} ID Copied!`, type: 'success' });
                                                    }
                                                }}
                                                disabled={!ev.actor_id} // غیرفعال کردن اگر آیدی وجود ندارد (مثلا سیستم)
                                                className={`text-[10px] font-bold px-2 py-1 rounded uppercase flex items-center gap-1.5 transition-all hover:shadow-sm hover:scale-105 active:scale-95 ${
                                                    ev.actor_role === 'system' 
                                                    ? 'bg-purple-50 text-purple-700 border border-purple-100 cursor-default' 
                                                    : 'bg-orange-50 text-orange-700 border border-orange-100 hover:bg-orange-100 cursor-copy'
                                                }`}
                                                title={ev.actor_id ? `Click to copy ID: ${ev.actor_id}` : 'System Event'}
                                            >
                                                {ev.actor_role || 'SYSTEM'}
                                                {ev.actor_id && <Copy className="w-3 h-3 opacity-50"/>}
                                            </button>
                                        </td>
                                        <td className="p-5">
                                            {/* استفاده از کامپوننت جدید برای پیدا کردن موارد قابل کپی */}
                                            <SmartDataParser 
                                                data={ev.payload} 
                                                onCopy={(text, label) => {
                                                    copyToClipboard(text);
                                                    setToast({ msg: `${label} Copied!`, type: 'success' });
                                                }} 
                                            />
                                            {/* نمایش جیسون خام */}
                                            <code className="text-[10px] text-slate-500 bg-slate-50 px-2 py-1 rounded border border-slate-100 block max-w-[300px] truncate font-mono">
                                                {JSON.stringify(ev.payload)}
                                            </code>
                                        </td>
                                        <td className="p-5 text-right text-xs text-slate-400 font-mono">
                                            {new Date(ev.created_at).toLocaleTimeString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* ============================================================ */}
                {/* TAB: AUDIT LOGS (DECISIONS) */}
                {/* ============================================================ */}
                {activeTab === 'logs' && (
                    <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-200/50 overflow-hidden animate-in fade-in duration-500">
                        <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                            <div>
                                <h3 className="font-bold text-base text-slate-800">Immutable Audit Ledger</h3>
                                <p className="text-xs text-slate-400 mt-1 font-medium">All administrative actions are cryptographically hashed.</p>
                            </div>
                            <div className="flex items-center gap-2.5 px-4 py-2 bg-blue-50 border border-blue-100 rounded-xl">
                                <Database className="w-4 h-4 text-blue-600"/>
                                <span className="text-[10px] font-mono text-blue-700 font-bold uppercase">DB Connection: Secure</span>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50/80 text-[11px] text-slate-500 uppercase font-bold tracking-wider">
                                    <tr>
                                        <th className="p-6 border-b">Verification</th>
                                        <th className="p-6 border-b">Event & Actor</th>
                                        <th className="p-6 border-b">Context</th>
                                        <th className="p-6 border-b">State Transition</th> 
                                        <th className="p-6 border-b">Cryptographic Hash</th>
                                        <th className="p-6 border-b">Rule Ver</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm divide-y divide-slate-100">
                                    {logs.map(log => (
                                        <tr key={log.id} className="hover:bg-slate-50 transition-colors group">
                                            <td className="p-6 align-top w-20">
                                                <div className="p-2.5 bg-slate-100 rounded-xl w-fit text-slate-400 group-hover:text-blue-600 group-hover:bg-blue-100 transition-colors">
                                                    <Fingerprint className="w-5 h-5" />
                                                </div>
                                            </td>
                                            <td className="p-6 align-top">
                                                <div className="font-bold text-slate-900 text-sm mb-1">{log.event_type}</div>
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase ${log.actor_id ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                                                            {log.actor_id ? 'MANUAL' : 'SYSTEM'}
                                                        </span>
                                                    </div>
                                                    <span className="text-[10px] text-slate-400 font-mono mt-1">{formatDate(log.created_at)}</span>
                                                </div>
                                            </td>
                                            <td className="p-6 align-top">
                                                <button 
                                                    onClick={() => {
                                                        // اگر ID خاصی نبود fallback به عنوان global
                                                        const idToCopy = log.project_id || 'GLOBAL';
                                                        copyToClipboard(idToCopy);
                                                        setToast({ msg: "Context ID Copied", type: 'success' });
                                                    }}
                                                    className="text-blue-600 font-bold text-xs bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg w-fit border border-blue-100 hover:border-blue-300 transition-all flex items-center gap-2"
                                                    title="Click to copy ID"
                                                >
                                                    {log.projects?.title || log.project_id?.slice(0,8) || 'GLOBAL'}
                                                    <Copy className="w-3 h-3 opacity-50"/>
                                                </button>
                                            </td>
                                            <td className="p-6 align-top">
                                                <button 
                                                    onClick={() => {
                                                        copyToClipboard(log.log_hash || log.system_hash || '');
                                                        setToast({ msg: "Hash signature copied to clipboard", type: 'success' });
                                                    }}
                                                    className="flex items-center gap-3 group/hash bg-slate-50 hover:bg-white border border-slate-200 hover:border-blue-300 rounded-xl px-4 py-2 transition-all w-full max-w-[220px] shadow-sm"
                                                >
                                                    <span className="font-mono text-[10px] text-slate-500 truncate group-hover/hash:text-blue-600">
                                                        {truncateHash(log.log_hash || log.system_hash || '')}
                                                    </span>
                                                    <Copy className="w-3 h-3 text-slate-300 group-hover/hash:text-blue-500 ml-auto"/>
                                                </button>
                                            </td>
                                            <td className="p-6 align-top">
                                                <div className="space-y-3">
                                                    {/* بررسی PREV STATE برای TX Hash */}
                                                    <div className="flex flex-col gap-1 items-start text-[10px]">
                                                        <div className="flex items-center gap-2 w-full">
                                                            <span className="text-slate-400 font-bold w-10">PREV</span>
                                                            <code className="bg-slate-100 text-slate-600 px-2 py-1 rounded border border-slate-200 block flex-1 font-mono break-all line-clamp-1">
                                                                {JSON.stringify(log.prev_state)}
                                                            </code>
                                                        </div>
                                                        {/* دکمه‌های کپی هوشمند برای PREV */}
                                                        <SmartDataParser data={log.prev_state} onCopy={(t, l) => { copyToClipboard(t); setToast({ msg: `${l} Copied`, type: 'success' }) }} />
                                                    </div>

                                                    {/* بررسی NEXT STATE برای TX Hash */}
                                                    <div className="flex flex-col gap-1 items-start text-[10px]">
                                                        <div className="flex items-center gap-2 w-full">
                                                            <span className="text-slate-400 font-bold w-10">NEXT</span>
                                                            <code className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded border border-emerald-200 block flex-1 font-mono font-bold break-all line-clamp-1">
                                                                {JSON.stringify(log.next_state)}
                                                            </code>
                                                        </div>
                                                        {/* دکمه‌های کپی هوشمند برای NEXT */}
                                                        <SmartDataParser data={log.next_state} onCopy={(t, l) => { copyToClipboard(t); setToast({ msg: `${l} Copied`, type: 'success' }) }} />
                                                    </div>

                                                    {log.is_override && (
                                                        <div className="text-[10px] text-rose-600 font-bold bg-rose-50 px-3 py-1 rounded border border-rose-100 w-fit flex items-center gap-1">
                                                            <ShieldAlert className="w-3 h-3"/> ADMIN OVERRIDE
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-6 align-top">
                                                <span className="bg-purple-50 text-purple-700 px-2 py-1 rounded border border-purple-100 text-[10px] font-mono font-bold">
                                                    {log.rule_version || 'v1.0.0'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {logs.length === 0 && (
                                        <tr><td colSpan={5} className="p-16 text-center text-slate-400 text-sm">No audit logs found.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* ============================================================ */}
                {/* TAB: DISPUTES */}
                {/* ============================================================ */}
                {activeTab === 'disputes' && (
                    <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-200/50 overflow-hidden animate-in fade-in duration-500">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50/80 border-b border-slate-200">
                                <tr>
                                    <th className="p-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Case File</th>
                                    <th className="p-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Value Locked</th>
                                    <th className="p-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Type</th>
                                    <th className="p-6 text-xs font-bold text-slate-500 uppercase tracking-wider">Risk Level</th>
                                    <th className="p-6 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Intervention</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {disputes.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="p-24 text-center">
                                            <div className="flex flex-col items-center gap-4">
                                                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-2">
                                                    <CheckCircle2 className="w-8 h-8"/>
                                                </div>
                                                <h4 className="text-slate-900 font-bold text-lg">All Systems Nominal</h4>
                                                <p className="text-slate-500 text-sm max-w-xs leading-relaxed">No active disputes requiring administrative attention at this time.</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : disputes.map(d => (
                                    <tr key={d.id} className="hover:bg-rose-50/10 transition-colors">
                                        <td className="p-6">
                                            <div className="font-mono text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded w-fit mb-1.5 border border-slate-200">ID: {d.id.slice(0,8)}...</div>
                                            <div className="text-sm text-slate-900 font-bold truncate max-w-[250px]">{d.title}</div>
                                        </td>
                                        <td className="p-6 font-black text-slate-800 text-base">${d.budget?.toLocaleString()}</td>
                                        <td className="p-6">
                                            <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-lg text-xs font-bold">Milestone Dispute</span>
                                        </td>
                                        <td className="p-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                                                    <div className="h-full bg-rose-500 w-[85%] rounded-full shadow-[0_0_10px_rgba(244,63,94,0.5)]"></div>
                                                </div>
                                                <span className="text-xs font-black text-rose-600">CRITICAL</span>
                                            </div>
                                        </td>
                                        <td className="p-6 text-right">
                                            <div className="flex justify-end gap-3 items-center h-full">
                                                <button 
                                                    onClick={() => setSelectedCase(d)}
                                                    className="px-4 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold hover:bg-slate-50 text-slate-700 flex items-center gap-2 transition-all shadow-sm group"
                                                >
                                                    <Eye className="w-3 h-3 text-slate-400 group-hover:text-blue-500 transition-colors"/> Evidence
                                                </button>
                                                <ActionDropdown projectId={d.id} />
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* ============================================================ */}
                {/* TAB: ADMIN OVERRIDES */}
                {/* ============================================================ */}
                {activeTab === 'overrides' && (
                    <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden animate-in fade-in duration-500">
                        <div className="p-8 border-b border-slate-100 bg-rose-50/30 flex justify-between items-center">
                            <div>
                                <h3 className="font-bold text-base text-rose-900">Admin Intervention Log</h3>
                                <p className="text-xs text-rose-500 mt-1">Audit trail of manual overrides and forced transactions.</p>
                            </div>
                            <ShieldAlert className="w-6 h-6 text-rose-500 opacity-50"/>
                        </div>
                        <table className="w-full text-left">
                            <thead className="bg-slate-50/80 border-b border-slate-200 text-[11px] text-slate-500 uppercase font-bold">
                                <tr>
                                    <th className="p-5">Admin</th>
                                    <th className="p-5">Project</th>
                                    <th className="p-5">Change</th>
                                    <th className="p-5">Justification (Reason)</th>
                                    <th className="p-5 text-right">Date</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-sm">
                                {overrides.map(ov => (
                                    <tr key={ov.id} className="hover:bg-rose-50/10 transition-colors">
                                        <td className="p-5">
                                            <div className="font-bold text-slate-800 text-xs truncate max-w-[150px]" title={ov.admin_id}>
                                                {ov.admin?.email || ov.admin_id || 'System'}
                                            </div>
                                        </td>
                                        <td className="p-5">
                                            <div className="text-xs font-bold text-slate-600">{ov.projects?.title}</div>
                                        </td>
                                        <td className="p-5">
                                            <div className="flex items-center gap-2 text-xs">
                                                <span className="line-through text-slate-400">{ov.original_decision}</span>
                                                <ArrowRightLeft className="w-3 h-3 text-slate-300"/>
                                                <span className="font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-100">
                                                    {ov.new_decision}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="p-5">
                                            <div className="text-xs text-slate-600 max-w-md leading-relaxed">
                                                <span className="text-slate-400 italic mr-1">"</span>
                                                <SmartTextParser 
                                                    text={ov.reason} 
                                                    onCopy={(t) => {
                                                        copyToClipboard(t);
                                                        setToast({ msg: "Hash Copied to Clipboard!", type: 'success' });
                                                    }}
                                                />
                                                <span className="text-slate-400 italic ml-1">"</span>
                                            </div>
                                        </td>
                                        <td className="p-5 text-right text-xs text-slate-400 font-mono">
                                            {new Date(ov.created_at).toLocaleString()}
                                        </td>
                                    </tr>
                                ))}
                                {overrides.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="p-16 text-center text-slate-400">
                                            No manual interventions recorded. Logic flow is autonomous.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {activeTab === 'rules' && (
                    <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-200/50 overflow-hidden animate-in fade-in duration-500 p-8">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="font-bold text-xl text-slate-800">System Rule Configuration</h3>
                                <p className="text-sm text-slate-500">Current active logic version: <span className="font-mono text-blue-600 font-bold">1.0.0-Live</span></p>
                            </div>
                            <div className="flex gap-2">
                                <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold border border-emerald-100 flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3"/> Active
                                </span>
                                <button className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold border border-slate-200 cursor-not-allowed opacity-70 flex items-center gap-2">
                                    <Lock className="w-3 h-3"/> Read-Only Mode
                                </button>
                            </div>
                        </div>

                        <div className="bg-[#1e1e1e] rounded-2xl p-0 overflow-hidden relative group border border-slate-800 shadow-inner">
                            <div className="flex items-center justify-between px-4 py-2 bg-[#2d2d2d] border-b border-white/10">
                                <span className="text-xs text-slate-400 font-mono">lib/decision_engine.ts</span>
                                <div className="flex gap-1.5">
                                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/20 border border-red-500/50"></div>
                                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/20 border border-yellow-500/50"></div>
                                    <div className="w-2.5 h-2.5 rounded-full bg-green-500/20 border border-green-500/50"></div>
                                </div>
                            </div>
                            <pre className="p-6 text-emerald-400 font-mono text-xs leading-relaxed overflow-x-auto custom-scrollbar">
                {`/**
                * PRODUCTION DECISION ENGINE (v1.0.0-Live)
                * Rule-Based System
                */

                export const evaluateMilestoneRelease = async (
                milestoneId: string, projectId: string, freelancerId: string
                ): Promise<DecisionResult> => {
                
                // 1. RULE: Delivery Exists
                if (milestone.submission_file_url) {
                    delivery_score = 100;
                } else {
                    delivery_score = 0; // Critical Fail
                }

                // 2. RULE: Timing (Deadline Check)
                if (now > due) {
                    behavior_score -= (daysLate * 5); 
                }

                // 3. RULE: High Value Risk
                if (amount > 1000) {
                    risk_score += 50; // Manual Review Trigger
                }

                // SCORING THRESHOLDS
                if (delivery_score >= 75 && behavior_score >= 70 && risk_score <= 40) {
                    return 'RELEASE'; // Auto-Approve
                } else if (risk_score >= 70) {
                    return 'HOLD';    // Manual Review
                } else {
                    return 'DISPUTE'; // Auto-Reject
                }
                };`}
                            </pre>
                        </div>
                        
                        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm">
                                <div className="flex items-center gap-2 text-xs text-slate-500 uppercase font-bold mb-2">
                                    <AlertOctagon className="w-4 h-4 text-rose-500"/>
                                    Risk Threshold
                                </div>
                                <div className="text-2xl font-black text-slate-800">70<span className="text-sm text-slate-400 font-medium ml-1">/100</span></div>
                                <div className="text-[10px] text-slate-400 mt-1">Scores above this trigger manual review</div>
                            </div>
                            
                            <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm">
                                <div className="flex items-center gap-2 text-xs text-slate-500 uppercase font-bold mb-2">
                                    <FileText className="w-4 h-4 text-emerald-500"/>
                                    Min Delivery Score
                                </div>
                                <div className="text-2xl font-black text-slate-800">75<span className="text-sm text-slate-400 font-medium ml-1">/100</span></div>
                                <div className="text-[10px] text-slate-400 mt-1">Required for auto-release eligibility</div>
                            </div>
                            
                            <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm">
                                <div className="flex items-center gap-2 text-xs text-slate-500 uppercase font-bold mb-2">
                                    <Activity className="w-4 h-4 text-blue-500"/>
                                    System Version
                                </div>
                                <div className="text-2xl font-black text-slate-800">v1.0.0</div>
                                <div className="text-[10px] text-slate-400 mt-1">Last Freeze: ${new Date().toLocaleDateString()}</div>
                            </div>
                        </div>
                    </div>
                )}
            </main>

            {/* Evidence Modal Overlay */}
            {selectedCase && <EvidencePanel project={selectedCase} onClose={() => setSelectedCase(null)} />}
            {/* Description Modal Overlay */}
            {selectedDesc && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-200 transform transition-all scale-100">
                        {/* Modal Header */}
                        <div className="p-5 border-b border-slate-100 flex justify-between items-start bg-slate-50">
                            <div>
                                <h3 className="font-bold text-slate-800 text-lg pr-4">{selectedDesc.title}</h3>
                                <p className="text-xs text-slate-500 mt-1">Full Project Description</p>
                            </div>
                            <button 
                                onClick={() => setSelectedDesc(null)} 
                                className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500"
                            >
                                <X className="w-5 h-5"/>
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 max-h-[60vh] overflow-y-auto bg-white">
                            <p className="text-sm text-slate-700 leading-7 whitespace-pre-wrap">
                                {selectedDesc.content}
                            </p>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                            <button 
                                onClick={() => setSelectedDesc(null)}
                                className="px-5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}