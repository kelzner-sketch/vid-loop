import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const { file_url, filename } = await req.json();
    
    if (!file_url) {
      return Response.json({ error: 'No file_url provided' }, { status: 400 });
    }

    const res = await fetch(file_url);
    if (!res.ok) {
      return Response.json({ error: 'Failed to fetch file' }, { status: 500 });
    }

    const buffer = await res.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));

    return Response.json({ base64, filename });
  } catch (error) {
    console.error('Download error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});