import { ExecutionContext, WorkflowStep } from '../types';

export async function executeHttp(step: WorkflowStep, ctx: ExecutionContext): Promise<any> {
  const method = step.config.method || 'GET';
  const url = step.config.url;
  const headers = step.config.headers || {};
  
  if (!url) {
    throw new Error('HTTP Step missing URL');
  }

  // Very basic templating for body if needed
  let bodyStr = step.config.body ? JSON.stringify(step.config.body) : null;
  if (bodyStr && ctx.previousOutput) {
    bodyStr = bodyStr.replace(/{{previous_output}}/g, typeof ctx.previousOutput === 'object' ? JSON.stringify(ctx.previousOutput) : String(ctx.previousOutput));
  }

  const res = await fetch(url, {
    method,
    headers,
    body: (method !== 'GET' && method !== 'HEAD') ? bodyStr : undefined
  });

  if (!res.ok) {
    throw new Error(`HTTP request failed with status ${res.status}`);
  }

  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return await res.json();
  }
  return await res.text();
}
