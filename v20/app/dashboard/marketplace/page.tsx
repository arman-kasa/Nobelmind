'use client';
import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../../lib/supabase';
import { Search, DollarSign, Clock, Filter, Briefcase } from 'lucide-react';
import { Button, Badge, SpotlightCard } from '../../../components/ui/shared';

export default function MarketplacePage() {
    // Singleton client
    const [supabase] = useState(() => createClient());
    const router = useRouter();
    const [projects, setProjects] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        let mounted = true;
        const load = async () => {
            // Only fetch open projects
            const { data } = await supabase.from('projects')
                .select('*')
                .eq('status', 'open') 
                .order('created_at', { ascending: false });
            
            if (mounted && data) {
                setProjects(data);
                setLoading(false);
            }
        };
        load();
        return () => { mounted = false; };
    }, [supabase]);

    // Optimize filtering with useMemo
    const filteredProjects = useMemo(() => {
        if (!search) return projects;
        const lowerSearch = search.toLowerCase();
        return projects.filter(p => 
            p.title.toLowerCase().includes(lowerSearch) || 
            p.description.toLowerCase().includes(lowerSearch)
        );
    }, [projects, search]);

    return (
        <div className="animate-in fade-in duration-500 pb-20">
             <div className="mb-6 md:mb-8">
                <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">Marketplace</h1>
                <p className="text-xs md:text-sm text-slate-500">Find anonymous work and get paid in crypto.</p>
             </div>

             <div className="flex flex-col md:flex-row gap-4 mb-8">
                 <div className="relative flex-1">
                     <Search className="absolute left-3 top-2.5 md:top-3 w-4 h-4 text-slate-400" />
                     <input 
                        className="w-full pl-10 p-2 md:p-2.5 bg-white border border-slate-200 rounded-xl focus:border-blue-500 outline-none text-xs md:text-sm"
                        placeholder="Search projects..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                     />
                 </div>
                 <Button variant="outline" className="text-xs md:text-sm md:w-auto h-9 md:h-10 gap-2">
                    <Filter className="w-3 h-3 md:w-4 md:h-4" /> Filters
                 </Button>
             </div>

             {loading ? (
                 <div className="text-center py-20 text-slate-400 text-xs">Loading marketplace...</div>
             ) : (
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                     {filteredProjects.map(p => (
                         <SpotlightCard key={p.id} onClick={() => router.push(`/dashboard/projects/${p.id}`)} className="h-full flex flex-col hover:border-blue-300 transition-colors !p-4 md:!p-6 cursor-pointer">
                             <div className="flex justify-between items-start mb-3 md:mb-4">
                                 <div className="flex gap-2">
                                     {p.skills_required?.slice(0, 2).map((s: string) => (
                                         <Badge key={s} variant="outline" className="text-[9px] md:text-xs">{s}</Badge>
                                     ))}
                                 </div>
                                 <span className="text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded-lg text-[10px] md:text-sm flex items-center gap-1">
                                    <DollarSign className="w-3 h-3" /> {p.budget}
                                 </span>
                             </div>
                             
                             <h3 className="font-bold text-sm md:text-lg text-slate-900 mb-2 line-clamp-1">{p.title}</h3>
                             <p className="text-xs md:text-sm text-slate-500 line-clamp-3 mb-4 flex-1 leading-relaxed">
                                {p.description}
                             </p>

                             <div className="pt-3 md:pt-4 border-t border-slate-100 flex justify-between items-center text-[10px] md:text-xs text-slate-400">
                                 <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(p.created_at).toLocaleDateString()}</span>
                                 <span className="flex items-center gap-1"><Briefcase className="w-3 h-3" /> Fixed Price</span>
                             </div>
                         </SpotlightCard>
                     ))}
                     {filteredProjects.length === 0 && (
                         <div className="col-span-full text-center py-20 bg-slate-50 rounded-2xl border border-slate-100">
                             <p className="text-slate-500 text-sm">No open projects found matching your search.</p>
                         </div>
                     )}
                 </div>
             )}
        </div>
    );
}