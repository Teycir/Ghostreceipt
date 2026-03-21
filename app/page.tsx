import { GeneratorForm } from '@/components/generator/generator-form';

export default function HomePage(): React.JSX.Element {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            GhostReceipt
          </h1>
          <p className="text-lg text-muted-foreground">
            Prove the payment. Keep the privacy.
          </p>
        </div>

        <div className="rounded-lg border bg-card p-8 shadow-sm">
          <GeneratorForm />
        </div>
      </div>
    </main>
  );
}
