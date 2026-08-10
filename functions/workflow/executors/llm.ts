import { ExecutionContext, WorkflowStep } from '../types';

function applyTemplate(template: string, ctx: ExecutionContext): string {
  // Simple replacement of {{previous_output}}
  if (typeof template !== 'string') return template;
  let str = template;
  if (ctx.previousOutput) {
    str = str.replace(/{{previous_output}}/g, typeof ctx.previousOutput === 'object' ? JSON.stringify(ctx.previousOutput) : String(ctx.previousOutput));
  }
  return str;
}

export async function executeLLM(step: WorkflowStep, ctx: ExecutionContext): Promise<any> {
  const prompt = step.config.prompt || '';
  const finalPrompt = applyTemplate(prompt, ctx);
  
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) {
    // Stub Mode
    console.log('[executeLLM] Stub mode triggered for prompt:', finalPrompt);
    await new Promise(r => setTimeout(r, 500)); // Artificial delay
    
    // Allow the test to force an output for conditionals
    if (step.config.stub_output) {
      return step.config.stub_output;
    }
    return `STUB_OUTPUT_FOR: ${finalPrompt.substring(0, 20)}...`;
  }
  
  // Real LLM call (e.g. OpenAI/Groq compatible)
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: step.config.model || 'llama3-8b-8192',
      messages: [{ role: 'user', content: finalPrompt }]
    })
  });
  
  if (!res.ok) {
    throw new Error(`LLM API returned ${res.status}`);
  }
  
  const data = await res.json();
  return data.choices[0].message.content;
}
