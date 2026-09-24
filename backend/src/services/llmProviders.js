export const PROVIDER_API_KEYS = Object.freeze({
  groq: 'GROQ_API_KEY',
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
});

export const isSupportedProvider = provider => Object.hasOwn(PROVIDER_API_KEYS, provider);

export function assertProviderCredentials(models, env = process.env) {
  for (const provider of new Set(models.map(model => model.provider))) {
    if (!isSupportedProvider(provider)) throw new Error('Unsupported LLM provider: ' + provider);
    const key = PROVIDER_API_KEYS[provider];
    if (!env[key]?.trim()) throw new Error('Missing ' + key + ' for ' + provider);
  }
}
