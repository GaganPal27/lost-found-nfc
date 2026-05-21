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

  try {
    // Request NDEF first — works for our programmed stickers
    // If the tag is read-only / non-NDEF, this will throw and we fall through
    await NfcManager.requestTechnology([
      NfcTech.Ndef,
      NfcTech.NfcA,
      NfcTech.NfcB,
      NfcTech.NfcF,
      NfcTech.NfcV,
      NfcTech.IsoDep,
      NfcTech.MifareClassic,
      NfcTech.MifareUltralight,
    ] as any);

    const tag: TagEvent | null = await NfcManager.getTag();

    if (tag) {
      // Extract hardware UID — always present regardless of tag type
      if (tag.id) {
        if (Array.isArray(tag.id)) {
          // byte array → hex string e.g. "04A1B2C3D4E5F6"
          hardwareId = (tag.id as number[])
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('')
            .toUpperCase();
        } else if (typeof tag.id === 'string') {
          hardwareId = tag.id.toUpperCase();
        }
      }

      // Try to extract NDEF URL
      if (tag.ndefMessage && tag.ndefMessage.length > 0) {
        try {
          const record = tag.ndefMessage[0];
          const decoded = Ndef.uri.decodePayload(
            new Uint8Array(record.payload as number[])
          );
          if (decoded) url = decoded;
        } catch (_) {
          // Not a URI record — ignore
        }
      }
    }
  } catch (ex) {
    console.warn('NFC Read Error:', ex);
  } finally {
    NfcManager.cancelTechnologyRequest();
  }

  return { url, hardwareId };
};

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
