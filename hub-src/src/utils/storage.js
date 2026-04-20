import { supabase } from '../lib/supabase';

/**
 * Create a short-lived signed URL for a private storage object.
 * Returns null if the path is missing or the request fails.
 */
export async function getSignedUrl(bucket, path, expiresIn = 60) {
  if (!bucket || !path) return null;
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn);
  return data?.signedUrl || null;
}

const ALLOWED_RECEIPT_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const MAX_RECEIPT_MB = 10;

/**
 * Validate a file before uploading.
 * Returns an error string if invalid, or null if OK.
 */
export function validateUploadFile(file, {
  maxMB = MAX_RECEIPT_MB,
  allowedTypes = ALLOWED_RECEIPT_TYPES,
} = {}) {
  if (!file) return 'No file selected.';
  if (file.size > maxMB * 1024 * 1024) return `File too large (max ${maxMB} MB).`;
  if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
    return `Invalid file type. Allowed: ${allowedTypes.map(t => t.split('/')[1].toUpperCase()).join(', ')}.`;
  }
  return null;
}
