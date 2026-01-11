import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import { CanvasItemData, ArrowData, BoardSettings } from "./types";

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
        const userDocRef = doc(db, 'users', userId);
        await setDoc(userDocRef, { data }, { merge: true });
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
            // Assuming data is stored under a 'data' field.
            return userData.data as CanvasData;
        } else {
            console.log("No such document!");
            return null;
        }
    } catch (error) {
        console.error("Error loading canvas data:", error);
        throw error;
    }
};

export { app, auth, db, storage };
