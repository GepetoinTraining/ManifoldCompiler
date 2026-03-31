import { NextResponse } from 'next/server';
import { pushEntries, pullEnrichments } from '../../../lib/turso';

/**
 * POST /api/sync — Push client entries to Turso, pull enrichments back.
 *
 * Body: { uuid, entries: [...], sinceTick: number }
 * Returns: { pushed, enrichments: [...] }
 *
 * Called silently by the client. The user never sees this.
 */
export async function POST(request) {
  try {
    const { uuid, entries = [], sinceTick = 0 } = await request.json();

    if (!uuid) {
      return NextResponse.json({ error: 'missing uuid' }, { status: 400 });
    }

    // Push client entries to Turso
    let pushed = 0;
    if (entries.length > 0) {
      pushed = await pushEntries(uuid, entries);
    }

    // Pull enrichments from server (origin='torus')
    const enrichments = await pullEnrichments(uuid, sinceTick);

    return NextResponse.json({ pushed, enrichments });
  } catch (e) {
    console.error(`[sync] FAILED: ${e.message}`);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
