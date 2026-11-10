// On-device text recognition (Apple Vision on iOS, Google ML Kit on Android) via the
// expo-text-extractor native module. Expo Go does not include it, so we look it up
// optionally: the scanner shows a notice instead of crashing until you use a
// development build (see README).

import { requireOptionalNativeModule } from 'expo';

interface TextExtractorModule {
  isSupported: boolean;
  extractTextFromImage(uri: string): Promise<string[]>;
}

const native = requireOptionalNativeModule<TextExtractorModule>('ExpoTextExtractor');

export const isTextRecognitionAvailable = Boolean(native?.isSupported);

export async function recognizeText(uri: string): Promise<string[]> {
  if (!native) throw new Error('Text recognition needs a development build of the app.');
  return native.extractTextFromImage(uri.replace('file://', ''));
}
