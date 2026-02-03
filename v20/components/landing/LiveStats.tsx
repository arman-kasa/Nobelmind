'use client';
import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { motion } from 'framer-motion';
import { Users, Briefcase, Coins } from 'lucide-react';

export default function LiveStats() {
  const [stats, setStats] = useState({ users: 0, projects: 0, volume: 0 });
  // استفاده از try-catch برای جلوگیری از کرش اگر کلاینت ساخته نشد
  const supabase = createClient();

  useEffect(() => {
    async function fetchStats() {
      try {
        // دریافت تعداد کاربران
        const { count: usersCount, error: usersError } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
        if (usersError) console.error("Users Error:", usersError);

        // دریافت تعداد پروژه‌ها
        const { count: projectsCount, error: projectsError } = await supabase.from('projects').select('*', { count: 'exact', head: true });
        if (projectsError) console.error("Projects Error:", projectsError);

        // دریافت حجم مالی
        const { data: volumeData, error: volumeError } = await supabase.from('projects').select('budget');
        
        let totalVolume = 0;
        if (volumeData) {
          totalVolume = volumeData.reduce((acc, curr) => acc + (Number(curr.budget) || 0), 0);
        }

        setStats({
          users: usersCount || 0,
          projects: projectsCount || 0,
          volume: totalVolume
        });
      } catch (err) {
        console.error("Failed to fetch stats:", err);
      }
    }
    fetchStats();
  }, []);

  return (
    <div className="py-12 bg-white border-y border-slate-100 relative z-20">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100">
          
          {/* Projects Stats */}
          <div className="flex flex-col items-center py-6 md:py-0">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-4">
              <Briefcase className="w-6 h-6" />
            </div>
            <motion.h3 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} // جلوگیری از غیب شدن مجدد
              transition={{ duration: 0.5 }}
              className="text-4xl font-black text-slate-900 mb-1"
            >
              +{stats.projects}
            </motion.h3>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Projects Created</p>
          </div>

          {/* Volume Stats */}
          <div className="flex flex-col items-center py-6 md:py-0">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-4">
              <Coins className="w-6 h-6" />
            </div>
            <motion.h3 
               initial={{ opacity: 0, y: 20 }}
               whileInView={{ opacity: 1, y: 0 }}
               viewport={{ once: true }} // جلوگیری از غیب شدن مجدد
               transition={{ duration: 0.5, delay: 0.1 }}
               className="text-4xl font-black text-slate-900 mb-1"
            >
              {stats.volume.toLocaleString()}$
            </motion.h3>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Total Volume (USDT)</p>
          </div>

          {/* Users Stats */}
          <div className="flex flex-col items-center py-6 md:py-0">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-4">
              <Users className="w-6 h-6" />
            </div>
            <motion.h3 
               initial={{ opacity: 0, y: 20 }}
               whileInView={{ opacity: 1, y: 0 }}
               viewport={{ once: true }} // جلوگیری از غیب شدن مجدد
               transition={{ duration: 0.5, delay: 0.2 }}
               className="text-4xl font-black text-slate-900 mb-1"
            >
              +{stats.users}
            </motion.h3>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Active Users</p>
          </div>

        </div>
      </div>
    </div>
  );
}