import { useAuth } from '../../hooks/useAuth';
import RewardsPage from '../shared/RewardsPage';

export default function CreatorRewards() {
  const { profile } = useAuth();
  return <RewardsPage isAdmin={false} profileId={profile?.id} />;
}
