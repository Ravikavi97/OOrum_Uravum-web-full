import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-20 text-center">
      <div className="mb-8">
        <span className="text-8xl font-bold text-accent-red">404</span>
      </div>
      <h1 className="text-3xl font-bold mb-4">
        பக்கம் கிடைக்கவில்லை
      </h1>
      <p className="text-foreground/60 mb-8 text-lg">
        நீங்கள் தேடும் பக்கம் இல்லை அல்லது நீக்கப்பட்டிருக்கலாம்.
      </p>
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Link
          href="/"
          className="inline-block rounded-lg bg-primary-dark px-6 py-3 text-sm font-medium text-white hover:bg-primary-dark/90 transition-colors"
        >
          முகப்புப் பக்கம்
        </Link>
        <Link
          href="/search"
          className="inline-block rounded-lg border border-foreground/20 px-6 py-3 text-sm font-medium text-foreground hover:bg-foreground/5 transition-colors"
        >
          செய்திகளைத் தேடுங்கள்
        </Link>
      </div>
    </main>
  );
}
