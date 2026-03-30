import { NextResponse } from 'next/server';

// In production, this would be Vercel KV or Edge Config
// For now, use a simple in-memory store (resets on cold start)
let KERNEL_IP = process.env.KERNEL_IP || null;
let KERNEL_PORT = process.env.KERNEL_PORT || '3141';

export function GET() {
  return NextResponse.json({
    status: 'ok',
    kernel_ip: KERNEL_IP,
    kernel_port: KERNEL_PORT,
    has_kernel: !!KERNEL_IP,
  });
}

// Export for use by other routes
export { KERNEL_IP, KERNEL_PORT };
