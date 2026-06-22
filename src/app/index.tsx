import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LogOut, MessageSquare, ArrowRight, Clock, ShieldAlert } from 'lucide-react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Image } from 'expo-image';

import { auth, emailToKey, dbGet, getWithFallback, setWithFallback } from '@/lib/firebase';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ThemeToggle } from '@/components/theme-toggle';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';

WebBrowser.maybeCompleteAuthSession();

interface PreviousChat {
  id: string;
  topic: string;
  createdAt: number;
}

export default function HomeScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [topic, setTopic] = useState('');
  const [name, setName] = useState('');
  const [onboardingName, setOnboardingName] = useState('');
  const [authLoading, setAuthLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [onboardingLoading, setOnboardingLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [previousChats, setPreviousChats] = useState<PreviousChat[]>([]);
  
  // Developer Bypass state
  const [bypassEmail, setBypassEmail] = useState('');
  const [showBypassInput, setShowBypassInput] = useState(false);

  const router = useRouter();
  const theme = useTheme();



  // Load chats from Firebase
  const loadPreviousChats = async (uid: string, emailKey: string) => {
    try {
      // Read both paths in parallel, swallowing errors to accommodate database rules
      const [uidSnap, emailSnap] = await Promise.all([
        dbGet(`chats/${uid}`).catch(() => null),
        emailKey !== uid ? dbGet(`chats/${emailKey}`).catch(() => null) : null,
      ]);

      const rawUid = uidSnap && uidSnap.exists() ? uidSnap.val() : {};
      const rawEmail = emailSnap && emailSnap.exists() ? emailSnap.val() : {};

      // Merge results, giving preference to UID-based records if identical keys exist
      const raw = { ...rawEmail, ...rawUid };

      // Deduplicate by topic - keep only the most recent chat per topic
      const byTopic: Record<string, PreviousChat> = {};
      Object.entries(raw).forEach(([id, data]: any) => {
        const key = (data.topic || '').toLowerCase();
        if (!key) return;
        if (!byTopic[key] || (data.createdAt || 0) > byTopic[key].createdAt) {
          byTopic[key] = { id, topic: data.topic, createdAt: data.createdAt || 0 };
        }
      });

      const list = Object.values(byTopic).sort((a, b) => b.createdAt - a.createdAt);
      setPreviousChats(list);
    } catch (e) {
      console.error('Error loading previous chats:', e);
    }
  };

  useEffect(() => {
    // Check if bypass email was stored previously
    const checkBypassState = async () => {
      try {
        const savedBypassEmail = await AsyncStorage.getItem('bypass_email');
        if (savedBypassEmail) {
          setBypassEmail(savedBypassEmail);
        }
      } catch (err) {
        console.warn('AsyncStorage check failed:', err);
      }
    };
    checkBypassState();

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      let activeUser = currentUser;
      let uid = currentUser?.uid;
      let email = currentUser?.email;
      
      try {
        const savedEmail = await AsyncStorage.getItem('bypass_email');
        if (!uid && savedEmail) {
          uid = emailToKey(savedEmail);
          email = savedEmail;
          activeUser = { uid, email } as any;
        }
      } catch {}

      if (activeUser && uid) {
        setUser(activeUser);
        setName('');
        setPreviousChats([]);
        setNeedsOnboarding(false);
        
        try {
          const emailKey = email ? emailToKey(email) : uid;
          try {
            const snapshot = await getWithFallback(`users/${uid}`, `users/${emailKey}`);
            if (snapshot && snapshot.exists && snapshot.exists() && snapshot.val().name) {
              setName(snapshot.val().name);
              setNeedsOnboarding(false);
              loadPreviousChats(uid, emailKey);
            } else {
              setNeedsOnboarding(true);
            }
          } catch (dbErr: any) {
            console.warn('Database access denied in auth listener. Using mock data mode.', dbErr.message);
            setNeedsOnboarding(true);
          }
        } catch (error) {
          console.error('Error checking user profile:', error);
          const fallbackName = currentUser?.displayName || 'User';
          setName(fallbackName);
          setNeedsOnboarding(false);
        }
      } else {
        setUser(null);
        setName('');
        setPreviousChats([]);
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Reload previous chats whenever user is authenticated and onboarding is finished
  useEffect(() => {
    if (user && !needsOnboarding) {
      const loadChats = async () => {
        const savedEmail = await AsyncStorage.getItem('bypass_email');
        const email = user.email || savedEmail;
        const emailKey = email ? emailToKey(email) : user.uid;
        loadPreviousChats(user.uid, emailKey);
      };
      loadChats();
    }
  }, [user, needsOnboarding]);

  const handleGoogleSignIn = async () => {
    try {
      setAuthLoading(true);
      const callbackUrl = Linking.createURL('login');
      console.log('Deep Link Callback URL:', callbackUrl);
      const authUrl = `https://discuss.tirup.in/mobile-auth?redirect=${encodeURIComponent(callbackUrl)}`;
      
      const result = await WebBrowser.openAuthSessionAsync(authUrl, callbackUrl);
      
      if (result.type === 'success' && result.url) {
        const parsedUrl = Linking.parse(result.url);
        const idToken = parsedUrl.queryParams?.idToken as string;
        if (idToken) {
          const { signInWithCredential, GoogleAuthProvider } = require('firebase/auth');
          const credential = GoogleAuthProvider.credential(idToken);
          await signInWithCredential(auth, credential);
        }
      }
    } catch (err: any) {
      console.error('Failed to start browser auth session:', err);
      Alert.alert('Authentication Error', 'Failed to open browser: ' + err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleAnonymousSignIn = async () => {
    setAuthLoading(true);
    try {
      const { signInAnonymously } = require('firebase/auth');
      await signInAnonymously(auth);
    } catch (e: any) {
      console.error('Guest login failed:', e);
      Alert.alert(
        'Guest Sign-In Failed',
        'To use Guest access, please enable "Anonymous" provider in your Firebase Console under Authentication > Sign-in method.\n\nError: ' + e.message,
        [{ text: 'OK' }]
      );
      setAuthLoading(false);
    }
  };

  const handleBypassSignIn = async () => {
    if (!bypassEmail.trim()) {
      Alert.alert('Error', 'Please enter a valid email address.');
      return;
    }
    
    setAuthLoading(true);
    try {
      const cleanEmail = bypassEmail.trim().toLowerCase();
      await AsyncStorage.setItem('bypass_email', cleanEmail);
      
      const bypassUid = emailToKey(cleanEmail);
      
      try {
        const { signInWithEmailAndPassword, createUserWithEmailAndPassword } = require('firebase/auth');
        try {
          await signInWithEmailAndPassword(auth, cleanEmail, 'BypassPassword123!');
        } catch (authErr: any) {
          if (authErr.code === 'auth/user-not-found' || authErr.code === 'auth/invalid-credential') {
            await createUserWithEmailAndPassword(auth, cleanEmail, 'BypassPassword123!');
          } else {
            throw authErr;
          }
        }
      } catch (e: any) {
        console.warn('Firebase Email Auth failed, falling back to local state:', e.message);
        // Fallback to local state if Email/Password is restricted
        setUser({ uid: bypassUid, email: cleanEmail } as any);
      }
      
      // Fetch user data
      const emailKey = emailToKey(cleanEmail);
      try {
        const snapshot = await getWithFallback(`users/${bypassUid}`, `users/${emailKey}`);
        if (snapshot && snapshot.exists && snapshot.exists() && snapshot.val().name) {
          setName(snapshot.val().name);
          setNeedsOnboarding(false);
          loadPreviousChats(bypassUid, emailKey);
        } else {
          setNeedsOnboarding(true);
        }
      } catch (dbErr: any) {
        // If Permission Denied happens, we simulate success for local dev
        console.warn('Database access denied. Using mock data mode.', dbErr.message);
        setNeedsOnboarding(true);
      }
      
      setAuthLoading(false);
    } catch (e) {
      console.error('Bypass sign-in failed:', e);
      Alert.alert('Error', 'Failed to connect. Please try again.');
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await AsyncStorage.removeItem('bypass_email');
      await signOut(auth);
      setBypassEmail('');
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  };

  const handleOnboardingSubmit = async () => {
    if (!onboardingName.trim() || !user) return;

    setOnboardingLoading(true);
    try {
      const cleanName = onboardingName.trim();
      const savedEmail = await AsyncStorage.getItem('bypass_email');
      const email = user.email || savedEmail;
      const emailKey = email ? emailToKey(email) : user.uid;
      
      await setWithFallback(`users/${user.uid}`, `users/${emailKey}`, {
        name: cleanName,
        createdAt: Date.now(),
      });
      setName(cleanName);
      setNeedsOnboarding(false);
    } catch (error) {
      console.error('Failed to save name:', error);
      Alert.alert('Error', 'Failed to save display name.');
    } finally {
      setOnboardingLoading(false);
    }
  };

  const handleSubmit = () => {
    if (!topic.trim()) return;
    setIsLoading(true);
    router.push({
      pathname: '/chat' as any,
      params: { topic: topic.trim() },
    });
    // Reset loader after screen push so it's clean if we navigate back
    setTimeout(() => setIsLoading(false), 800);
  };

  const handleOpenChat = (chat: PreviousChat) => {
    router.push({
      pathname: '/chat' as any,
      params: { topic: chat.topic },
    });
  };

  if (authLoading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.text} />
        <ThemedText style={styles.loadingText} themeColor="textSecondary">
          Loading session
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {/* Background glow blobs */}
      <View style={[styles.glowBlob1, { backgroundColor: theme.text === '#ffffff' ? 'rgba(14, 165, 233, 0.05)' : 'rgba(14, 165, 233, 0.08)' }]} />
      <View style={[styles.glowBlob2, { backgroundColor: theme.text === '#ffffff' ? 'rgba(168, 85, 247, 0.05)' : 'rgba(168, 85, 247, 0.08)' }]} />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
        {/* Fixed Header controls */}
        <View style={styles.header}>
          {user && (
            <Pressable onPress={handleSignOut} style={({ pressed }) => [styles.signOutButton, pressed && styles.pressed]}>
              <LogOut size={14} color={theme.text} opacity={0.6} />
              <ThemedText style={styles.signOutText} themeColor="textSecondary">
                Sign Out
              </ThemedText>
            </Pressable>
          )}
          <ThemeToggle style={styles.themeToggle} />
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.cardContainer}>
              {!user ? (
                /* Landing Auth view */
                <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
                  <View style={styles.heroSection}>
                    <Image
                      source={require('@/assets/icon.png')}
                      style={styles.logoImage}
                      contentFit="contain"
                    />
                    <ThemedText type="title" style={styles.heroTitle}>Discuss</ThemedText>
                    <ThemedText style={styles.heroSubtitle} themeColor="textSecondary">
                      Sign in with Google to start or join AI group chats.
                    </ThemedText>
                  </View>

                  <Pressable
                    onPress={handleGoogleSignIn}
                    style={({ pressed }) => [
                      styles.googleButton,
                      { borderColor: theme.backgroundSelected },
                      pressed && styles.pressed,
                    ]}
                  >
                    <MessageSquare size={16} color={theme.text} />
                    <ThemedText style={styles.googleButtonText} themeColor="text">Sign In with Google</ThemedText>
                  </Pressable>

                  <Pressable
                    onPress={handleAnonymousSignIn}
                    style={({ pressed }) => [
                      styles.guestButton,
                      { backgroundColor: theme.text },
                      pressed && styles.pressed,
                    ]}
                  >
                    <ThemedText style={[styles.guestButtonText, { color: theme.background }]}>Continue as Guest</ThemedText>
                  </Pressable>

                  {/* Expo Go Developer Bypass UI */}
                  <View style={styles.bypassWrapper}>
                    {!showBypassInput ? (
                      <Pressable onPress={() => setShowBypassInput(true)}>
                        <ThemedText style={styles.bypassLink} type="linkPrimary">
                          Expo Go Developer Bypass (Login by Email)
                        </ThemedText>
                      </Pressable>
                    ) : (
                      <View style={styles.bypassInputBlock}>
                        <TextInput
                          value={bypassEmail}
                          onChangeText={setBypassEmail}
                          placeholder="Enter your email to sync web data"
                          placeholderTextColor={theme.text === '#ffffff' ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'}
                          keyboardType="email-address"
                          autoCapitalize="none"
                          style={[
                            styles.input,
                            {
                              color: theme.text,
                              backgroundColor: theme.text === '#ffffff' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                              borderColor: theme.backgroundSelected,
                            },
                          ]}
                        />
                        <View style={styles.bypassButtons}>
                          <Pressable
                            onPress={handleBypassSignIn}
                            style={({ pressed }) => [styles.bypassConfirmButton, pressed && styles.pressed]}
                          >
                            <ThemedText style={styles.bypassConfirmText}>Connect</ThemedText>
                          </Pressable>
                          <Pressable
                            onPress={() => setShowBypassInput(false)}
                            style={styles.bypassCancelButton}
                          >
                            <ThemedText themeColor="textSecondary" style={styles.bypassCancelText}>Cancel</ThemedText>
                          </Pressable>
                        </View>
                      </View>
                    )}
                  </View>
                </View>
              ) : needsOnboarding ? (
                /* Onboarding screen (name entry) */
                <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
                  <View style={styles.onboardingHeader}>
                    <ThemedText type="subtitle" style={styles.onboardingTitle}>Onboarding</ThemedText>
                    <ThemedText style={styles.onboardingSubtitle} themeColor="textSecondary">
                      What should we call you in the group chat?
                    </ThemedText>
                  </View>

                  <TextInput
                    value={onboardingName}
                    onChangeText={setOnboardingName}
                    placeholder="Enter your name"
                    placeholderTextColor={theme.text === '#ffffff' ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'}
                    style={[
                      styles.input,
                      {
                        color: theme.text,
                        backgroundColor: theme.text === '#ffffff' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                        borderColor: theme.backgroundSelected,
                      },
                    ]}
                    maxLength={20}
                    editable={!onboardingLoading}
                    autoFocus
                  />

                  <Pressable
                    onPress={handleOnboardingSubmit}
                    disabled={!onboardingName.trim() || onboardingLoading}
                    style={({ pressed }) => [
                      styles.button,
                      { backgroundColor: theme.text },
                      (!onboardingName.trim() || onboardingLoading) && styles.disabledButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <ThemedText style={[styles.buttonText, { color: theme.background }]}>
                      {onboardingLoading ? 'Saving...' : 'Continue'}
                    </ThemedText>
                    <ArrowRight size={14} color={theme.background} />
                  </Pressable>
                </View>
              ) : (
                /* Authenticated Dashboard view */
                <View style={styles.dashboard}>
                  <View style={styles.dashboardHeader}>
                    <ThemedText type="subtitle" style={styles.dashboardTitle}>Discuss</ThemedText>
                    <ThemedText style={styles.dashboardSubtitle} themeColor="textSecondary">
                      Welcome, <ThemedText type="smallBold">{name}</ThemedText>! Start a new discussion.
                    </ThemedText>
                  </View>

                  {/* Offline Warning Banner */}
                  {auth.currentUser === null && (
                    <View style={[styles.offlineBanner, { backgroundColor: theme.text === '#ffffff' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(220, 38, 38, 0.05)', borderColor: theme.text === '#ffffff' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(220, 38, 38, 0.1)' }]}>
                      <ShieldAlert size={14} color="#ef4444" style={{ marginTop: 2 }} />
                      <View style={{ flex: 1, gap: 2 }}>
                        <ThemedText style={styles.offlineBannerTitle} type="smallBold">
                          Offline / Local Mode Active
                        </ThemedText>
                        <ThemedText style={styles.offlineBannerText} themeColor="textSecondary">
                          You are using unauthenticated bypass login. Chats will only save locally on this device. To sync with web, enable and sign in using real Google or Anonymous Auth.
                        </ThemedText>
                      </View>
                    </View>
                  )}

                  {/* New topic input form */}
                  <View style={styles.topicForm}>
                    <ThemedText style={styles.label} type="smallBold" themeColor="textSecondary">
                      Choose a topic
                    </ThemedText>
                    <TextInput
                      value={topic}
                      onChangeText={setTopic}
                      placeholder="Startup ideas, Artificial Intelligence, Philosophy..."
                      placeholderTextColor={theme.text === '#ffffff' ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'}
                      style={[
                        styles.input,
                        {
                          color: theme.text,
                          backgroundColor: theme.text === '#ffffff' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                          borderColor: theme.backgroundSelected,
                        },
                      ]}
                      editable={!isLoading}
                    />

                    <Pressable
                      onPress={handleSubmit}
                      disabled={!topic.trim() || isLoading}
                      style={({ pressed }) => [
                        styles.button,
                        { backgroundColor: theme.text },
                        (!topic.trim() || isLoading) && styles.disabledButton,
                        pressed && styles.pressed,
                      ]}
                    >
                      <ThemedText style={[styles.buttonText, { color: theme.background }]}>
                        {isLoading
                          ? 'Starting...'
                          : previousChats.find((c) => c.topic.toLowerCase() === topic.trim().toLowerCase())
                          ? 'Resume Chat'
                          : 'Begin Conversation'}
                      </ThemedText>
                    </Pressable>
                  </View>

                  {/* Previous chats list */}
                  {previousChats.length > 0 && (
                    <View style={styles.previousChatsSection}>
                      <ThemedText style={styles.sectionHeader} type="smallBold" themeColor="textSecondary">
                        PREVIOUS CHATS
                      </ThemedText>
                      <View style={styles.chatListContainer}>
                        {previousChats.map((chat) => (
                          <Pressable
                            key={chat.id}
                            onPress={() => handleOpenChat(chat)}
                            style={({ pressed }) => [
                              styles.chatListItem,
                              {
                                borderColor: theme.backgroundSelected,
                                backgroundColor: theme.text === '#ffffff' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
                              },
                              pressed && styles.pressed,
                            ]}
                          >
                            <Clock size={12} color={theme.text} opacity={0.4} />
                            <ThemedText style={styles.chatListText} themeColor="text" numberOfLines={1}>
                              {chat.topic}
                            </ThemedText>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  )}
                </View>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        <View style={styles.footer}>
          <Pressable onPress={() => router.push('/privacy' as any)}>
            <ThemedText style={styles.footerLink} themeColor="textSecondary">Privacy Policy</ThemedText>
          </Pressable>
          <ThemedText style={styles.footerDot} themeColor="textSecondary">·</ThemedText>
          <Pressable onPress={() => router.push('/terms' as any)}>
            <ThemedText style={styles.footerLink} themeColor="textSecondary">Terms of Service</ThemedText>
          </Pressable>
        </View>
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
    justifyContent: 'space-between',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  loadingText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    height: 56,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  signOutText: {
    fontSize: 12,
    fontWeight: '600',
  },
  themeToggle: {
    marginLeft: 'auto',
  },
  pressed: {
    opacity: 0.7,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.five,
  },
  cardContainer: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: Spacing.five,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: Spacing.five,
    gap: Spacing.two,
  },
  logoImage: {
    width: 64,
    height: 64,
    borderRadius: 16,
    marginBottom: Spacing.two,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    opacity: 0.8,
  },
  googleButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  googleButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  bypassWrapper: {
    marginTop: Spacing.four,
    alignItems: 'center',
  },
  bypassLink: {
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  bypassInputBlock: {
    width: '100%',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  bypassButtons: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  bypassConfirmButton: {
    flex: 1,
    backgroundColor: '#3c87f7',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  bypassConfirmText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  bypassCancelButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bypassCancelText: {
    fontSize: 12,
  },
  input: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    fontSize: 14,
  },
  onboardingHeader: {
    gap: 4,
    marginBottom: Spacing.four,
  },
  onboardingTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  onboardingSubtitle: {
    fontSize: 13,
    opacity: 0.8,
  },
  button: {
    flexDirection: 'row',
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    marginTop: Spacing.two,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.4,
  },
  dashboard: {
    width: '100%',
  },
  dashboardHeader: {
    alignItems: 'center',
    gap: Spacing.one,
    marginBottom: Spacing.five,
  },
  dashboardTitle: {
    fontSize: 32,
    fontWeight: '800',
  },
  dashboardSubtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  topicForm: {
    gap: Spacing.two,
  },
  label: {
    fontSize: 12,
    letterSpacing: 0.5,
  },
  previousChatsSection: {
    marginTop: Spacing.five,
    gap: Spacing.two,
  },
  sectionHeader: {
    fontSize: 10,
    letterSpacing: 1.5,
  },
  chatListContainer: {
    maxHeight: 180,
    gap: Spacing.one,
  },
  chatListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  chatListText: {
    fontSize: 13,
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: Spacing.three,
  },
  footerLink: {
    fontSize: 11,
    opacity: 0.6,
  },
  footerDot: {
    fontSize: 11,
    opacity: 0.4,
  },
  glowBlob1: {
    position: 'absolute',
    top: -100,
    left: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    opacity: 0.5,
  },
  glowBlob2: {
    position: 'absolute',
    bottom: -100,
    right: -100,
    width: 300,
    height: 300,
    borderRadius: 150,
    opacity: 0.5,
  },
  guestButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: Spacing.two,
  },
  guestButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  offlineBanner: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: Spacing.four,
  },
  offlineBannerTitle: {
    fontSize: 12,
    color: '#ef4444',
  },
  offlineBannerText: {
    fontSize: 11,
    lineHeight: 15,
  },
});
