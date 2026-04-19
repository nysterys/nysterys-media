import React, { useState } from 'react';
import Sidebar from '../components/shared/Sidebar';
import AdminOverview from '../components/admin/AdminOverview';
import CampaignsView from '../components/admin/CampaignsView';
import AgenciesView from '../components/admin/AgenciesView';
import PlatformsView from '../components/admin/PlatformsView';
import DeliverablesTypesView from '../components/admin/DeliverablesTypesView';
import PaymentsView from '../components/admin/PaymentsView';
import UsersView from '../components/admin/UsersView';
import AnalyticsView from '../components/admin/AnalyticsView';
import PlatformAccountsView from '../components/admin/PlatformAccountsView';
import PaymentDestinationsView from '../components/admin/PaymentDestinationsView';
import PaymentMethodsView from '../components/admin/PaymentMethodsView';
import CalendarView from '../components/admin/CalendarView';
import RewardsView from '../components/admin/RewardsView';
import CampaignFlowView from '../components/admin/CampaignFlowView';

const NAV = [
  {
    label: null,
    items: [
      { view: 'overview',      icon: '◈', label: 'Overview' },
      { view: 'campaigns',     icon: '◎', label: 'Campaigns' },
      { view: 'calendar',      icon: '▦', label: 'Calendar' },
      { view: 'payments',      icon: '◇', label: 'Payments' },
      { view: 'rewards',       icon: '★', label: 'Rewards' },
      { view: 'analytics',     icon: '◉', label: 'Analytics' },
      { view: 'campaign-flow', icon: '⟶', label: 'Campaign Flow' },
    ]
  },
  {
    label: 'Setup',
    items: [
      { view: 'agencies',           icon: '⬡', label: 'Agencies & Labels' },
      { view: 'platforms',          icon: '◻', label: 'Platforms' },
      { view: 'deliverable-types',  icon: '◈', label: 'Deliverable Types' },
      { view: 'payout-destinations',icon: '◇', label: 'Payment Destinations' },
      { view: 'payment-methods',    icon: '◈', label: 'Payment Methods' },
      { view: 'platform-accounts',   icon: '◎', label: 'Platform Accounts' },
      { view: 'users',              icon: '○', label: 'Users' },
    ]
  }
];

export default function AdminDashboard() {
  const [activeView, setActiveView] = useState('overview');

  function renderView() {
    switch (activeView) {
      case 'overview':            return <AdminOverview setActiveView={setActiveView} />;
      case 'campaigns':           return <CampaignsView />;
      case 'calendar':            return <CalendarView />;
      case 'payments':            return <PaymentsView />;
      case 'rewards':             return <RewardsView />;
      case 'analytics':           return <AnalyticsView />;
      case 'campaign-flow':       return <CampaignFlowView />;
      case 'agencies':            return <AgenciesView />;
      case 'platforms':           return <PlatformsView />;
      case 'deliverable-types':   return <DeliverablesTypesView />;
      case 'payout-destinations': return <PaymentDestinationsView />;
      case 'payment-methods':     return <PaymentMethodsView />;
      case 'platform-accounts':    return <PlatformAccountsView />;
      case 'users':               return <UsersView />;
      default:                    return <AdminOverview setActiveView={setActiveView} />;
    }
  }

  return (
    <div className="app-layout">
      <Sidebar navItems={NAV} activeView={activeView} setActiveView={setActiveView} />
      <div className="main-content">{renderView()}</div>
    </div>
  );
}
