---
date: 2025-01-27T20:30:00-08:00
git_commit: 6cd6a3ecc5bc6fe3db0a92587a90d413eb9b18cb
branch: feat/stripe
repository: handicappin
topic: "Handicappin codebase architecture and functionality analysis"
tags: [research, codebase, golf-saas, handicap-calculation, authentication]
status: complete
last_updated: 2025-01-27
---

# Research: Handicappin Codebase Architecture and Functionality Analysis

**Date**: 2025-01-27T20:30:00-08:00
**Git Commit**: 6cd6a3ecc5bc6fe3db0a92587a90d413eb9b18cb
**Branch**: feat/stripe
**Repository**: handicappin

## Research Question

What is the overall architecture and main functionality of the Handicappin golf SaaS application?

## Summary

Handicappin is a customer-facing golf SaaS application built with Next.js 15.5.1, React 19.1.1, and Supabase. The application provides comprehensive golf handicap tracking, round management, and calculation tools. Key features include user authentication, golf scorecard entry, USGA-compliant handicap calculations, dashboard analytics, and interactive calculators.

## Detailed Findings

### Core Architecture

- **Frontend**: Next.js 15.5.1 with App Router, React 19.1.1, TypeScript
- **Backend**: Supabase (PostgreSQL database, authentication, edge functions)
- **API Layer**: tRPC for type-safe API communication
- **Styling**: Tailwind CSS with Radix UI components
- **State Management**: React Query (TanStack Query) for server state
- **Forms**: React Hook Form with Zod validation

### Authentication System

- **Provider**: Supabase Auth with email/password authentication
- **User Management**: Custom profile creation via Supabase Edge Functions
- **Session Management**: Server-side session handling with middleware
- **Security**: Row Level Security (RLS) policies for data access control
- **Email Verification**: Built-in email verification flow

### Golf-Specific Features

#### Round Management

- **Scorecard Entry**: Interactive golf scorecard with course/tee selection
- **Course Database**: Searchable course database with tee information
- **Hole Management**: Support for 9-hole and 18-hole rounds
- **Score Validation**: Real-time score validation and handicap stroke calculation

#### Handicap Calculation Engine

- **USGA Compliance**: Full USGA handicap calculation system
- **Score Differentials**: Automatic calculation of score differentials
- **Handicap Index**: Rolling 20-round calculation with soft/hard caps
- **Exceptional Score Reduction**: ESR implementation for outlier scores
- **Course Handicap**: Dynamic course handicap calculation based on tee ratings

#### Database Schema

- **Core Tables**: profile, round, score, course, hole, teeInfo
- **Relationships**: Proper foreign key relationships with cascade deletes
- **Data Integrity**: Comprehensive validation and constraint enforcement
- **Audit Trail**: Created timestamps and approval status tracking

### User Interface Components

#### Dashboard System

- **Personal Dashboard**: User-specific handicap tracking and round history
- **Analytics**: Handicap trend charts and performance metrics
- **Round History**: Paginated round history with detailed scoring
- **Profile Management**: User profile editing and handicap display

#### Scorecard Interface

- **Course Selection**: Searchable course database with autocomplete
- **Tee Management**: Dynamic tee selection with rating information
- **Score Entry**: Intuitive score entry with handicap stroke calculation
- **Validation**: Real-time form validation and error handling

#### Calculator Tools

- **Course Handicap Calculator**: Interactive handicap calculation tool
- **Score Differential Calculator**: Score differential calculation and explanation
- **Transparency Focus**: Detailed calculation explanations and step-by-step breakdowns

### Technical Implementation

#### API Architecture

- **tRPC Routers**: Organized by domain (auth, round, course, tee, scorecard)
- **Type Safety**: End-to-end type safety with TypeScript and Zod
- **Error Handling**: Comprehensive error handling and validation
- **Performance**: Optimized queries with proper indexing and caching

#### Data Flow

```
User Input → React Hook Form → Zod Validation → tRPC Mutation → Supabase → Database
```

#### State Management

- **Server State**: React Query for API data fetching and caching
- **Form State**: React Hook Form for complex form management
- **UI State**: React useState for component-level state
- **Global State**: Context providers for shared application state

### Security and Performance

#### Security Features

- **Row Level Security**: Database-level access control
- **Authentication**: Secure session management with Supabase
- **Input Validation**: Comprehensive input validation with Zod schemas
- **CORS Protection**: Proper CORS headers for edge functions

#### Performance Optimizations

- **Server Components**: Next.js App Router with server-side rendering
- **Code Splitting**: Dynamic imports and lazy loading
- **Caching**: React Query caching and Supabase query optimization
- **Image Optimization**: Next.js image optimization for course images

## Code References

- `app/rounds/add/page.tsx:1-36` - Round entry page with scorecard component
- `components/scorecard/golf-scorecard.tsx:57-761` - Main scorecard interface
- `server/api/routers/round.ts:82-390` - Round management API endpoints
- `utils/calculations/handicap.ts:1-229` - Handicap calculation utilities
- `supabase/functions/handicap-engine/index.ts:35-426` - Handicap calculation edge function
- `db/schema.ts:22-265` - Database schema definitions
- `utils/auth/helpers.ts:1-65` - Authentication helper functions
- `app/dashboard/[id]/page.tsx:1-50` - User dashboard page

## Architecture Insights

### Design Patterns

- **Domain-Driven Design**: Organized by golf domain concepts (rounds, courses, handicaps)
- **Repository Pattern**: tRPC procedures act as repositories for data access
- **Validation Layer**: Zod schemas provide comprehensive input validation
- **Error Boundary**: Proper error handling and user feedback

### Scalability Considerations

- **Database Design**: Normalized schema with proper indexing
- **API Design**: RESTful tRPC procedures with proper pagination
- **Caching Strategy**: React Query for client-side caching
- **Edge Functions**: Supabase edge functions for complex calculations

### User Experience Focus

- **Transparency**: Detailed calculation explanations and step-by-step breakdowns
- **Accessibility**: Proper ARIA labels and keyboard navigation
- **Responsive Design**: Mobile-first approach with Tailwind CSS
- **Performance**: Fast loading with skeleton states and optimistic updates

## Historical Context (from experiences/)

No previous experiences found in the codebase for this analysis.

## Open Questions

1. **Payment Integration**: The current branch is `feat/stripe` - what payment features are being implemented?
2. **Calculator Expansion**: The calculators page shows "Coming Soon" - what additional calculators are planned?
3. **Course Management**: How are new courses added to the database? Is there an admin interface?
4. **Handicap Verification**: How is handicap verification handled for tournament play?
5. **Mobile App**: Are there plans for a mobile application companion?

## Key Technologies and Dependencies

### Core Framework

- Next.js 15.5.1 (App Router)
- React 19.1.1
- TypeScript 5.x

### Backend Services

- Supabase (PostgreSQL, Auth, Edge Functions)
- tRPC 11.5.0
- Drizzle ORM 0.44.5

### UI and Styling

- Tailwind CSS 4.1.12
- Radix UI components
- Lucide React icons
- Recharts for data visualization

### Development Tools

- Vitest 3.2.4 for testing
- ESLint for code quality
- PostCSS for CSS processing
- React Email for email templates

This comprehensive analysis reveals a well-architected golf SaaS application with a focus on transparency, user experience, and USGA compliance. The codebase demonstrates modern React patterns, type safety, and scalable architecture suitable for a customer-facing application.
