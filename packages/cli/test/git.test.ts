import { describe, expect, test } from "bun:test"
import { getWorktreeRoot, normalizeRepoPaths } from "../src/lib/config"
import { deriveRepoSlug, parseWorktreeList, resolveWorktreePath } from "../src/lib/git"

describe("deriveRepoSlug", () => {
  test("uses owner and repo from https remote", () => {
    expect(deriveRepoSlug("/tmp/opencode", "https://github.com/anomalyco/opencode.git")).toBe("anomalyco/opencode")
  })

  test("uses owner and repo from ssh remote", () => {
    expect(deriveRepoSlug("/tmp/opencode", "git@github.com:anomalyco/opencode.git")).toBe("anomalyco/opencode")
  })

  test("trims whitespace from remote URLs", () => {
    expect(deriveRepoSlug("/tmp/harbor", "https://github.com/VishalBilagi/harbor.git\n")).toBe("VishalBilagi/harbor")
  })

  test("falls back to local basename without origin", () => {
    expect(deriveRepoSlug("/tmp/opencode", null)).toBe("opencode")
  })
})

describe("resolveWorktreePath", () => {
  test("nests branch paths under repo slug", () => {
    expect(resolveWorktreePath("anomalyco/opencode", "feature/auth")).toBe(`${getWorktreeRoot()}/anomalyco/opencode/feature/auth`)
  })
})

describe("parseWorktreeList", () => {
  test("parses porcelain output", () => {
    const result = parseWorktreeList([
      "worktree /Users/me/src/opencode",
      "HEAD abc123",
      "branch refs/heads/main",
      "",
      "worktree /Users/me/.jet-worktrees/anomalyco/opencode/feature/auth",
      "HEAD def456",
      "branch refs/heads/feature/auth",
      "",
    ].join("\n"))

    expect(result).toHaveLength(2)
    expect(result[0]?.path).toBe("/Users/me/src/opencode")
    expect(result[0]?.branch).toBe("refs/heads/main")
    expect(result[1]?.branch).toBe("refs/heads/feature/auth")
  })

  test("parses nul-delimited porcelain output", () => {
    const result = parseWorktreeList([
      "worktree /Users/me/src/opencode",
      "HEAD abc123",
      "branch refs/heads/main",
      "",
      "worktree /Users/me/.jet-worktrees/VishalBilagi/harbor.git\n/feat/test",
      "HEAD def456",
      "branch refs/heads/feat/test",
      "",
    ].join("\u0000"))

    expect(result).toHaveLength(2)
    expect(result[1]?.path).toBe("/Users/me/.jet-worktrees/VishalBilagi/harbor.git\n/feat/test")
  })
})

describe("normalizeRepoPaths", () => {
  test("deduplicates and sorts", () => {
    const normalized = normalizeRepoPaths(["/tmp/b", "/tmp/a", "/tmp/b"])
    expect(normalized).toEqual(["/tmp/a", "/tmp/b"])
  })
})
