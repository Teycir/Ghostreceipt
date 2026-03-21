export function Footer(): React.JSX.Element {
  return (
    <footer className="w-full border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex flex-col items-center justify-between gap-4 py-10 md:h-24 md:flex-row md:py-0">
        <div className="flex flex-col items-center gap-4 px-8 md:flex-row md:gap-2 md:px-0">
          <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
            Built by{' '}
            <a
              href="https://teycirbensoltane.tn"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium underline underline-offset-4"
            >
              Teycir Ben Soltane
            </a>
            . Open source on{' '}
            <a
              href="https://github.com/teycir/GhostReceipt"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium underline underline-offset-4"
            >
              GitHub
            </a>
            .
          </p>
        </div>
        <div className="flex gap-4">
          <a
            href="/docs/how-to-use.html"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            How to Use
          </a>
          <a
            href="/docs/faq.html"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            FAQ
          </a>
          <a
            href="/docs/security.html"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Security
          </a>
          <a
            href="/docs/license.html"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            License
          </a>
        </div>
      </div>
    </footer>
  );
}
