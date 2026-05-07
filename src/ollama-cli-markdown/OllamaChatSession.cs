using System.Text;

namespace OllamaCliMarkdown;

internal sealed class OllamaChatSession
{
    private readonly string model;
    private readonly IReadOnlyList<string> extraRunArgs;
    private readonly List<ChatTurn> history = [];

    public OllamaChatSession(string model, IReadOnlyList<string> extraRunArgs)
    {
        this.model = model;
        this.extraRunArgs = extraRunArgs;
    }

    public async Task<string> SendAsync(string userPrompt, CancellationToken cancellationToken = default)
    {
        var prompt = BuildPrompt(userPrompt);
        var args = new List<string> { "run", model };
        args.AddRange(extraRunArgs);
        args.Add(prompt);

        var result = await OllamaCommandRunner.RunCaptureAsync(args, cancellationToken);
        if (result.ExitCode != 0)
        {
            throw new OllamaCliException($"`ollama run {model}` failed with exit code {result.ExitCode}.{Environment.NewLine}{result.StandardError}");
        }

        var response = result.StandardOutput.Trim();
        history.Add(new ChatTurn("User", userPrompt.Trim()));
        history.Add(new ChatTurn("Assistant", response));
        return response;
    }

    public string ClearHistory()
    {
        history.Clear();
        return "Cleared this wrapper session's transcript.";
    }

    private string BuildPrompt(string userPrompt)
    {
        if (history.Count == 0)
        {
            return userPrompt;
        }

        var prompt = new StringBuilder();
        prompt.AppendLine("You are continuing an ongoing chat session.");
        prompt.AppendLine("Use the prior transcript for context, but answer only the latest user message.");
        prompt.AppendLine();
        prompt.AppendLine("Prior transcript:");

        foreach (var turn in history)
        {
            prompt.AppendLine($"{turn.Role}:");
            prompt.AppendLine(turn.Content);
            prompt.AppendLine();
        }

        prompt.AppendLine("Latest user message:");
        prompt.AppendLine(userPrompt);

        return prompt.ToString();
    }

    private sealed record ChatTurn(string Role, string Content);
}
