using System.Net.Http.Json;
using System.Runtime.CompilerServices;
using System.Text.Json;
using System.Text.Json.Serialization;
using OllamaCsharpWeb.Models;

namespace OllamaCsharpWeb.Services;

public sealed class OllamaClient(HttpClient httpClient)
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public async Task<IReadOnlyList<string>> GetModelsAsync(CancellationToken cancellationToken = default)
    {
        using var response = await httpClient.GetAsync("api/tags", cancellationToken);
        var responseText = await response.Content.ReadAsStringAsync(cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            throw new HttpRequestException($"GET /api/tags returned {(int)response.StatusCode} {response.ReasonPhrase}. {responseText}");
        }

        var tags = JsonSerializer.Deserialize<OllamaTagsResponse>(responseText, JsonOptions)
            ?? throw new InvalidOperationException("Ollama returned an empty model list response.");

        return tags.Models
            .Select(model => model.Name)
            .Where(name => !string.IsNullOrWhiteSpace(name))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Order(StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    public async IAsyncEnumerable<string> StreamChatAsync(
        string model,
        IReadOnlyList<ChatMessage> messages,
        [EnumeratorCancellation] CancellationToken cancellationToken = default)
    {
        var requestBody = new OllamaChatRequest(
            model,
            messages.Select(message => new OllamaMessage(message.Role, message.Content)).ToList(),
            Stream: true);

        using var request = new HttpRequestMessage(HttpMethod.Post, "api/chat")
        {
            Content = JsonContent.Create(requestBody, options: JsonOptions)
        };

        using var response = await httpClient.SendAsync(
            request,
            HttpCompletionOption.ResponseHeadersRead,
            cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            var responseText = await response.Content.ReadAsStringAsync(cancellationToken);
            throw new HttpRequestException($"POST /api/chat returned {(int)response.StatusCode} {response.ReasonPhrase}. {responseText}");
        }

        await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
        using var reader = new StreamReader(stream);

        while (!reader.EndOfStream)
        {
            var line = await reader.ReadLineAsync(cancellationToken);
            if (string.IsNullOrWhiteSpace(line))
            {
                continue;
            }

            OllamaChatChunk? chunk;
            try
            {
                chunk = JsonSerializer.Deserialize<OllamaChatChunk>(line, JsonOptions);
            }
            catch (JsonException exception)
            {
                throw new InvalidOperationException("Ollama returned malformed streaming JSON.", exception);
            }

            if (chunk?.Message?.Content is { Length: > 0 } content)
            {
                yield return content;
            }

            if (chunk?.Done == true)
            {
                yield break;
            }
        }
    }

    private sealed record OllamaTagsResponse(IReadOnlyList<OllamaModel> Models);

    private sealed record OllamaModel(string Name);

    private sealed record OllamaChatRequest(
        string Model,
        IReadOnlyList<OllamaMessage> Messages,
        bool Stream);

    private sealed record OllamaMessage(string Role, string Content);

    private sealed record OllamaChatChunk(
        OllamaMessage? Message,
        [property: JsonPropertyName("done")] bool Done);
}
