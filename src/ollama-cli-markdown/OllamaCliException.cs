namespace OllamaCliMarkdown;

internal sealed class OllamaCliException : Exception
{
    public OllamaCliException(string message)
        : base(message)
    {
    }

    public OllamaCliException(string message, Exception innerException)
        : base(message, innerException)
    {
    }
}
