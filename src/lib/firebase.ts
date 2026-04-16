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

/**
 * Save canvas data directly to Firestore as plain JSON.
 * Security is enforced by Firestore rules (request.auth != null),
 * so we don't need application-level encryption here.
 */
export const saveCanvasData = async (userId: string, data: CanvasData) => {
    try {
        const userDocRef = doc(db, "users", userId);
        await setDoc(userDocRef, { data: JSON.stringify(data) }, { merge: true });
    } catch (error) {
        console.error("Error saving canvas data:", error);
        throw error;
    }
};

/**
 * Load canvas data from Firestore.
 * Handles three legacy formats:
 *   1. Plain JSON string (current format)
 *   2. AES-encrypted string (previous format) — calls /api/canvas/decrypt
 *   3. Raw object (oldest format, stored unencrypted as a Firestore map)
 */
export const loadCanvasData = async (userId: string): Promise<CanvasData | null> => {
    try {
        const userDocRef = doc(db, "users", userId);
        const docSnap = await getDoc(userDocRef);

        if (!docSnap.exists()) return null;

        const raw = docSnap.data()?.data;

        // 1. Plain JSON string
        if (typeof raw === "string") {
            try {
                return JSON.parse(raw) as CanvasData;
            } catch {
                // Not valid JSON — likely an encrypted legacy string, fall through
            }

            // 2. Legacy encrypted string — decrypt server-side (ENCRYPTION_KEY stays private)
            try {
                const res = await fetch("/api/canvas/decrypt", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ ciphertext: raw }),
                });
                if (res.ok) {
                    const { data } = await res.json();
                    // Re-save as plain JSON so future loads are fast (migration)
                    await saveCanvasData(userId, data);
                    return data as CanvasData;
                }
            } catch {
                console.error("Legacy decryption failed, returning null");
            }
            return null;
        }

        // 3. Raw object (oldest legacy format)
        if (typeof raw === "object" && raw !== null) {
            return raw as CanvasData;
        }

        return null;
    } catch (error) {
        console.error("Error loading canvas data:", error);
        throw error;
    }
};

export { app, auth, db, storage };