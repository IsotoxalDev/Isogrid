import { NextRequest, NextResponse } from "next/server";
import { decrypt } from "@/lib/encryption";

/**
 * POST /api/canvas/decrypt
 *
 * A minimal server-only route for migrating legacy AES-encrypted Firestore docs.
 * The ENCRYPTION_KEY never leaves the server — no NEXT_PUBLIC_ exposure needed.
 *
 * This is called at most once per user (on first load of encrypted legacy data).
 * After the call, firebase.ts re-saves the data as plain JSON, so subsequent
 * loads never hit this endpoint again.
 */
export async function POST(req: NextRequest) {
    try {
        const { ciphertext } = await req.json();

        if (typeof ciphertext !== "string" || !ciphertext) {
            return NextResponse.json({ error: "Invalid ciphertext" }, { status: 400 });
        }

        const decrypted = decrypt(ciphertext);

        // Ensure decryption actually produced something parseable
        let data: unknown;
        try {
            data = JSON.parse(decrypted);
        } catch {
            return NextResponse.json({ error: "Decryption failed" }, { status: 422 });
        }

        return NextResponse.json({ data });
    } catch {
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
