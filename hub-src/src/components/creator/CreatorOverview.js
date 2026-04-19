import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import OverviewPage from '../shared/OverviewPage';

export default function CreatorOverview({ setActiveView, navigateToCampaign, refreshKey }) {
  const { profile } = useAuth();
  return (
    <OverviewPage
      isAdmin={false}
      profileId={profile?.id}
      creatorName={profile?.creator_name || profile?.full_name}
      setActiveView={setActiveView}
      navigateToCampaign={navigateToCampaign}
      refreshKey={refreshKey}
    />
  );
}
