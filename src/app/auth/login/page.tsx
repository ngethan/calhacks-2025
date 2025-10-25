"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

export default function LoginPage() {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);
	const router = useRouter();

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		setLoading(true);

		try {
			const response = await authClient.signIn.email(
				{
					email,
					password,
				},
				{
					onSuccess: () => {
						router.push("/");
						router.refresh();
					},
					onError: (ctx) => {
						setError(ctx.error.message ?? "Sign in failed");
					},
				},
			);

			if (response.error) {
				setError(response.error.message ?? "Sign in failed");
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Sign in failed");
		} finally {
			setLoading(false);
		}
	};

	return (
		<main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">
			<div className="w-full max-w-md space-y-8 rounded-lg bg-white/10 p-8">
				<div className="text-center">
					<h2 className="text-3xl font-bold">Sign In</h2>
				</div>

				<form onSubmit={handleSubmit} className="space-y-6">
					<div>
						<label htmlFor="email" className="block text-sm font-medium">
							Email
						</label>
						<input
							id="email"
							type="email"
							required
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							className="mt-1 w-full rounded-md bg-white/20 px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[hsl(280,100%,70%)]"
							placeholder="you@example.com"
						/>
					</div>

					<div>
						<label htmlFor="password" className="block text-sm font-medium">
							Password
						</label>
						<input
							id="password"
							type="password"
							required
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							className="mt-1 w-full rounded-md bg-white/20 px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[hsl(280,100%,70%)]"
							placeholder="••••••••"
						/>
					</div>

					{error && (
						<div className="rounded-md bg-red-500/20 p-3 text-sm text-red-200">
							{error}
						</div>
					)}

					<button
						type="submit"
						disabled={loading}
						className="w-full rounded-md bg-[hsl(280,100%,70%)] px-4 py-2 font-semibold text-white hover:bg-[hsl(280,100%,60%)] focus:outline-none focus:ring-2 focus:ring-[hsl(280,100%,70%)] focus:ring-offset-2 disabled:opacity-50"
					>
						{loading ? "Signing in..." : "Sign In"}
					</button>
				</form>

				<div className="text-center text-sm">
					<Link
						href="/auth/signup"
						className="text-[hsl(280,100%,70%)] hover:underline"
					>
						Don't have an account? Sign up
					</Link>
				</div>
			</div>
		</main>
	);
}
