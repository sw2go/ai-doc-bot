import Link from "next/link";

interface LayoutProps {
  children?: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="mx-auto flex flex-col space-y-4">
      <header className="container mx-auto sticky top-0 z-40 bg-white">
        <div className="h-16 border-b border-b-slate-200 py-4">
        <nav className="inline ml-4 pl-6">
          <Link href="/" className="hover:text-slate-600 cursor-pointer">
            Chat
          </Link>                    
          </nav>
          <nav className="inline ml-4 pl-6">
          <Link href="files" className="hover:text-slate-600 cursor-pointer">
            Files
          </Link>
          </nav>
        </div>
      </header>
      <div>
        <main className="flex w-full flex-1 flex-col overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
