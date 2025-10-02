---
alwaysApply: true
---

# Coding Standards & Rules

## 🎯 **Core Mission**

Build a responsive web application that displays and analyzes code performance metrics for Knowit projects and their customers' projects. The application provides comprehensive scoreboard functionality with project analytics, performance tracking, and interactive data visualization.

## 🚫 **What NOT to Change**

### **Core Architecture (Locked)**

- **Next.js 15.5.2** with App Router - Do not downgrade or switch to Pages Router
- **React 19.1.0** with TypeScript - Do not downgrade React version
- **Panda CSS 1.2.0+** with Park UI preset - Do not replace with other CSS frameworks
- **NextAuth 5.0.0-beta.29** for authentication - Keep Azure AD integration
- **Vitest 3.2.4+** for testing - Do not switch to Jest
- **Playwright 1.55.0+** for E2E testing - Keep browser automation setup
- **pnpm** as package manager - [[memory:8610311]]

### **File Structure**

```
src/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   ├── auth/              # Authentication pages
│   ├── board/             # Board-specific pages
│   ├── live/              # Live data pages
│   ├── projects/          # Project detail pages
│   └── layout.tsx         # Root layout - minimal changes only
├── components/
│   ├── data-display/      # Charts, tables, metrics display
│   ├── layout/            # Headers, navigation, providers
│   ├── navigation/        # Navigation components
│   └── ui/                # Reusable UI primitives
├── lib/
│   ├── api-client/        # Auto-generated API client - DO NOT MODIFY
│   ├── api-client-init.ts # API client configuration
│   └── auth.ts            # NextAuth configuration
├── styles/
│   ├── recipes/           # Panda CSS component recipes
│   └── tokens/            # Design tokens
└── utils/                 # Utility functions
```

### **Essential Type Definitions**

```typescript
// DO NOT REMOVE - Core types for the API
export type SiteDto = {
  id: string;
  name: string;
  lastUpdated: string;
  previousUpdated: string | null;
  pageCount: number;
  performance: number;
  accessibility: number;
  bestPractice: number;
  seo: number;
  security: number;
  average: number;
  progress: number;
};

// Authentication types
export type Session = {
  user: User;
  accessToken?: string;
  idToken?: string;
};
```

## ✅ **What TO Implement**

### **MVP Features**

- Project performance dashboard with metrics visualization
- Interactive data tables with sorting and filtering
- Responsive design for desktop and mobile
- Real-time data updates and caching
- User authentication via Azure AD
- Route-based navigation with proper loading states

### **Integration Requirements**

- Hey API client for backend communication
- NextAuth for Azure AD authentication
- Panda CSS for consistent styling
- Comprehensive testing with Vitest and Playwright
- Type-safe API integration with auto-generated clients

## 📋 **Coding Conventions**

### **TypeScript Standards**

```typescript
// Use explicit types for all props and API responses
interface ComponentProps {
  projects: SiteDto[];
  onProjectSelect?: (id: string) => void;
  className?: string;
}

// Use proper error handling with typed errors
const fetchProjects = async (): Promise<SiteDto[] | null> => {
  try {
    const response = await getApiSitesAllSites();
    return response.data ?? [];
  } catch (error) {
    console.error("Failed to fetch projects:", error);
    return null;
  }
};

// Use Zod for runtime validation when needed
import { z } from "zod";

const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  average: z.number().min(0).max(100),
});
```

### **Next.js App Router Patterns**

```typescript
// Server Components for data fetching
export default async function ProjectsPage() {
  const projects = await getApiSitesAllSites();

  return <ProjectsTable projects={projects.data ?? []} />;
}

// Client Components for interactivity
("use client");

export default function InteractiveChart({ data }: ChartProps) {
  const [selectedMetric, setSelectedMetric] = useState("performance");

  return (
    <div>
      <MetricSelector onSelect={setSelectedMetric} />
      <Chart data={data} metric={selectedMetric} />
    </div>
  );
}

// Loading and error boundaries
export default function Loading() {
  return <Spinner aria-label="Loading projects..." />;
}

export default function Error({ error }: { error: Error }) {
  return (
    <div role="alert">
      <h2>Something went wrong!</h2>
      <details>{error.message}</details>
    </div>
  );
}
```

### **Component Structure**

```typescript
// Order: imports, types, utils, main component
import React from "react";
import { css } from "@/styled-system/css";
import { SiteDto } from "@/lib/api-client";

// Component-specific types
interface ProjectCardProps {
  project: SiteDto;
  size?: "sm" | "md" | "lg";
  interactive?: boolean;
  onSelect?: (id: string) => void;
}

// Utility functions
const formatScore = (score: number): string => {
  return `${score}%`;
};

// Main component
export default function ProjectCard({
  project,
  size = "md",
  interactive = false,
  onSelect,
}: ProjectCardProps) {
  // State declarations
  const [isExpanded, setIsExpanded] = useState(false);

  // Event handlers
  const handleClick = () => {
    if (interactive && onSelect) {
      onSelect(project.id);
    }
  };

  // Render
  return (
    <div className={card({ size, interactive })} onClick={handleClick}>
      {/* Component content */}
    </div>
  );
}
```

### **Styling with Panda CSS**

```typescript
// Use design tokens and semantic colors
import { css } from "@/styled-system/css";

const styles = css({
  bg: "bg.surface",
  color: "text.primary",
  p: "lg",
  borderRadius: "md",
  shadow: "sm",
});

// Use recipes for component variants
import { card } from "@/styled-system/recipes";

const cardStyles = card({
  size: "md",
  interactive: true,
});

// Responsive design with breakpoints
const responsiveStyles = css({
  display: "grid",
  gridTemplateColumns: {
    base: "1fr",
    md: "repeat(2, 1fr)",
    lg: "repeat(3, 1fr)",
  },
  gap: { base: "md", lg: "lg" },
});
```

### **API Integration Patterns**

```typescript
// Use auto-generated Hey API client
import { getApiSitesAllSites, type SiteDto } from "@/lib/api-client";

// Server-side data fetching
export default async function ProjectsPage() {
  try {
    const response = await getApiSitesAllSites();
    const projects = response.data ?? [];

    return <ProjectsTable projects={projects} />;
  } catch (error) {
    console.error("Failed to fetch projects:", error);
    return <ErrorBoundary error="Failed to load projects" />;
  }
}

// Client-side data fetching with error handling
const useProjects = () => {
  const [projects, setProjects] = useState<SiteDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        setLoading(true);
        const response = await getApiSitesAllSites();
        setProjects(response.data ?? []);
        setError(null);
      } catch (err) {
        setError("Failed to fetch projects");
        console.error("API Error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, []);

  return { projects, loading, error };
};
```

### **Authentication Integration**

```typescript
// Use NextAuth session in components
import { auth } from "@/lib/auth";

// Server Components
export default async function ProtectedPage() {
  const session = await auth();

  if (!session) {
    redirect("/auth/signin");
  }

  return <Dashboard user={session.user} />;
}

// Client Components
("use client");

import { useSession } from "next-auth/react";

export default function UserProfile() {
  const { data: session, status } = useSession();

  if (status === "loading") return <Spinner />;
  if (status === "unauthenticated") return <SignInPrompt />;

  return <Profile user={session.user} />;
}
```

## 🔧 **Development Workflow**

### **Before Making Changes**

```bash
# Check current state
pnpm typecheck
pnpm lint
pnpm test

# Generate API client if schema changed
pnpm codegen
```

### **Change Process**

1. Generate API types if backend changes: `pnpm codegen`
2. Create/update components with proper TypeScript types
3. Write tests for new functionality
4. Run linting and type checking
5. Test in browser and run E2E tests

### **Error Resolution Priority**

1. TypeScript compilation errors (highest)
2. ESLint errors
3. Test failures
4. Runtime errors
5. Warnings (address but don't block)

## 🚨 **Critical Don'ts**

### **Architecture Violations**

- ❌ No direct database queries in frontend code
- ❌ No manual API client modifications (use `pnpm codegen`)
- ❌ No Pages Router patterns in App Router project
- ❌ No client-side authentication logic (use NextAuth)
- ❌ No inline styles (use Panda CSS system)

### **Performance Killers**

- ❌ Don't fetch data in client components without caching
- ❌ Don't create objects in render methods
- ❌ Don't forget to memoize expensive calculations
- ❌ Don't ignore Next.js caching mechanisms
- ❌ Don't bundle large dependencies on client side

### **Code Quality**

- ❌ No `console.log` statements in production code
- ❌ No `any` types (use proper TypeScript)
- ❌ No hardcoded values (use environment variables/tokens)
- ❌ No commented-out code blocks
- ❌ No missing error boundaries

## 🎨 **UI/UX Guidelines**

### **Design Principles**

- Clean, professional interface for business users
- Data-driven design with clear metrics visualization
- Responsive design for desktop and mobile
- Accessible design following WCAG guidelines
- Consistent spacing and typography using design tokens

### **Component Hierarchy**

```
App Layout
├── Navigation Header
│   ├── Logo/Brand
│   ├── Main Navigation
│   └── User Menu
├── Page Content
│   ├── Title Header
│   ├── Data Tables/Charts
│   └── Action Controls
└── Footer (if needed)
```

### **Interaction Patterns**

- Click to drill down into project details
- Hover states for interactive elements
- Loading states for async operations
- Sort and filter for data tables
- Responsive navigation for mobile

## 🧪 **Testing Standards**

### **Testing Framework Stack**

- **Vitest 3.2.4+** for unit and integration tests
- **React Testing Library** for component testing
- **Playwright 1.55.0+** for E2E testing
- **Storybook** for component documentation and visual testing
- **MSW** for API mocking in tests

### **Testing Philosophy**

```typescript
// ✅ CORRECT: Test user behavior, not implementation
describe("ProjectsTable", () => {
  it("should display projects and allow sorting", async () => {
    const user = userEvent.setup();
    const mockProjects = createMockProjects();

    render(<ProjectsTable projects={mockProjects} />);

    // Check data is displayed
    expect(screen.getByText("Test Project 1")).toBeInTheDocument();

    // Test sorting interaction
    await user.click(
      screen.getByRole("button", { name: /sort by performance/i })
    );

    // Verify sorting result
    const rows = screen.getAllByRole("row");
    expect(rows[1]).toHaveTextContent("Test Project 1"); // Highest score first
  });
});

// ❌ WRONG: Testing implementation details
expect(component.state.sortColumn).toBe("performance");
```

### **Test Organization**

```
test/
├── unit/                   # Component and utility tests
│   ├── components/
│   ├── utils/
│   └── hooks/
├── integration/            # API integration tests
│   └── api/
├── e2e/                    # End-to-end tests
│   ├── auth.spec.ts
│   ├── dashboard.spec.ts
│   └── projects.spec.ts
├── utils.ts               # Test utilities and mocks
└── vitestSetup.ts         # Test environment setup
```

### **API Testing Patterns**

```typescript
// Mock API responses for reliable testing
import { createMockProjects } from "@/test/utils";

describe("Project API Integration", () => {
  it("should handle successful data fetch", async () => {
    const mockData = createMockProjects();

    // Mock the API call
    vi.mocked(getApiSitesAllSites).mockResolvedValue({
      data: mockData,
      error: null,
    });

    render(<ProjectsPage />);

    await waitFor(() => {
      expect(screen.getByText("Test Project 1")).toBeInTheDocument();
    });
  });

  it("should handle API errors gracefully", async () => {
    vi.mocked(getApiSitesAllSites).mockRejectedValue(
      new Error("Network error")
    );

    render(<ProjectsPage />);

    await waitFor(() => {
      expect(screen.getByText(/failed to load projects/i)).toBeInTheDocument();
    });
  });
});
```

## 📱 **Responsive Design Standards**

### **Breakpoint Strategy**

```typescript
// Use Panda CSS breakpoints consistently
import { breakpoints } from "@/styles/breakpoints";

const responsiveGrid = css({
  display: "grid",
  gridTemplateColumns: {
    base: "1fr", // Mobile: single column
    md: "repeat(2, 1fr)", // Tablet: two columns
    lg: "repeat(3, 1fr)", // Desktop: three columns
    xl: "repeat(4, 1fr)", // Large desktop: four columns
  },
  gap: { base: "md", lg: "lg" },
});
```

### **Mobile-First Approach**

```typescript
// Start with mobile styles, enhance for larger screens
const mobileFirstStyles = css({
  // Base styles (mobile)
  fontSize: "sm",
  p: "md",

  // Enhanced for larger screens
  md: {
    fontSize: "md",
    p: "lg",
  },

  lg: {
    fontSize: "lg",
    p: "xl",
  },
});
```

## 🔒 **Security Guidelines**

### **Authentication Security**

```typescript
// Always validate sessions server-side
export default async function ProtectedApiRoute() {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Proceed with authenticated request
}

// Use environment variables for sensitive data
import { env } from "@/env";

const apiConfig = {
  baseUrl: env.API_BASE_URL,
  clientSecret: env.AZURE_AD_CLIENT_SECRET, // Never expose in client
};
```

### **Data Validation**

```typescript
// Validate all inputs with Zod
import { z } from "zod";

const projectUpdateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  metrics: z.object({
    performance: z.number().min(0).max(100),
    accessibility: z.number().min(0).max(100),
  }),
});

export async function updateProject(data: unknown) {
  const validData = projectUpdateSchema.parse(data);
  // Safe to use validData
}
```

## 🚀 **Performance Optimization**

### **Next.js Optimization**

```typescript
// Use Next.js caching strategies
export const revalidate = 600; // Cache for 10 minutes

// Implement proper loading states
export default function Loading() {
  return <ProjectsTableSkeleton />;
}

// Use dynamic imports for large components
const HeavyChart = dynamic(() => import("./HeavyChart"), {
  loading: () => <ChartSkeleton />,
  ssr: false, // If chart doesn't work server-side
});
```

### **React Optimization**

```typescript
// Memoize expensive calculations
const sortedProjects = useMemo(() => {
  return projects.sort((a, b) => b.average - a.average);
}, [projects]);

// Optimize re-renders with memo and callback
const ProjectCard = memo(({ project, onSelect }: ProjectCardProps) => {
  const handleClick = useCallback(() => {
    onSelect?.(project.id);
  }, [project.id, onSelect]);

  return <div onClick={handleClick}>{project.name}</div>;
});
```

## 📊 **Analytics and Monitoring**

### **Error Tracking**

```typescript
// Implement proper error boundaries
export default function GlobalErrorBoundary({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to monitoring service
    console.error("Global error:", error);
  }, [error]);

  return (
    <div>
      <h2>Something went wrong!</h2>
      <button onClick={reset}>Try again</button>
    </div>
  );
}
```

### **Performance Monitoring**

```typescript
// Monitor key metrics
useEffect(() => {
  const startTime = performance.now();

  return () => {
    const loadTime = performance.now() - startTime;
    if (loadTime > 1000) {
      console.warn(`Slow component render: ${loadTime}ms`);
    }
  };
}, []);
```

## 🎯 **Success Metrics**

### **Technical**

- [ ] Zero TypeScript compilation errors
- [ ] All ESLint rules pass
- [ ] Test coverage > 80% for business logic
- [ ] E2E tests pass for critical user journeys
- [ ] Bundle size < 500KB gzipped for initial load

### **Performance**

- [ ] First Contentful Paint < 1.5s
- [ ] Largest Contentful Paint < 2.5s
- [ ] Time to Interactive < 3s
- [ ] Cumulative Layout Shift < 0.1

### **User Experience**

- [ ] Responsive design works on all device sizes
- [ ] Accessible to screen readers (WCAG AA)
- [ ] Fast loading with skeleton states
- [ ] Error states are user-friendly
- [ ] Authentication flow is seamless

This comprehensive coding standards document ensures consistency, maintainability, and alignment with the project's core mission of providing a high-quality scoreboard application for code performance analysis.
