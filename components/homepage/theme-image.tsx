"use client";
import Image from "next/image";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export default function ThemeImage() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="relative">
      {/* Hidden images for preloading to reduce switching delay */}
      <Image
        src="/images/landing.png"
        alt=""
        width={1}
        height={1}
        className="hidden"
        priority
      />
      <Image
        src="/images/landing-dark.png"
        alt=""
        width={1}
        height={1}
        className="hidden"
        priority
      />

      {/* Light theme image - visible by default, hidden in dark mode */}
      <Image
        src="/images/landing.png"
        alt="Handicappin' Dashboard"
        className="w-full rounded-lg shadow-2xl border transition-opacity duration-200 dark:hidden"
        width={1000}
        height={1000}
        priority
      />

      {/* Dark theme image - hidden by default, visible in dark mode */}
      <Image
        src="/images/landing-dark.png"
        alt="Handicappin' Dashboard"
        className="w-full rounded-lg shadow-2xl border transition-opacity duration-200 hidden dark:block"
        width={1000}
        height={1000}
        priority
      />
    </div>
  );
}
