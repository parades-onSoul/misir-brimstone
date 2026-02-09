'use client';

import { motion } from 'framer-motion';
import { Mail, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function ConfirmEmailPage() {
    return (
        <div className="flex min-h-screen items-center justify-center p-6">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex max-w-md flex-col items-center text-center"
            >
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                    <Mail className="h-8 w-8 text-primary" />
                </div>
                <h1 className="mt-6 text-2xl font-semibold">Check your email</h1>
                <p className="mt-2 text-muted-foreground">
                    We&apos;ve sent a confirmation link to your email address.
                    Click the link to activate your account and start tracking your knowledge.
                </p>
                <div className="mt-8 space-y-3 w-full">
                    <Button asChild className="w-full">
                        <Link href="/login">
                            Continue to sign in
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                    </Button>
                    <p className="text-xs text-muted-foreground">
                        Didn&apos;t receive the email? Check your spam folder or try signing up again.
                    </p>
                </div>
            </motion.div>
        </div>
    );
}
