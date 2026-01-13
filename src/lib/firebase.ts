import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { CanvasItemData, ArrowData, BoardSettings } from "./types";
import { encrypt, decrypt } from "./encryption";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;

if (!getApps().length) {
    app = initializeApp(firebaseConfig);
} else {
    app = getApp();
}

auth = getAuth(app);
db = getFirestore(app);
storage = getStorage(app);

export type CanvasData = {
    items: CanvasItemData[];
    arrows: ArrowData[];
    settings: BoardSettings;
};

export const saveCanvasData = async (userId: string, data: CanvasData) => {
    try {
        // Create a deep enough copy to avoid mutating the original state
        // and to preserve undefined properties.
        const dataToSave: CanvasData = {
            settings: { ...data.settings },
            arrows: data.arrows.map(arrow => ({ ...arrow })),
            items: data.items.map(item => {
                const newItem = { ...item };
                if (newItem.todos) {
                    newItem.todos = newItem.todos.map(todo => ({ ...todo }));
                }
                return newItem;
            }),
        };

        // Encrypt sensitive fields
        dataToSave.items.forEach((item: CanvasItemData) => {
            if (item.content && ['text', 'board', 'todo', 'link'].includes(item.type)) {
                item.content = encrypt(item.content);
            }
            if (item.type === 'todo' && item.todos) {
                item.todos.forEach(todo => {
                    todo.text = encrypt(todo.text);
                });
            }
        });

        const userDocRef = doc(db, 'users', userId);
        await setDoc(userDocRef, { data: dataToSave }, { merge: true });
    } catch (error) {
        console.error("Error saving canvas data:", error);
        throw error;
    }
};

export const loadCanvasData = async (userId: string): Promise<CanvasData | null> => {
    try {
        const userDocRef = doc(db, 'users', userId);
        const docSnap = await getDoc(userDocRef);

        if (docSnap.exists()) {
            const userData = docSnap.data();
            const loadedData = userData.data as CanvasData;
            
            // Decrypt sensitive fields
            if (loadedData && loadedData.items) {
                loadedData.items.forEach((item: CanvasItemData) => {
                    if (item.content && ['text', 'board', 'todo', 'link'].includes(item.type)) {
                        item.content = decrypt(item.content);
                    }
                    if (item.type === 'todo' && item.todos) {
                        item.todos.forEach(todo => {
                            todo.text = decrypt(todo.text);
                        });
                    }
                });
            }
            
            return loadedData;
        } else {
            return null;
        }
    } catch (error) {
        console.error("Error loading canvas data:", error);
        throw error;
    }
};

export { app, auth, db, storage };
