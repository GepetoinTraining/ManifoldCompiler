import { NextResponse } from 'next/server';

function getKernelUrl() {
  const ip = process.env.KERNEL_IP || '127.0.0.1';
  const port = process.env.KERNEL_PORT || '3141';
  return `http://${ip}:${port}`;
}

export async function GET(request, { params }) {
  const kernelUrl = getKernelUrl();
  if (!kernelUrl) {
    return NextResponse.json({ error: 'kernel not connected' }, { status: 503 });
  }

  const path = params.path.join('/');
  try {
    const url = new URL(request.url);
    const resp = await fetch(`${kernelUrl}/api/${path}${url.search}`, {
      headers: { 'X-Torus-Key': process.env.TORUS_API_KEY || '' },
    });
    const data = await resp.json();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: 'kernel unreachable', detail: e.message }, { status: 502 });
  }
}

export async function POST(request, { params }) {
  const kernelUrl = getKernelUrl();
  if (!kernelUrl) {
    return NextResponse.json({ error: 'kernel not connected' }, { status: 503 });
  }

  const path = params.path.join('/');
  try {
    const body = await request.json();
    const resp = await fetch(`${kernelUrl}/api/${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Torus-Key': process.env.TORUS_API_KEY || '',
      },
      body: JSON.stringify(body),
    });
    const data = await resp.json();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: 'kernel unreachable', detail: e.message }, { status: 502 });
  }
}
