'use client';
import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../lib/supabase';
import { Search, Plus, Clock, Lock, TrendingUp, DollarSign, Briefcase, Bot, Shield, CheckCircle } from 'lucide-react';
import { Button, Badge, SpotlightCard } from '../../components/ui/shared';

// Chart Component - Memoized
const SimpleChart = React.memo(({ color = 'bg-blue-500' }: { color?: string }) => (
    <div className="h-12 md:h-16 flex items-end gap-1 mt-4">
        {[40, 70, 45, 90, 60, 80, 55].map((h, i) => (
            <div key={i} style={{ height: `${h}%` }} className={`flex-1 rounded-t-sm ${color} opacity-20 hover:opacity-100 transition-opacity`} />
        ))}
    </div>
));
SimpleChart.displayName = 'SimpleChart';

// Stats Card - Memoized to prevent re-renders
const StatsCard = React.memo(({ title, value, icon: Icon, color, trend }: any) => (
    <SpotlightCard className="!p-4 md:!p-5">
        <div className="flex justify-between items-start">
            <div>
                <p className="text-[10px] md:text-sm text-slate-500 mb-1 font-medium">{title}</p>
                <h3 className="text-lg md:text-2xl font-bold text-slate-900">{value}</h3>
            </div>
            <div className={`p-1.5 md:p-2 rounded-lg ${color} bg-opacity-10 text-opacity-100`}>
                <Icon className={`w-4 h-4 md:w-5 md:h-5 ${color.replace('bg-', 'text-')}`} />
            </div>
        </div>
        {trend && <div className="mt-3 md:mt-4 flex items-center text-[9px] md:text-xs text-emerald-600 font-medium"><TrendingUp className="w-3 h-3 mr-1" /> {trend} this month</div>}
        <SimpleChart color={color.replace('bg-', 'bg-')} />
    </SpotlightCard>
));
StatsCard.displayName = 'StatsCard';

export default function DashboardPage() {
    const [supabase] = useState(() => createClient());
    const router = useRouter();
    
    const [profile, setProfile] = useState<any>(null);
    const [projects, setProjects] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;
        const load = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if(!user) {
                    if (mounted) router.replace('/auth');
                    return;
                }

                // 1. Fetch Profile First
                const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single();
                if (!prof) {
                    if (mounted) setLoading(false);
                    return; 
                }

                // 2. Parallel Fetching: Projects, Reviews, Counts
                // This eliminates the waterfall effect
                const isClient = prof.user_type === 'client';
                
                const projectsPromise = isClient
                    ? supabase.from('projects').select('*').eq('client_id', user.id).order('created_at', { ascending: false })
                    : supabase.from('projects').select('*').eq('freelancer_id', user.id).in('status', ['hired', 'in_progress', 'review', 'completed']).order('created_at', { ascending: false });

                const reviewsPromise = supabase.from('reviews').select('rating').eq('reviewee_id', user.id);
                
                // Count completed projects efficiently
                const completedCountPromise = supabase.from('projects')
                    .select('*', { count: 'exact', head: true })
                    .eq(isClient ? 'client_id' : 'freelancer_id', user.id)
                    .eq('status', 'completed');

                const [projectsRes, reviewsRes, completedRes] = await Promise.all([
                    projectsPromise,
                    reviewsPromise,
                    completedCountPromise
                ]);

                if (!mounted) return;

                // 3. Process Data
                const projs = projectsRes.data || [];
                const reviews = reviewsRes.data || [];
                const completedCount = completedRes.count || 0;

                // Calculate Trust Score
                const totalReviews = reviews.length;
                const avgRating = totalReviews > 0 ? (reviews.reduce((a, b) => a + b.rating, 0) / totalReviews) : 0;
                
                let calculatedTrust = 50; 
                calculatedTrust += (completedCount * 5); 
                calculatedTrust += (avgRating * 10); 
                if (calculatedTrust > 100) calculatedTrust = 100;

                setProfile({ ...prof, trust_score: Math.round(calculatedTrust) });
                setProjects(projs);

            } catch (err) {
                console.error("Error loading dashboard:", err);
            } finally {
                if (mounted) setLoading(false);
            }
        };
        load();
        return () => { mounted = false; };
    }, [supabase, router]);

    // Memoize Stats Calculation
    const stats = useMemo(() => {
        const active = projects.filter(p => ['hired', 'in_progress', 'review'].includes(p.status)).length;
        const completed = projects.filter(p => p.status === 'completed').length;
        const money = projects.reduce((acc, p) => acc + (p.status === 'completed' ? p.budget : 0), 0);
        return { active, completed, money };
    }, [projects]);

    if(loading) return (
        <div className="min-h-[50vh] flex items-center justify-center">
            <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full"/>
        </div>
    );

    if (!profile) return null;

    const DashboardHeader = ({ title, subtitle, action }: any) => (
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-8 gap-4 relative">
            <div>
                <h1 className="text-2xl md:text-3xl font-bold text-slate-900">{title}</h1>
                <p className="text-xs md:text-sm text-slate-500 mt-1">{subtitle}</p>
            </div>
            {action}
        </div>
    );

    // --- FREELANCER DASHBOARD ---
    if(profile.user_type === 'freelancer') {
        return (
            <div className="animate-in fade-in duration-500 pb-20 px-4 md:px-0 pt-4 md:pt-0">
                <DashboardHeader 
                    title={`Hello, ${profile.ghost_id}`}
                    subtitle="Ready to work anonymously?"
                    action={<Button variant="primary" onClick={() => router.push('/dashboard/marketplace')} icon={Search} className="text-xs md:text-sm h-10 w-full md:w-auto justify-center">Find Work</Button>}
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-8 md:mb-10">
                    <StatsCard title="Earnings" value={`$${stats.money}`} icon={DollarSign} color="bg-emerald-500" trend="+0%" />
                    <StatsCard title="Trust Score" value={profile.trust_score} icon={Shield} color="bg-blue-500" />
                    <StatsCard title="Active Jobs" value={stats.active} icon={Clock} color="bg-amber-500" />
                </div>

                <div className="flex items-center justify-between mb-4 md:mb-6">
                    <h2 className="text-lg md:text-xl font-bold text-slate-900">My Active Projects</h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                    {projects.map(p => (
                        <SpotlightCard key={p.id} onClick={() => router.push(`/dashboard/projects/${p.id}`)} className="h-full flex flex-col hover:border-blue-300 transition-colors !p-4">
                            <div className="flex justify-between items-start mb-3">
                                <Badge>{p.status.replace('_', ' ')}</Badge>
                                <span className="text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded-lg text-xs">${p.budget}</span>
                            </div>
                            <h3 className="font-bold text-sm md:text-lg text-slate-900 mb-2 line-clamp-1">{p.title}</h3>
                            <p className="text-xs md:text-sm text-slate-500 line-clamp-2 mb-4 flex-1">{p.description}</p>
                            <div className="pt-3 border-t border-slate-100 flex justify-between items-center text-[10px] md:text-xs text-slate-400">
                                <span>{new Date(p.created_at).toLocaleDateString()}</span>
                                <span className="flex items-center gap-1">Open <Search className="w-3 h-3"/></span>
                            </div>
                        </SpotlightCard>
                    ))}
                    {projects.length === 0 && (
                        <div className="col-span-full text-center py-10 bg-slate-50 rounded-xl border border-slate-100">
                            <p className="text-slate-400 text-xs md:text-sm mb-4">No active projects yet.</p>
                            <Button variant="outline" onClick={() => router.push('/dashboard/marketplace')} className="text-xs">Browse Marketplace</Button>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // --- CLIENT DASHBOARD ---
    return (
        <div className="animate-in fade-in duration-500 pb-20 px-4 md:px-0 pt-4 md:pt-0">
            <DashboardHeader 
                title="Client Dashboard"
                subtitle="Manage anonymous bounties & escrow"
                action={<Button variant="primary" onClick={() => router.push('/dashboard/create-project')} icon={Plus} className="text-xs md:text-sm h-10 w-full md:w-auto justify-center">Post Project</Button>}
            />

            <div className="bg-gradient-to-r from-blue-900 to-slate-900 rounded-2xl p-3 md:p-4 mb-6 md:mb-8 text-white flex flex-wrap items-center gap-3 md:gap-6 shadow-xl">
                 <div className="flex items-center gap-2 text-xs md:text-sm font-semibold">
                    <Shield className="w-4 h-4 md:w-5 md:h-5 text-emerald-400" />
                    <span>Trust Status: Protected</span>
                 </div>
                 <div className="hidden md:block w-px h-6 bg-white/20"></div>
                 <div className="flex items-center gap-2 text-[10px] md:text-xs text-blue-100">
                    <Lock className="w-3 h-3 md:w-4 md:h-4" /> Escrow Active
                 </div>
                 <div className="flex items-center gap-2 text-[10px] md:text-xs text-blue-100">
                    <Bot className="w-3 h-3 md:w-4 md:h-4" /> AI Monitoring On
                 </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-8 md:mb-10">
                <StatsCard title="Active Projects" value={stats.active} icon={Briefcase} color="bg-blue-500" />
                <StatsCard title="Total Spent" value={`$${stats.money}`} icon={DollarSign} color="bg-emerald-500" />
                <StatsCard title="Completed Jobs" value={stats.completed} icon={CheckCircle} color="bg-purple-500" />
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="p-4 md:p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <h2 className="text-sm md:text-lg font-bold text-slate-900">Your Projects</h2>
                </div>
                <div className="divide-y divide-slate-100">
                    {projects.map(p => (
                        <div key={p.id} className="p-4 md:p-6 flex flex-col md:flex-row items-start md:items-center justify-between hover:bg-slate-50 transition-colors gap-4">
                            <div className="flex-1 w-full">
                                <div className="flex items-center justify-between md:justify-start gap-3 mb-1">
                                    <h3 className="font-bold text-slate-900 text-sm md:text-lg cursor-pointer hover:text-blue-600 line-clamp-1" onClick={() => router.push(`/dashboard/projects/${p.id}`)}>{p.title}</h3>
                                    {p.escrow_status === 'locked' && <Badge variant="default" className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[9px] md:text-xs"><Lock className="w-3 h-3 mr-1"/> Locked</Badge>}
                                </div>
                                <div className="flex gap-4 mt-2 text-[10px] md:text-sm text-slate-500">
                                    <span className="flex items-center gap-1"><Clock className="w-3 h-3 md:w-3.5 md:h-3.5" /> {new Date(p.created_at).toLocaleDateString()}</span>
                                    <span>Budget: <span className="font-medium text-emerald-600">${p.budget}</span></span>
                                    <span className={`px-2 py-0.5 rounded text-[9px] md:text-xs font-bold uppercase ${p.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>{p.status.replace('_', ' ')}</span>
                                </div>
                            </div>
                            <Button variant="outline" className="text-[10px] md:text-xs h-8 md:h-9 w-full md:w-auto" onClick={() => router.push(`/dashboard/projects/${p.id}`)}>Manage</Button>
                        </div>
                    ))}
                    {projects.length === 0 && (
                        <div className="text-center py-12 md:py-16 px-6">
                            <div className="w-12 h-12 md:w-16 md:h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400"><Plus className="w-6 h-6 md:w-8 md:h-8"/></div>
                            <h3 className="text-slate-900 font-bold mb-4 text-sm md:text-lg">No Projects Yet</h3>
                            <Button onClick={() => router.push('/dashboard/create-project')} className="text-xs md:text-sm">Post Anonymous Project</Button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}