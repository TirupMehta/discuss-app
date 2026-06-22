import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Clipboard,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ArrowLeft, Share2, Plus, Trash2, Send } from 'lucide-react-native';

import {
  auth,
  emailToKey,
  dbGet,
  dbSet,
  dbRemove,
  dbPush,
  getWithFallback,
  setWithFallback,
  updateWithFallback,
} from '@/lib/firebase';
import { generateGroupChat, continueConversation } from '@/lib/actions';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ThemeToggle } from '@/components/theme-toggle';
import { useTheme } from '@/hooks/use-theme';
import '@/global.css';
import { Spacing } from '@/constants/theme';

interface Message {
  character: string;
  content: string;
  isUser?: boolean;
}

function TypingIndicator({ character }: { character: string }) {
  const theme = useTheme();
  // Standard pulsing dots animation loop for React Native
  const [pulseIndex, setPulseIndex] = useState(0);
  const [fadeAnim] = useState(() => new Animated.Value(0));
  const [slideAnim] = useState(() => new Animated.Value(6));

  useEffect(() => {
    const timer = setInterval(() => {
      setPulseIndex((prev) => (prev + 1) % 3);
    }, 300);

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();

    return () => {
      clearInterval(timer);
    };
  }, [fadeAnim, slideAnim]);

  return (
    <Animated.View
      style={[
        styles.typingContainer,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <ThemedText style={styles.typingLabel} type="smallBold">
        {character}
      </ThemedText>
      <View style={styles.typingDots}>
        <View style={[styles.typingDot, { opacity: pulseIndex === 0 ? 1 : 0.3, backgroundColor: theme.text }]} />
        <View style={[styles.typingDot, { opacity: pulseIndex === 1 ? 1 : 0.3, backgroundColor: theme.text }]} />
        <View style={[styles.typingDot, { opacity: pulseIndex === 2 ? 1 : 0.3, backgroundColor: theme.text }]} />
      </View>
    </Animated.View>
  );
}

function AnimatedMessage({
  message,
  userName,
  index,
  hasInitialized,
}: {
  message: Message;
  userName: string;
  index: number;
  hasInitialized: boolean;
}) {
  const isMe = message.character === userName || message.isUser;
  const [fadeAnim] = useState(() => new Animated.Value(0));
  const [slideAnim] = useState(() => new Animated.Value(10));

  useEffect(() => {
    // If chat is already active and user/AI adds a message, show immediately.
    // If initial loading, stagger them beautifully.
    const delay = hasInitialized ? 0 : Math.min(index * 50, 600);

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, [hasInitialized, fadeAnim, slideAnim, index]);

  return (
    <Animated.View
      style={[
        styles.messageRow,
        isMe ? styles.messageRowMe : styles.messageRowOther,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={[styles.messageBubble, isMe ? styles.messageBubbleMe : styles.messageBubbleOther]}>
        <ThemedText style={styles.messageSender} type="smallBold">
          {message.character}
        </ThemedText>
        <ThemedText style={styles.messageText} themeColor="text">
          {message.content}
        </ThemedText>
      </View>
    </Animated.View>
  );
}

function ConnectingIndicator() {
  const theme = useTheme();
  const [fadeAnim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 0.7,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  return (
    <Animated.View style={[styles.connectingContainer, { opacity: fadeAnim }]}>
      <ThemedText style={styles.connectingText} themeColor="textSecondary">
        Connecting to chat...
      </ThemedText>
      <ActivityIndicator size="small" color={theme.text} style={{ marginTop: Spacing.two }} />
    </Animated.View>
  );
}

export default function ChatScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const theme = useTheme();

  const topicParam = (params.topic as string) || '';
  const shareId = (params.share as string) || '';

  const [topic, setTopic] = useState(topicParam);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [userInput, setUserInput] = useState('');
  const [characters, setCharacters] = useState<string[]>([]);
  const [currentTyping, setCurrentTyping] = useState<string | null>(null);

  const [userName, setUserName] = useState('You');
  const [userUid, setUserUid] = useState('');
  const [chatId, setChatId] = useState<string | null>(null);
  const [isSharedView, setIsSharedView] = useState(false);
  const [authLoading, setAuthLoading] = useState(!shareId);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);
  const activeRenderIdRef = useRef<string | null>(null);
  const activeRequestIdRef = useRef<string | null>(null);
  const initializedRef = useRef(false);
  const lastParamRef = useRef('');

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, currentTyping]);

  // 1. Auth check
  useEffect(() => {
    if (shareId) {
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      let uid = currentUser?.uid;
      let email = currentUser?.email;
      
      try {
        const savedEmail = await AsyncStorage.getItem('bypass_email');
        if (!uid && savedEmail) {
          uid = emailToKey(savedEmail);
          email = savedEmail;
        }
      } catch {}

      if (uid) {
        setUserUid(uid);
        try {
          const emailKey = email ? emailToKey(email) : uid;

          try {
            const snapshot = await getWithFallback(`users/${uid}`, `users/${emailKey}`);
            if (snapshot && snapshot.exists && snapshot.exists() && snapshot.val().name) {
              setUserName(snapshot.val().name);
              setAuthLoading(false);
            } else {
              router.replace('/');
            }
          } catch (dbErr: any) {
            console.warn('Database access denied in chat auth listener. Using mock data mode.', dbErr.message);
            setUserName('Developer');
            setAuthLoading(false);
          }
        } catch (e) {
          console.error('Error fetching user name:', e);
          router.replace('/');
        }
      } else {
        router.replace('/');
      }
    });

    return () => unsubscribe();
  }, [shareId, router]);

  // Setup chat once auth loads is placed below setupChat declaration

  // 3. Sync messages to Firebase when they update in normal mode
  useEffect(() => {
    const syncDatabase = async () => {
      const savedEmail = await AsyncStorage.getItem('bypass_email');
      const bypassUid = savedEmail ? emailToKey(savedEmail) : undefined;
      const uid = auth.currentUser?.uid || userUid || bypassUid;
      const email = auth.currentUser?.email || savedEmail;
      
      if (uid && chatId && messages.length > 0 && !isSharedView) {
        const emailKey = email ? emailToKey(email) : uid;
        const payload = {
          topic,
          createdAt: Date.now(),
          messages,
          characters,
        };
        try {
          await setWithFallback(`chats/${uid}/${chatId}`, `chats/${emailKey}/${chatId}`, payload);
        } catch (e) {
          console.error('Error syncing messages:', e);
        }
      }
    };
    
    syncDatabase();
  }, [messages, chatId, isSharedView, topic, userUid, characters]);

  // setupChat is defined below initializeChat to satisfy declaration order

  const parseGroupChatResponse = (response: string): Message[] => {
    const lines = response.split('\n').filter((line) => line.trim());
    const parsedMessages: Message[] = [];

    for (const line of lines) {
      const colonMatch = line.match(/^([^:]+):\s*(.+)$/);
      const dashMatch = line.match(/^([^-]+)-\s*(.+)$/);
      const spaceMatch = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s+(.+)$/);

      if (colonMatch) {
        parsedMessages.push({
          character: colonMatch[1].trim(),
          content: colonMatch[2].trim(),
        });
      } else if (dashMatch) {
        parsedMessages.push({
          character: dashMatch[1].trim(),
          content: dashMatch[2].trim(),
        });
      } else if (spaceMatch && spaceMatch[1].length < 20) {
        parsedMessages.push({
          character: spaceMatch[1].trim(),
          content: spaceMatch[2].trim(),
        });
      }
    }

    return parsedMessages;
  };

  const displayMessagesSequentially = useCallback(async (newMessages: Message[]) => {
    const currentRenderId = Math.random().toString();
    activeRenderIdRef.current = currentRenderId;

    for (let i = 0; i < newMessages.length; i++) {
      const message = newMessages[i];

      if (activeRenderIdRef.current !== currentRenderId) return;

      setCurrentTyping(message.character);

      // Typing simulation delays matching the web experience
      const delay = i === 0 ? Math.random() * 300 + 200 : Math.random() * 600 + 400;
      await new Promise((resolve) => setTimeout(resolve, delay));

      if (activeRenderIdRef.current !== currentRenderId) {
        setCurrentTyping(null);
        return;
      }

      setCurrentTyping(null);
      setMessages((prev) => [...prev, message]);

      if (i < newMessages.length - 1) {
        // Variable delay between AI character responses (from 200ms to 800ms)
        const nextDelay = Math.random() * 600 + 200;
        await new Promise((resolve) => setTimeout(resolve, nextDelay));
      }
    }

    if (activeRenderIdRef.current === currentRenderId) {
      activeRenderIdRef.current = null;
    }
  }, []);

  const initializeChat = useCallback(async (activeChatId: string) => {
    setIsGenerating(true);
    const requestId = Math.random().toString();
    activeRequestIdRef.current = requestId;

    const tryGenerate = async (): Promise<Message[]> => {
      const response = await generateGroupChat(topicParam, userName);
      return parseGroupChatResponse(response);
    };

    try {
      let parsedMessages: Message[] = [];
      try {
        parsedMessages = await tryGenerate();
      } catch (err: any) {
        console.warn('First initialize attempt failed, retrying...', err);
        if (activeRequestIdRef.current !== requestId) return;
        await new Promise((resolve) => setTimeout(resolve, 1500));
        if (activeRequestIdRef.current !== requestId) return;
        parsedMessages = await tryGenerate();
      }

      if (activeRequestIdRef.current !== requestId) return;

      if (parsedMessages.length === 0) {
        console.warn('First initialize parse returned empty, retrying...');
        await new Promise((resolve) => setTimeout(resolve, 1500));
        if (activeRequestIdRef.current !== requestId) return;
        parsedMessages = await tryGenerate();
      }

      if (activeRequestIdRef.current !== requestId) return;

      if (parsedMessages.length > 0) {
        const uniqueCharacters = [...new Set(parsedMessages.map((m) => m.character))];
        setCharacters(uniqueCharacters);
        setIsGenerating(false);
        await displayMessagesSequentially(parsedMessages);
        setHasInitialized(true);
      } else {
        throw new Error('Failed to generate content after retry');
      }
    } catch (error: any) {
      console.error('Error generating chat, using fallback:', error);
      if (activeRequestIdRef.current !== requestId) return;

      const fallbackChars = ['Vishwa', 'Riya', 'Aarav'];
      setCharacters(fallbackChars);
      const fallbackMessages: Message[] = [
        { character: 'Vishwa', content: `Hey everyone, let's talk about ${topicParam || 'this topic'}!` },
        { character: 'Riya', content: 'Great topic! What are your thoughts on this?' },
      ];
      setIsGenerating(false);
      await displayMessagesSequentially(fallbackMessages);
    } finally {
      if (activeRequestIdRef.current === requestId) {
        setIsGenerating(false);
      }
    }
  }, [topicParam, userName, displayMessagesSequentially]);

  const setupChat = useCallback(async () => {
    const savedEmail = await AsyncStorage.getItem('bypass_email');
    
    if (shareId) {
      // Shared View Mode
      setIsSharedView(true);
      setIsGenerating(true);
      try {
        const sharedSnap = await dbGet(`shared/${shareId}`);
        if (!sharedSnap.exists()) {
          Alert.alert('Not Found', 'Shared conversation not found.');
          router.replace('/');
          return;
        }
        const val = sharedSnap.val();
        if (val && typeof val === 'object' && val.topic) {
          setTopic(val.topic || 'Shared Chat');
          setMessages(val.messages || []);
          setCharacters(val.characters || []);
          setHasInitialized(true);
        } else {
          // Legacy pointer fallback
          const ownerUid = val as string;
          const emailKey = ownerUid.includes(',') ? ownerUid : '';
          const snapshot = await getWithFallback(`chats/${ownerUid}/${shareId}`, `chats/${emailKey}/${shareId}`);
          if (snapshot.exists()) {
            const data = snapshot.val();
            setTopic(data.topic || 'Shared Chat');
            setMessages(data.messages || []);
            setCharacters(data.characters || []);
            setHasInitialized(true);
          } else {
            Alert.alert('Not Found', 'Shared conversation not found.');
            router.replace('/');
          }
        }
      } catch (err) {
        console.error('Error loading shared chat:', err);
        Alert.alert('Error', 'Failed to load shared conversation.');
        router.replace('/');
      } finally {
        setIsGenerating(false);
      }
    } else {
      // Normal Conversation Mode
      setIsSharedView(false);
      const bypassUid = savedEmail ? emailToKey(savedEmail) : undefined;
      const uid = auth.currentUser?.uid || userUid || bypassUid;
      if (!uid) {
        router.replace('/');
        return;
      }

      const email = auth.currentUser?.email || savedEmail;
      const emailKey = email ? emailToKey(email) : uid;

      const tryLoadChat = async (id: string): Promise<boolean> => {
        try {
          const snap = await getWithFallback(`chats/${uid}/${id}`, `chats/${emailKey}/${id}`);
          if (snap.exists()) {
            const data = snap.val();
            setChatId(id);
            setTopic(data.topic || topicParam);
            setMessages(data.messages || []);
            setCharacters(data.characters || []);
            setHasInitialized(true);
            return true;
          }
        } catch (dbErr: any) {
          console.warn('DB denied when loading chat, skipping.', dbErr.message);
          return false;
        }
        
        // Remove orphaned empty entry
        try {
          await dbRemove(`chats/${uid}/${id}`);
        } catch (e: any) {
          if (e.message?.includes('Permission denied') || e.code === 'PERMISSION_DENIED') {
            try {
              await dbRemove(`chats/${emailKey}/${id}`);
            } catch (err) {
               console.warn('DB denied when removing orphaned chat, skipping.', err);
            }
          }
        }
        return false;
      };

      // Search user's chats by topic (case-insensitive)
      if (topicParam) {
        try {
          const indexSnap = await getWithFallback(`chats/${uid}`, `chats/${emailKey}`);
          if (indexSnap.exists()) {
            const all = indexSnap.val() as Record<string, { topic: string; createdAt: number }>;
            const matches = Object.entries(all)
              .filter(([_, d]) => d.topic?.toLowerCase() === topicParam.toLowerCase())
              .sort((a, b) => (b[1].createdAt || 0) - (a[1].createdAt || 0));

            for (const [matchId] of matches) {
              const loaded = await tryLoadChat(matchId);
              if (loaded) return;
            }
          }
        } catch (e) {
          console.warn('Error searching chats:', e);
        }
      }

      // Create a brand new chat session
      const newChatId = dbPush('chats');
      setChatId(newChatId);
      try {
        await setWithFallback(`chats/${uid}/${newChatId}`, `chats/${emailKey}/${newChatId}`, {
          topic: topicParam,
          createdAt: Date.now(),
        });
      } catch (e) {
        console.warn('DB denied when creating new chat, proceeding locally.', e);
      }
      initializeChat(newChatId);
    }
  }, [shareId, topicParam, userUid, router, initializeChat]);

  // 2. Setup chat once auth loads (moved below setupChat)
  useEffect(() => {
    if (authLoading) return;

    const activeParam = shareId ? `share:${shareId}` : `topic:${topicParam}`;
    if (lastParamRef.current !== activeParam) {
      lastParamRef.current = activeParam;
      initializedRef.current = false;
    }

    if (!initializedRef.current) {
      initializedRef.current = true;
      setupChat();
    }

    return () => {
      activeRenderIdRef.current = null;
      activeRequestIdRef.current = null;
      initializedRef.current = false;
    };
  }, [topicParam, shareId, authLoading, setupChat]);

  const handleUserMessage = async () => {
    if (!userInput.trim() || isSharedView) return;

    activeRenderIdRef.current = null;
    setCurrentTyping(null);

    const requestId = Math.random().toString();
    activeRequestIdRef.current = requestId;

    const userMessage: Message = {
      character: userName,
      content: userInput.trim(),
      isUser: true,
    };

    const currentShownMessages = [...messages];
    setMessages((prev) => [...prev, userMessage]);
    setUserInput('');
    setIsGenerating(true);

    let chatCharacters = characters;
    if (chatCharacters.length === 0 && currentShownMessages.length > 0) {
      chatCharacters = [...new Set(currentShownMessages.map((m) => m.character).filter((c) => c !== userName))];
      setCharacters(chatCharacters);
    }

    const tryContinue = async (): Promise<Message[]> => {
      const recentMessages = currentShownMessages.slice(-20);
      const formattedHistory = recentMessages.map((m) => {
        if (m.character === userName || m.isUser) {
          return `${userName}: ${m.content}`;
        } else {
          return `${m.character}: ${m.content}`;
        }
      });
      const newHistory = [`Topic: ${topicParam}`, ...formattedHistory, `${userName}: ${userMessage.content}`];
      const response = await continueConversation(newHistory, chatCharacters, userMessage.content, userName);
      return parseGroupChatResponse(response);
    };

    try {
      let parsedMessages: Message[] = [];
      try {
        parsedMessages = await tryContinue();
      } catch (err: any) {
        console.warn('First continue attempt failed, retrying...', err);
        if (activeRequestIdRef.current !== requestId) return;
        await new Promise((resolve) => setTimeout(resolve, 1500));
        if (activeRequestIdRef.current !== requestId) return;
        parsedMessages = await tryContinue();
      }

      if (activeRequestIdRef.current !== requestId) return;

      if (parsedMessages.length === 0) {
        console.warn('First continue parse returned empty, retrying...');
        await new Promise((resolve) => setTimeout(resolve, 1500));
        if (activeRequestIdRef.current !== requestId) return;
        parsedMessages = await tryContinue();
      }

      if (activeRequestIdRef.current !== requestId) return;

      if (parsedMessages.length > 0) {
        setIsGenerating(false);
        await displayMessagesSequentially(parsedMessages);
      } else {
        throw new Error('Failed to continue conversation after retry');
      }
    } catch (error: any) {
      console.error('Error continuing conversation, using fallback:', error);
      if (activeRequestIdRef.current !== requestId) return;

      const fallbackReplies = [
        'Sorry, my internet connection is acting up. What were we saying?',
        'Wait, what? I think my connection just lagged out. Can you say that again?',
        "Whoa, lag spike! I didn't catch that, say it again?",
        'Oops, my messages are failing to send. Hold on a second.',
      ];
      const randomReply = fallbackReplies[Math.floor(Math.random() * fallbackReplies.length)];
      const randomChar = chatCharacters.length > 0 ? chatCharacters[Math.floor(Math.random() * chatCharacters.length)] : 'Vishwa';

      const fallbackMessages: Message[] = [{ character: randomChar, content: randomReply }];
      setIsGenerating(false);
      await displayMessagesSequentially(fallbackMessages);
    } finally {
      if (activeRequestIdRef.current === requestId) {
        setIsGenerating(false);
      }
    }
  };

  const handleNewChat = () => {
    router.replace('/');
  };

  const handleDeleteChat = async () => {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      setTimeout(() => setDeleteConfirm(false), 3000);
      return;
    }
    
    if (chatId) {
      try {
        const uid = auth.currentUser?.uid || userUid;
        if (uid) {
          const savedEmail = await AsyncStorage.getItem('bypass_email');
          const email = auth.currentUser?.email || savedEmail;
          const emailKey = email ? emailToKey(email) : uid;
          try {
            await dbRemove(`chats/${uid}/${chatId}`);
          } catch (e: any) {
            if (e.message?.includes('Permission denied') || e.code === 'PERMISSION_DENIED') {
              await dbRemove(`chats/${emailKey}/${chatId}`);
            } else {
              throw e;
            }
          }
        }
        await dbRemove(`shared/${chatId}`);
      } catch (e) {
        console.error('Error deleting chat:', e);
      }
    }
    router.replace('/');
  };

  const handleShare = async () => {
    if (!chatId) return;
    const uid = auth.currentUser?.uid || userUid;
    if (!uid) return;
    try {
      const savedEmail = await AsyncStorage.getItem('bypass_email');
      const email = auth.currentUser?.email || savedEmail;
      const emailKey = email ? emailToKey(email) : uid;
      
      // Update chat entry to public
      await updateWithFallback(`chats/${uid}/${chatId}`, `chats/${emailKey}/${chatId}`, { isPublic: true });
      
      // Write full chat snapshot to public shared index
      await dbSet(`shared/${chatId}`, {
        uid,
        topic,
        messages,
        characters,
        createdAt: Date.now(),
      });
      
      const shareUrl = `https://discuss.tirup.in/chat?share=${chatId}`;
      Clipboard.setString(shareUrl);
      Alert.alert('Link Copied', 'Shared conversation link copied to clipboard!');
    } catch (e) {
      console.error('Error sharing chat:', e);
      Alert.alert('Error', 'Failed to generate share link.');
    }
  };

  if (authLoading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.text} />
        <ThemedText style={styles.loadingText} themeColor="textSecondary">
          Verifying session
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        {/* Chat Header Bar */}
        <View style={[styles.header, { borderColor: theme.backgroundSelected }]}>
          <Pressable onPress={() => router.replace('/')} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
            <ArrowLeft size={14} color={theme.text} opacity={0.6} />
            <ThemedText style={styles.backButtonText} themeColor="text">Back</ThemedText>
          </Pressable>

          <ThemedText style={styles.headerTopic} type="smallBold" numberOfLines={1}>
            {topic || 'Chat'}
          </ThemedText>

          <View style={styles.headerControls}>
            {!isSharedView && chatId && (
              <>
                <Pressable onPress={handleShare} style={({ pressed }) => [styles.controlButton, pressed && styles.pressed]}>
                  <Share2 size={16} color={theme.text} opacity={0.6} />
                </Pressable>
                <Pressable
                  onPress={handleDeleteChat}
                  style={({ pressed }) => [
                    styles.deleteButton,
                    deleteConfirm && styles.deleteButtonActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Trash2 size={15} color={deleteConfirm ? '#ef4444' : theme.text} opacity={deleteConfirm ? 1 : 0.6} />
                  {deleteConfirm && <ThemedText style={styles.deleteConfirmText}>Sure?</ThemedText>}
                </Pressable>
              </>
            )}
            {!isSharedView && (
              <Pressable onPress={handleNewChat} style={({ pressed }) => [styles.controlButton, pressed && styles.pressed]}>
                <Plus size={16} color={theme.text} opacity={0.6} />
              </Pressable>
            )}
            <ThemeToggle style={styles.headerThemeToggle} />
          </View>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        >
          {/* Messages list */}
          <ScrollView
            ref={scrollViewRef}
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            onContentSizeChange={scrollToBottom}
          >
            {isGenerating && !hasInitialized && (
              <ConnectingIndicator />
            )}

            <View style={styles.messagesContainer}>
              {messages.map((message, index) => (
                <AnimatedMessage
                  key={index}
                  message={message}
                  userName={userName}
                  index={index}
                  hasInitialized={hasInitialized}
                />
              ))}

              {isGenerating && !currentTyping && hasInitialized && (
                <TypingIndicator character="Discussing..." />
              )}

              {currentTyping && <TypingIndicator character={currentTyping} />}
            </View>
          </ScrollView>

          {/* Floating Input / Share banner at bottom */}
          <View style={[styles.inputContainer, { backgroundColor: theme.background, borderColor: theme.backgroundSelected }]}>
            {isSharedView ? (
              <View style={[styles.sharedBanner, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
                <View style={styles.sharedBannerInfo}>
                  <ThemedText style={styles.sharedBannerTitle} type="smallBold">
                    Viewing Shared Chat
                  </ThemedText>
                  <ThemedText style={styles.sharedBannerSubtitle} themeColor="textSecondary">
                    This discussion is read-only. Create your own!
                  </ThemedText>
                </View>
                <Pressable
                  onPress={() => router.replace('/')}
                  style={({ pressed }) => [styles.sharedBannerButton, pressed && styles.pressed]}
                >
                  <ThemedText style={styles.sharedBannerButtonText}>Start Chat</ThemedText>
                </Pressable>
              </View>
            ) : (
              <View style={styles.inputRow}>
                <TextInput
                  value={userInput}
                  onChangeText={setUserInput}
                  placeholder="Say something..."
                  placeholderTextColor={theme.text === '#ffffff' ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'}
                  style={[
                    styles.inputField,
                    {
                      color: theme.text,
                      backgroundColor: theme.text === '#ffffff' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                      borderColor: theme.backgroundSelected,
                    },
                  ]}
                  editable={!isGenerating}
                />
                <Pressable
                  onPress={handleUserMessage}
                  disabled={!userInput.trim() || isGenerating}
                  style={({ pressed }) => [
                    styles.sendButton,
                    { backgroundColor: theme.text },
                    (!userInput.trim() || isGenerating) && styles.disabledSendButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Send size={14} color={theme.background} />
                </Pressable>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    height: 56,
    borderBottomWidth: 1,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 4,
  },
  backButtonText: {
    fontSize: 11,
    fontWeight: '600',
    opacity: 0.8,
  },
  headerTopic: {
    fontSize: 14,
    fontWeight: '700',
    maxWidth: '35%',
  },
  headerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  controlButton: {
    padding: 6,
    borderRadius: 8,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  deleteButtonActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  deleteConfirmText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ef4444',
  },
  headerThemeToggle: {
    padding: 0,
  },
  pressed: {
    opacity: 0.7,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: 110,
  },
  connectingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.six,
  },
  connectingText: {
    fontSize: 13,
  },
  messagesContainer: {
    gap: Spacing.four,
  },
  messageRow: {
    flexDirection: 'row',
    width: '100%',
  },
  messageRowMe: {
    justifyContent: 'flex-end',
  },
  messageRowOther: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '85%',
    gap: 2,
  },
  messageBubbleMe: {
    alignItems: 'flex-end',
  },
  messageBubbleOther: {
    alignItems: 'flex-start',
  },
  messageSender: {
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.7,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    opacity: 0.6,
  },
  typingLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  typingDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  typingDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  inputContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    paddingHorizontal: Spacing.four,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
  },
  inputRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 8,
  },
  inputField: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledSendButton: {
    opacity: 0.4,
  },
  sharedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  sharedBannerInfo: {
    flex: 1,
    gap: 2,
  },
  sharedBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  sharedBannerSubtitle: {
    fontSize: 11,
  },
  sharedBannerButton: {
    backgroundColor: '#000000',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  sharedBannerButtonText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
});
