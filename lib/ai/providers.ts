export type AIProviderConfig = {
  provider: "deepseek" | "kimi";
  apiKey: string;
  baseUrl: string;
  model: string;
};

function getEnv(name: string) {
  const value = process.env[name];
  if (!value) return null;
  return value.trim();
}

export function getChatProviders(): AIProviderConfig[] {
  const providers: AIProviderConfig[] = [];

  const deepseekKey = getEnv("DEEPSEEK_API_KEY");
  if (deepseekKey) {
    providers.push({
      provider: "deepseek",
      apiKey: deepseekKey,
      baseUrl: getEnv("DEEPSEEK_BASE_URL") ?? "https://api.deepseek.com",
      model: getEnv("DEEPSEEK_MODEL") ?? "deepseek-chat",
    });
  }

  const kimiKey = getEnv("KIMI_API_KEY");
  if (kimiKey) {
    providers.push({
      provider: "kimi",
      apiKey: kimiKey,
      baseUrl: getEnv("KIMI_BASE_URL") ?? "https://api.moonshot.ai/v1",
      model: getEnv("KIMI_MODEL") ?? "kimi-k2-0905-preview",
    });
  }

  return providers;
}

