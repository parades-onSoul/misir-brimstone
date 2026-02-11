'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { cn } from "@/lib/utils"
import { useAuth } from '@/hooks/use-auth';
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

export function SignupForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter();
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      setIsLoading(false);
      return;
    }

    try {
      const { error } = await signUp(email, password);
      if (error) {
        setError(error.message);
      } else {
        router.push('/dashboard');
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={cn("flex flex-col gap-6", className)}
      {...props}
    >
      <Card className="border-border/40 shadow-2xl">
        <CardHeader className="text-center space-y-3 pb-8 border-b border-border/40 bg-linear-to-b from-secondary/30 to-secondary/10">
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, duration: 0.3 }}
          >
            <CardTitle className="text-2xl font-semibold tracking-tight">Create your account</CardTitle>
          </motion.div>
          <CardDescription className="text-sm text-muted-foreground/80">
            Start building your personal orientation system
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-8 px-8 pb-8">
          <form onSubmit={handleSubmit}>
            <FieldGroup className="space-y-5">
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.2 }}
                  className="rounded-lg bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive font-medium shadow-sm"
                >
                  {error}
                </motion.div>
              )}
              <Field className="space-y-2.5">
                <FieldLabel htmlFor="email" className="text-sm font-medium text-foreground">Email</FieldLabel>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  className="h-11 px-4 bg-[#141517] border-white/10 text-[13px] text-[#EEEEF0] placeholder:text-[#8A8F98] focus-visible:ring-1 focus-visible:ring-[#5E6AD2] focus-visible:border-[#5E6AD2] transition-colors"
                />
              </Field>
              <Field className="space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field className="space-y-2.5">
                    <FieldLabel htmlFor="password" className="text-sm font-medium text-foreground">Password</FieldLabel>
                    <Input
                      id="password"
                      type="password"
                      placeholder="At least 8 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="h-11 px-4 bg-[#141517] border-white/10 text-[13px] text-[#EEEEF0] placeholder:text-[#8A8F98] focus-visible:ring-1 focus-visible:ring-[#5E6AD2] focus-visible:border-[#5E6AD2] transition-colors"
                    />
                  </Field>
                  <Field className="space-y-2.5">
                    <FieldLabel htmlFor="confirm-password" className="text-sm font-medium text-foreground">
                      Confirm Password
                    </FieldLabel>
                    <Input
                      id="confirm-password"
                      type="password"
                      placeholder="Re-enter password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className="h-11 px-4 bg-[#141517] border-white/10 text-[13px] text-[#EEEEF0] placeholder:text-[#8A8F98] focus-visible:ring-1 focus-visible:ring-[#5E6AD2] focus-visible:border-[#5E6AD2] transition-colors"
                    />
                  </Field>
                </div>
                <FieldDescription className="text-xs text-muted-foreground/70">
                  Must be at least 8 characters long
                </FieldDescription>
              </Field>
              <Field className="pt-2">
                <Button type="submit" disabled={isLoading} className="w-full h-11 mt-4 bg-[#5E6AD2] hover:bg-[#5E6AD2]/90 text-white text-[13px] font-medium transition-colors shadow-md hover:shadow-lg">
                  {isLoading ? (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-center gap-2"
                    >
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Creating account...
                    </motion.span>
                  ) : (
                    'Create account'
                  )}
                </Button>
                <FieldDescription className="text-center">
                  Already have an account?{' '}
                  <Link href="/login" className="text-primary hover:underline">
                    Sign in
                  </Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  )
}
