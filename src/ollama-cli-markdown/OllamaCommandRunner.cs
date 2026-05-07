using System.ComponentModel;
using System.Diagnostics;
using System.Text;

namespace OllamaCliMarkdown;

internal static class OllamaCommandRunner
{
    public static async Task<int> RunRawAsync(IReadOnlyList<string> args)
    {
        if (args.Count == 0)
        {
            Console.Error.WriteLine("No Ollama command was provided.");
            return 1;
        }

        var startInfo = new ProcessStartInfo
        {
            FileName = "ollama",
            UseShellExecute = false
        };

        foreach (var arg in args)
        {
            startInfo.ArgumentList.Add(arg);
        }

        try
        {
            using var process = Process.Start(startInfo);
            if (process is null)
            {
                Console.Error.WriteLine("Failed to start ollama.");
                return 1;
            }

            await process.WaitForExitAsync();
            return process.ExitCode;
        }
        catch (Win32Exception)
        {
            Console.Error.WriteLine("Could not start `ollama`. Confirm Ollama is installed and available on PATH.");
            return 1;
        }
    }

    public static async Task<OllamaCommandResult> RunCaptureAsync(
        IReadOnlyList<string> args,
        CancellationToken cancellationToken = default)
    {
        if (args.Count == 0)
        {
            return new OllamaCommandResult(1, string.Empty, "No Ollama command was provided.");
        }

        var startInfo = new ProcessStartInfo
        {
            FileName = "ollama",
            UseShellExecute = false,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            StandardOutputEncoding = Encoding.UTF8,
            StandardErrorEncoding = Encoding.UTF8
        };

        foreach (var arg in args)
        {
            startInfo.ArgumentList.Add(arg);
        }

        try
        {
            using var process = Process.Start(startInfo);
            if (process is null)
            {
                return new OllamaCommandResult(1, string.Empty, "Failed to start ollama.");
            }

            var stdoutTask = process.StandardOutput.ReadToEndAsync(cancellationToken);
            var stderrTask = process.StandardError.ReadToEndAsync(cancellationToken);
            await process.WaitForExitAsync(cancellationToken);

            return new OllamaCommandResult(
                process.ExitCode,
                await stdoutTask,
                await stderrTask);
        }
        catch (Win32Exception)
        {
            return new OllamaCommandResult(
                1,
                string.Empty,
                "Could not start `ollama`. Confirm Ollama is installed and available on PATH.");
        }
    }
}

internal sealed record OllamaCommandResult(
    int ExitCode,
    string StandardOutput,
    string StandardError);
