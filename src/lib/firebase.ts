import { initializeApp, getApps, getApp } from "firebase/app";
// @ts-ignore
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import { getDatabase } from "firebase/database";
import AsyncStorage from "@react-native-async-storage/async-storage";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID
};

// Initialize Firebase App
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Auth with AsyncStorage persistence to ensure session persistence across app launches
const auth = (() => {
  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage)
    });
  } catch {
    // Fallback if initializeAuth was already called or in some environment contexts
    const { getAuth } = require("firebase/auth");
    return getAuth(app);
  }
})();

const db = getDatabase(app);

const emailToKey = (email: string): string => email.replace(/\./g, ",");

// AsyncStorage mock implementation details for unauthenticated mode
const MOCK_PREFIX = "mock_db:";

const shouldUseMock = () => {
  return auth.currentUser === null;
};

interface MockSnapshot {
  exists(): boolean;
  val(): any;
}

const mockSnapshot = (val: any): MockSnapshot => ({
  exists: () => val !== null && val !== undefined,
  val: () => val,
});

async function mockWrite(path: string, value: any) {
  try {
    const key = `${MOCK_PREFIX}${path}`;
    if (value === null || value === undefined) {
      await AsyncStorage.removeItem(key);
    } else {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    }
  } catch (err) {
    console.error(`Mock write failed for path ${path}:`, err);
  }
}

async function mockRead(path: string): Promise<any> {
  try {
    const key = `${MOCK_PREFIX}${path}`;
    const data = await AsyncStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    console.error(`Mock read failed for path ${path}:`, err);
    return null;
  }
}

async function mockReadDir(path: string): Promise<any> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const prefix = `${MOCK_PREFIX}${path}/`;
    const matchingKeys = allKeys.filter(k => k.startsWith(prefix));
    
    if (matchingKeys.length === 0) {
      return await mockRead(path);
    }
    
    const pairs = await AsyncStorage.multiGet(matchingKeys);
    const result: Record<string, any> = {};
    for (const [key, val] of pairs) {
      if (val) {
        const subPath = key.substring(prefix.length);
        if (subPath.includes('/')) {
          const parts = subPath.split('/');
          let current = result;
          for (let i = 0; i < parts.length - 1; i++) {
            current[parts[i]] = current[parts[i]] || {};
            current = current[parts[i]];
          }
          current[parts[parts.length - 1]] = JSON.parse(val);
        } else {
          result[subPath] = JSON.parse(val);
        }
      }
    }
    return result;
  } catch (err) {
    console.error(`Mock read dir failed for path ${path}:`, err);
    return null;
  }
}

async function mockUpdate(path: string, value: any) {
  try {
    const existing = await mockRead(path);
    if (existing && typeof existing === 'object' && value && typeof value === 'object') {
      const merged = { ...existing, ...value };
      await mockWrite(path, merged);
    } else {
      await mockWrite(path, value);
    }
  } catch (err) {
    console.error(`Mock update failed for path ${path}:`, err);
  }
}

async function mockRemove(path: string) {
  try {
    const key = `${MOCK_PREFIX}${path}`;
    await AsyncStorage.removeItem(key);
    
    const allKeys = await AsyncStorage.getAllKeys();
    const prefix = `${MOCK_PREFIX}${path}/`;
    const matchingKeys = allKeys.filter(k => k.startsWith(prefix));
    if (matchingKeys.length > 0) {
      await Promise.all(matchingKeys.map(k => AsyncStorage.removeItem(k)));
    }
  } catch (err) {
    console.error(`Mock remove failed for path ${path}:`, err);
  }
}

// Wrapped Database operations that leverage mock fallbacks
async function dbGet(path: string): Promise<any> {
  if (shouldUseMock()) {
    if (path.startsWith("shared/")) {
      try {
        const url = `${firebaseConfig.databaseURL}/${path}.json`;
        const response = await fetch(url);
        if (response.ok) {
          const json = await response.json();
          if (json) {
            return mockSnapshot(json);
          }
        }
      } catch (restErr) {
        console.warn(`Failed to fetch shared chat via REST API:`, restErr);
      }
    }
    const data = await mockReadDir(path);
    return mockSnapshot(data);
  }
  
  try {
    const { get, ref } = require("firebase/database");
    return await get(ref(db, path));
  } catch (err: any) {
    console.warn(`Real DB read failed for path ${path}, falling back to mock:`, err.message);
    const data = await mockReadDir(path);
    return mockSnapshot(data);
  }
}

async function dbSet(path: string, value: any): Promise<void> {
  if (shouldUseMock()) {
    await mockWrite(path, value);
    if (path.startsWith("shared/")) {
      try {
        const url = `${firebaseConfig.databaseURL}/${path}.json`;
        await fetch(url, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(value),
        });
      } catch (err) {
        console.warn(`Mock mode: Failed to upload shared chat to real DB via REST:`, err);
      }
    }
    return;
  }
  
  try {
    const { set, ref } = require("firebase/database");
    await set(ref(db, path), value);
  } catch (err: any) {
    console.warn(`Real DB write failed for path ${path}, falling back to mock:`, err.message);
    await mockWrite(path, value);
    if (path.startsWith("shared/")) {
      try {
        const url = `${firebaseConfig.databaseURL}/${path}.json`;
        await fetch(url, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(value),
        });
      } catch (restErr) {
        console.warn(`Fallback: Failed to upload shared chat to real DB via REST:`, restErr);
      }
    }
  }
}

async function dbUpdate(path: string, value: any): Promise<void> {
  if (shouldUseMock()) {
    await mockUpdate(path, value);
    if (path.startsWith("shared/")) {
      try {
        const url = `${firebaseConfig.databaseURL}/${path}.json`;
        await fetch(url, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(value),
        });
      } catch (err) {
        console.warn(`Mock mode: Failed to update shared chat on real DB via REST:`, err);
      }
    }
    return;
  }
  
  try {
    const { update, ref } = require("firebase/database");
    await update(ref(db, path), value);
  } catch (err: any) {
    console.warn(`Real DB update failed for path ${path}, falling back to mock:`, err.message);
    await mockUpdate(path, value);
    if (path.startsWith("shared/")) {
      try {
        const url = `${firebaseConfig.databaseURL}/${path}.json`;
        await fetch(url, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(value),
        });
      } catch (restErr) {
        console.warn(`Fallback: Failed to update shared chat on real DB via REST:`, restErr);
      }
    }
  }
}

async function dbRemove(path: string): Promise<void> {
  if (shouldUseMock()) {
    await mockRemove(path);
    return;
  }
  
  try {
    const { remove, ref } = require("firebase/database");
    await remove(ref(db, path));
  } catch (err: any) {
    console.warn(`Real DB remove failed for path ${path}, falling back to mock:`, err.message);
    await mockRemove(path);
  }
}

function dbPush(path: string): string {
  if (!shouldUseMock()) {
    try {
      const { push, ref } = require("firebase/database");
      const newRef = push(ref(db, path));
      return newRef.key || Math.random().toString(36).substring(2, 15);
    } catch (err) {
      console.warn("dbPush failed, falling back to mock key:", err);
    }
  }
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
}

// Fallback logic
async function getWithFallback(uidPath: string, emailPath: string) {
  try {
    const snap = await dbGet(uidPath);
    if (snap && snap.exists && snap.exists()) {
      return snap;
    }
    try {
      return await dbGet(emailPath);
    } catch (fallbackErr) {
      console.warn(`Fallback read also failed on ${emailPath}:`, fallbackErr);
      const data = await mockReadDir(emailPath);
      return mockSnapshot(data);
    }
  } catch (err: any) {
    console.warn(`Read failed on ${uidPath}, trying fallback ${emailPath}. Error:`, err);
    try {
      const snap = await dbGet(emailPath);
      if (snap && snap.exists && snap.exists()) {
        return snap;
      }
      const data = await mockReadDir(emailPath);
      return mockSnapshot(data);
    } catch (fallbackErr) {
      console.warn(`Fallback read also failed on ${emailPath}:`, fallbackErr);
      const data = await mockReadDir(emailPath);
      return mockSnapshot(data);
    }
  }
}

async function setWithFallback(uidPath: string, emailPath: string, value: any) {
  try {
    return await dbSet(uidPath, value);
  } catch (err: any) {
    console.warn(`Write failed on ${uidPath}, trying fallback ${emailPath}. Error:`, err);
    try {
      return await dbSet(emailPath, value);
    } catch (fallbackErr) {
      console.warn(`Fallback write also failed on ${emailPath}:`, fallbackErr);
      await mockWrite(emailPath, value);
    }
  }
}

async function updateWithFallback(uidPath: string, emailPath: string, value: any) {
  try {
    return await dbUpdate(uidPath, value);
  } catch (err: any) {
    console.warn(`Update failed on ${uidPath}, trying fallback ${emailPath}. Error:`, err);
    try {
      return await dbUpdate(emailPath, value);
    } catch (fallbackErr) {
      console.warn(`Fallback update also failed on ${emailPath}:`, fallbackErr);
      await mockUpdate(emailPath, value);
    }
  }
}

export { app, auth, db, emailToKey, dbGet, dbSet, dbUpdate, dbRemove, dbPush, getWithFallback, setWithFallback, updateWithFallback };
