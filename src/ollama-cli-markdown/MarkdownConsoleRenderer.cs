using System.Text.RegularExpressions;

namespace OllamaCliMarkdown;

internal sealed partial class MarkdownConsoleRenderer
{
    public void Render(string markdown)
    {
        var lines = markdown.ReplaceLineEndings("\n").Split('\n');
        var inCodeBlock = false;
        var codeLanguage = string.Empty;

        foreach (var rawLine in lines)
        {
            var line = rawLine.TrimEnd();

            if (line.StartsWith("```", StringComparison.Ordinal))
            {
                inCodeBlock = !inCodeBlock;
                if (inCodeBlock)
                {
                    codeLanguage = line[3..].Trim();
                    Console.WriteLine(Ansi.Dim($"┌─ code{(string.IsNullOrWhiteSpace(codeLanguage) ? string.Empty : $" ({codeLanguage})")}"));
                }
                else
                {
                    Console.WriteLine(Ansi.Dim("└─"));
                    codeLanguage = string.Empty;
                }

                continue;
            }

            if (inCodeBlock)
            {
                Console.WriteLine($"{Ansi.Dim("│")} {line}");
                continue;
            }

            if (string.IsNullOrWhiteSpace(line))
            {
                Console.WriteLine();
                continue;
            }

            var heading = HeadingRegex().Match(line);
            if (heading.Success)
            {
                var level = heading.Groups["level"].Value.Length;
                var marker = new string('#', level);
                Console.WriteLine($"{Ansi.Cyan(marker)} {Ansi.Bold(FormatInline(heading.Groups["text"].Value))}");
                continue;
            }

            var quote = QuoteRegex().Match(line);
            if (quote.Success)
            {
                Console.WriteLine(Ansi.Dim($"│ {FormatInline(quote.Groups["text"].Value)}"));
                continue;
            }

            var unordered = UnorderedListRegex().Match(line);
            if (unordered.Success)
            {
                Console.WriteLine($"{unordered.Groups["indent"].Value}• {FormatInline(unordered.Groups["text"].Value)}");
                continue;
            }

            var ordered = OrderedListRegex().Match(line);
            if (ordered.Success)
            {
                Console.WriteLine($"{ordered.Groups["indent"].Value}{Ansi.Cyan(ordered.Groups["number"].Value)} {FormatInline(ordered.Groups["text"].Value)}");
                continue;
            }

            if (TableSeparatorRegex().IsMatch(line))
            {
                Console.WriteLine(Ansi.Dim(line));
                continue;
            }

            if (line.TrimStart().StartsWith('|'))
            {
                Console.WriteLine(Ansi.Magenta(FormatInline(line)));
                continue;
            }

            Console.WriteLine(FormatInline(line));
        }
    }

    private static string FormatInline(string text)
    {
        text = LinkRegex().Replace(text, match =>
        {
            var label = match.Groups["label"].Value;
            var url = match.Groups["url"].Value;
            return $"{Ansi.Underline(label)} {Ansi.Dim($"({url})")}";
        });

        text = InlineCodeRegex().Replace(text, match => Ansi.Yellow(match.Groups["code"].Value));
        text = BoldRegex().Replace(text, match => Ansi.Bold(match.Groups["text"].Value));
        text = ItalicRegex().Replace(text, match => Ansi.Italic(match.Groups["text"].Value));

        return text;
    }

    [GeneratedRegex(@"^(?<level>#{1,6})\s+(?<text>.+)$")]
    private static partial Regex HeadingRegex();

    [GeneratedRegex(@"^>\s?(?<text>.*)$")]
    private static partial Regex QuoteRegex();

    [GeneratedRegex(@"^(?<indent>\s*)[-*+]\s+(?<text>.+)$")]
    private static partial Regex UnorderedListRegex();

    [GeneratedRegex(@"^(?<indent>\s*)(?<number>\d+[.)])\s+(?<text>.+)$")]
    private static partial Regex OrderedListRegex();

    [GeneratedRegex(@"^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$")]
    private static partial Regex TableSeparatorRegex();

    [GeneratedRegex(@"\[(?<label>[^\]]+)\]\((?<url>[^)]+)\)")]
    private static partial Regex LinkRegex();

    [GeneratedRegex(@"`(?<code>[^`]+)`")]
    private static partial Regex InlineCodeRegex();

    [GeneratedRegex(@"\*\*(?<text>.+?)\*\*")]
    private static partial Regex BoldRegex();

    [GeneratedRegex(@"(?<!\*)\*(?<text>[^*]+)\*(?!\*)")]
    private static partial Regex ItalicRegex();
}
