'use client';

import { useAuthStore } from '@/lib/store';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export function UserMenu() {
  const { user, loading, signOut } = useAuthStore();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  if (loading) {
    return <div className="text-muted-foreground">Loading...</div>;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex items-center gap-2.5 p-1.5 rounded-md hover:bg-sidebar-accent group cursor-pointer transition-colors">
      <div className="h-6 w-6 rounded-full bg-indigo-500/20 flex items-center justify-center text-[10px] font-medium text-indigo-300 border border-indigo-500/30">
        {user.email?.[0].toUpperCase()}
      </div>
      <div className="flex flex-col flex-1 min-w-0 gap-0.5">
        <span className="text-[13px] font-medium text-sidebar-foreground truncate leading-none">{user.email?.split('@')[0]}</span>
        <span className="text-[11px] text-muted-foreground truncate leading-none">Free Plan</span>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
        onClick={handleSignOut}
      >
        <span className="sr-only">Sign Out</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="lucide lucide-log-out"
        >
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" x2="9" y1="12" y2="12" />
        </svg>
      </Button>
    </div>
  );
}
