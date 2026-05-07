namespace OllamaCsharpWeb.Services;

public sealed class OllamaOptions
{
    public string BaseUrl { get; set; } = "http://localhost:11434";

    public string NormalizedBaseUrl => $"{BaseUrl.TrimEnd('/')}/";
}
