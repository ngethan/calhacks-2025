import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      `${process.env.BETTER_AUTH_URL}/ide?github_error=${error}`,
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${process.env.BETTER_AUTH_URL}/ide?github_error=no_code`,
    );
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      `${process.env.BETTER_AUTH_URL}/ide?github_error=config_error`,
    );
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
        }),
      },
    );

    const tokenData = (await tokenResponse.json()) as {
      access_token?: string;
      error?: string;
    };

    if (tokenData.error || !tokenData.access_token) {
      return NextResponse.redirect(
        `${process.env.BETTER_AUTH_URL}/ide?github_error=token_error`,
      );
    }

    // Store the access token in a cookie or return it to the client
    // For now, we'll redirect back to the IDE with the token in the URL (you may want to use a more secure method)
    const response = NextResponse.redirect(
      `${process.env.BETTER_AUTH_URL}/ide?github_success=true`,
    );

    // Store token in httpOnly cookie for security
    response.cookies.set("github_access_token", tokenData.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    return response;
  } catch (err) {
    console.error("GitHub OAuth error:", err);
    return NextResponse.redirect(
      `${process.env.BETTER_AUTH_URL}/ide?github_error=server_error`,
    );
  }
}
