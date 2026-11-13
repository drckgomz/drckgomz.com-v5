export default async function ServiceUnavailablePage({ searchParams }: { searchParams: Promise<{ service?: string }> }) {
  const params = await searchParams;
  const service = params.service === "auth" ? "Sign-in" : "The requested service";
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold">{service} is not configured</h1>
      <p className="mt-3 text-muted-foreground">
        This deployment needs its server-side database and authentication settings before this area is available.
      </p>
    </main>
  );
}
