const MAX_WIDTH = 1200;
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
const JPEG_QUALITY = 0.85;

export interface ImageValidation {
  valid: boolean;
  error?: string;
}

/**
 * Validates an image file
 */
export function validateImage(file: File): ImageValidation {
  if (!file) {
    return { valid: false, error: 'No file provided' };
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: 'Invalid file type. Please upload JPG, PNG, WEBP, or GIF images.'
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File is too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`
    };
  }

  return { valid: true };
}

/**
 * Optimizes an image by resizing and compressing
 */
export async function optimizeImage(file: File): Promise<File> {
  // Don't optimize GIFs (animated images)
  if (file.type === 'image/gif') {
    return file;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Failed to get canvas context'));
      return;
    }

    img.onload = () => {
      let { width, height } = img;

      // Only resize if image is larger than MAX_WIDTH
      if (width > MAX_WIDTH) {
        height = (height * MAX_WIDTH) / width;
        width = MAX_WIDTH;
      }

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      // Convert to JPEG for better compression (unless it's PNG and small)
      const outputType = file.type === 'image/png' && file.size < 500 * 1024
        ? 'image/png'
        : 'image/jpeg';

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to create blob'));
            return;
          }

          // If optimization made it bigger, use original
          if (blob.size > file.size) {
            resolve(file);
            return;
          }

          const optimizedFile = new File([blob], file.name, {
            type: outputType,
            lastModified: Date.now(),
          });

          resolve(optimizedFile);
        },
        outputType,
        JPEG_QUALITY
      );
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    img.src = URL.createObjectURL(file);
  });
}

/**
 * Generates a unique filename for an image
 */
export function generateImageFilename(originalName: string, slug: string): string {
  const timestamp = Date.now();
  const sanitized = originalName.replace(/[^a-zA-Z0-9.-]/g, '-');
  return `${slug}-${timestamp}-${sanitized}`;
}
