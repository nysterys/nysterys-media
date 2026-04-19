import { useAuth } from '../../hooks/useAuth';
import CampaignsPage from '../shared/CampaignsPage';

export default function CreatorCampaigns({ pendingCampaignId, onCampaignStatusChanged }) {
  const { profile } = useAuth();
  return (
    <CampaignsPage
      isAdmin={false}
      profileId={profile?.id}
      pendingCampaignId={pendingCampaignId}
      onCampaignStatusChanged={onCampaignStatusChanged}
    />
  );
}
