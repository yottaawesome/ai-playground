// Thin client for Anthropic's Messages API — the "brains" end of the agent.
// https://docs.anthropic.com/en/api/messages
//
// Deliberately minimal: one function, one POST, no streaming, no retries,
// no rate-limit backoff. Real products layer all of that on top.

module;

#include <cpr/cpr.h>
#include <nlohmann/json.hpp>

export module agent:llm;

import std;

export namespace agent::llm
{
    using Json = nlohmann::json;

    struct Config
    {
        std::string ApiKey;
        std::string Model = "claude-sonnet-4-5";
        std::string Endpoint = "https://api.anthropic.com/v1/messages";
        std::string AnthropicVersion = "2023-06-01";
        int MaxTokens = 4096;
    };

    // Sends a Messages request. `messages` is the full conversation so far;
    // `tools` is the JSON array of tool specs the model may call.
    // Returns the decoded JSON response (or throws on transport/parse errors).
    auto SendMessage(
        const Config& cfg,
        const std::string& systemPrompt,
        const Json& messages,
        const Json& tools
    ) -> Json
    {
        auto body = Json{
            { "model", cfg.Model },
            { "max_tokens", cfg.MaxTokens },
            { "system", systemPrompt },
            { "messages", messages },
            { "tools", tools },
        };

        auto response = cpr::Post(
            cpr::Url{ cfg.Endpoint },
            cpr::Header{
                { "x-api-key", cfg.ApiKey },
                { "anthropic-version", cfg.AnthropicVersion },
                { "content-type", "application/json" },
            },
            cpr::Body{ body.dump() },
            cpr::Timeout{ std::chrono::seconds{ 120 } }
        );

        if (response.status_code == 0)
            throw std::runtime_error("Network error: " + response.error.message);

        if (response.status_code < 200 or response.status_code >= 300)
            throw std::runtime_error(
                std::format("Anthropic API {}: {}", response.status_code, response.text)
            );

        return Json::parse(response.text);
    }
}
