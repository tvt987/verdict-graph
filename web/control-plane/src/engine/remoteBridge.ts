import type { ScenarioId } from '../types/protocol';

export interface ClusterHealth {
  online: boolean;
  url: string;
  protocols: string[];
  activeRuns: number;
}

export const DEFAULT_PYTHON_CLUSTER_URL = 'http://127.0.0.1:8090';

export async function probePythonCluster(
  baseUrl: string = DEFAULT_PYTHON_CLUSTER_URL
): Promise<ClusterHealth> {
  // Only probe loopback automatically when running locally; avoids mixed-content or noisy console errors on HTTPS GitHub Pages
  const isLocalHost =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  if (!isLocalHost && baseUrl.startsWith('http://127.0.0.1')) {
    return { online: false, url: baseUrl, protocols: [], activeRuns: 0 };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 900);
    const res = await fetch(`${baseUrl}/health`, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) {
      return { online: false, url: baseUrl, protocols: [], activeRuns: 0 };
    }
    const data = (await res.json()) as {
      status?: string;
      protocols?: string[];
      active_runs?: number;
    };
    return {
      online: data.status === 'ok',
      url: baseUrl,
      protocols: data.protocols ?? [],
      activeRuns: data.active_runs ?? 0,
    };
  } catch {
    return { online: false, url: baseUrl, protocols: [], activeRuns: 0 };
  }
}

export async function syncRunToPythonCluster(
  baseUrl: string,
  scenarioId: ScenarioId
): Promise<{ ok: boolean; remoteRunId?: string; error?: string }> {
  try {
    const res = await fetch(`${baseUrl}/api/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario_id: scenarioId }),
    });
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` };
    }
    const json = (await res.json()) as { run_id?: string };
    return { ok: true, remoteRunId: json.run_id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Cluster unreachable' };
  }
}

export interface ByokConfig {
  provider: 'gemini' | 'openai';
  apiKey: string;
  model: string;
}

export async function synthesizeWithByok(
  config: ByokConfig,
  contextPrompt: string
): Promise<{ ok: boolean; text?: string; error?: string }> {
  if (!config.apiKey.trim()) {
    return { ok: false, error: 'Missing API key' };
  }
  try {
    if (config.provider === 'gemini') {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        config.model || 'gemini-2.5-flash'
      )}:generateContent?key=${encodeURIComponent(config.apiKey)}`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: contextPrompt }] }],
        }),
      });
      if (!res.ok) return { ok: false, error: `Gemini HTTP ${res.status}` };
      const data = (await res.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      return text ? { ok: true, text } : { ok: false, error: 'Empty Gemini response' };
    }

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model || 'gpt-4.1-mini',
        messages: [
          { role: 'system', content: 'You are Verdict Graph Grounded Synthesizer. Return a concise cited engineering verdict.' },
          { role: 'user', content: contextPrompt },
        ],
        max_tokens: 220,
      }),
    });
    if (!res.ok) return { ok: false, error: `OpenAI HTTP ${res.status}` };
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data.choices?.[0]?.message?.content;
    return text ? { ok: true, text } : { ok: false, error: 'Empty OpenAI response' };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Request failed' };
  }
}
