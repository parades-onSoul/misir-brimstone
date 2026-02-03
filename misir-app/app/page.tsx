import { redirect } from 'next/navigation';

export default function Home() {
  // Root redirects to login - middleware will redirect to dashboard if authenticated
  redirect('/login');
}
