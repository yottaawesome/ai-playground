// The agent loop itself.
//
// Pseudocode:
//
//   loop forever:
//       response = LLM.send(system, messages, tools)
//       append response.content as an assistant message
//
//       if response.stop_reason == "tool_use":
//           for each tool_use block in response.content:
//               result = tools.call(block.name, block.input)
//               collect a tool_result block referencing block.id
//           append a user message whose content is the list of tool_results
//           continue       # let the model see the results
//
//       else:   # "end_turn" / "stop_sequence" / "max_tokens" ...
//           print any text blocks
//           break          # hand control back to the human
//
// That's the whole thing. Everything else — plan mode, sub-agents, memory
// files, context compaction — is layered on top of this core.

module;

#include <nlohmann/json.hpp>

export module agent:loop;

import std;
import :llm;
import :tools;

export namespace agent
{
    using Json = nlohmann::json;

    inline constexpr std::string_view DefaultSystemPrompt =
        "You are a concise coding assistant running in a terminal. "
        "You have access to tools for reading, listing, and writing files "
        "in the user's workspace. Prefer making tool calls over guessing. "
        "When you're done, reply with a short summary and stop.";

    // Run a single turn: user message -> (tool calls)* -> final assistant text.
    // Mutates `messages` so subsequent turns see the full history.
    inline void RunTurn(
        const llm::Config& cfg,
        tools::Registry& registry,
        std::string_view systemPrompt,
        Json& messages,
        const std::string& userInput
    )
    {
        messages.push_back({
            { "role", "user" },
            { "content", userInput },
        });

        const auto toolSpecs = registry.Specs();

        while (true)
        {
            auto response = llm::SendMessage(cfg, std::string{ systemPrompt }, messages, toolSpecs);

            const auto& contentBlocks = response.at("content");
            messages.push_back({
                { "role", "assistant" },
                { "content", contentBlocks },
            });

            // Print any user-visible text from this step.
            for (const auto& block : contentBlocks)
            {
                if (block.value("type", "") == "text")
                    std::println("{}", block.value("text", ""));
            }

            const auto stopReason = response.value("stop_reason", "");
            if (stopReason != "tool_use")
                return;

            // Execute each tool_use block and build a matching user turn
            // containing tool_result blocks.
            auto toolResults = Json::array();
            for (const auto& block : contentBlocks)
            {
                if (block.value("type", "") != "tool_use")
                    continue;

                const auto id   = block.at("id").get<std::string>();
                const auto name = block.at("name").get<std::string>();
                const auto& input = block.at("input");

                std::println("  [tool] {} {}", name, input.dump());
                auto result = registry.Call(name, input);

                toolResults.push_back({
                    { "type", "tool_result" },
                    { "tool_use_id", id },
                    { "content", result.dump() },
                });
            }

            messages.push_back({
                { "role", "user" },
                { "content", toolResults },
            });
            // Loop again so the model can react to the tool output.
        }
    }

    // Simple interactive REPL — one user line per turn.
    inline void Repl(
        const llm::Config& cfg,
        tools::Registry& registry,
        std::string_view systemPrompt = DefaultSystemPrompt
    )
    {
        auto messages = Json::array();
        std::println("agent-loop ready. Type 'exit' to quit.");
        for (;;)
        {
            std::print("\nyou> ");
            auto line = std::string{};
            if (not std::getline(std::cin, line))
                break;
            if (line == "exit" or line == "quit")
                break;
            if (line.empty())
                continue;

            try
            {
                RunTurn(cfg, registry, systemPrompt, messages, line);
            }
            catch (const std::exception& ex)
            {
                std::println(std::cerr, "error: {}", ex.what());
            }
        }
    }
}
