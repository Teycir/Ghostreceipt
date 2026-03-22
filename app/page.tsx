import { GeneratorForm } from '@/components/generator/generator-form';
import { Footer } from '@/components/footer';
import { EyeCandy } from '@/components/eye-candy';
import { AnimatedTagline } from '@/components/animated-tagline';
import TextPressure from '@/components/text-pressure';

export default function HomePage(): React.JSX.Element {
  return (
    <>
      <EyeCandy />
      <main className="flex min-h-screen flex-col items-center justify-center p-4 pb-20">
        <div className="w-full max-w-2xl space-y-8 fade-up">

          {/* Header */}
          <div className="text-center space-y-3">
            <h1 className="sr-only">GhostReceipt</h1>
            {/* Interactive title — mouse pressure changes font weight */}
            <div aria-hidden="true">
              <TextPressure
                text="GhostReceipt"
                textColor="#ffffff"
                minFontSize={52}
                className="glow-heading justify-center"
              />
            </div>

            {/* Animated tagline — chars fade in sequentially */}
            <AnimatedTagline text="Prove the payment.  Keep the privacy." />
          </div>

          {/* Form card */}
          <div className="glass-card rounded-xl p-8 shadow-2xl">
            <GeneratorForm />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
