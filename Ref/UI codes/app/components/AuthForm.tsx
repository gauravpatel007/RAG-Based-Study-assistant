"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setToken } from "@/app/lib/auth-client";

export default function AuthForm() {
  const router = useRouter();
  
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const endpoint = isLogin ? "/api/auth/login" : "/api/auth/signup";
      const payload = isLogin ? { email, password } : { name, email, password };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Authentication failed");
        setIsLoading(false);
        return;
      }

      setToken(data.token);
      router.push("/floor");
    } catch (err) {
      console.error("Auth error", err);
      setError("Network error. Please try again.");
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setError(null);
  };

  return (
    <div className="w-full max-w-md bg-surface-container-low rounded-xl p-8 shadow-[0_12px_40px_rgba(0,0,0,0.08)]">
      <div className="flex flex-col items-center mb-6">
        <h1 className="font-headline text-headline-lg font-bold text-primary mb-2">
          {isLogin ? "Welcome Back" : "Create Account"}
        </h1>
        <p className="font-body text-body-md text-on-surface-variant text-center">
          {isLogin
            ? "Enter your credentials to access the terminal."
            : "Register a new cashier securely."}
        </p>
      </div>

      {error && (
        <div className="mb-6 p-3 bg-error-container text-on-error-container rounded-lg text-sm text-center">
          {error}
        </div>
      )}

      <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
        {!isLogin && (
          <div className="flex flex-col gap-1.5">
            <label className="font-body text-label-md text-on-surface-variant uppercase tracking-wider">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required={!isLogin}
              placeholder="e.g. Alex"
              className="w-full bg-surface-highest text-on-surface placeholder:text-on-surface-variant px-4 py-3 rounded-md border-b-2 border-transparent focus:border-primary focus:outline-none transition-colors"
            />
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="font-body text-label-md text-on-surface-variant uppercase tracking-wider">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="cashier@pos.com"
            className="w-full bg-surface-highest text-on-surface placeholder:text-on-surface-variant px-4 py-3 rounded-md border-b-2 border-transparent focus:border-primary focus:outline-none transition-colors"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="font-body text-label-md text-on-surface-variant uppercase tracking-wider">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="••••••••"
            className="w-full bg-surface-highest text-on-surface placeholder:text-on-surface-variant px-4 py-3 rounded-md border-b-2 border-transparent focus:border-primary focus:outline-none transition-colors"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="mt-4 w-full py-3.5 bg-gradient-to-r from-primary to-primary-container text-on-primary font-headline font-bold rounded-lg shadow-md hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-75 disabled:pointer-events-none"
        >
          {isLoading ? "Processing..." : isLogin ? "Sign In" : "Register"}
        </button>
      </form>

      <div className="mt-8 text-center">
        <button
          type="button"
          onClick={toggleMode}
          className="font-body text-body-md text-primary hover:text-primary-fixed transition-colors underline-offset-4 hover:underline"
        >
          {isLogin
            ? "Don't have an account? Register"
            : "Already have an account? Sign In"}
        </button>
      </div>
    </div>
  );
}
