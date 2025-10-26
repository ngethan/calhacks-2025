import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const clientId = process.env.GITHUB_CLIENT_ID;

  if (!clientId) {
    return NextResponse.json(
      { error: "GitHub client ID not configured" },
      { status: 500 },
    );
  }

  // GitHub OAuth authorization URL
  const scope = "repo"; // Permission to create repositories
  const redirectUri = `${process.env.BETTER_AUTH_URL}/api/github/callback`;

  const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=${scope}&redirect_uri=${encodeURIComponent(redirectUri)}`;

  return NextResponse.redirect(authUrl);
}
