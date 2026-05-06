// Minimal Claude-Code-style agent in C++23.
//
// Wires together three pieces:
//
//   agent:llm    — HTTP client for Anthropic's Messages API
//   agent:tools  — registry of file I/O tools, sandboxed to the cwd
//   agent:loop   — the send / receive-tool-use / execute / repeat loop
//
// Needs ANTHROPIC_API_KEY set in the environment. Optional first arg is the
// workspace root (defaults to the current directory).

import std;
import agent;

auto main(int argc, char** argv) -> int
try
{
    auto apiKey = std::string{};
    if (auto env = std::getenv("ANTHROPIC_API_KEY"))
        apiKey = env;

    if (apiKey.empty())
    {
        std::println(std::cerr, "ANTHROPIC_API_KEY is not set.");
        return 1;
    }

    auto root = std::filesystem::path{ argc > 1 ? argv[1] : "." };
    root = std::filesystem::weakly_canonical(root);
    std::println("Workspace root: {}", root.string());

    auto cfg = agent::llm::Config{ .ApiKey = std::move(apiKey) };
    auto registry = agent::tools::BuildDefaultRegistry(root);

    agent::Repl(cfg, registry);
    return 0;
}
catch (const std::exception& ex)
{
    std::println(std::cerr, "fatal: {}", ex.what());
    return 1;
}
