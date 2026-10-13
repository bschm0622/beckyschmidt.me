// Client-safe image validation and optimization, plus the upload constraints
// shared with the /api/github/upload-image route.

const MAX_WIDTH = 1200;
const JPEG_QUALITY = 0.85;

/** Max size of an image after optimizeImage() — what the upload route accepts. */
export const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
/** Max size of the original file picked/pasted/dropped. Phone photos are often
 *  3–10MB but shrink well under MAX_FILE_SIZE once resized to MAX_WIDTH. */
export const MAX_INPUT_SIZE = 25 * 1024 * 1024; // 25MB
export const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

export interface ImageValidation {
  valid: boolean;
  error?: string;
}

/**
 * Validates an original image file before optimization. The 2MB upload limit
 * is checked after optimizeImage(), since resizing shrinks most photos.
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

  if (file.size > MAX_INPUT_SIZE) {
    return {
      valid: false,
      error: `File is too large. Maximum size is ${MAX_INPUT_SIZE / 1024 / 1024}MB.`
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

    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;

      // Only resize if image is larger than MAX_WIDTH
      if (width > MAX_WIDTH) {
        height = (height * MAX_WIDTH) / width;
        width = MAX_WIDTH;
      }

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      // Convert to JPEG for better compression, except small PNGs and PNGs
      // with transparency (JPEG has no alpha, so it would turn black).
      const outputType =
        file.type === 'image/png' && (file.size < 500 * 1024 || hasTransparency(ctx, width, height))
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

          const optimizedFile = new File([blob], withExtension(file.name, outputType), {
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
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image'));
    };

    img.src = objectUrl;
  });
}

function hasTransparency(ctx: CanvasRenderingContext2D, width: number, height: number): boolean {
  const { data } = ctx.getImageData(0, 0, width, height);
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 255) return true;
  }
  return false;
}

/** Swap a filename's extension to match the (possibly converted) MIME type. */
export function withExtension(name: string, type: string): string {
  const ext = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : type === 'image/gif' ? 'gif' : 'jpg';
  return `${name.replace(/\.[^.]+$/, '') || 'image'}.${ext}`;
}
