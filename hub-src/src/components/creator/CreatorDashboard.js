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
  const [selectedCampaignId, setSelectedCampaignId] = useState(null);

  function navigateToCampaign(campaignId) {
    setSelectedCampaignId(campaignId);
    setActiveView('campaigns');
  }

  function renderView() {
    switch (activeView) {
      case 'overview': return <CreatorOverview setActiveView={setActiveView} navigateToCampaign={navigateToCampaign} />;
      case 'campaigns': return <CreatorCampaigns initialCampaignId={selectedCampaignId} onCampaignOpened={() => setSelectedCampaignId(null)} />;
      case 'payments': return <CreatorPayments />;
      case 'analytics': return <CreatorAnalytics />;
      default: return <CreatorOverview setActiveView={setActiveView} navigateToCampaign={navigateToCampaign} />;
    }
  }

  return (
    <div className="app-layout">
      <Sidebar navItems={NAV} activeView={activeView} setActiveView={setActiveView} />
      <div className="main-content">{renderView()}</div>
    </div>
  );
}
