import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Accepts multipart/form-data: file (File/Blob), duration (string), title (string)
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const formData = await req.formData();
    const file = formData.get('file');
    const duration = parseFloat(formData.get('duration')) || null;
    const title = formData.get('title') || `Clip ${new Date().toLocaleTimeString()}`;

    if (!file) {
      return Response.json({ error: 'Missing file' }, { status: 400 });
    }

    console.log('Uploading file:', file.name, file.size, file.type);
    const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({ file });
    console.log('Upload successful:', file_url);

    const clip = await base44.asServiceRole.entities.Clip.create({
      file_url,
      duration,
      title,
    });

    return Response.json({ file_url, clip });
  } catch (error) {
    console.error('uploadClip error:', error.message, error.stack);
    return Response.json({ error: error.message }, { status: 500 });
  }
});