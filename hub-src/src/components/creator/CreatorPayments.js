import React from 'react';
import PaymentsPage from '../shared/PaymentsPage';
import { useAuth } from '../../hooks/useAuth';

export default function CreatorPayments() {
  const { profile } = useAuth();
  return <PaymentsPage isAdmin={false} creatorProfileId={profile?.id} />;
}
