import { supabase } from './supabase';
import { Platform } from 'react-native';

/**
 * Lädt ein Avatar-Bild in den Supabase Storage-Bucket "avatars" hoch.
 * Gibt die öffentliche URL zurück, oder null bei Fehler.
 *
 * Ordnerstruktur: avatars/<userId>/avatar-<timestamp>.jpg
 * Jeder User schreibt nur in seinen eigenen Ordner (Policy: foldername = uid).
 */
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export async function uploadAvatar(userId: string, uri: string): Promise<string | null> {
  try {
    const fileName = `${userId}/avatar-${Date.now()}.jpg`;

    if (Platform.OS === 'web') {
      // Web: URI → Blob via fetch
      const response = await fetch(uri);
      const blob = await response.blob();

      if (!ALLOWED_IMAGE_TYPES.includes(blob.type)) return null;
      if (blob.size > MAX_AVATAR_SIZE_BYTES) return null;

      const { error } = await supabase.storage
        .from('avatars')
        .upload(fileName, blob, { upsert: true, contentType: 'image/jpeg' });
      if (error) throw error;
    } else {
      // Native: FormData mit file-Objekt
      const formData = new FormData();
      formData.append('file', { uri, name: 'avatar.jpg', type: 'image/jpeg' } as unknown as Blob);
      const { error } = await supabase.storage
        .from('avatars')
        .upload(fileName, formData, { upsert: true });
      if (error) throw error;
    }

    const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
    return data.publicUrl;
  } catch {
    return null;
  }
}
