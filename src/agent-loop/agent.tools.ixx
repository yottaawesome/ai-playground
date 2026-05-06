// Tool registry — the "hands" end of the agent.
//
// Each tool has:
//   * a name the model uses to call it
//   * a human description (this is how the model learns when to use it)
//   * a JSON schema describing inputs (enforced loosely by the model)
//   * an Invoke function that turns JSON input into JSON output
//
// Anything that takes a path is sandboxed to a root directory so a runaway
// agent can't wander off into the filesystem. Real products add per-call
// approval prompts, read-only modes, allow/deny lists, etc.

module;

#include <nlohmann/json.hpp>

export module agent:tools;

import std;

export namespace agent::tools
{
    using Json = nlohmann::json;

    struct Tool
    {
        std::string Name;
        std::string Description;
        Json InputSchema;
        std::function<Json(const Json&)> Invoke;
    };

    class Registry
    {
    public:
        void Register(Tool t)
        {
            m_tools[t.Name] = std::move(t);
        }

        [[nodiscard]] auto Specs() const -> Json
        {
            auto arr = Json::array();
            for (const auto& [_, t] : m_tools)
            {
                arr.push_back({
                    { "name", t.Name },
                    { "description", t.Description },
                    { "input_schema", t.InputSchema },
                });
            }
            return arr;
        }

        [[nodiscard]] auto Call(const std::string& name, const Json& input) const -> Json
        {
            auto it = m_tools.find(name);
            if (it == m_tools.end())
                return Json{ { "error", std::format("Unknown tool '{}'.", name) } };
            try
            {
                return it->second.Invoke(input);
            }
            catch (const std::exception& ex)
            {
                return Json{ { "error", ex.what() } };
            }
        }

    private:
        std::unordered_map<std::string, Tool> m_tools;
    };

    namespace detail
    {
        // Resolve `rel` under `root`, rejecting attempts to escape via `..`
        // or absolute paths. Returns the resolved canonical path.
        inline auto SafeResolve(
            const std::filesystem::path& root,
            const std::string& rel
        ) -> std::filesystem::path
        {
            namespace fs = std::filesystem;
            auto joined = fs::weakly_canonical(root / rel);
            auto canonicalRoot = fs::weakly_canonical(root);

            auto r = canonicalRoot.string();
            auto j = joined.string();
            if (j.size() < r.size() or j.compare(0, r.size(), r) != 0)
                throw std::runtime_error("Path escapes sandbox root: " + rel);
            return joined;
        }
    }

    // Build the default set of built-in tools, all sandboxed to `root`.
    inline auto BuildDefaultRegistry(const std::filesystem::path& root) -> Registry
    {
        namespace fs = std::filesystem;
        auto reg = Registry{};

        reg.Register(Tool{
            .Name = "read_file",
            .Description =
                "Read a UTF-8 text file relative to the workspace root. "
                "Returns the full file contents. Use for small-to-medium files.",
            .InputSchema = {
                { "type", "object" },
                { "properties", {
                    { "path", { { "type", "string" }, { "description", "Path relative to workspace root" } } }
                }},
                { "required", Json::array({ "path" }) },
            },
            .Invoke = [root](const Json& in) -> Json
            {
                auto path = detail::SafeResolve(root, in.at("path").get<std::string>());
                auto stream = std::ifstream{ path, std::ios::binary };
                if (not stream)
                    throw std::runtime_error("Cannot open " + path.string());
                auto buf = std::stringstream{};
                buf << stream.rdbuf();
                return Json{ { "content", buf.str() } };
            },
        });

        reg.Register(Tool{
            .Name = "list_dir",
            .Description = "List entries in a directory relative to the workspace root.",
            .InputSchema = {
                { "type", "object" },
                { "properties", {
                    { "path", { { "type", "string" } } }
                }},
                { "required", Json::array({ "path" }) },
            },
            .Invoke = [root](const Json& in) -> Json
            {
                auto path = detail::SafeResolve(root, in.at("path").get<std::string>());
                if (not fs::is_directory(path))
                    throw std::runtime_error("Not a directory: " + path.string());

                auto entries = Json::array();
                for (const auto& e : fs::directory_iterator{ path })
                {
                    entries.push_back({
                        { "name", e.path().filename().string() },
                        { "is_dir", e.is_directory() },
                        { "size", e.is_regular_file() ? static_cast<std::uint64_t>(e.file_size()) : 0u },
                    });
                }
                return Json{ { "entries", entries } };
            },
        });

        reg.Register(Tool{
            .Name = "write_file",
            .Description =
                "Write UTF-8 text to a file relative to the workspace root. "
                "Overwrites any existing file. Creates parent directories as needed.",
            .InputSchema = {
                { "type", "object" },
                { "properties", {
                    { "path",    { { "type", "string" } } },
                    { "content", { { "type", "string" } } }
                }},
                { "required", Json::array({ "path", "content" }) },
            },
            .Invoke = [root](const Json& in) -> Json
            {
                auto path = detail::SafeResolve(root, in.at("path").get<std::string>());
                fs::create_directories(path.parent_path());
                auto stream = std::ofstream{ path, std::ios::binary | std::ios::trunc };
                if (not stream)
                    throw std::runtime_error("Cannot write " + path.string());
                auto content = in.at("content").get<std::string>();
                stream.write(content.data(), static_cast<std::streamsize>(content.size()));
                return Json{
                    { "ok", true },
                    { "bytes_written", content.size() },
                };
            },
        });

        return reg;
    }
}
