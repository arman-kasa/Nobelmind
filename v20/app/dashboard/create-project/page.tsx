'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../../lib/supabase';
import { DollarSign, Shield, Lock, Bot, Calendar } from 'lucide-react';
import { Button, SpotlightCard } from '../../../components/ui/shared';
import { createProjectAction } from '../../actions'; // Import Server Action

const ALL_SKILLS = [
    "React", "Next.js", "TypeScript", "Node.js", "Tailwind CSS", "Supabase", 
    "Solidity", "Web3.js", "Ethers.js", "UI/UX Design", "Figma", "Python", 
    "Django", "FastAPI", "PostgreSQL", "MongoDB", "AWS", "Docker", "Kubernetes"
];

const SkillSelector = ({ selected, onToggle }: any) => {
    const [input, setInput] = useState('');
    const suggestions = input 
        ? ALL_SKILLS.filter(s => s.toLowerCase().includes(input.toLowerCase()) && !selected.includes(s))
        : [];

    return (
        <div className="relative">
            <div className="flex flex-wrap gap-2 mb-3">
                {selected.map((skill: string) => (
                    <span key={skill} className="px-3 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded-full text-xs font-medium flex items-center gap-1">
                        {skill}
                        <button type="button" onClick={() => onToggle(skill)} className="hover:text-red-500 ml-1">×</button>
                    </span>
                ))}
            </div>
            <div className="relative">
                <input 
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Type a skill..."
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-700 outline-none focus:border-blue-500 transition-colors text-sm"
                />
                {input && suggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-20 max-h-60 overflow-y-auto">
                        {suggestions.map(skill => (
                            <button 
                                key={skill}
                                type="button"
                                onClick={() => { onToggle(skill); setInput(''); }}
                                className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700 text-sm"
                            >
                                {skill}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default function CreateProjectPage() {
    const router = useRouter();
    const [formData, setFormData] = useState({ 
        title: '', 
        description: '', 
        min_budget: '',
        max_budget: '', // Main budget for escrow
        min_duration: '',
        max_duration: '',
        skills: [] as string[] 
    });
    const [loading, setLoading] = useState(false);

    // V2.0: Switched to Server Action for secure Address Generation
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.title || !formData.max_budget) return;
        setLoading(true);

        const form = new FormData();
        form.append('title', formData.title);
        
        const detailedDescription = `${formData.description}\n\n[Project Metadata]\nBudget Range: $${formData.min_budget} - $${formData.max_budget}\nDuration: ${formData.min_duration} - ${formData.max_duration} Days`;
        form.append('description', detailedDescription);
        
        form.append('budgetMax', formData.max_budget);
        form.append('skills', formData.skills.join(','));

        // Use the imported Server Action
        // NOTE: In a real Next.js form, you'd bind this to the <form action={...}> but we are doing it programmatically here
        const result = await createProjectAction(null, form);
        
        if (result?.error) {
            alert('Error creating project: ' + result.error);
            setLoading(false);
        }
        // Success redirect happens in the action
    };

    return (
        <div className="max-w-4xl mx-auto animate-in fade-in duration-500 pb-20 px-4 md:px-0">
             <Button variant="ghost" onClick={() => router.back()} className="mb-6 pl-0">← Back</Button>
             
             <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">Post a New Bounty (V2.0)</h1>
             <p className="text-slate-500 mb-8 text-sm">Crypto Escrow & Smart Contract Enabled</p>

             <div className="space-y-6">
                 {/* Card 1: Scope */}
                 <SpotlightCard className="!p-6">
                     <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                        <div className="w-6 h-6 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 text-xs">1</div>
                        Scope of Work
                     </h2>
                     <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-2">Project Title</label>
                            <input 
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 outline-none transition-all text-sm"
                                placeholder="e.g. DeFi Dashboard Frontend"
                                value={formData.title}
                                onChange={e => setFormData({...formData, title: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-2">Description</label>
                            <textarea 
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 outline-none h-40 resize-none transition-all text-sm"
                                placeholder="Describe deliverables clearly..."
                                value={formData.description}
                                onChange={e => setFormData({...formData, description: e.target.value})}
                            />
                        </div>
                        <div>
                             <label className="block text-xs font-bold text-slate-700 mb-2">Required Skills</label>
                             <SkillSelector 
                                selected={formData.skills} 
                                onToggle={(skill: string) => {
                                     const exists = formData.skills.includes(skill);
                                     setFormData({
                                         ...formData, 
                                         skills: exists ? formData.skills.filter(s => s !== skill) : [...formData.skills, skill]
                                     });
                                }} 
                             />
                         </div>
                     </div>
                 </SpotlightCard>

                 {/* Card 2: Terms */}
                 <SpotlightCard className="!p-6">
                    <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                        <div className="w-6 h-6 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600 text-xs">2</div>
                        Terms & Budget
                     </h2>
                     <div className="grid md:grid-cols-2 gap-6">
                        {/* Budget Range */}
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-2">Budget Range (USDC)</label>
                            <div className="flex items-center gap-2">
                                <div className="relative flex-1">
                                    <span className="absolute left-3 top-3 text-slate-400 text-xs">$</span>
                                    <input 
                                        type="number"
                                        className="w-full pl-6 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 outline-none text-sm"
                                        placeholder="Min"
                                        value={formData.min_budget}
                                        onChange={e => setFormData({...formData, min_budget: e.target.value})}
                                    />
                                </div>
                                <span className="text-slate-400">-</span>
                                <div className="relative flex-1">
                                    <span className="absolute left-3 top-3 text-slate-400 text-xs">$</span>
                                    <input 
                                        type="number"
                                        className="w-full pl-6 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 outline-none text-sm"
                                        placeholder="Max"
                                        value={formData.max_budget}
                                        onChange={e => setFormData({...formData, max_budget: e.target.value})}
                                    />
                                </div>
                            </div>
                            <p className="text-[10px] text-slate-500 mt-2 flex items-center gap-1">
                                <Lock className="w-3 h-3" /> Max amount will be required for escrow.
                            </p>
                        </div>

                        {/* Duration Range */}
                        <div>
                             <label className="block text-xs font-bold text-slate-700 mb-2">Estimated Duration (Days)</label>
                             <div className="flex items-center gap-2">
                                <div className="relative flex-1">
                                    <input 
                                        type="number"
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 outline-none text-sm"
                                        placeholder="Min Days"
                                        value={formData.min_duration}
                                        onChange={e => setFormData({...formData, min_duration: e.target.value})}
                                    />
                                </div>
                                <span className="text-slate-400">-</span>
                                <div className="relative flex-1">
                                    <input 
                                        type="number"
                                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 outline-none text-sm"
                                        placeholder="Max Days"
                                        value={formData.max_duration}
                                        onChange={e => setFormData({...formData, max_duration: e.target.value})}
                                    />
                                </div>
                             </div>
                             <div className="mt-2 text-[10px] text-green-600 font-bold flex items-center gap-1">
                                <Bot className="w-3 h-3" /> AI Risk Score: Low
                             </div>
                        </div>
                     </div>
                 </SpotlightCard>

                 {/* Card 3: Platform Role */}
                 <SpotlightCard className="!p-6 bg-slate-50 border-slate-200/60">
                     <div className="flex gap-4">
                        <div className="w-10 h-10 bg-white rounded-xl border border-slate-200 flex items-center justify-center flex-shrink-0">
                            <Shield className="w-5 h-5 text-slate-400" />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-900 text-sm mb-1">Smart Contract Escrow</h3>
                            <p className="text-xs text-slate-500 leading-relaxed">
                                A unique Polygon address will be generated for this project.
                                Funds will be secured in a smart contract until completion.
                            </p>
                        </div>
                     </div>
                 </SpotlightCard>

                 <div className="pt-4 border-t border-slate-100">
                     <Button onClick={handleSubmit} disabled={loading} className="w-full md:w-auto md:float-right bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200">
                         {loading ? 'Generating Contract...' : 'Create Crypto Bounty'}
                     </Button>
                 </div>
             </div>
        </div>
    );
}