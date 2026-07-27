import NfcManager, { Ndef, NfcTech, TagEvent } from 'react-native-nfc-manager';

export const checkNFCSupport = async () => {
  return await NfcManager.isSupported();
};

export const startNFC = async () => {
  await NfcManager.start();
};

// ─── Write a URL to a blank NDEF tag ────────────────────────────────────────
export const writeNDEFUrl = async (url: string): Promise<boolean> => {
  try {
    await NfcManager.requestTechnology(NfcTech.Ndef);
    const bytes = Ndef.encodeMessage([Ndef.uriRecord(url)]);
    if (bytes) {
      await NfcManager.ndefHandler.writeNdefMessage(bytes);
    }
    return true;
  } catch (ex) {
    console.warn('NFC Write Error:', ex);
    return false;
  } finally {
    NfcManager.cancelTechnologyRequest();
  }
};

// ─── Read a tag — returns both the NDEF URL (if any) and the hardware UID ────
export type NfcReadResult = {
  url: string | null;          // NDEF URL if the tag has one (programmed tags)
  hardwareId: string | null;   // Raw hardware UID hex (all tags have this)
};

export const readAnyTag = async (): Promise<NfcReadResult> => {
  let url: string | null = null;
  let hardwareId: string | null = null;

  // ── Attempt 1: request NDEF in isolation ──────────────────────────────────
  // Requesting an array of multiple tech types (as before) lets Android pick
  // ANY of them to establish the session — on some devices/tags it picks
  // NfcA instead of Ndef, and tag.ndefMessage comes back empty even though
  // the tag genuinely has a URL written to it. Asking for Ndef alone first
  // guarantees we get the NDEF message when the tag actually has one.
  try {
    await NfcManager.requestTechnology(NfcTech.Ndef);
    const tag: TagEvent | null = await NfcManager.getTag();

    if (tag?.id) {
      hardwareId = extractHardwareId(tag.id);
    }
    if (tag?.ndefMessage && tag.ndefMessage.length > 0) {
      try {
        const record = tag.ndefMessage[0];
        const decoded = Ndef.uri.decodePayload(new Uint8Array(record.payload as number[]));
        if (decoded) url = decoded;
      } catch (_) {
        // Not a URI record — ignore
      }
    }
  } catch (ex) {
    // Tag doesn't support pure Ndef tech (or read failed) — fall through
    // to the broader multi-tech attempt below for hardwareId-only tags.
  } finally {
    NfcManager.cancelTechnologyRequest().catch(() => {});
  }

  // ── Attempt 2: broader multi-tech request, only if attempt 1 got nothing ──
  // Covers blank/non-NDEF tags and cards (metro cards, etc.) where we only
  // need the hardware UID, not a URL.
  if (!url && !hardwareId) {
    try {
      await NfcManager.requestTechnology([
        NfcTech.NfcA,
        NfcTech.NfcB,
        NfcTech.NfcF,
        NfcTech.NfcV,
        NfcTech.IsoDep,
        NfcTech.MifareClassic,
        NfcTech.MifareUltralight,
      ] as any);

      const tag: TagEvent | null = await NfcManager.getTag();
      if (tag?.id) hardwareId = extractHardwareId(tag.id);
    } catch (ex) {
      console.warn('NFC Read Error:', ex);
    } finally {
      NfcManager.cancelTechnologyRequest().catch(() => {});
    }
  }

  return { url, hardwareId };
};

function extractHardwareId(id: TagEvent['id']): string | null {
  if (Array.isArray(id)) {
    return (id as number[]).map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  }
  if (typeof id === 'string') return id.toUpperCase();
  return null;
}

// ─── Link an existing NFC card by reading its hardware UID only ──────────────
// Used during item registration "Link Existing Card" flow.
// Requests the widest possible tech stack so metro cards / debit cards work.
export const linkExistingTag = async (): Promise<string | null> => {
  try {
    await NfcManager.requestTechnology([
      NfcTech.NfcA,
      NfcTech.NfcB,
      NfcTech.IsoDep,
      NfcTech.MifareClassic,
      NfcTech.MifareUltralight,
      NfcTech.Ndef,
    ] as any);

    const tag: TagEvent | null = await NfcManager.getTag();

    if (!tag?.id) return null;

    if (Array.isArray(tag.id)) {
      return (tag.id as number[])
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase();
    }
    return String(tag.id).toUpperCase();
  } catch (ex) {
    console.warn('NFC Link Error:', ex);
    return null;
  } finally {
    NfcManager.cancelTechnologyRequest();
  }
};

// Legacy — kept for backwards compatibility with existing scan.tsx
export const readNDEFUrl = async (): Promise<string | null> => {
  const { url } = await readAnyTag();
  return url;
};
