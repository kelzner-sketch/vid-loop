import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Accepts either:
//   - multipart/form-data with a 'file' field (binary)
//   - application/json with { fileBase64, fileName, fileType, duration, title }
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const contentType = req.headers.get('content-type') || '';

    let fileBlob, duration, title;

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file');
      if (!file) return Response.json({ error: 'Missing file' }, { status: 400 });
      fileBlob = file;
      duration = parseFloat(formData.get('duration')) || 0;
      title = formData.get('title') || `Clip ${new Date().toLocaleTimeString()}`;
    } else {
      // JSON path: fileBase64 + fileName + fileType
      const body = await req.json();
      if (!body.fileBase64) return Response.json({ error: 'Missing fileBase64' }, { status: 400 });

      const binary = Uint8Array.from(atob(body.fileBase64), c => c.charCodeAt(0));
      fileBlob = new File([binary], body.fileName || 'clip.webm', { type: body.fileType || 'video/webm' });
      duration = body.duration || 0;
      title = body.title || `Clip ${new Date().toLocaleTimeString()}`;
    }

    console.log('Uploading:', fileBlob.name, fileBlob.size, fileBlob.type);
    const { file_url } = await base44.integrations.Core.UploadFile({ file: fileBlob });
    console.log('Upload successful:', file_url);

    const clip = await base44.entities.Clip.create({ file_url, duration, title });
    return Response.json({ file_url, clip });
  } catch (error) {
    console.error('uploadClip error:', error.message, error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});