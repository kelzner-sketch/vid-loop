import { useRef, useCallback } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';

export function useFFmpegConvert() {
  const ffmpegRef = useRef(null);
  const loadedRef = useRef(false);

  const convert = useCallback(async (webmBlob) => {
    try {
      const ffmpeg = ffmpegRef.current || new FFmpeg();
      ffmpegRef.current = ffmpeg;

      // Load FFmpeg once
      if (!loadedRef.current) {
        const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm';
        await ffmpeg.load({
          coreURL: `${baseURL}/ffmpeg-core.js`,
          wasmURL: `${baseURL}/ffmpeg-core.wasm`,
        });
        loadedRef.current = true;
      }

      // Write WebM to virtual filesystem
      const inputName = 'input.webm';
      const outputName = 'output.mp4';
      await ffmpeg.writeFile(inputName, new Uint8Array(await webmBlob.arrayBuffer()));

      // Convert WebM → MP4
      await ffmpeg.exec(['-i', inputName, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', outputName]);

      // Read output
      const outputData = await ffmpeg.readFile(outputName);
      const mp4Blob = new Blob([outputData], { type: 'video/mp4' });

      // Cleanup
      await ffmpeg.deleteFile(inputName);
      await ffmpeg.deleteFile(outputName);

      return mp4Blob;
    } catch (error) {
      console.error('FFmpeg conversion error:', error);
      throw error;
    }
  }, []);

  return { convert };
}