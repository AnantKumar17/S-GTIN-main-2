const OpenAI = require('openai');

/**
 * GitHub Models OpenAI Client
 * Wrapper for GitHub Models API using OpenAI client
 */
class GitHubModelsClient {
  constructor() {
    this.client = new OpenAI({
      baseURL: process.env.GITHUB_MODEL_ENDPOINT || 'https://models.github.ai/inference',
      apiKey: process.env.GITHUB_TOKEN
    });

    if (!process.env.GITHUB_TOKEN) {
      console.warn('⚠️ GitHubModelsClient: GITHUB_TOKEN not configured');
    }
  }

  /**
   * Create chat completion
   */
  async chat(messages, options = {}) {
    try {
      const completion = await this.client.chat.completions.create({
        messages: messages,
        model: options.model || process.env.MODEL_NAME || 'openai/gpt-4o',
        temperature: options.temperature || 0.7,
        max_tokens: options.max_tokens || 1000,
        top_p: options.top_p || 1.0
      });

      return completion;
    } catch (error) {
      console.error('[GitHubModelsClient] Chat completion failed:', error.message);
      throw error;
    }
  }

  /**
   * Check if client is properly configured
   */
  isConfigured() {
    return !!process.env.GITHUB_TOKEN;
  }

  /**
   * Get model information
   */
  getModelInfo() {
    return {
      model: process.env.MODEL_NAME || 'openai/gpt-4o',
      endpoint: process.env.GITHUB_MODEL_ENDPOINT || 'https://models.github.ai/inference',
      configured: this.isConfigured()
    };
  }
}

module.exports = GitHubModelsClient;