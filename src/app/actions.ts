"use server";

import { encrypt, decrypt } from "@/lib/encryption";
import type { CanvasData } from "@/lib/types";

export async function encryptCanvasData(data: CanvasData) {
  const jsonString = JSON.stringify(data);
  return encrypt(jsonString);
}

export async function decryptCanvasData(data: any): Promise<CanvasData | null> {
  if (typeof data === 'string') {
    try {
      const decryptedString = decrypt(data);
      return JSON.parse(decryptedString) as CanvasData;
    } catch (error) {
      console.error("Failed to decrypt or parse canvas data:", error);
      return null;
    }
  }

  // Handle unencrypted data (legacy support)
  if (typeof data === 'object' && data !== null) {
    return data as CanvasData;
  }

  return null;
}
