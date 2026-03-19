'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';
import { Navbar } from '@/components/navbar';
import { RewardsLandingPage } from '@/components/rewards/landing-page';
import { RewardsDashboard } from '@/components/rewards/rewards-dashboard';
import { useAuth } from '@/components/auth/auth-provider';

// Dynamic import with SSR disabled to avoid wallet context issues during hydration
const EnrollmentModal = dynamic(
  () => import('@/components/rewards/enrollment-modal').then((mod) => mod.EnrollmentModal),
  { ssr: false }
);

export default function RewardsPage() {
  const { isEnrolled, isLoading } = useAuth();
  const [enrollmentModalOpen, setEnrollmentModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 pt-24 pb-12">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !isEnrolled ? (
          <>
            <RewardsLandingPage onEnroll={() => setEnrollmentModalOpen(true)} />
            <EnrollmentModal
              open={enrollmentModalOpen}
              onOpenChange={setEnrollmentModalOpen}
            />
          </>
        ) : (
          <RewardsDashboard />
        )}
      </main>
    </div>
  );
}
