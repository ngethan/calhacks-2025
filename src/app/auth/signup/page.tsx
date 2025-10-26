"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shadows } from "@/components/ui/shadows";
import { authClient } from "@/lib/auth-client";
import { ArrowLeft, Check, Eye, EyeOff, Loader2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

export default function SignUpPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const getPasswordStrength = (password: string) => {
    if (!password) return { strength: 0, label: "", color: "" };

    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[^a-zA-Z\d]/.test(password)) strength++;

    const strengthMap = {
      0: { label: "Very Weak", color: "bg-red-500" },
      1: { label: "Weak", color: "bg-orange-500" },
      2: { label: "Fair", color: "bg-yellow-500" },
      3: { label: "Good", color: "bg-blue-500" },
      4: { label: "Strong", color: "bg-green-500" },
      5: { label: "Very Strong", color: "bg-green-600" },
    };

    return { strength, ...strengthMap[strength as keyof typeof strengthMap] };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (formData.password !== formData.confirmPassword) {
      toast.error("Passwords do not match");
      setIsLoading(false);
      return;
    }

    if (formData.password.length < 8) {
      toast.error("Password must be at least 8 characters long");
      setIsLoading(false);
      return;
    }

    try {
      await authClient.signUp.email(
        {
          email: formData.email,
          password: formData.password,
          name: formData.email.split("@")[0], // Use email prefix as name
        },
        {
          onSuccess: () => {
            toast.success(
              "Account created successfully! Please check your email for verification."
            );
            router.push(
              "/auth/login?success=Please verify your email to continue"
            );
          },
          onError: (ctx) => {
            toast.error(ctx.error.message ?? "Sign up failed");
          },
        }
      );
    } catch (err) {
      console.error("Signup error:", err);
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background p-4">
      {/* Ethereal Shadows Background */}
      <Shadows
        color="rgba(128, 128, 128, 0.5)"
        animation={{ scale: 50, speed: 50 }}
        noise={{ opacity: 0.3, scale: 1 }}
      />

      <Link
        href="/"
        className="absolute top-8 left-8 z-10 flex items-center gap-2 text-muted-foreground text-sm transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Home
      </Link>

      <div className="relative z-10 w-full max-w-md space-y-6">
        <div className="space-y-4 text-center">
          <div className="flex justify-center">
            <img
              src="/logo.png"
              alt="Aligned Logo"
              className="h-12 w-12 object-contain"
            />
          </div>
          <div className="space-y-2">
            <h1 className="font-semibold text-2xl tracking-tight">
              Create your account
            </h1>
            <p className="text-muted-foreground text-sm">
              Already have an account?{" "}
              <Link
                href="/auth/login"
                className="font-medium text-foreground hover:underline"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="block font-medium text-sm">
              Email
            </label>
            <Input
              id="email"
              type="email"
              placeholder="name@example.com"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              required
              disabled={isLoading}
              className="h-12"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="block font-medium text-sm">
              Password
            </label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="At least 8 characters"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                required
                disabled={isLoading}
                className="h-12 pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="-translate-y-1/2 absolute top-1/2 right-3 text-muted-foreground transition-colors hover:text-foreground"
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {formData.password && (
              <div className="space-y-1">
                <div className="flex gap-1">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={`strength-${i}`}
                      className={`h-1 flex-1 rounded-full transition-colors ${
                        i < getPasswordStrength(formData.password).strength
                          ? getPasswordStrength(formData.password).color
                          : "bg-muted"
                      }`}
                    />
                  ))}
                </div>
                <p className="text-muted-foreground text-xs">
                  Password strength:{" "}
                  {getPasswordStrength(formData.password).label}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor="confirmPassword"
                className="block font-medium text-sm"
              >
                Confirm password
              </label>
              {formData.confirmPassword && (
                <div className="flex items-center gap-1">
                  {formData.password === formData.confirmPassword ? (
                    <>
                      <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
                      <span className="text-green-600 text-xs dark:text-green-400">
                        Passwords match
                      </span>
                    </>
                  ) : (
                    <>
                      <X className="h-3 w-3 text-red-600 dark:text-red-400" />
                      <span className="text-red-600 text-xs dark:text-red-400">
                        Passwords don't match
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm your password"
                value={formData.confirmPassword}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    confirmPassword: e.target.value,
                  })
                }
                required
                disabled={isLoading}
                className={`h-12 pr-12 ${
                  formData.confirmPassword
                    ? formData.password === formData.confirmPassword
                      ? "border-green-500/50 bg-green-500/5 focus:border-green-500"
                      : "border-red-500/50 bg-red-500/5 focus:border-red-500"
                    : ""
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="-translate-y-1/2 absolute top-1/2 right-3 text-muted-foreground transition-colors hover:text-foreground"
                tabIndex={-1}
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            className="h-12 w-full"
            disabled={
              isLoading ||
              !formData.email.trim() ||
              !formData.password ||
              !formData.confirmPassword ||
              formData.password !== formData.confirmPassword
            }
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating account...
              </>
            ) : (
              "Create account"
            )}
          </Button>
        </form>

        <div className="mt-8 text-center text-muted-foreground text-xs">
          By signing up, you agree to our{" "}
          <Link
            href="/privacy"
            target="_blank"
            className="underline hover:text-foreground hover:no-underline"
          >
            Privacy Policy
          </Link>{" "}
          and{" "}
          <Link
            href="/tos"
            target="_blank"
            className="underline hover:text-foreground hover:no-underline"
          >
            Terms of Service
          </Link>
        </div>
      </div>
    </div>
  );
}
