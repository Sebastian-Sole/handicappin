# Purge Tickets Command

This command performs backlog refinement/grooming by reviewing tickets in the `.claude/tickets/` directory and determining which tickets should be deleted, archived, or kept active.

## 🎯 Purpose

Reduce bloat in the tickets directory by:

- Removing obsolete or irrelevant tickets
- Archiving completed tickets with historical value
- Keeping active and relevant tickets
- Maintaining a clean, focused backlog

## 🔍 Analysis Criteria

### ✅ Keep Active Tickets

- **Incomplete tickets aligned with current project scope**
- **High/medium priority tickets with clear acceptance criteria**
- **Tickets with dependencies that are still relevant**
- **Tickets representing current technical debt**

### 📁 Archive Completed Tickets

- **Completed tickets with valuable implementation details**
- **Tickets with associated experience files**
- **Complex integrations that may be referenced later**
- **Architectural decisions with documented rationale**

### 🗑️ Delete Obsolete Tickets

- **Completed tickets with no future reference value**
- **Tickets made obsolete by architecture changes**
- **Duplicate or redundant tickets**
- **Tickets that contradict current project direction**
- **Low-priority enhancement tickets that won't be implemented**

## 🚨 Process

### Step 1: Analyze Each Ticket

For each ticket in `.claude/tickets/`, evaluate:

1. **Completion Status**
   - Check for completion notes in the ticket
   - Look for `[x]` marks in acceptance criteria
   - Verify existence of associated experience files

2. **Relevance Assessment**
   - Does this align with current project scope?
   - Is this ticket still technically feasible?
   - Would this ticket add value to the current MVP?

3. **Priority Assessment**
   - What's the labeled priority (high/medium/low)?
   - Does this solve a current pain point?
   - Is this blocked by unresolved dependencies?

4. **Documentation Value**
   - Are there implementation details worth preserving?
   - Does this ticket document important decisions?
   - Would future developers benefit from this context?

### Step 2: Take Action

Based on analysis, take one of these actions:

#### Keep Active (No Action)

```bash
# Ticket remains in .claude/tickets/
# No changes needed
```

#### Archive Completed

```bash
# Move to archive directory
mkdir -p .claude/tickets/archive
mv .claude/tickets/XXXX-ticket-name.md .claude/tickets/archive/
```

Update ticket references in other files with new path

#### Delete Obsolete

```bash
# Remove completely
rm .claude/tickets/XXXX-ticket-name.md
```

Update ticket references in other files with new path

## 🤖 Automated Analysis Process

### Step 1: Discover Tickets

```bash
# List all tickets in the directory
ls -1 .claude/tickets/*.md 2>/dev/null | grep -v archive || echo "No tickets found"
```

### Step 2: Analyze Each Ticket

For each ticket file, the command will:

1. **Extract Metadata**
   - Parse ticket number and title from filename
   - Extract priority from labels section
   - Identify completion status from acceptance criteria
   - Look for completion notes sections

2. **Check Completion Status**
   - Count `[x]` vs `[ ]` in acceptance criteria
   - Look for "✅ Completion Notes" or similar sections
   - Check for "Status: COMPLETED" markers

3. **Assess Documentation Value**
   - Check for associated experience files in `.claude/experiences/`
   - Look for complex technical implementations
   - Identify architectural decisions or integration patterns

4. **Evaluate Current Relevance**
   - Parse priority labels (high/medium/low)
   - Check if ticket aligns with project scope rules
   - Identify dependencies or blocking relationships

### Step 3: Generate Recommendations

The command will output:

```
📋 TICKET ANALYSIS RESULTS

Ticket #XXXX: [Title]
├── Status: [COMPLETED|IN_PROGRESS|NOT_STARTED]
├── Priority: [HIGH|MEDIUM|LOW]
├── Completion: [X%] ([N] of [M] criteria met)
├── Experience Files: [YES|NO]
└── Recommendation: [KEEP|ARCHIVE|DELETE]
    Rationale: [Explanation]

SUMMARY:
- Keep Active: X tickets
- Archive Completed: Y tickets
- Delete Obsolete: Z tickets

COMMANDS TO EXECUTE:
[Generated bash commands based on analysis]
```

## 🔧 Analysis Logic

### Completion Detection Rules

- **COMPLETED**: >90% acceptance criteria checked + completion notes present
- **IN_PROGRESS**: >0% but <90% acceptance criteria checked
- **NOT_STARTED**: 0% acceptance criteria checked

### Action Decision Matrix

| Status      | Priority | Has Experience | Scope Aligned | Action  |
| ----------- | -------- | -------------- | ------------- | ------- |
| COMPLETED   | Any      | YES            | Any           | ARCHIVE |
| COMPLETED   | High/Med | NO             | YES           | ARCHIVE |
| COMPLETED   | Low      | NO             | NO            | DELETE  |
| NOT_STARTED | High     | Any            | YES           | KEEP    |
| NOT_STARTED | Med      | Any            | YES           | KEEP    |
| NOT_STARTED | Low      | NO             | YES           | KEEP    |
| NOT_STARTED | Any      | NO             | NO            | DELETE  |

### Scope Alignment Check

- Check against `.claude/rules/` for current project boundaries
- Identify tickets that contradict current architecture
- Flag enhancement tickets that exceed MVP scope

## 🎯 Usage Instructions

1. **Run the Analysis**

   ```bash
   # Navigate to project root
   cd /path/to/project

   # Execute the purge command analysis
   # This will scan all tickets and provide recommendations
   ```

2. **Present the analysis results for review**:

   ```
   I've analyzed the tickets directory and generated purge recommendations.

   Please review the analysis and let me know:
   - Are the ticket statuses correctly identified?
   - Do the priority assessments look accurate?
   - Are the recommendations (KEEP/ARCHIVE/DELETE) appropriate?
   - Any tickets that should be handled differently?
   - Should I proceed with executing the recommended actions?
   ```

3. **Iterate based on feedback** - be ready to:
   - Adjust ticket status assessments
   - Override priority evaluations
   - Modify recommendations based on business context
   - Add/remove tickets from purge list
   - Clarify reasoning for specific decisions

4. **Continue refining** until the user approves the plan

5. **Execute Actions** (only after user approval):
   - Run the generated commands to purge tickets
   - Verify the results match expectations
   - Commit the changes to maintain history

## 🚨 Validation Steps

After executing the purge:

1. **Verify Archive Structure**

   ```bash
   ls -la .claude/tickets/archive/
   # Should contain: 0001-supabase-realtime-integration.md, 0005-game-selection-dropdown.md
   ```

2. **Confirm Active Tickets**

   ```bash
   ls -la .claude/tickets/
   # Should contain: 0004-documentation-and-setup-guides.md
   ```

3. **Check Experience Files**

   ```bash
   ls -la .claude/experiences/
   # Should still contain all experience files (nothing should be deleted)
   ```

4. **Validate Project Focus**
   - Active backlog aligns with current project scope
   - No critical completed work lost
   - Historical context preserved for complex integrations

## 📝 Notes

- **Experience files are never deleted** - they contain valuable implementation knowledge
- **Archive tickets can be moved back** - if future work requires referencing them
- **Focus on MVP scope** - complex enhancements should wait until core functionality is stable
- **Preserve learning** - completed tickets with implementation insights have ongoing value

## 🔄 Future Purge Criteria

Establish regular backlog grooming:

- **Monthly review** for active projects
- **Quarterly purge** for completed features
- **Scope alignment check** when project direction changes
- **Dependency cleanup** when technologies/approaches change

This command ensures the tickets directory remains focused, relevant, and valuable for ongoing development work.
