import { CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET } from '@env';

const DEFAULT_FOLDER = 'pride-this-way/profile';

export type CloudinaryUploadResult = {
  secureUrl: string;
  publicId: string;
};

const guessMimeType = (uri: string): string => {
  const lower = uri.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.heic') || lower.endsWith('.heif')) return 'image/heic';
  return 'image/jpeg';
};

const guessFileName = (uri: string): string => {
  const parts = uri.split('/');
  const last = parts[parts.length - 1] || `upload-${Date.now()}.jpg`;
  return last.includes('.') ? last : `${last}.jpg`;
};

export const uploadImageToCloudinary = async (
  localUri: string,
  folder: string = DEFAULT_FOLDER,
): Promise<CloudinaryUploadResult> => {
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
    throw new Error(
      'Cloudinary not configured. Add CLOUDINARY_CLOUD_NAME and CLOUDINARY_UPLOAD_PRESET to .env and restart Metro with --reset-cache.',
    );
  }

  const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

  const formData = new FormData();
  formData.append('file', {
    uri: localUri,
    name: guessFileName(localUri),
    type: guessMimeType(localUri),
  } as any);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  if (folder) formData.append('folder', folder);

  const response = await fetch(url, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('[cloudinary] upload failed:', response.status, errText);
    throw new Error(`Image upload failed (${response.status})`);
  }

  const body = await response.json();
  if (!body?.secure_url) {
    console.error('[cloudinary] missing secure_url, body=', body);
    throw new Error('Image upload returned no URL');
  }

  return {
    secureUrl: body.secure_url,
    publicId: body.public_id,
  };
};
