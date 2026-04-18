import React, { useState } from 'react';
import Sidebar from '../components/shared/Sidebar';
import CreatorOverview from '../components/creator/CreatorOverview';
import CreatorCampaigns from '../components/creator/CreatorCampaigns';
import CreatorAnalytics from '../components/creator/CreatorAnalytics';
import CreatorPayments from '../components/creator/CreatorPayments';

const NAV = [
  {
    label: null,
    items: [
      { view: 'overview', icon: '◈', label: 'My Overview' },
      { view: 'campaigns', icon: '◎', label: 'My Campaigns' },
      { view: 'payments', icon: '◇', label: 'My Payments' },
      { view: 'analytics', icon: '◉', label: 'My Analytics' },
    ]
  }
];

export default function CreatorDashboard() {
  const [activeView, setActiveView] = useState('overview');
  const [pendingCampaignId, setPendingCampaignId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  function navigateToCampaign(campaignId) {
    setPendingCampaignId(campaignId);
    setActiveView('campaigns');
  }

  function triggerRefresh() {
    setRefreshKey(k => k + 1);
  }

  const show = (view) => ({ display: activeView === view ? 'block' : 'none' });

  return (
    <div className="app-layout">
      <Sidebar navItems={NAV} activeView={activeView} setActiveView={setActiveView} />
      <div className="main-content">
        <div style={show('overview')}>
          <CreatorOverview setActiveView={setActiveView} navigateToCampaign={navigateToCampaign} refreshKey={refreshKey} />
        </div>
        <div style={show('campaigns')}>
          <CreatorCampaigns
            pendingCampaignId={pendingCampaignId}
            onCampaignStatusChanged={triggerRefresh}
          />
        </div>
        <div style={show('payments')}>
          <CreatorPayments />
        </div>
        <div style={show('analytics')}>
          <CreatorAnalytics />
        </div>
      </div>
    </div>
  );
}
