import React, { useEffect } from 'react';
import { StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';

export default function LoginScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const theme = useTheme();

  useEffect(() => {
    const idToken = params.idToken as string;
    if (idToken) {
      try {
        const credential = GoogleAuthProvider.credential(idToken);
        signInWithCredential(auth, credential)
          .then(() => {
            router.replace('/');
          })
          .catch((err) => {
            console.error('Firebase sign-in from browser failed:', err);
            alert('Sign in failed: ' + err.message);
            router.replace('/');
          });
      } catch (err: any) {
        console.error('Credential generation failed:', err);
        alert('Invalid session details received.');
        router.replace('/');
      }
    } else {
      router.replace('/');
    }
  }, [params.idToken, router]);

  return (
    <ThemedView style={styles.container}>
      <ActivityIndicator size="large" color={theme.text} />
      <ThemedText style={styles.loadingText} themeColor="textSecondary">
        Syncing session...
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
