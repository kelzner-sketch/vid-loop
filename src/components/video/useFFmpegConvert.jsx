import { useRef, useCallback } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';

export function useFFmpegConvert() {
  const ffmpegRef = useRef(null);
  const loadedRef = useRef(false);

  const convert = useCallback(async (webmBlob) => {
    try {
      console.log('[FFmpeg] Starting conversion...');
      const ffmpeg = ffmpegRef.current || new FFmpeg();
      ffmpegRef.current = ffmpeg;

      // Load FFmpeg once
      if (!loadedRef.current) {
        console.log('[FFmpeg] Loading library...');
        const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm';
        await Promise.race([
          ffmpeg.load({
            coreURL: `${baseURL}/ffmpeg-core.js`,
            wasmURL: `${baseURL}/ffmpeg-core.wasm`,
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('FFmpeg load timeout')), 30000))
        ]);
        loadedRef.current = true;
        console.log('[FFmpeg] Library loaded');
      }

      // Write WebM to virtual filesystem
      console.log('[FFmpeg] Writing input file...');
      const inputName = 'input.webm';
      const outputName = 'output.mp4';
      await ffmpeg.writeFile(inputName, new Uint8Array(await webmBlob.arrayBuffer()));

      // Convert WebM → MP4
      console.log('[FFmpeg] Starting conversion...');
      await Promise.race([
        ffmpeg.exec(['-i', inputName, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', outputName]),
        new Promise((_, reject) => setTimeout(() => reject(new Error('FFmpeg exec timeout')), 60000))
      ]);

      // Read output
      console.log('[FFmpeg] Reading output...');
      const outputData = await ffmpeg.readFile(outputName);
      const mp4Blob = new Blob([outputData], { type: 'video/mp4' });

      // Cleanup
      await ffmpeg.deleteFile(inputName);
      await ffmpeg.deleteFile(outputName);

      console.log('[FFmpeg] Conversion complete, size:', mp4Blob.size);
      return mp4Blob;
    } catch (error) {
      console.error('[FFmpeg] Conversion error:', error);
      throw new Error(`MP4 conversion failed: ${error.message}`);
    }
  }, []);

  return { convert };
}