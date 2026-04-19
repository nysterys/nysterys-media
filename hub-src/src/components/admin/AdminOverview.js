import React from 'react';
import OverviewPage from '../shared/OverviewPage';

export default function AdminOverview({ setActiveView }) {
  return <OverviewPage isAdmin={true} profileId={null} setActiveView={setActiveView} />;
}
