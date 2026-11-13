import { Alert } from 'react-native';
import * as api from '../services/api';
import { OptionSheet } from './OptionSheet';

export type ReportTarget = { type: 'user' | 'post' | 'comment' | 'message' | 'story'; id: string | number } | null;

const REASONS: Array<[string, string]> = [
  ['spam', 'Spam'], ['harassment', 'Harassment or bullying'], ['hate', 'Hate speech'], ['violence', 'Violence or threats'],
  ['nudity', 'Nudity or sexual content'], ['scam', 'Scam or fraud'], ['impersonation', 'Impersonation'], ['other', 'Something else'],
];

/** "Report" bottom sheet: pick a reason and it is sent to the moderators. */
export const ReportSheet = ({ target, onClose }: { target: ReportTarget; onClose: () => void }) => (
  <OptionSheet
    visible={!!target}
    title="Why are you reporting this?"
    options={REASONS.map(([key, label]) => ({
      label,
      onPress: async () => {
        if (!target) return;
        try {
          await api.safety.report(target.type, target.id, key);
          Alert.alert('Report sent', 'Thank you. Our team will review it.');
        } catch {
          Alert.alert('Error', 'Could not send the report');
        }
      },
    }))}
    onClose={onClose}
  />
);
