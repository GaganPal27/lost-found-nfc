import NfcManager, { Ndef, NfcTech } from 'react-native-nfc-manager';

export const checkNFCSupport = async () => {
  return await NfcManager.isSupported();
};

export const startNFC = async () => {
  await NfcManager.start();
};

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

export const readNDEFUrl = async (): Promise<string | null> => {
  try {
    await NfcManager.requestTechnology(NfcTech.Ndef);
    const tag = await NfcManager.getTag();
    if (tag?.ndefMessage && tag.ndefMessage.length > 0) {
      const record = tag.ndefMessage[0];
      return Ndef.uri.decodePayload(new Uint8Array(record.payload as number[]));
    }
    return null;
  } catch (ex) {
    console.warn('NFC Read Error:', ex);
    return null;
  } finally {
    NfcManager.cancelTechnologyRequest();
  }
};
