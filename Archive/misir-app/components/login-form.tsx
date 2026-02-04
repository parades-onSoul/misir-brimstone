'use client';

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { signIn, signUp } from "@/lib/db/auth"
import { useRouter } from "next/navigation"

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (isSignUp) {
        const result = await signUp(email, password)
        if (result.error) {
          // Provide user-friendly error messages
          if (result.error.includes('already registered')) {
            setError('This email is already registered. Please sign in instead.')
          } else if (result.error.includes('Password should be')) {
            setError('Password must be at least 6 characters long.')
          } else {
            setError(result.error)
          }
        } else {
          // Redirect to confirmation page after signup
          router.push('/confirm-email')
        }
      } else {
        const result = await signIn(email, password)
        if (result.error) {
          // Provide user-friendly error messages
          if (result.error.includes('Invalid login credentials')) {
            setError('Invalid email or password. Please check your credentials and try again.')
          } else if (result.error.includes('Email not confirmed')) {
            setError('Please confirm your email address before signing in. Check your inbox for the confirmation link.')
          } else if (result.error.includes('not found')) {
            setError('No account found with this email. Please sign up first.')
          } else {
            setError(result.error)
          }
        } else {
          // Check if user needs onboarding (never completed it)
          try {
            const statusRes = await fetch('/api/auth/status')
            const statusData = await statusRes.json()
            
            if (!statusData.onboardedAt) {
              // Never onboarded - go to onboarding
              router.push('/onboarding')
            } else {
              // Already onboarded - go to dashboard (even if no spaces)
              router.push('/dashboard')
            }
          } catch {
            // If check fails, default to dashboard
            router.push('/dashboard')
          }
        }
      }
    } catch (_err) {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <form onSubmit={handleSubmit}>
        <FieldGroup>
          <div className="flex flex-col items-center gap-2 text-center">
            <h1 className="text-xl font-bold">Welcome to Misir</h1>
            <FieldDescription>
              {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
              <button 
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp)
                  setError('')
                }}
                className="underline underline-offset-4 hover:text-primary"
              >
                {isSignUp ? 'Sign in' : 'Sign up'}
              </button>
            </FieldDescription>
          </div>
          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              type="email"
              placeholder="m@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </Field>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <Field>
            <Button type="submit" disabled={loading}>
              {loading ? 'Loading...' : isSignUp ? 'Sign up' : 'Login'}
            </Button>
          </Field>
        </FieldGroup>
      </form>
      <FieldDescription className="px-6 text-center">
        By clicking continue, you agree to our <a href="#" className="underline underline-offset-4 hover:text-primary">Terms of Service</a>{" "}
        and <a href="#" className="underline underline-offset-4 hover:text-primary">Privacy Policy</a>.
      </FieldDescription>
    </div>
  )
}
