import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import CalendarPage from '../shared/CalendarPage';

export default function CreatorCalendar() {
  const { profile } = useAuth();
  return <CalendarPage isAdmin={false} profileId={profile?.id} />;
}
