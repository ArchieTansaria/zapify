"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { nhost } from "@/lib/nhost"
import { ZapifyLogo } from "@/components/brand/zapify-logo"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle } from "lucide-react"

export default function SignUpPage() {
  const router = useRouter()

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const res = await nhost.auth.signUpEmailPassword({
        email,
        password,
        options: {
          displayName: name,
        }
      })

      if (res.body?.session) {
        setTimeout(() => {
          router.push("/app")
          router.refresh()
        }, 100)
      } else {
        // If no session but no error, email verification is required (not used in this project currently, but safe to handle)
        setError("Please check your email to verify your account.")
        setIsLoading(false)
      }
    } catch (err) {
      const error = err as Error
      setError(error.message || "An unexpected error occurred.")
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <ZapifyLogo className="mb-4" markClassName="h-8 w-8" textClassName="text-2xl" />
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-2xl">Sign up</CardTitle>
          <CardDescription>
            Create an account to start building workflows.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignUp} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none" htmlFor="name">
                Full Name
              </label>
              <Input
                id="name"
                placeholder="Alice"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none" htmlFor="email">
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none" htmlFor="password">
                Password
              </label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>
            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive font-medium p-3 rounded-md bg-destructive/10">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <p>{error}</p>
              </div>
            )}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Signing up..." : "Sign up"}
            </Button>
          </form>
        </CardContent>
        <CardFooter>
          <div className="text-sm text-muted-foreground w-full text-center">
            Already have an account?{" "}
            <Link href="/signin" className="text-foreground font-medium hover:underline">
              Sign in
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
