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

export default function PrivacyScreen() {
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
              <ThemedText type="subtitle" style={styles.title}>Privacy Policy</ThemedText>
              <ThemedText style={styles.lastUpdated} themeColor="textSecondary">Last updated: May 29, 2026</ThemedText>
            </View>

            <View style={[styles.divider, { backgroundColor: theme.backgroundSelected }]} />

            <View style={styles.contentBlock}>
              <View style={styles.section}>
                <ThemedText style={styles.sectionTitle} type="smallBold">1. Introduction</ThemedText>
                <ThemedText style={styles.paragraph} themeColor="textSecondary">
                  Welcome to Discuss. We are committed to protecting your privacy and providing a secure AI group chat simulation experience. This Privacy Policy explains how we collect, use, and safeguard your personal information when you use our service.
                </ThemedText>
              </View>

              <View style={styles.section}>
                <ThemedText style={styles.sectionTitle} type="smallBold">2. Information We Collect</ThemedText>
                <ThemedText style={styles.bulletItem} themeColor="textSecondary">
                  • <ThemedText type="smallBold">Account Information:</ThemedText> When you log in with Google, we access basic public profile information (such as your name, email address, and profile photo) provided by Google.
                </ThemedText>
                <ThemedText style={styles.bulletItem} themeColor="textSecondary">
                  • <ThemedText type="smallBold">Usage Data:</ThemedText> We store the topics, onboarding names, and group chat simulation histories you create so you can retrieve and resume them.
                </ThemedText>
              </View>

              <View style={styles.section}>
                <ThemedText style={styles.sectionTitle} type="smallBold">3. How We Use Your Information</ThemedText>
                <ThemedText style={styles.paragraph} themeColor="textSecondary">
                  Your information is used solely to provide, operate, and maintain the chat simulator:
                </ThemedText>
                <ThemedText style={styles.bulletItem} themeColor="textSecondary">
                  • To authenticate your identity and secure your account.
                </ThemedText>
                <ThemedText style={styles.bulletItem} themeColor="textSecondary">
                  • To synchronize and persist your chat history across your devices.
                </ThemedText>
                <ThemedText style={styles.bulletItem} themeColor="textSecondary">
                  • To personalize your display name inside simulated AI chat groups.
                </ThemedText>
              </View>

              <View style={styles.section}>
                <ThemedText style={styles.sectionTitle} type="smallBold">4. Third-Party Service Providers</ThemedText>
                <ThemedText style={styles.paragraph} themeColor="textSecondary">
                  We use secure, enterprise-grade cloud services to facilitate our service:
                </ThemedText>
                <ThemedText style={styles.bulletItem} themeColor="textSecondary">
                  • <ThemedText type="smallBold">Firebase (Google):</ThemedText> Used for secure user authentication (Firebase Auth) and database hosting (Firebase Realtime Database) to save your chat sessions.
                </ThemedText>
                <ThemedText style={styles.bulletItem} themeColor="textSecondary">
                  • <ThemedText type="smallBold">Google Gemini API:</ThemedText> Used to generate the conversational simulated responses of AI characters.
                </ThemedText>
              </View>

              <View style={styles.section}>
                <ThemedText style={styles.sectionTitle} type="smallBold">5. Data Retention & Deletion</ThemedText>
                <ThemedText style={styles.paragraph} themeColor="textSecondary">
                  Your data is stored for as long as your account exists. You can request account deletion or log out of your session at any time. Since data is tied to your Google authentication, signing out removes your local active credentials.
                </ThemedText>
              </View>

              <View style={styles.section}>
                <ThemedText style={styles.sectionTitle} type="smallBold">6. Cookies & Local Storage</ThemedText>
                <ThemedText style={styles.paragraph} themeColor="textSecondary">
                  We use mobile AsyncStorage and secure authentication session tokens solely to preserve your login session and verify your account status. We do not use cookies or local storage for tracking, marketing, or advertising.
                </ThemedText>
              </View>

              <View style={styles.section}>
                <ThemedText style={styles.sectionTitle} type="smallBold">7. Changes to This Policy</ThemedText>
                <ThemedText style={styles.paragraph} themeColor="textSecondary">
                  {'We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date.'}
                </ThemedText>
              </View>

              <View style={styles.section}>
                <ThemedText style={styles.sectionTitle} type="smallBold">8. Contact Us</ThemedText>
                <ThemedText style={styles.paragraph} themeColor="textSecondary">
                  If you have any questions or suggestions about our Privacy Policy, do not hesitate to contact us at{' '}
                  <ThemedText style={styles.linkText}>support@tirup.in</ThemedText>.
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
  linkText: {
    color: '#3c87f7',
    textDecorationLine: 'underline',
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
