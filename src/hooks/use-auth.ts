"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";

export function useAuth(): { user: User | null; isLoading: boolean } {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
            setUser(firebaseUser && firebaseUser.emailVerified ? firebaseUser : null);
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, []);

    return { user, isLoading };
}
