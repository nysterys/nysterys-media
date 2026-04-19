import React from 'react';
import AnalyticsPage from '../shared/AnalyticsPage';
import { useAuth } from '../../hooks/useAuth';

export default function CreatorAnalytics() {
  const { profile } = useAuth();
  return <AnalyticsPage isAdmin={false} creatorProfileId={profile?.id} />;
}
