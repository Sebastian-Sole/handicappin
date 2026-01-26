"use client";
import Image from "next/image";

export default function ThemeImage() {
  return (
    <div className="relative">
      {/* Light theme image - visible by default, hidden in dark mode */}
      <Image
        src="/images/landing.png"
        alt="Handicappin' Dashboard"
        className="w-full rounded-lg shadow-2xl border transition-opacity duration-200 dark:hidden"
        width={600}
        height={400}
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 600px"
        priority
        fetchPriority="high"
      />

      {/* Dark theme image - hidden by default, visible in dark mode */}
      <Image
        src="/images/landing-dark.png"
        alt="Handicappin' Dashboard"
        className="w-full rounded-lg shadow-2xl border transition-opacity duration-200 hidden dark:block"
        width={600}
        height={400}
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 600px"
        priority
        fetchPriority="high"
      />
    </div>
  );
}
