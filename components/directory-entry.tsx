"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
export default function DirectoryEntry(){const path=usePathname();if(path.startsWith('/admin'))return null;return <nav className="directory-entry" aria-label="ფუნქციების სარჩევი"><Link href="/app/features">ყველა ფუნქცია · All features ↗</Link></nav>}
