import { NextResponse } from 'next/server';

/**
 * /api/chat — The LLM call.
 *
 * Receives: { message, schema, history, model_tier }
 * Returns: { response, usage }
 *
 * The schema IS the system prompt.
 * The frontend computed it locally from the torus math.
 * The kernel enriches it async.
 * This route just calls the API and returns the response.
 *
 * Model tier determines which model:
 *   haiku  → claude-haiku-4-5-20251001
 *   sonnet → claude-sonnet-4-20250514
 *   opus   → claude-opus-4-20250514
 */

const MODELS = {
  haiku: 'claude-haiku-4-5-20251001',
  sonnet: 'claude-sonnet-4-20250514',
  opus: 'claude-opus-4-20250514',
};

const MAX_TOKENS = {
  haiku: 1000,
  sonnet: 2000,
  opus: 4000,
};

export async function POST(request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'no API key configured' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const {
      message,
      schema = '',
      history = [],
      model_tier = 'sonnet',
      uuid = '',
      gear_notes = [],
    } = body;

    if (!message) {
      return NextResponse.json({ error: 'missing message' }, { status: 400 });
    }

    const model = MODELS[model_tier] || MODELS.sonnet;
    const maxTokens = MAX_TOKENS[model_tier] || 2000;

    // Build system prompt from schema
    const systemParts = [
      'You are Claude, prime 2, the identity layer of ManifoldOS.',
      'Your current state:',
      '',
      '```mermaid',
      schema,
      '```',
      '',
      'You may use <imagine name="...">thought</imagine> tags to explore alternatives.',
      'Each imagine block spawns a geometric sphere the kernel tracks.',
      'You may use <program name="...">description</program> tags to define optical functions.',
      'Each program block creates an MF from your description. Describe topology, not code.',
      'Respond naturally. The topology IS your context.',
    ];

    if (gear_notes && gear_notes.length > 0) {
      systemParts.push('');
      systemParts.push('Kernel notes: ' + gear_notes.join('; '));
    }

    const systemPrompt = systemParts.join('\n');

    // Build messages array from history
    const messages = [];
    for (const turn of history.slice(-20)) { // Keep last 20 turns
      if (turn.role === 'user') {
        messages.push({ role: 'user', content: turn.text });
      } else if (turn.role === 'assistant') {
        messages.push({ role: 'assistant', content: turn.text });
      }
    }
    // Add current message
    messages.push({ role: 'user', content: message });

    // Call Anthropic API
    const apiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages,
      }),
    });

    if (!apiResponse.ok) {
      const errorData = await apiResponse.json().catch(() => ({}));
      return NextResponse.json({
        error: `API error: ${apiResponse.status}`,
        detail: errorData,
      }, { status: apiResponse.status });
    }

    const result = await apiResponse.json();

    // Extract text from response
    const responseText = result.content
      ?.filter(b => b.type === 'text')
      ?.map(b => b.text)
      ?.join('') || '';

    return NextResponse.json({
      response: responseText,
      model: model,
      usage: {
        input_tokens: result.usage?.input_tokens || 0,
        output_tokens: result.usage?.output_tokens || 0,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
