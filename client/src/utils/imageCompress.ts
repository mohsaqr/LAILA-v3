/**
 * Compress an image file to fit within a target size (in KB).
 * Uses canvas to re-encode as JPEG with decreasing quality.
 */
export const compressImage = (file: File, maxSizeKB: number): Promise<File> => {
  return new Promise((resolve) => {
    // If already under limit, return as-is
    if (file.size <= maxSizeKB * 1024) {
      resolve(file);
      return;
    }

    const img = new window.Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      const canvas = document.createElement('canvas');

      // Scale down large images (max 1200px on longest side)
      const maxDim = 1200;
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);

      // Try decreasing quality until under limit
      let quality = 0.8;
      const tryCompress = () => {
        canvas.toBlob(
          (blob) => {
            if (!blob) { resolve(file); return; }
            if (blob.size <= maxSizeKB * 1024 || quality <= 0.1) {
              const name = file.name.replace(/\.\w+$/, '.jpg');
              resolve(new File([blob], name, { type: 'image/jpeg' }));
            } else {
              quality -= 0.1;
              tryCompress();
            }
          },
          'image/jpeg',
          quality,
        );
      };
      tryCompress();
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };

    img.src = url;
  });
};
