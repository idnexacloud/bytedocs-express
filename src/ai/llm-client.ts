/**
 * LLM Client for ByteDocs Express
 * Supports OpenRouter, OpenAI, and Claude API
 */

import { AIConfig } from '../core/types';

export interface ChatRequest {
  message: string;
  context?: string;  // Full OpenAPI spec JSON
  endpoint?: any;
}

export interface ChatResponse {
  response: string;
  provider: string;
  model?: string;
  tokensUsed?: number;
  error?: string;
}

export class LLMClient {
  private config: AIConfig;

  constructor(config: AIConfig) {
    this.config = config;
  }

  /**
   * Send chat request to LLM with API context
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    if (!this.config.enabled) {
      throw new Error('AI features are not enabled');
    }

    if (!this.config.apiKey) {
      throw new Error(`API key is required for ${this.config.provider}`);
    }

    const systemPrompt = this.buildSystemPrompt(request);
    const userMessage = request.message;

    try {
      switch (this.config.provider) {
        case 'openrouter':
          return await this.chatOpenRouter(systemPrompt, userMessage);
        case 'openai':
          return await this.chatOpenAI(systemPrompt, userMessage);
        case 'claude':
          return await this.chatClaude(systemPrompt, userMessage);
        default:
          throw new Error(`Unsupported LLM provider: ${this.config.provider}`);
      }
    } catch (error) {
      return {
        response: '',
        provider: this.config.provider || 'unknown',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Build system prompt with API context (optimized for token usage)
   */
  private buildSystemPrompt(request: ChatRequest): string {
    // Compact system prompt - essential rules only
    let prompt = `API documentation assistant. Rules:
1. ONLY use endpoints from the spec below - NEVER invent
2. If endpoint not in spec, say "not available"
3. Be concise
4. Match user language (Indonesian/English)
5. Show minimal code examples

SPEC:
${request.context || ''}`;

    // Add focused endpoint note if applicable
    if (request.endpoint) {
      prompt += '\n\nNote: User viewing specific endpoint - provide contextual info.';
    }

    return prompt;
  }

  /**
   * OpenRouter API
   */
  private async chatOpenRouter(systemPrompt: string, userMessage: string): Promise<ChatResponse> {
    const model = this.config.features?.model || 'anthropic/claude-3.5-sonnet';
    const baseURL = 'https://openrouter.ai/api/v1';

    const response = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/anthropics/bytedocs-express',
        'X-Title': 'ByteDocs Express',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: this.config.features?.temperature || 0.7,
        max_tokens: this.config.features?.maxTokens || 2000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} ${error}`);
    }

    const data = await response.json() as any;
    return {
      response: data.choices[0]?.message?.content || 'No response from AI',
      provider: 'openrouter',
      model,
      tokensUsed: data.usage?.total_tokens,
    };
  }

  /**
   * OpenAI API
   */
  private async chatOpenAI(systemPrompt: string, userMessage: string): Promise<ChatResponse> {
    const model = this.config.features?.model || 'gpt-4o-mini';
    const baseURL = 'https://api.openai.com/v1';

    const response = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: this.config.features?.temperature || 0.7,
        max_tokens: this.config.features?.maxTokens || 2000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} ${error}`);
    }

    const data = await response.json() as any;
    return {
      response: data.choices[0]?.message?.content || 'No response from AI',
      provider: 'openai',
      model,
      tokensUsed: data.usage?.total_tokens,
    };
  }

  /**
   * Claude (Anthropic) API
   */
  private async chatClaude(systemPrompt: string, userMessage: string): Promise<ChatResponse> {
    const model = this.config.features?.model || 'claude-3-5-sonnet-20241022';
    const baseURL = 'https://api.anthropic.com/v1';

    const response = await fetch(`${baseURL}/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': this.config.apiKey || '',
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: this.config.features?.maxTokens || 2000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Claude API error: ${response.status} ${error}`);
    }

    const data = await response.json() as any;
    return {
      response: data.content[0]?.text || 'No response from AI',
      provider: 'claude',
      model,
      tokensUsed: data.usage?.input_tokens + data.usage?.output_tokens,
    };
  }
}
