import type { Preview } from "@storybook/nextjs";
import { withThemeByClassName } from "@storybook/addon-themes";

import "../app/globals.css";
import { withToaster } from "./decorators";

const preview: Preview = {
  parameters: {
    nextjs: {
      // Enable @storybook/nextjs App Router mocks so stories that import
      // useRouter / usePathname / useSearchParams from `next/navigation`
      // don't throw SB_FRAMEWORK_NEXTJS_0002.
      appDirectory: true,
    },
    layout: "centered",
    controls: {
      expanded: true,
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      options: {
        light: { name: "Light", value: "#ffffff" },
        dark: { name: "Dark", value: "#0a0f0c" },
      },
    },
    a11y: {
      // Run a11y checks automatically; surface violations in the panel.
      test: "todo",
    },
    viewport: {
      options: {
        mobile: {
          name: "Mobile (375)",
          styles: { width: "375px", height: "667px" },
          type: "mobile",
        },
        mobileLarge: {
          name: "Mobile Large (414)",
          styles: { width: "414px", height: "896px" },
          type: "mobile",
        },
        tablet: {
          name: "Tablet (768)",
          styles: { width: "768px", height: "1024px" },
          type: "tablet",
        },
        laptop: {
          name: "Laptop (1280)",
          styles: { width: "1280px", height: "800px" },
          type: "desktop",
        },
        desktop: {
          name: "Desktop (1440)",
          styles: { width: "1440px", height: "900px" },
          type: "desktop",
        },
      },
    },
  },
  initialGlobals: {
    backgrounds: { value: "light" },
  },
  decorators: [
    withThemeByClassName({
      themes: {
        light: "",
        dark: "dark",
      },
      defaultTheme: "light",
    }),
    // Mount sonner's <Toaster /> for every story (no-op if sonner is not
    // installed). Per-story opt-in providers (withTrpc, withSupabaseAuth,
    // withReactHookForm) live in `./decorators`.
    withToaster,
  ],
};

export default preview;
