import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const accessToken = request.cookies.get("github_access_token")?.value;

  if (!accessToken) {
    return NextResponse.json({ authenticated: false });
  }

  // Optionally, verify the token is still valid by making a request to GitHub
  try {
    const response = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (response.ok) {
      return NextResponse.json({ authenticated: true });
    }

    // Token is invalid, clear it
    const res = NextResponse.json({ authenticated: false });
    res.cookies.delete("github_access_token");
    return res;
  } catch (error) {
    console.error("Error checking GitHub auth:", error);
    return NextResponse.json({ authenticated: false });
  }
}
