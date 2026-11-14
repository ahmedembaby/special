import React, { useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAppColors } from '../theme/useAppColors';
import * as api from '../services/api';

type Task = 'summarize' | 'suggest_replies' | 'translate' | 'answer' | 'moderate' | 'search_terms';
interface Props { visible: boolean; onClose: () => void; context: string; unreadContext?: string; isGroup: boolean; onSearchTerms?: (terms: string[]) => void }

export const AIAssistantSheet = ({ visible, onClose, context, unreadContext = '', isGroup, onSearchTerms }: Props) => {
  const { c } = useAppColors();
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (task: Task, language = 'Arabic', sourceContext = context) => {
    if (busy) return;
    if (!sourceContext.trim() && task !== 'answer') {
      Alert.alert('No conversation text', 'Load some text messages before using this assistant.');
      return;
    }
    if (task === 'answer' && !prompt.trim()) {
      Alert.alert('Ask a question', 'Write your question first.');
      return;
    }
    setBusy(true);
    setResult('');
    try {
      const response = await api.ai.assistant({ task, context: sourceContext, prompt: prompt.trim(), language });
      if (task === 'search_terms') {
        let terms: string[] = [];
        try {
          const parsed = JSON.parse(response.data.result);
          if (Array.isArray(parsed)) terms = parsed.filter((value) => typeof value === 'string').map((value) => value.trim()).filter(Boolean).slice(0, 8);
        } catch {
          terms = response.data.result.split(/[;,\\n]/).map((value) => value.replace(/^[0-9.\\s-]+/, '').trim()).filter(Boolean).slice(0, 8);
        }
        if (terms.length) {
          onSearchTerms?.(terms);
          setResult('Searching loaded and server-indexed messages for: ' + terms.join(' · '));
        } else setResult(response.data.result);
      } else setResult(response.data.result);
    } catch (error: any) {
      Alert.alert('AI unavailable', error?.response?.data?.message || 'Check the server AI configuration and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.shade}>
        <View style={[styles.sheet, { backgroundColor: c.card, borderColor: c.border }]}>
          <View style={styles.header}>
            <View>
              <Text style={{ color: c.text, fontSize: 18, fontWeight: '800' }}>Special AI</Text>
              <Text style={{ color: c.textSecondary, fontSize: 12, marginTop: 3 }}>Assistant for this conversation</Text>
            </View>
            <TouchableOpacity onPress={onClose}><Text style={{ color: c.textSecondary, fontSize: 24 }}>×</Text></TouchableOpacity>
          </View>
          <Text style={[styles.notice, { color: c.textSecondary, backgroundColor: c.surface }]}>
            When you choose an action, the loaded conversation text is sent to the AI provider configured by the server. Private message content is not sent until you explicitly tap an action.
          </Text>
          <TextInput value={prompt} onChangeText={setPrompt} placeholder="Ask about this conversation…" placeholderTextColor={c.textMuted} multiline style={[styles.input, { color: c.text, backgroundColor: c.inputBg, borderColor: c.border }]} />
          <View style={styles.actions}>
            <TouchableOpacity onPress={() => run('summarize')} disabled={busy} style={[styles.action, { backgroundColor: c.primary }]}><Text style={styles.actionText}>Summarize</Text></TouchableOpacity>
            {unreadContext.trim() ? <TouchableOpacity onPress={() => run('summarize', 'Arabic', unreadContext)} disabled={busy} style={[styles.action, { backgroundColor: c.primary }]}><Text style={styles.actionText}>Summarize unread</Text></TouchableOpacity> : null}
            <TouchableOpacity onPress={() => run('suggest_replies')} disabled={busy} style={[styles.action, { backgroundColor: c.primary }]}><Text style={styles.actionText}>Suggest replies</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => run('translate', 'Arabic')} disabled={busy} style={[styles.action, { backgroundColor: c.surface, borderColor: c.border }]}><Text style={[styles.actionText, { color: c.text }]}>Translate to Arabic</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => run('answer')} disabled={busy} style={[styles.action, { backgroundColor: c.surface, borderColor: c.border }]}><Text style={[styles.actionText, { color: c.text }]}>Ask</Text></TouchableOpacity>
            {isGroup ? <TouchableOpacity onPress={() => run('moderate')} disabled={busy} style={[styles.action, { backgroundColor: c.surface, borderColor: c.border }]}><Text style={[styles.actionText, { color: c.text }]}>Review spam</Text></TouchableOpacity> : null}
            <TouchableOpacity onPress={() => run('search_terms')} disabled={busy || !prompt.trim()} style={[styles.action, { backgroundColor: c.surface, borderColor: c.border, opacity: prompt.trim() ? 1 : 0.45 }]}><Text style={[styles.actionText, { color: c.text }]}>Find in conversation</Text></TouchableOpacity>
          </View>
          {busy ? <ActivityIndicator color={c.primary} style={{ marginVertical: 14 }} /> : null}
          {result ? <ScrollView style={[styles.result, { borderColor: c.border }]}><Text selectable style={{ color: c.text, lineHeight: 22 }}>{result}</Text></ScrollView> : null}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  shade: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, padding: 18, paddingBottom: 30, maxHeight: '88%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  notice: { padding: 11, borderRadius: 12, fontSize: 12, lineHeight: 18, marginBottom: 12 },
  input: { minHeight: 58, maxHeight: 110, borderWidth: 1, borderRadius: 13, padding: 12, textAlignVertical: 'top', marginBottom: 12 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  action: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 10 },
  actionText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  result: { maxHeight: 210, borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 14 },
});
