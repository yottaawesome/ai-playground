using System.Text;

namespace OllamaCliMarkdown;

internal static class CommandLineSplitter
{
    public static IReadOnlyList<string> Split(string commandLine)
    {
        var args = new List<string>();
        var current = new StringBuilder();
        var inQuotes = false;

        for (var index = 0; index < commandLine.Length; index++)
        {
            var character = commandLine[index];

            if (character == '"')
            {
                inQuotes = !inQuotes;
                continue;
            }

            if (character == '\\' && index + 1 < commandLine.Length && commandLine[index + 1] == '"')
            {
                current.Append('"');
                index++;
                continue;
            }

            if (char.IsWhiteSpace(character) && !inQuotes)
            {
                AddCurrent(args, current);
                continue;
            }

            current.Append(character);
        }

        AddCurrent(args, current);
        return args;
    }

    private static void AddCurrent(List<string> args, StringBuilder current)
    {
        if (current.Length == 0)
        {
            return;
        }

        args.Add(current.ToString());
        current.Clear();
    }
}
