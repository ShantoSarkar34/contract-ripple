import { describe, expect, it } from "vitest";
import {
  GitHubError,
  fetchGitHubSource,
  parseGitHubRepository,
  type GitHubFetch,
} from "./github.js";

const BASE = "https://api.github.test";
const REPO_URL = `${BASE}/repos/octo/pets`;
const COMMIT_URL = `${REPO_URL}/commits/main`;
const TREE_URL = `${REPO_URL}/git/trees/commit-1?recursive=1`;
const blobUrl = (sha: string) => `${REPO_URL}/git/blobs/${sha}`;

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function createFetch(
  routes: Record<string, () => Response>,
): { fetchImpl: GitHubFetch; calls: string[]; authorizations: string[] } {
  const calls: string[] = [];
  const authorizations: string[] = [];
  const fetchImpl: GitHubFetch = async (url, init) => {
    calls.push(url);
    const headers = new Headers(init?.headers);
    authorizations.push(headers.get("authorization") ?? "");
    const handler = routes[url];
    return handler ? handler() : json({ message: "not found" }, 404);
  };
  return { fetchImpl, calls, authorizations };
}

const blob = (content: string) =>
  json({ content: Buffer.from(content, "utf8").toString("base64"), encoding: "base64" });

function standardRoutes(): Record<string, () => Response> {
  return {
    [REPO_URL]: () => json({ default_branch: "main", full_name: "octo/pets" }),
    [COMMIT_URL]: () => json({ sha: "commit-1" }),
    [TREE_URL]: () =>
      json({
        tree: [
          { path: "src/api.ts", type: "blob", size: 15, sha: "blob-1" },
          { path: "src/component.tsx", type: "blob", size: 20, sha: "blob-2" },
          { path: "node_modules/pkg/index.ts", type: "blob", size: 10, sha: "blob-3" },
          { path: "README.md", type: "blob", size: 10, sha: "blob-4" },
          { path: "src", type: "tree", sha: "tree-1" },
        ],
      }),
    [blobUrl("blob-1")]: () => blob(`fetch("/pets");`),
    [blobUrl("blob-2")]: () => blob(`export const x = 1;`),
  };
}

describe("parseGitHubRepository", () => {
  it("accepts owner/name and github.com URL forms", () => {
    expect(parseGitHubRepository("octo/pets")).toEqual({ owner: "octo", repo: "pets" });
    expect(parseGitHubRepository("https://github.com/octo/pets")).toEqual({
      owner: "octo",
      repo: "pets",
    });
    expect(parseGitHubRepository("https://github.com/octo/pets.git")).toEqual({
      owner: "octo",
      repo: "pets",
    });
  });

  it("rejects malformed and unsafe repository names", () => {
    expect(parseGitHubRepository("")).toBeNull();
    expect(parseGitHubRepository("pets")).toBeNull();
    expect(parseGitHubRepository("octo/pets/extra")).toBeNull();
    expect(parseGitHubRepository("../pets")).toBeNull();
    expect(parseGitHubRepository("octo/..")).toBeNull();
  });
});

describe("fetchGitHubSource", () => {
  it("fetches supported blobs with an authenticated official API request", async () => {
    const { fetchImpl, calls, authorizations } = createFetch(standardRoutes());

    const result = await fetchGitHubSource({
      repository: "octo/pets",
      token: "secret-token",
      apiBaseUrl: BASE,
      fetchImpl,
    });

    expect(result.repository).toBe("octo/pets");
    expect(result.ref).toBe("main");
    expect(result.files.map((file) => file.path).sort()).toEqual([
      "src/api.ts",
      "src/component.tsx",
    ]);
    expect(result.files.find((file) => file.path === "src/api.ts")?.content).toContain("fetch");
    expect(result.skipped).toContainEqual({
      path: "node_modules/pkg/index.ts",
      reason: "ignored_directory",
    });
    expect(result.totalBytes).toBe(
      [...result.files].reduce((sum, file) => sum + Buffer.byteLength(file.content), 0),
    );
    expect(calls).not.toContain(blobUrl("blob-3"));
    expect(calls).not.toContain(blobUrl("blob-4"));
    expect(authorizations.every((value) => value === "Bearer secret-token")).toBe(true);
  });

  it("uses an explicit ref when provided", async () => {
    const routes = standardRoutes();
    routes[`${REPO_URL}/commits/release%2F1.2`] = () => json({ sha: "commit-1" });
    const { fetchImpl } = createFetch(routes);

    const result = await fetchGitHubSource({
      repository: "octo/pets",
      ref: "release/1.2",
      token: "secret-token",
      apiBaseUrl: BASE,
      fetchImpl,
    });

    expect(result.ref).toBe("release/1.2");
  });

  it("refuses to run without a token instead of faking a connection", async () => {
    await expect(
      fetchGitHubSource({ repository: "octo/pets", token: "  ", apiBaseUrl: BASE }),
    ).rejects.toMatchObject({ code: "github_not_configured" });
  });

  it("rejects an invalid repository before making requests", async () => {
    const { fetchImpl, calls } = createFetch({});

    await expect(
      fetchGitHubSource({ repository: "not-a-repo", token: "token", fetchImpl }),
    ).rejects.toMatchObject({ code: "github_invalid_repository" });
    expect(calls).toHaveLength(0);
  });

  it("maps authentication, permission, rate-limit, and missing-repository failures", async () => {
    const cases: Array<{
      response: () => Response;
      code: string;
    }> = [
      { response: () => json({ message: "Bad credentials" }, 401), code: "github_unauthorized" },
      { response: () => json({ message: "Forbidden" }, 403), code: "github_forbidden" },
      {
        response: () =>
          json(
            { message: "API rate limit exceeded" },
            403,
            {
              "x-ratelimit-remaining": "0",
              "x-ratelimit-reset": "1893456000",
            },
          ),
        code: "github_rate_limited",
      },
      { response: () => json({ message: "Not Found" }, 404), code: "github_not_found" },
    ];

    for (const testCase of cases) {
      const { fetchImpl } = createFetch({ [REPO_URL]: testCase.response });
      await expect(
        fetchGitHubSource({
          repository: "octo/pets",
          token: "token",
          apiBaseUrl: BASE,
          fetchImpl,
        }),
      ).rejects.toMatchObject({ code: testCase.code });
    }
  });

  it("reports truncated trees and skipped blob failures without failing the analysis", async () => {
    const routes: Record<string, () => Response> = {
      [REPO_URL]: () => json({ default_branch: "main" }),
      [COMMIT_URL]: () => json({ sha: "commit-1" }),
      [TREE_URL]: () =>
        json({
          truncated: true,
          tree: [
            { path: "src/ok.ts", type: "blob", size: 5, sha: "ok" },
            { path: "src/fail.ts", type: "blob", size: 5, sha: "fail" },
          ],
        }),
      [blobUrl("ok")]: () => blob(`fetch("/pets");`),
      [blobUrl("fail")]: () => json({ message: "Server error" }, 500),
    };
    const { fetchImpl } = createFetch(routes);

    const result = await fetchGitHubSource({
      repository: "octo/pets",
      token: "token",
      apiBaseUrl: BASE,
      fetchImpl,
    });

    expect(result.files.map((file) => file.path)).toEqual(["src/ok.ts"]);
    expect(result.skipped).toContainEqual({ path: "src/fail.ts", reason: "fetch_failed" });
    expect(result.limitations.join(" ")).toContain("truncated");
    expect(result.limitations.join(" ")).toContain("could not be fetched");
  });

  it("wraps network failures in a safe error", async () => {
    const fetchImpl: GitHubFetch = async () => {
      throw new Error("socket closed for secret-token");
    };

    await expect(
      fetchGitHubSource({
        repository: "octo/pets",
        token: "secret-token",
        apiBaseUrl: BASE,
        fetchImpl,
      }),
    ).rejects.toBeInstanceOf(GitHubError);
  });

  it("propagates time-limit failures instead of reporting partial success", async () => {
    const routes = standardRoutes();
    routes[blobUrl("blob-1")] = () => {
      throw new GitHubError("github_timeout", "GitHub source analysis exceeded the time limit.");
    };
    const { fetchImpl } = createFetch(routes);

    await expect(
      fetchGitHubSource({
        repository: "octo/pets",
        token: "token",
        apiBaseUrl: BASE,
        fetchImpl,
      }),
    ).rejects.toMatchObject({ code: "github_timeout" });
  });
});
