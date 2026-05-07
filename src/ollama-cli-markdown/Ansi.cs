namespace OllamaCliMarkdown;

internal static class Ansi
{
    public static bool IsEnabled { get; } = !Console.IsOutputRedirected;

    public static string Bold(string value) => Wrap("1", value);

    public static string Dim(string value) => Wrap("2", value);

    public static string Italic(string value) => Wrap("3", value);

    public static string Underline(string value) => Wrap("4", value);

    public static string Cyan(string value) => Wrap("36", value);

    public static string Green(string value) => Wrap("32", value);

    public static string Magenta(string value) => Wrap("35", value);

    public static string Yellow(string value) => Wrap("33", value);

    private static string Wrap(string code, string value)
    {
        return IsEnabled ? $"\u001b[{code}m{value}\u001b[0m" : value;
    }
}
