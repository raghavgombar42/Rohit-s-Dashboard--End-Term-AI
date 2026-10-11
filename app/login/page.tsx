export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : "/";
  const error = sp.error === "1";

  return (
    <main className="min-h-screen grid place-items-center px-4">
      <form action="/api/login" method="post" className="w-full max-w-sm rounded-xl border border-line bg-surface p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-accent">Tandem Forge</p>
        <h1 className="mt-1 text-xl font-semibold">Funding Outreach Engine</h1>
        <p className="mt-1 text-sm text-muted">Private workspace for Rohit Gupta.</p>
        <input type="hidden" name="next" value={next} />
        <label className="mt-6 block text-sm font-medium" htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoFocus
          className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm outline-none focus:border-accent"
        />
        {error && <p className="mt-2 text-sm text-bad">Incorrect password.</p>}
        <button className="mt-4 w-full rounded-md bg-ink px-3 py-2 text-sm font-medium text-white hover:opacity-90">
          Sign in
        </button>
      </form>
    </main>
  );
}
