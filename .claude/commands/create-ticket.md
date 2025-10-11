# Create Ticket

You are tasked with creating new tickets in the `.claude/tickets/` directory. These tickets represent specific, isolated features, bugs, or tasks that need to be implemented.

## Getting Started

When this command is invoked:

1. **Check if parameters were provided**:

   - If a specific ticket description or reference was provided, skip the default message
   - Begin the ticket creation process immediately

2. **If no parameters provided**, respond with:

```
I'll help you create a new ticket. Please provide:
1. A brief description of the task/feature/bug
2. Any relevant context, user stories, or requirements
3. Priority level (high/medium/low)
4. Any related files, experiences, or research to reference

I'll create a properly formatted ticket with acceptance criteria, technical requirements, and implementation details.

Tip: You can also invoke this command with context like: `/create_ticket "Add dark mode toggle" high priority`
```

Then wait for the user's input.

## Process Steps

### Step 1: Context Gathering & Analysis

1. **Read any mentioned files immediately and FULLY**:

   - Ticket references, experiences, research documents
   - Related implementation files or code
   - **IMPORTANT**: Use the Read tool WITHOUT limit/offset parameters to read entire files
   - **CRITICAL**: Read these files yourself in the main context before proceeding

2. **Analyze the ticket requirements**:

   - Determine the scope and complexity
   - Identify technical dependencies
   - Consider user impact and priority
   - Check for similar existing tickets

3. **Research existing patterns**:
   - Review existing tickets for consistent formatting
   - Check experiences directory for related work
   - Look at current codebase for implementation context

### Step 2: Ticket Structure Development

Create a ticket following this standardized format:

```markdown
# [Number] - [Short Descriptive Title]

## 🎯 **Description**

[Clear, concise description of what needs to be implemented]

## 📋 **User Story**

As a [user type], I want [functionality] so that [benefit/value]

## 🔧 **Technical Context**

[Background information about why this is needed and current state]

## ✅ **Acceptance Criteria**

- [ ] [Specific, measurable requirement]
- [ ] [Another specific requirement]
- [ ] [Technical implementation requirement]
- [ ] [Testing requirement]

## 🚨 **Technical Requirements**

### **Implementation Details**

[Specific technical approach, code examples, or patterns to follow]

### **Dependencies**

[List of files, components, or systems that need to be modified or integrated]

### **Integration Points**

[How this feature connects to existing systems]

## 🔍 **Implementation Notes**

[Detailed technical considerations, edge cases, or special requirements]

## 📊 **Definition of Done**

- [ ] [Specific completion criterion]
- [ ] [Testing requirement]
- [ ] [Documentation requirement]
- [ ] [Performance requirement]

## 🧪 **Testing Requirements**

- [ ] [Unit test requirement]
- [ ] [Integration test requirement]
- [ ] [Manual testing requirement]
- [ ] [Edge case testing]

## 🚫 **Out of Scope**

[Explicitly list what this ticket does NOT include to prevent scope creep]

## 📝 **Notes**

[Additional context, references, or considerations]

## 🏷️ **Labels**

- `priority: [high|medium|low]`
- `type: [feature|bug|enhancement|documentation]`
- `component: [relevant-component]`
- `[additional-relevant-tags]`
```

### Step 3: Number Assignment

1. **Check existing tickets**:

   - List all existing ticket files in `.claude/tickets/`
   - Find the highest numbered ticket
   - Assign next sequential number

2. **File naming convention**:
   - Format: `XXXX-[kebab-case-description].md`
   - Examples: `0005-dark-mode-toggle.md`, `0006-fix-move-validation-bug.md`

### Step 4: Ticket Creation

1. **Create the ticket file**:

   - Use the standardized format above
   - Fill in all sections based on user requirements
   - Include specific technical details and code examples
   - Set appropriate priority and labels

2. **Validate completeness**:
   - Ensure all sections are filled out
   - Check that acceptance criteria are specific and measurable
   - Verify technical requirements are detailed enough for implementation
   - Confirm priority and labels are appropriate

### Step 5: Integration with Project Management

1. **Update project overview**:

   - Reference the new ticket in relevant documentation
   - Update any project status or planning documents

2. **Create cross-references**:
   - Link to related tickets if applicable
   - Reference relevant experience files
   - Connect to existing research or implementation notes

## Special Cases

### Creating Tickets from Completed Work

When creating tickets based on completed tasks or research:

1. **Read the completed work**:

   - Review implementation details
   - Understand what was accomplished
   - Identify any follow-up work needed

2. **Extract ticket requirements**:
   - Convert completed work into ticket format
   - Focus on remaining tasks or improvements
   - Reference the completed work in notes

### Creating Tickets from Experiences

When creating tickets based on experience files:

1. **Analyze the experience**:

   - Understand what was learned
   - Identify patterns or solutions
   - Extract actionable next steps

2. **Formulate ticket requirements**:
   - Convert insights into specific tasks
   - Include references to the original experience
   - Set appropriate priority based on impact

### Creating Enhancement Tickets

For feature enhancements or improvements:

1. **Assess current state**:

   - Understand existing functionality
   - Identify improvement opportunities
   - Consider user feedback or requirements

2. **Define enhancement scope**:
   - Be specific about what's being enhanced
   - Include backward compatibility considerations
   - Set clear success metrics

## Quality Guidelines

### Ticket Quality Checklist

- [ ] **Clear Description**: Anyone can understand what needs to be done
- [ ] **Specific Acceptance Criteria**: Measurable requirements, not vague statements
- [ ] **Technical Details**: Enough information to start implementation
- [ ] **Proper Priority**: Reflects business value and urgency
- [ ] **Appropriate Scope**: Not too large, not too small
- [ ] **Testable**: Clear definition of done with verification steps
- [ ] **Contextual**: Includes relevant background and constraints

### Common Pitfalls to Avoid

- **Vague Requirements**: "Make it better" or "Improve performance"
- **Too Large Scope**: Multiple unrelated features in one ticket
- **Missing Context**: No explanation of why the feature is needed
- **Unclear Acceptance Criteria**: Subjective or unmeasurable requirements
- **Missing Dependencies**: Not identifying what needs to be in place first

## Integration with Existing Workflow

### After Creating a Ticket

1. **Present the ticket**:

   ```
   I've created ticket [number] - [title] at:
   `.claude/tickets/[number]-[title].md`

   Please review:
   - Are the acceptance criteria specific enough?
   - Is the priority level appropriate?
   - Any missing technical details?
   - Should this be broken into smaller tickets?
   ```

2. **Iterate based on feedback**:

   - Adjust scope or requirements as needed
   - Refine acceptance criteria
   - Update priority if necessary
   - Split into multiple tickets if too large

3. **Update project documentation**:
   - Reference new ticket in planning documents
   - Update any relevant status tracking
   - Create cross-references to related work

## Examples

### Feature Ticket Example

```markdown
# 0005 - Dark Mode Toggle

## 🎯 **Description**

Add a dark mode toggle to the chess viewer interface that allows users to switch between light and dark themes.

## 📋 **User Story**

As a chess player, I want to switch to dark mode so that I can play chess comfortably in low-light conditions.

## ✅ **Acceptance Criteria**

- [ ] Toggle switch appears in the UI header
- [ ] Clicking toggle switches between light and dark themes
- [ ] Theme preference persists across browser sessions
- [ ] All components (board, controls, move list) adapt to theme
- [ ] Smooth transition animation between themes
```

### Bug Ticket Example

```markdown
# 0006 - Fix Move Validation Error

## 🎯 **Description**

Fix incorrect error message when user attempts invalid castling move in practice mode.

## 📋 **User Story**

As a chess player, I want clear error messages when I make invalid moves so that I can learn from my mistakes.

## ✅ **Acceptance Criteria**

- [ ] Invalid castling attempts show "Cannot castle" instead of generic error
- [ ] Error message appears in practice mode only
- [ ] Message disappears after 3 seconds or when valid move is made
- [ ] All invalid move types have appropriate specific messages
```

Remember: Tickets should be actionable, specific, and provide enough context for successful implementation while maintaining clear boundaries to prevent scope creep.
