import Link from 'next/link';

export default function ConfirmEmailPage() {
  return (
    <div className="bg-background flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <div className="w-full max-w-md text-center space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Check your email</h1>
          <p className="text-muted-foreground">
            We&apos;ve sent you a confirmation link to verify your email address.
          </p>
        </div>
        
        <div className="rounded-lg border bg-card p-6 text-card-foreground">
          <div className="space-y-4">
            <div className="flex justify-center">
              <svg
                className="h-16 w-16 text-muted-foreground"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            
            <div className="space-y-2">
              <p className="text-sm">
                Please check your inbox and click the confirmation link to activate your account.
              </p>
              <p className="text-sm text-muted-foreground">
                If you don&apos;t see the email, check your spam folder.
              </p>
            </div>
          </div>
        </div>

        <div className="text-sm text-muted-foreground">
          <p>
            After confirming your email, you can{" "}
            <Link href="/" className="underline underline-offset-4 hover:text-primary">
              sign in to your account
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
