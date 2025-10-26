import { type NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    // Get the access token from the cookie
    const accessToken = request.cookies.get("github_access_token")?.value;

    if (!accessToken) {
      return NextResponse.json(
        { error: "Not authenticated with GitHub" },
        { status: 401 },
      );
    }

    // Get the files from the request body
    const body = await request.json();
    const { files, repoName, repoDescription, isPrivate = false } = body;

    if (!files || !repoName) {
      return NextResponse.json(
        { error: "Missing required fields: files and repoName" },
        { status: 400 },
      );
    }

    // Step 1: Get the authenticated user's info
    const userResponse = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!userResponse.ok) {
      return NextResponse.json(
        { error: "Failed to get user info from GitHub" },
        { status: 401 },
      );
    }

    const userData = (await userResponse.json()) as { login: string };
    const username = userData.login;

    // Step 2: Create a new repository with auto_init to get a default branch
    const createRepoResponse = await fetch(
      "https://api.github.com/user/repos",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: repoName,
          description: repoDescription || "Created with vibecheck",
          private: isPrivate,
          auto_init: true, // Initialize with README to create default branch
        }),
      },
    );

    if (!createRepoResponse.ok) {
      const errorData = await createRepoResponse.json();
      return NextResponse.json(
        {
          error: "Failed to create repository",
          details: errorData,
        },
        { status: createRepoResponse.status },
      );
    }

    const repoData = (await createRepoResponse.json()) as {
      name: string;
      html_url: string;
      default_branch: string;
    };

    // Wait a moment for GitHub to finish initializing the repository
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Step 3: Get the latest commit SHA (from the auto-initialized commit)
    const refResponse = await fetch(
      `https://api.github.com/repos/${username}/${repoName}/git/refs/heads/${repoData.default_branch || "main"}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github.v3+json",
        },
      },
    );

    if (!refResponse.ok) {
      return NextResponse.json(
        { error: "Failed to get repository reference" },
        { status: 500 },
      );
    }

    const refData = (await refResponse.json()) as {
      object: { sha: string };
    };
    const baseCommitSha = refData.object.sha;

    // Step 4: Get the tree SHA from the base commit
    const commitResponse = await fetch(
      `https://api.github.com/repos/${username}/${repoName}/git/commits/${baseCommitSha}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github.v3+json",
        },
      },
    );

    if (!commitResponse.ok) {
      return NextResponse.json(
        { error: "Failed to get base commit" },
        { status: 500 },
      );
    }

    const commitInfo = (await commitResponse.json()) as {
      tree: { sha: string };
    };
    const baseTreeSha = commitInfo.tree.sha;

    // Step 5: Create blobs for each file
    const blobs: { path: string; sha: string; mode: string }[] = [];

    for (const file of files) {
      const createBlobResponse = await fetch(
        `https://api.github.com/repos/${username}/${repoName}/git/blobs`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/vnd.github.v3+json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content: file.content,
            encoding: "utf-8",
          }),
        },
      );

      if (!createBlobResponse.ok) {
        console.error(
          `Failed to create blob for ${file.path}:`,
          await createBlobResponse.text(),
        );
        continue;
      }

      const blobData = (await createBlobResponse.json()) as { sha: string };
      blobs.push({
        path: file.path,
        sha: blobData.sha,
        mode: "100644", // regular file
      });
    }

    // Step 6: Create a new tree with all the files
    const createTreeResponse = await fetch(
      `https://api.github.com/repos/${username}/${repoName}/git/trees`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          base_tree: baseTreeSha,
          tree: blobs.map((blob) => ({
            path: blob.path,
            mode: blob.mode,
            type: "blob",
            sha: blob.sha,
          })),
        }),
      },
    );

    if (!createTreeResponse.ok) {
      const errorText = await createTreeResponse.text();
      console.error("Failed to create tree:", errorText);
      return NextResponse.json(
        { error: "Failed to create tree", details: errorText },
        { status: 500 },
      );
    }

    const treeData = (await createTreeResponse.json()) as { sha: string };

    // Step 7: Create a new commit
    const createCommitResponse = await fetch(
      `https://api.github.com/repos/${username}/${repoName}/git/commits`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: "Initial commit from vibecheck",
          tree: treeData.sha,
          parents: [baseCommitSha],
        }),
      },
    );

    if (!createCommitResponse.ok) {
      const errorText = await createCommitResponse.text();
      console.error("Failed to create commit:", errorText);
      return NextResponse.json(
        { error: "Failed to create commit", details: errorText },
        { status: 500 },
      );
    }

    const commitData = (await createCommitResponse.json()) as { sha: string };

    // Step 8: Update the reference to point to the new commit
    const updateRefResponse = await fetch(
      `https://api.github.com/repos/${username}/${repoName}/git/refs/heads/${repoData.default_branch || "main"}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sha: commitData.sha,
          force: false,
        }),
      },
    );

    if (!updateRefResponse.ok) {
      const errorText = await updateRefResponse.text();
      console.error("Failed to update reference:", errorText);
      return NextResponse.json(
        { error: "Failed to update reference", details: errorText },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      repoUrl: repoData.html_url,
      repoName: repoData.name,
    });
  } catch (error) {
    console.error("GitHub export error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error },
      { status: 500 },
    );
  }
}
