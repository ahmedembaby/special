import React from 'react';
import { SafeAreaView, View, Text, ScrollView, TouchableOpacity, StatusBar, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppColors } from '../theme/useAppColors';
import { Icon } from '../components/Icon';

const P1 =
  "Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book. It has survived not only five centuries, but also the leap into electronic typesetting, remaining essentially unchanged. It was popularised in the 1960s with the release of Letraset sheets containing Lorem Ipsum passages, and more recently with desktop publishing software like Aldus PageMaker including versions of Lorem Ipsum.";
const P2 =
  "It is a long established fact that a reader will be distracted by the readable content of a page when looking at its layout. The point of using Lorem Ipsum is that it has a more-or-less normal distribution of letters, as opposed to using 'Content here, content here', making it look like readable English. Many desktop publishing packages and web page editors now use Lorem Ipsum as their default model text, and a search for 'lorem ipsum' will uncover many web sites still in their infancy. Various versions have evolved over the years, sometimes by accident, sometimes on purpose (injected humour and the like).";

/** Design: "Term of Service" (Privacy Policy / About App share this layout). */
export default function TermsScreen({ route }: any) {
  const navigation = useNavigation() as any;
  const insets = useSafeAreaInsets();
  const { c, isDark } = useAppColors();
  const title: string = route?.params?.title || 'Term of Service';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background, paddingTop: insets.top + 12 }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <View style={styles.top}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
          style={[styles.back, { backgroundColor: c.background }]}
        >
          <Icon name="arrowLeft" size={22} color={c.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: c.text }]}>{title}</Text>
        <View style={styles.back} />
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }} showsVerticalScrollIndicator={false}>
        <Text style={[styles.p, { color: c.text }]}>{P1}</Text>
        <Text style={[styles.p, { color: c.text }]}>{P2}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 },
  back: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F4F2FB',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 2,
  },
  title: { fontSize: 18, fontWeight: '600' },
  p: { fontSize: 13, lineHeight: 18, marginBottom: 18 },
});
