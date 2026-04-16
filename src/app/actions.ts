"use server";

/**
 * Server Actions for Isogrid.
 *
 * NOTE: Canvas encryption/decryption has been moved to the client-side
 * (see `src/lib/firebase.ts`) to avoid sending large canvas payloads
 * through the Next.js serverless function, which was causing
 * FUNCTION_PAYLOAD_TOO_LARGE (413) errors on Vercel.
 *
 * This file is kept as the designated place for future server-only operations.
 */

// No active server actions at this time.
// Add future server-only operations here.
