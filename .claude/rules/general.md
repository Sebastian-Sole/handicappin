# Coding Standards and Best Practices

## Variable Naming and Code Quality

### Variable and Function Naming
- Use descriptive, meaningful names for all variables, functions, and constants
- Avoid abbreviations, single letters, or cryptic names (e.g., avoid `i`, `j`, `k`, `x`, `y`, `data`, `temp`)
- Even in loops, use descriptive names that explain the purpose (e.g., `userIndex`, `currentItem`, `rowIndex` instead of `i`)
- Use camelCase for variables and functions, PascalCase for components and classes
- Boolean variables should start with is/has/can/should (e.g., `isVisible`, `hasPermission`, `canEdit`)

### Code Maintainability
- Write self-documenting code through clear naming
- Prefer explicit over implicit code
- Use meaningful comments only when the business logic is complex
- Avoid deep nesting (max 3-4 levels)
- Break down large functions into smaller, focused functions
- Use early returns to reduce nesting
- Extract magic numbers and strings into named constants

### Component and Function Guidelines
- Component names should clearly describe what they do (e.g., `UserProfileCard`, `ProjectStatusBadge`)
- Function names should be verbs that describe the action (e.g., `calculateTotalScore`, `validateUserInput`)
- Use TypeScript interfaces and types to document expected data structures
- Avoid any types; use specific type definitions instead

### Array and Object Handling
- Use descriptive names for array iterations: `projectIndex`, `currentProject`, `itemIndex`
- Choose clear names for object destructuring: `{ userProfile, projectSettings }` instead of `{ profile, settings }`
- Use meaningful names for array methods: `projects.filter(project => project.isActive)`

### Constants and Configuration
- Extract configuration values into named constants at the top of files
- Use SCREAMING_SNAKE_CASE for constants that represent configuration (e.g., `MAX_RETRY_ATTEMPTS`)
- Group related constants together

### File Organization
- Use barrel exports (index.ts files) to keep imports clean
- Organize imports: external libraries first, then internal modules
- Keep components small and focused on a single responsibility
