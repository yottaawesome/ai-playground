using Markdig;
using Microsoft.AspNetCore.Components;

namespace OllamaCsharpWeb.Services;

public sealed class MarkdownFormatter
{
    private readonly MarkdownPipeline pipeline = new MarkdownPipelineBuilder()
        .UseAdvancedExtensions()
        .DisableHtml()
        .Build();

    public MarkupString ToMarkup(string markdown)
    {
        return new MarkupString(Markdown.ToHtml(markdown, pipeline));
    }
}
