using System.Text.RegularExpressions;

namespace OllamaCliMarkdown;

internal sealed partial class MarkdownConsoleRenderer
{
    public void Render(string markdown)
    {
        foreach (var segment in SplitThinkingSegments(markdown))
        {
            if (segment.IsThinking)
            {
                RenderThinking(segment.Text);
            }
            else
            {
                RenderMarkdown(segment.Text);
            }
        }
    }

    private static IEnumerable<RenderSegment> SplitThinkingSegments(string markdown)
    {
        var index = 0;

        while (index < markdown.Length)
        {
            var thinkTagStart = markdown.IndexOf("<think>", index, StringComparison.OrdinalIgnoreCase);
            var thinkingStart = markdown.IndexOf("Thinking...", index, StringComparison.OrdinalIgnoreCase);
            var start = MinPositive(thinkTagStart, thinkingStart);

            if (start < 0)
            {
                yield return new RenderSegment(markdown[index..], IsThinking: false);
                yield break;
            }

            if (start > index)
            {
                yield return new RenderSegment(markdown[index..start], IsThinking: false);
            }

            if (start == thinkTagStart)
            {
                var contentStart = start + "<think>".Length;
                var end = markdown.IndexOf("</think>", contentStart, StringComparison.OrdinalIgnoreCase);
                if (end < 0)
                {
                    yield return new RenderSegment(markdown[contentStart..], IsThinking: true);
                    yield break;
                }

                yield return new RenderSegment(markdown[contentStart..end], IsThinking: true);
                index = end + "</think>".Length;
            }
            else
            {
                var endMatch = DoneThinkingRegex().Match(markdown, start);
                if (!endMatch.Success)
                {
                    yield return new RenderSegment(markdown[start..], IsThinking: true);
                    yield break;
                }

                var end = endMatch.Index + endMatch.Length;
                yield return new RenderSegment(markdown[start..end], IsThinking: true);
                index = end;
            }
        }
    }

    private static void RenderThinking(string markdown)
    {
        var lines = markdown.ReplaceLineEndings("\n").Split('\n');

        foreach (var rawLine in lines)
        {
            var line = rawLine.TrimEnd();
            Console.WriteLine(string.IsNullOrWhiteSpace(line) ? string.Empty : Ansi.Thinking(line));
        }
    }

    private static void RenderMarkdown(string markdown)
    {
        var lines = markdown.ReplaceLineEndings("\n")
            .Split('\n')
            .Select(line => line.TrimEnd())
            .ToArray();
        var inCodeBlock = false;
        var codeLanguage = string.Empty;

        for (var lineIndex = 0; lineIndex < lines.Length; lineIndex++)
        {
            var line = lines[lineIndex];

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

            if (TryReadTable(lines, lineIndex, out var table, out var consumedLines))
            {
                RenderTable(table);
                lineIndex += consumedLines - 1;
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

            Console.WriteLine(FormatInline(line));
        }
    }

    private static int MinPositive(int first, int second)
    {
        return (first, second) switch
        {
            (< 0, < 0) => -1,
            (< 0, _) => second,
            (_, < 0) => first,
            _ => Math.Min(first, second)
        };
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

    private static bool TryReadTable(
        IReadOnlyList<string> lines,
        int startIndex,
        out MarkdownTable table,
        out int consumedLines)
    {
        table = new MarkdownTable([], [], []);
        consumedLines = 0;

        if (startIndex + 1 >= lines.Count)
        {
            return false;
        }

        var header = ParseTableCells(lines[startIndex]);
        var alignments = ParseSeparatorCells(lines[startIndex + 1]);
        if (header.Count < 2 || alignments.Count < 2)
        {
            return false;
        }

        var rows = new List<IReadOnlyList<string>>();
        var lineIndex = startIndex + 2;

        while (lineIndex < lines.Count && LooksLikeTableRow(lines[lineIndex]))
        {
            rows.Add(ParseTableCells(lines[lineIndex]));
            lineIndex++;
        }

        table = new MarkdownTable(header, alignments, rows);
        consumedLines = lineIndex - startIndex;
        return true;
    }

    private static bool LooksLikeTableRow(string line)
    {
        return !string.IsNullOrWhiteSpace(line)
            && !line.TrimStart().StartsWith("```", StringComparison.Ordinal)
            && ParseTableCells(line).Count >= 2;
    }

    private static IReadOnlyList<string> ParseTableCells(string line)
    {
        var trimmed = line.Trim();
        if (trimmed.StartsWith('|'))
        {
            trimmed = trimmed[1..];
        }

        if (trimmed.EndsWith('|'))
        {
            trimmed = trimmed[..^1];
        }

        var cells = new List<string>();
        var current = new List<char>();
        var inCodeSpan = false;

        for (var index = 0; index < trimmed.Length; index++)
        {
            var character = trimmed[index];
            if (character == '`')
            {
                inCodeSpan = !inCodeSpan;
                current.Add(character);
                continue;
            }

            if (character == '|' && !inCodeSpan)
            {
                cells.Add(new string([.. current]).Replace("\\|", "|").Trim());
                current.Clear();
                continue;
            }

            current.Add(character);
        }

        cells.Add(new string([.. current]).Replace("\\|", "|").Trim());
        return cells;
    }

    private static IReadOnlyList<TableAlignment> ParseSeparatorCells(string line)
    {
        var cells = ParseTableCells(line);
        if (cells.Count < 2 || cells.Any(cell => !SeparatorCellRegex().IsMatch(cell)))
        {
            return [];
        }

        return cells.Select(cell =>
        {
            var trimmed = cell.Trim();
            return (trimmed.StartsWith(':'), trimmed.EndsWith(':')) switch
            {
                (true, true) => TableAlignment.Center,
                (false, true) => TableAlignment.Right,
                _ => TableAlignment.Left
            };
        }).ToList();
    }

    private static void RenderTable(MarkdownTable table)
    {
        var columnCount = new[] { table.Header.Count, table.Alignments.Count }
            .Concat(table.Rows.Select(row => row.Count))
            .Max();

        var alignments = NormalizeAlignments(table.Alignments, columnCount);
        var header = NormalizeRow(table.Header, columnCount)
            .Select(cell => Ansi.Bold(FormatInline(cell)))
            .ToList();
        var rows = table.Rows
            .Select(row => NormalizeRow(row, columnCount).Select(FormatInline).ToList())
            .ToList();
        var widths = Enumerable.Range(0, columnCount)
            .Select(column =>
            {
                var headerWidth = VisibleLength(header[column]);
                var rowWidth = rows.Count == 0 ? 0 : rows.Max(row => VisibleLength(row[column]));
                return Math.Max(3, Math.Max(headerWidth, rowWidth));
            })
            .ToArray();

        Console.WriteLine(RenderTableRow(header, widths, alignments));
        Console.WriteLine(Ansi.Dim(RenderTableSeparator(widths, alignments)));

        foreach (var row in rows)
        {
            Console.WriteLine(RenderTableRow(row, widths, alignments));
        }
    }

    private static IReadOnlyList<string> NormalizeRow(IReadOnlyList<string> row, int columnCount)
    {
        return Enumerable.Range(0, columnCount)
            .Select(index => index < row.Count ? row[index] : string.Empty)
            .ToList();
    }

    private static IReadOnlyList<TableAlignment> NormalizeAlignments(
        IReadOnlyList<TableAlignment> alignments,
        int columnCount)
    {
        return Enumerable.Range(0, columnCount)
            .Select(index => index < alignments.Count ? alignments[index] : TableAlignment.Left)
            .ToList();
    }

    private static string RenderTableRow(
        IReadOnlyList<string> cells,
        IReadOnlyList<int> widths,
        IReadOnlyList<TableAlignment> alignments)
    {
        var paddedCells = cells.Select((cell, index) => PadCell(cell, widths[index], alignments[index]));
        return $"| {string.Join(" | ", paddedCells)} |";
    }

    private static string RenderTableSeparator(
        IReadOnlyList<int> widths,
        IReadOnlyList<TableAlignment> alignments)
    {
        var cells = widths.Select((width, index) =>
        {
            var dashes = new string('-', width);
            return alignments[index] switch
            {
                TableAlignment.Center => $":{dashes[1..^1]}:",
                TableAlignment.Right => $"{dashes[..^1]}:",
                _ => dashes
            };
        });

        return $"| {string.Join(" | ", cells)} |";
    }

    private static string PadCell(string value, int width, TableAlignment alignment)
    {
        var padding = Math.Max(0, width - VisibleLength(value));
        return alignment switch
        {
            TableAlignment.Right => $"{new string(' ', padding)}{value}",
            TableAlignment.Center => $"{new string(' ', padding / 2)}{value}{new string(' ', padding - padding / 2)}",
            _ => $"{value}{new string(' ', padding)}"
        };
    }

    private static int VisibleLength(string value)
    {
        return AnsiEscapeRegex().Replace(value, string.Empty).Length;
    }

    [GeneratedRegex(@"^(?<level>#{1,6})\s+(?<text>.+)$")]
    private static partial Regex HeadingRegex();

    [GeneratedRegex(@"^>\s?(?<text>.*)$")]
    private static partial Regex QuoteRegex();

    [GeneratedRegex(@"^(?<indent>\s*)[-*+]\s+(?<text>.+)$")]
    private static partial Regex UnorderedListRegex();

    [GeneratedRegex(@"^(?<indent>\s*)(?<number>\d+[.)])\s+(?<text>.+)$")]
    private static partial Regex OrderedListRegex();

    [GeneratedRegex(@"\.\.\.done thinking\.?", RegexOptions.IgnoreCase)]
    private static partial Regex DoneThinkingRegex();

    [GeneratedRegex(@"^:?-{3,}:?$")]
    private static partial Regex SeparatorCellRegex();

    [GeneratedRegex(@"\[(?<label>[^\]]+)\]\((?<url>[^)]+)\)")]
    private static partial Regex LinkRegex();

    [GeneratedRegex(@"`(?<code>[^`]+)`")]
    private static partial Regex InlineCodeRegex();

    [GeneratedRegex(@"\*\*(?<text>.+?)\*\*")]
    private static partial Regex BoldRegex();

    [GeneratedRegex(@"(?<!\*)\*(?<text>[^*]+)\*(?!\*)")]
    private static partial Regex ItalicRegex();

    [GeneratedRegex(@"\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])")]
    private static partial Regex AnsiEscapeRegex();

    private sealed record RenderSegment(string Text, bool IsThinking);

    private sealed record MarkdownTable(
        IReadOnlyList<string> Header,
        IReadOnlyList<TableAlignment> Alignments,
        IReadOnlyList<IReadOnlyList<string>> Rows);

    private enum TableAlignment
    {
        Left,
        Center,
        Right
    }
}
