import { SignupForm } from "@/components/signup-form"
import { Sparkles } from "lucide-react"

export default function SignupPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10 bg-gradient-to-br from-background via-secondary/20 to-background">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-2 mb-8">
          <div className="flex items-center justify-center size-12 rounded-xl bg-gradient-to-br from-primary/90 to-primary shadow-lg">
            <Sparkles className="size-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-semibold">Misir</h1>
          <p className="text-sm text-muted-foreground">Personal Orientation System</p>
        </div>
        <SignupForm />
      </div>
    </div>
  )
}
