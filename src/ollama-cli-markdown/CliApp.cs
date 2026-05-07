namespace OllamaCliMarkdown;

internal static class CliApp
{
    public static async Task<int> RunAsync(string[] args)
    {
        Console.OutputEncoding = System.Text.Encoding.UTF8;
        Console.InputEncoding = System.Text.Encoding.UTF8;

        if (args.Length > 0)
        {
            return await RunCommandLineAsync(args);
        }

        return await RunShellAsync();
    }

    private static async Task<int> RunCommandLineAsync(IReadOnlyList<string> args)
    {
        if (IsHelp(args[0]))
        {
            PrintHelp();
            return 0;
        }

        if (IsChatCommand(args[0]))
        {
            var model = args.Count > 1 ? args[1] : PromptForModel();
            if (string.IsNullOrWhiteSpace(model))
            {
                Console.Error.WriteLine("A model name is required for chat mode.");
                return 1;
            }

            var extraRunArgs = args.Skip(2).ToArray();
            return await RunChatModeAsync(model, extraRunArgs);
        }

        return await OllamaCommandRunner.RunRawAsync(args);
    }

    private static async Task<int> RunShellAsync()
    {
        Console.WriteLine(Ansi.Bold("Ollama CLI Markdown"));
        Console.WriteLine("Type `chat <model>` for Markdown-formatted chat mode.");
        Console.WriteLine("Type any regular Ollama command, such as `list` or `show llama3.2`, for raw passthrough output.");
        Console.WriteLine("Type `help` for commands or `exit` to quit.");
        Console.WriteLine();

        while (true)
        {
            Console.Write(Ansi.Cyan("ollama-md> "));
            var line = Console.ReadLine();

            if (line is null)
            {
                return 0;
            }

            var command = CommandLineSplitter.Split(line);
            if (command.Count == 0)
            {
                continue;
            }

            var verb = command[0];
            if (IsExitCommand(verb))
            {
                return 0;
            }

            if (IsHelp(verb))
            {
                PrintHelp();
                continue;
            }

            if (IsChatCommand(verb))
            {
                var model = command.Count > 1 ? command[1] : PromptForModel();
                if (string.IsNullOrWhiteSpace(model))
                {
                    Console.Error.WriteLine("A model name is required for chat mode.");
                    continue;
                }

                var extraRunArgs = command.Skip(2).ToArray();
                await RunChatModeAsync(model, extraRunArgs);
                continue;
            }

            var ollamaArgs = string.Equals(verb, "ollama", StringComparison.OrdinalIgnoreCase)
                ? command.Skip(1).ToArray()
                : command;

            await OllamaCommandRunner.RunRawAsync(ollamaArgs);
        }
    }

    private static async Task<int> RunChatModeAsync(string model, IReadOnlyList<string> extraRunArgs)
    {
        Console.WriteLine(Ansi.Dim($"Starting wrapper chat mode for `ollama run {model} <prompt>`. Assistant responses are rendered as Markdown in this mode only."));
        Console.WriteLine(Ansi.Dim("Use /exit to leave chat mode, /clear to clear this wrapper session's transcript, or /help for chat commands."));
        Console.WriteLine();

        try
        {
            var session = new OllamaChatSession(model, extraRunArgs);
            var renderer = new MarkdownConsoleRenderer();

            while (true)
            {
                Console.Write(Ansi.Green($"chat:{model}> "));
                var prompt = Console.ReadLine();

                if (prompt is null || IsExitCommand(prompt))
                {
                    return 0;
                }

                if (string.IsNullOrWhiteSpace(prompt))
                {
                    continue;
                }

                if (string.Equals(prompt, "/help", StringComparison.OrdinalIgnoreCase))
                {
                    PrintChatHelp();
                    continue;
                }

                if (string.Equals(prompt.Trim(), "/clear", StringComparison.OrdinalIgnoreCase))
                {
                    Console.WriteLine(session.ClearHistory());
                    Console.WriteLine();
                    continue;
                }

                Console.WriteLine(Ansi.Dim("Running ollama..."));
                var output = await session.SendAsync(prompt);
                renderer.Render(output);
                Console.WriteLine();
            }
        }
        catch (OllamaCliException exception)
        {
            Console.Error.WriteLine(exception.Message);
            return 1;
        }
    }

    private static string? PromptForModel()
    {
        Console.Write("Model name: ");
        return Console.ReadLine()?.Trim();
    }

    private static void PrintHelp()
    {
        Console.WriteLine(Ansi.Bold("Usage"));
        Console.WriteLine("  dotnet run --project .\\src\\ollama-cli-markdown -- chat <model>");
        Console.WriteLine("  dotnet run --project .\\src\\ollama-cli-markdown -- <ollama-command> [args]");
        Console.WriteLine("  dotnet run --project .\\src\\ollama-cli-markdown");
        Console.WriteLine();
        Console.WriteLine(Ansi.Bold("Examples"));
        Console.WriteLine("  chat qwen2.5:7b       Starts formatted chat mode.");
        Console.WriteLine("  list                  Runs `ollama list` with raw output.");
        Console.WriteLine("  show qwen2.5:7b       Runs `ollama show qwen2.5:7b` with raw output.");
        Console.WriteLine("  ollama list           Also runs `ollama list` with raw output in app shell mode.");
        Console.WriteLine();
        Console.WriteLine("Only chat mode renders model responses as Markdown. Regular Ollama commands are passed through unchanged.");
    }

    private static void PrintChatHelp()
    {
        Console.WriteLine(Ansi.Bold("Chat mode commands"));
        Console.WriteLine("  /exit    Leave chat mode.");
        Console.WriteLine("  /clear   Clear this wrapper session's transcript.");
        Console.WriteLine("  /help    Show this help.");
        Console.WriteLine();
    }

    private static bool IsHelp(string value)
    {
        return string.Equals(value, "help", StringComparison.OrdinalIgnoreCase)
            || string.Equals(value, "--help", StringComparison.OrdinalIgnoreCase)
            || string.Equals(value, "-h", StringComparison.OrdinalIgnoreCase)
            || string.Equals(value, "/?", StringComparison.OrdinalIgnoreCase);
    }

    private static bool IsChatCommand(string value)
    {
        return string.Equals(value, "chat", StringComparison.OrdinalIgnoreCase);
    }

    private static bool IsExitCommand(string value)
    {
        return string.Equals(value.Trim(), "exit", StringComparison.OrdinalIgnoreCase)
            || string.Equals(value.Trim(), "quit", StringComparison.OrdinalIgnoreCase)
            || string.Equals(value.Trim(), "/exit", StringComparison.OrdinalIgnoreCase)
            || string.Equals(value.Trim(), "/quit", StringComparison.OrdinalIgnoreCase)
            || string.Equals(value.Trim(), "/bye", StringComparison.OrdinalIgnoreCase);
    }

}
