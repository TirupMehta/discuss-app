import React from 'react';
import { ScrollView, StyleSheet, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ThemeToggle } from '@/components/theme-toggle';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';

export default function TermsScreen() {
  const router = useRouter();
  const theme = useTheme();

  const handleBack = () => {
    router.back();
  };

  return (
    <ThemedView style={styles.container}>
      {/* Soft background glow blobs */}
      <View style={[styles.glowBlob1, { backgroundColor: theme.text === '#ffffff' ? 'rgba(14, 165, 233, 0.05)' : 'rgba(14, 165, 233, 0.08)' }]} />
      <View style={[styles.glowBlob2, { backgroundColor: theme.text === '#ffffff' ? 'rgba(168, 85, 247, 0.05)' : 'rgba(168, 85, 247, 0.08)' }]} />

      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        {/* Header navigation bar */}
        <View style={styles.header}>
          <Pressable onPress={handleBack} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
            <ArrowLeft size={16} color={theme.text} opacity={0.6} />
            <ThemedText style={styles.backButtonText} themeColor="text">Back</ThemedText>
          </Pressable>
          <ThemeToggle />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
            <View style={styles.cardHeader}>
              <ThemedText type="subtitle" style={styles.title}>Terms of Service</ThemedText>
              <ThemedText style={styles.lastUpdated} themeColor="textSecondary">Last updated: May 29, 2026</ThemedText>
            </View>

            <View style={[styles.divider, { backgroundColor: theme.backgroundSelected }]} />

            <View style={styles.contentBlock}>
              <View style={styles.section}>
                <ThemedText style={styles.sectionTitle} type="smallBold">1. Acceptance of Terms</ThemedText>
                <ThemedText style={styles.paragraph} themeColor="textSecondary">
                  {'By accessing or using Discuss ("the Service"), you agree to be bound by these Terms of Service. If you do not agree with any part of these terms, you may not use the Service.'}
                </ThemedText>
              </View>

              <View style={styles.section}>
                <ThemedText style={styles.sectionTitle} type="smallBold">2. Description of Service</ThemedText>
                <ThemedText style={styles.paragraph} themeColor="textSecondary">
                  Discuss is a web and mobile-based AI group chat simulation platform. It allows users to log in, customize a display name, choose topics of discussion, and observe or participate in generated chat simulations powered by Google Gemini AI.
                </ThemedText>
              </View>

              <View style={styles.section}>
                <ThemedText style={styles.sectionTitle} type="smallBold">3. User Conduct & Responsibilities</ThemedText>
                <ThemedText style={styles.paragraph} themeColor="textSecondary">
                  As a user, you agree to use the Service only for lawful purposes. You are solely responsible for the inputs, topics, and names you enter. You agree not to use the Service to:
                </ThemedText>
                <ThemedText style={styles.bulletItem} themeColor="textSecondary">
                  • Submit abusive, defamatory, harassing, or illegal content.
                </ThemedText>
                <ThemedText style={styles.bulletItem} themeColor="textSecondary">
                  • Attempt to bypass API constraints, exploit database security, or spam the Service.
                </ThemedText>
                <ThemedText style={styles.bulletItem} themeColor="textSecondary">
                  • Impersonate individuals or organizations maliciously.
                </ThemedText>
              </View>

              <View style={styles.section}>
                <ThemedText style={styles.sectionTitle} type="smallBold">4. Intellectual Property & AI Content</ThemedText>
                <ThemedText style={styles.paragraph} themeColor="textSecondary">
                  {"The chat simulations are generated programmatically by artificial intelligence. Discuss does not claim ownership of the AI-generated outputs. You are free to copy, share, or use the generated text for personal, educational, or creative purposes, subject to Google Gemini AI's terms of use."}
                </ThemedText>
              </View>

              <View style={styles.section}>
                <ThemedText style={styles.sectionTitle} type="smallBold">5. Disclaimer of Warranties</ThemedText>
                <ThemedText style={styles.paragraph} themeColor="textSecondary">
                  {'THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT ANY WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED.'}
                </ThemedText>
                <ThemedText style={styles.paragraph} themeColor="textSecondary">
                  {"Discuss makes no warranties regarding the accuracy, truthfulness, or appropriateness of the AI-generated chat messages. AI outputs are programmatically simulated and do not reflect factual statements, real opinions, or views of Discuss."}
                </ThemedText>
              </View>

              <View style={styles.section}>
                <ThemedText style={styles.sectionTitle} type="smallBold">6. Limitation of Liability</ThemedText>
                <ThemedText style={styles.paragraph} themeColor="textSecondary">
                  To the maximum extent permitted by law, Discuss and its creator (Tirup Mehta) shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of, or inability to use, the Service.
                </ThemedText>
              </View>

              <View style={styles.section}>
                <ThemedText style={styles.sectionTitle} type="smallBold">7. Modification of Service & Terms</ThemedText>
                <ThemedText style={styles.paragraph} themeColor="textSecondary">
                  We reserve the right to modify or discontinue the Service at any time without notice. We also reserve the right to amend these Terms of Service. Your continued use of the Service following any changes constitutes acceptance of those changes.
                </ThemedText>
              </View>

              <View style={styles.section}>
                <ThemedText style={styles.sectionTitle} type="smallBold">8. Governing Law</ThemedText>
                <ThemedText style={styles.paragraph} themeColor="textSecondary">
                  These terms shall be governed by and construed in accordance with the laws applicable in your jurisdiction, without regard to its conflict of law provisions.
                </ThemedText>
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    height: 56,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  backButtonText: {
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.8,
  },
  pressed: {
    opacity: 0.7,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: Spacing.four,
  },
  scrollContent: {
    paddingBottom: Spacing.six,
    paddingTop: Spacing.two,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: Spacing.four,
  },
  cardHeader: {
    gap: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  lastUpdated: {
    fontSize: 12,
    opacity: 0.8,
  },
  divider: {
    height: 1,
    marginVertical: Spacing.three,
  },
  contentBlock: {
    gap: Spacing.three,
  },
  section: {
    gap: 6,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.85,
  },
  bulletItem: {
    fontSize: 14,
    lineHeight: 20,
    paddingLeft: Spacing.one,
    opacity: 0.85,
  },
  glowBlob1: {
    position: 'absolute',
    top: 50,
    left: -50,
    width: 250,
    height: 250,
    borderRadius: 125,
    opacity: 0.6,
  },
  glowBlob2: {
    position: 'absolute',
    bottom: 100,
    right: -50,
    width: 250,
    height: 250,
    borderRadius: 125,
    opacity: 0.6,
  },
});
