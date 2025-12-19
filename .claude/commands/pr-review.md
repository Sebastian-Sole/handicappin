# Pull Request Review

You are tasked with conducting a comprehensive, critical code review of a pull request. This command runs automatically in GitHub Actions and must complete without user interaction.

## Initial Setup

When this command is invoked:

1. **Detect PR context automatically**:

   - Check for PR number in environment: `GITHUB_PR_NUMBER`
   - If not found, try: `gh pr view --json number -q .number` (if on PR branch)
   - Fallback: Get head ref and find associated PR: `gh pr list --head "${GITHUB_HEAD_REF:-${GITHUB_REF_NAME}}" --json number -q '.[0].number'`

2. **Get PR information**:

   ```bash
   PR_NUMBER=<detected_number>
   gh pr view $PR_NUMBER --json title,body,author,baseRefName,headRefName,number,url > pr_info.json
   ```

3. **Get changed files and diff**:

   ```bash
   BASE_BRANCH=$(gh pr view $PR_NUMBER --json baseRefName -q .baseRefName)
   HEAD_SHA=$(gh pr view $PR_NUMBER --json headRefOid -q .headRefOid)

   # Get changed files
   gh pr diff $PR_NUMBER --name-only > changed_files.txt

   # Get full diff
   gh pr diff $PR_NUMBER > full_diff.patch
   ```

4. **Read PR metadata**:

   - Parse `pr_info.json` for title, description, author
   - Check for existing review comments: `gh pr view $PR_NUMBER --json reviews,comments -q '.reviews, .comments'`

5. **Log initial acknowledgment** (no user interaction needed):

   ```
   Starting automated PR review for PR #$PR_NUMBER
   Title: [title]
   Author: [author]
   Base: [base] <- Head: [head]

   Analyzing [X] changed files...
   ```

## Review Process

### Step 1: Gather Complete Context

**CRITICAL**: Before reviewing any changes, you must understand the full context:

1. **Read ALL changed files FULLY**:

   ```bash
   # Read each file from the changed_files.txt list
   while IFS= read -r file; do
     cat "$file"  # Read complete file
   done < changed_files.txt
   ```

   - Read each changed file completely (no limit/offset parameters)
   - Understand what the file does in the codebase

2. **Understand file relationships**:

   - For each changed file, identify:
     - What imports it (use Grep tool to search for: `import.*filename` with type filter for TypeScript files)
     - What it imports (read imports in the file)
     - What components/functions it uses
     - What components/functions use it
   - **DO NOT assume** - trace the actual code paths

3. **Use research tools when needed**:

   - If you need to understand how a component is used, spawn a **codebase-locator** agent task
   - If you need to understand implementation details, spawn a **codebase-analyzer** agent task
   - If you need to find similar patterns, spawn a **codebase-pattern-finder** agent task
   - Use the **research-codebase** command for complex investigations
   - **Follow complete workflows** - if a prop is passed, trace where it comes from and how it's used
   - **Wait for all sub-tasks to complete** before proceeding

4. **Read related files**:
   - Read test files for changed code (check for `*.test.ts`, `*.spec.ts` files)
   - Read configuration files that might be affected
   - Read related components/files that interact with changes
   - Read documentation that might need updates

### Step 2: Review Each File Individually

For each changed file:

1. **Read the full file** (not just the diff):

   - Understand the complete context
   - See how changes fit into the existing code
   - Identify patterns and conventions

2. **Analyze the diff**:

   - Extract relevant sections from `full_diff.patch` for this file
   - Review each line changed
   - Understand what was added, removed, or modified
   - Consider edge cases and error scenarios

3. **Evaluate against criteria**:

   **Maintainability**:

   - Is the code readable and self-documenting?
   - Are there clear naming conventions?
   - Is complexity appropriate?
   - Are there magic numbers/strings that should be constants?
   - Is code DRY (Don't Repeat Yourself)?
   - Are there appropriate comments where needed?
   - Is the code organized logically?

   **Scalability**:

   - Will this code handle growth?
   - Are there hardcoded limits?
   - Is the data structure appropriate for scale?
   - Are there N+1 query problems?
   - Is caching used appropriately?
   - Will this perform well with large datasets?

   **Security**:

   - Are inputs validated?
   - Is authentication/authorization checked?
   - Are secrets properly handled?
   - Is SQL injection prevented?
   - Is XSS prevented?
   - Are file paths sanitized?
   - Is rate limiting considered?
   - Are permissions checked?
   - Is sensitive data exposed?
   - Are environment variables used correctly?

   **Best Practices**:

   - Does it follow project conventions?
   - Does it follow language/framework best practices?
   - Are errors handled properly?
   - Is logging appropriate?
   - Are types used correctly?
   - Are tests included?
   - Is the API design consistent?

   **Performance**:

   - Are there unnecessary re-renders?
   - Are expensive operations memoized?
   - Are database queries optimized?
   - Is bundle size considered?
   - Are images optimized?
   - Is code splitting used appropriately?
   - Are there memory leaks?

4. **Check against coding standards**:

   - Read `.claude/rules/coding-standards.md` for project-specific rules
   - Verify TypeScript usage
   - Verify Next.js patterns
   - Verify component structure
   - Verify API patterns
   - Verify testing patterns

5. **Document all issues found**:
   - Create a structured list of issues for this file
   - Include file path, line numbers, severity, and description
   - Prepare code suggestions for each issue

### Step 3: Review Overall PR Impact

After reviewing individual files:

1. **Evaluate cross-file changes**:

   - How do changes interact across files?
   - Are there breaking changes?
   - Are migrations needed?
   - Are there cascading effects?

2. **Check application workflow**:

   - How do changes affect user flows?
   - Are there edge cases in workflows?
   - Is error handling consistent?
   - Are loading states handled?

3. **Verify integration**:

   - Do changes integrate properly with existing code?
   - Are there conflicts with other features?
   - Is backward compatibility maintained?
   - Are API contracts maintained?

4. **Check dependencies**:
   - Check `package.json` for new dependencies
   - Are new dependencies necessary?
   - Are dependency versions compatible?
   - Check for security vulnerabilities: `pnpm audit` or `npm audit`
   - Is bundle size impact acceptable?

### Step 4: Generate Review Summary

Create an overall review summary in this format and save to `review_summary.md`:

```markdown
## 🔍 Pull Request Review Summary

**PR**: #$PR_NUMBER - [Title]
**Author**: [Author]
**Base**: [base] ← **Head**: [head]

---

## What was done (Key changes)

[Brief summary of what this PR accomplishes, organized by area/feature]

### Files Changed

- `path/to/file1.ts` - [brief description of changes]
- `path/to/file2.tsx` - [brief description of changes]

### Key Modifications

- [High-level change 1]
- [High-level change 2]
- [High-level change 3]

---

## Critical Issues found

[If any critical issues exist, list them here. If none, state "None found."]

### 🔴 Critical

- [Issue description] - `file.ts:123`
- [Issue description] - `file.tsx:456`

### 🟠 Major

- [Issue description] - `file.ts:789`

### 🟡 Minor

- [Issue description] - `file.ts:101`

### 🔵 Optional

- [Issue description] - `file.ts:202`

---

## Architecture notes

[Observations about architectural decisions, patterns, and implications]

### ✅ Positive Patterns

- [Good architectural decision] - `file.ts:123`

### ⚠️ Concerns

- [Architectural concern] - `file.ts:456`

### 💡 Suggestions

- [Architectural improvement suggestion] - `file.ts:789`

---

## Production notes

[Anything that needs attention before production deployment]

### Environment Variables

- `VARIABLE_NAME` - [Description of what needs to be set]

### Configuration

- [Configuration item] - [What needs to be configured]

### Cleanup Required

- [What should be removed before production]

### Deployment Considerations

- [Any special deployment steps needed]

---

## Confidence Score: [1-5]/5

**[Score]/5**

### Rationale

[Detailed explanation of the score]

**1 = Do not merge at all**

- Critical bugs that will break functionality
- Security vulnerabilities
- Data loss risks
- Breaking changes without migration

**2 = Merging not recommended until fixes implemented**

- Major bugs that will cause issues
- Significant security concerns
- Performance problems
- Missing critical error handling
- Code will run but has serious flaws

**3 = Merge with caution**

- Should address issues before merging
- Can get by if speed is necessary
- Likely to create technical debt
- Minor bugs or edge cases
- Missing tests for critical paths

**4 = Fine to merge**

- Some issues that should be fixed
- Minor improvements needed
- Good overall quality
- Most best practices followed

**5 = Ready to merge**

- Maybe some minor issues that can be addressed later
- No glaring problems
- High code quality
- Well tested
- Follows best practices

---

## Review Statistics

- **Files Reviewed**: [X]
- **Total Issues Found**: [Y]
  - Critical: [Z]
  - Major: [A]
  - Minor: [B]
  - Optional: [C]
- **Lines Changed**: [L]
- **Test Coverage**: [T]% (if applicable)
```

### Step 5: Create Individual Comment Files

For each issue found, create a separate comment file:

**File naming**: `comment_<severity>_<index>.md` (e.g., `comment_critical_01.md`, `comment_major_02.md`)

**Comment structure**:

````markdown
## [Severity]: [Brief Issue Title]

**Location**: `path/to/file.ts:123-125`

**Issue**:
[Detailed description of the issue]

**Impact**:
[What happens if this isn't fixed]

**Current Code**:

```typescript
// Show the problematic code from the diff
const problematicCode = "example";
```

**Suggested Fix**:

```typescript
// Show the corrected code
const fixedCode = "example";
```

**Quick Fix** (if applicable):
[If this is a simple fix, provide a commit-ready change]

<details>
<summary>🤖 AI Prompt</summary>

```
Fix the [issue type] in [file path] at line [line number].

[Detailed description of what needs to be fixed]

The issue is: [specific problem]
The fix should: [what the fix should accomplish]

Context: This is part of PR #$PR_NUMBER
```

</details>

**Severity**: [Critical/Major/Minor/Optional]
````

**Severity Guidelines**:

- **Critical**: Security vulnerabilities, data loss risks, breaking changes, critical bugs that prevent functionality
- **Major**: Bugs that will cause issues, performance problems, missing error handling, significant code quality issues
- **Minor**: Code style issues, minor optimizations, missing tests for non-critical paths, small improvements
- **Optional**: Nice-to-have improvements, documentation suggestions, future considerations

### Step 6: Track Duplicate Suggestions

If multiple comments address the same underlying issue:

1. **Identify duplicates**:
   - Group similar issues together
   - Note if they're the same problem in different files
   - Note if they're related issues that should be fixed together

2. **Create duplicate comment file**: `comment_duplicates.md`
   ```markdown
   ## 🔄 Duplicate Suggestions

   The following comments address similar or related issues:

   - **[Comment 1 title]** - `file1.ts:123`
   - **[Comment 2 title]** - `file2.ts:456`
   - **[Comment 3 title]** - `file3.ts:789`

   **Root Cause**: [What's the underlying issue]

   **Recommended Approach**: [How to fix all instances]

   Consider addressing these together to maintain consistency.
````

### Step 7: Post Review Automatically

After completing the review, automatically post all comments:

1. **Post summary comment first**:

   ```bash
   gh pr comment $PR_NUMBER --body-file review_summary.md
   ```

2. **Post individual issue comments**:

   ```bash
   # Post critical issues first
   for file in comment_critical_*.md; do
     [ -e "$file" ] || continue
     gh pr comment $PR_NUMBER --body-file "$file"
   done

   # Then major issues
   for file in comment_major_*.md; do
     [ -e "$file" ] || continue
     gh pr comment $PR_NUMBER --body-file "$file"
   done

   # Then minor issues
   for file in comment_minor_*.md; do
     [ -e "$file" ] || continue
     gh pr comment $PR_NUMBER --body-file "$file"
   done

   # Then optional issues
   for file in comment_optional_*.md; do
     [ -e "$file" ] || continue
     gh pr comment $PR_NUMBER --body-file "$file"
   done

   # Post duplicates comment if exists
   if [ -f comment_duplicates.md ]; then
     gh pr comment $PR_NUMBER --body-file comment_duplicates.md
   fi
   ```

3. **Alternative: Post as review with approval/request changes**:

   ```bash
   # Extract confidence score from review_summary.md
   # Looks for patterns like "**3/5**" or "Confidence Score: 3/5"
   CONFIDENCE_SCORE=$(grep -oP '(\*\*|Confidence Score: ?)\K[1-5](?=/5)' review_summary.md | head -1)

   # Validate score is an integer between 1 and 5
   if [[ ! "$CONFIDENCE_SCORE" =~ ^[1-5]$ ]]; then
     echo "Error: Could not extract valid confidence score from review_summary.md"
     echo "Expected format: **X/5** or 'Confidence Score: X/5' where X is 1-5"
     echo "Defaulting to score of 3 (comment only, no approval/rejection)"
     CONFIDENCE_SCORE=3
   fi

   echo "Confidence Score: $CONFIDENCE_SCORE/5"

   # If confidence score is 1 or 2, request changes
   if [ "$CONFIDENCE_SCORE" -le 2 ]; then
     gh pr review $PR_NUMBER --comment --body-file review_summary.md --request-changes
   # If confidence score is 3, comment only
   elif [ "$CONFIDENCE_SCORE" -eq 3 ]; then
     gh pr review $PR_NUMBER --comment --body-file review_summary.md
   # If confidence score is 4 or 5, approve with comment
   else
     gh pr review $PR_NUMBER --approve --body-file review_summary.md
   fi
   ```

4. **Log completion**:

   ```
   ✅ Review complete for PR #$PR_NUMBER

   Summary posted
   Individual comments posted: [X]
   - Critical: [Y]
   - Major: [Z]
   - Minor: [A]
   - Optional: [B]

   Confidence Score: [1-5]/5
   ```

## Critical Review Principles

### Be Skeptical

- **Challenge everything**: Don't assume code is correct
- **Question assumptions**: Why was this approach chosen?
- **Look for edge cases**: What happens with null, undefined, empty arrays, etc.?
- **Consider failure modes**: What if this fails?
- **Verify security**: Could this be exploited?

### Be Thorough

- **Read complete files**: Not just diffs
- **Trace code paths**: Follow props, function calls, data flow
- **Check related code**: Read files that interact with changes
- **Verify tests**: Are tests comprehensive?
- **Check documentation**: Is it updated?

### Be Critical

- **No issue is too small**: Report everything
- **Don't give benefit of doubt**: If unsure, flag it
- **Question patterns**: Is this the best way?
- **Check consistency**: Does this match project style?
- **Verify correctness**: Is the logic correct?

### Follow Complete Workflows

**DO NOT ASSUME** - Always trace:

- **Props**: Where do they come from? How are they used?
- **Functions**: What do they do? Where are they called?
- **Data flow**: How does data move through the system?
- **State**: How is state managed? When does it update?
- **API calls**: What endpoints? What data? Error handling?
- **Database queries**: What tables? What filters? Performance?

**Example**: If reviewing a component that receives a `userId` prop:

1. Find where the component is used (use codebase-locator)
2. Trace where `userId` comes from (read parent components)
3. Verify it's always available (check all usage sites)
4. Check if it can be null/undefined (read type definitions)
5. Verify how it's used in the component (read component code)
6. Check if it's passed to child components (read component code)
7. Verify database queries using it (read API/database code)

## Review Checklist

For each file, verify:

- [ ] Code follows project conventions
- [ ] Types are used correctly (no `any` unless necessary)
- [ ] Error handling is present
- [ ] Edge cases are handled
- [ ] Security is considered
- [ ] Performance is acceptable
- [ ] Tests are included/updated
- [ ] Documentation is updated
- [ ] No console.logs in production code
- [ ] No hardcoded secrets
- [ ] Environment variables used correctly
- [ ] No commented-out code
- [ ] No magic numbers/strings
- [ ] Code is readable and maintainable
- [ ] Dependencies are necessary
- [ ] Breaking changes are documented
- [ ] Migrations are included if needed

## Using Sub-Agents

When you need to understand the codebase:

1. **Use codebase-locator** (spawn as Task agent):

   ```
   Find all files that [use/import/define] [component/function/type]
   Return file paths with line numbers where it's used
   ```

2. **Use codebase-analyzer** (spawn as Task agent):

   ```
   Analyze how [component/function/system] works, including:
   - Entry points
   - Data flow
   - Error handling
   - Integration points
   Return detailed analysis with file:line references
   ```

3. **Use codebase-pattern-finder** (spawn as Task agent):

   ```
   Find examples of [pattern/feature] similar to [what we're reviewing]
   Show how it's implemented elsewhere in the codebase
   Include code examples with file:line references
   ```

4. **Use research-codebase** (spawn as Task agent):
   ```
   Research: [complex question about how something works]
   Focus on: [specific aspects]
   Return findings with file:line references
   ```

**Important**:

- Spawn sub-agents as parallel Task agents for efficiency
- Wait for all sub-agents to complete before proceeding
- Don't make assumptions based on partial information
- Use their findings to inform your review

## Automated Execution Flow

```
1. Detect PR number from environment/GitHub context
2. Get PR info: `gh pr view $PR_NUMBER --json ...`
3. Get changed files: `gh pr diff $PR_NUMBER --name-only`
4. Get full diff: `gh pr diff $PR_NUMBER`
5. Read all changed files fully
6. For each file:
   - Understand context
   - Review diff
   - Check against criteria
   - Identify issues
   - Document issues
7. Review overall impact
8. Generate review_summary.md
9. Generate individual comment files
10. Post summary: `gh pr comment $PR_NUMBER --body-file review_summary.md`
11. Post individual comments: `gh pr comment $PR_NUMBER --body-file comment_*.md`
12. Log completion
```

## Error Handling

If any step fails:

1. **Log the error**:

   ```
   ❌ Error during PR review: [error message]
   Step: [which step failed]
   ```

2. **Attempt to post partial review**:

   - If summary is generated, post it with a note about partial review
   - If individual comments are generated, post them

3. **Exit with appropriate code**:
   - Exit 0 if review completed (even with issues found)
   - Exit 1 if review failed to complete

## Important Notes

- **Fully automated**: No user interaction required
- **Read files FULLY**: Never use limit/offset when reading changed files
- **Trace completely**: Don't assume - follow the code path
- **Be critical**: Challenge everything, report all issues
- **Be thorough**: Check security, performance, maintainability, best practices
- **Use tools**: Leverage sub-agents and research commands
- **Document everything**: Include file:line references for all issues
- **Provide fixes**: Include code suggestions and AI prompts
- **Track duplicates**: Group similar issues together
- **Post automatically**: Use `gh pr comment` to post all findings
- **Handle errors gracefully**: Post partial reviews if possible
- **Temporary files only**: All review files are temporary and NOT committed to the repository

Remember: Your goal is to ensure code quality, security, and maintainability. Be thorough, be critical, and help improve the codebase through automated, comprehensive reviews.
