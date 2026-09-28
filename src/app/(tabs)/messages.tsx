import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { EmptyState } from '@/components/States';

// SMS and USSD are Phase 2 (FEATURES.md §6–7).
export default function MessagesScreen() {
  return (
    <Screen title="Messages">
      <Card>
        <EmptyState
          icon="chatbubble-ellipses-outline"
          title="Messages are coming soon"
          message="Reading and sending SMS, and checking your balance with USSD codes, will arrive in the next update."
        />
      </Card>
    </Screen>
  );
}
