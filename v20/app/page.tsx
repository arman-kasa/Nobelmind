'use client';
import React from 'react';
import { useRouter } from 'next/navigation';
// بازگشت ۱ مرحله به عقب
import { LandingNavbar, Hero, HowItWorks, FeaturesGrid, GuaranteeSection, Footer } from '../components/landing/sections';
import { AuroraBackground } from '../components/ui/shared';
import LiveStats from '../components/landing/LiveStats';
export default function LandingPage() {
  const router = useRouter();

  // No useEffect checking for user here. Landing page is public.

  const handleSignIn = () => {
    router.push('/auth');
  };

  const handleLaunchApp = () => {
    // Only redirect to dashboard if user explicitly clicks Launch App
    router.push('/dashboard');
  };

  const handleRoleSelect = (role: 'client' | 'freelancer') => {
    router.push(`/auth?role=${role}`);
  };

  return (
    <main className="min-h-screen bg-white selection:bg-blue-100 selection:text-blue-900 font-sans relative">
      <AuroraBackground />
      <LandingNavbar onSignIn={handleSignIn} onLaunchApp={handleLaunchApp} />
      <Hero onRoleSelect={handleRoleSelect} />
      <LiveStats />
      <HowItWorks />
      <FeaturesGrid />
      <GuaranteeSection />
      <Footer />
    </main>
  );
}