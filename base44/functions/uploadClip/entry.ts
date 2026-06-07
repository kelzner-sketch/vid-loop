import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Called with JSON: { file_url, duration, title }
// The frontend uploads the file directly via base44.integrations.Core.UploadFile,
// then calls this function just to save the Clip entity record.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const { file_url, duration, title } = await req.json();

    if (!file_url) {
      return Response.json({ error: 'Missing file_url' }, { status: 400 });
    }

    const clip = await base44.asServiceRole.entities.Clip.create({
      file_url,
      duration: parseFloat(duration) || null,
      title: title || `Clip ${new Date().toLocaleTimeString()}`,
    });

    console.log('Clip saved:', clip.id, file_url);
    return Response.json({ file_url, clip });
  } catch (error) {
    console.error('uploadClip error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});