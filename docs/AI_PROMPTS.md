# AI Prompt Templates

This guide provides prompt templates for effective communication between users and AI agents when building applications with SalesPro Web.

## For Non-Technical Users

### When Describing Your Application Idea

#### Basic Application Description

```
"I want to build a [application type] that [solves this problem].
The main users are [target audience] and they need to [primary use case].
Key features should include [list 3-5 main features]."
```

**Example:**

```
"I want to build a task management app that helps small teams organize their work.
The main users are project managers and team members who need to track progress on multiple projects.
Key features should include creating tasks, assigning them to team members, setting deadlines, and viewing project dashboards."
```

#### Detailed Feature Request

```
"I need to add a [feature name] to my app.
This feature should allow users to [what users can do].
It should work like this: [describe the user flow].
Important requirements: [list any specific requirements or constraints]."
```

**Example:**

```
"I need to add a notification system to my app.
This feature should allow users to receive alerts when tasks are assigned to them or when deadlines are approaching.
It should work like this: users get email notifications and in-app notifications, and they can configure their notification preferences.
Important requirements: notifications should be real-time and users should be able to turn them off."
```

#### UI/UX Changes

```
"I want to change the [component/page name] to [describe the change].
It should look like [describe appearance] and behave like [describe functionality].
Users should be able to [list user interactions].
Make sure it works on [desktop/mobile/both]."
```

**Example:**

```
"I want to change the user dashboard to show a calendar view of tasks.
It should look like a monthly calendar with tasks displayed on their due dates.
Users should be able to click on tasks to edit them, drag tasks to different dates, and filter by project.
Make sure it works on both desktop and mobile."
```

### When Reporting Issues

#### Bug Reports

```
"I'm having an issue with [component/feature name].
When I [describe what you were doing], it [describe what went wrong] instead of [describe expected behavior].
This happens [always/sometimes/when specific conditions].
I'm using [browser/device] and the error message says [paste error message if any]."
```

**Example:**

```
"I'm having an issue with the task creation form.
When I try to create a new task, it shows an error message instead of saving the task.
This happens every time I try to create a task.
I'm using Chrome on desktop and the error message says 'Validation failed'."
```

#### Performance Issues

```
"The [feature/component] is running slowly.
It takes [time] to [action] when it should be [expected time].
This happens when [describe when it occurs].
I'm using [browser/device] and have [number] of [items] in the system."
```

### When Requesting New Features

#### Business Feature Request

```
"I need to add [feature name] because [business reason].
This will help [target users] by [benefit].
The feature should [describe functionality] and integrate with [existing features].
Priority: [high/medium/low] because [reason]."
```

**Example:**

```
"I need to add user roles because we have different types of users with different permissions.
This will help project managers by allowing them to control who can create projects and assign tasks.
The feature should allow admins to set user roles and restrict access to certain features.
Priority: high because we're launching next month and need proper access control."
```

#### Technical Feature Request

```
"I want to add [technical feature] to [component/system].
This should [describe technical functionality].
It needs to work with [existing systems] and handle [specific requirements].
Performance requirements: [response time, concurrent users, etc.]."
```

### When Asking for Help

#### General Questions

```
"I'm not sure how to [describe what you want to do].
I want to [describe your goal] but I'm not sure [what you're uncertain about].
Can you help me understand [specific question] and suggest the best approach?"
```

#### Implementation Questions

```
"I want to implement [feature] but I'm not sure about [specific concern].
Should I [option 1] or [option 2]?
What are the pros and cons of each approach?
Which would work better for [your specific use case]?"
```

## For AI Agents

### When Analyzing User Requirements

#### Requirements Clarification

```
"To help you build this application effectively, I need to understand a few things:

1. **Business Context**: [Ask about the business domain, target users, and main problems being solved]

2. **Technical Requirements**:
   - Do you need user authentication? If so, what type?
   - Will this need real-time features (like live updates)?
   - Do you need mobile responsiveness?
   - Any third-party integrations required?

3. **Data Requirements**:
   - What are the main entities in your system?
   - What relationships exist between them?
   - Any specific data validation rules?

4. **User Experience**:
   - What's the primary user flow?
   - Any specific UI/UX requirements?
   - Accessibility requirements?

5. **Timeline and Priorities**:
   - What's your MVP (minimum viable product)?
   - What features are must-have vs nice-to-have?
   - Any specific deadlines or constraints?"
```

#### Feature Planning

```
"Based on your requirements, I suggest we break this down into phases:

**Phase 1 (MVP)**: [List core features]
- [Feature 1]: [Description and complexity]
- [Feature 2]: [Description and complexity]

**Phase 2**: [List secondary features]
- [Feature 3]: [Description and complexity]

**Future Enhancements**: [List advanced features]

For each feature, I'll need to understand:
- User stories (who, what, why)
- Acceptance criteria (how do we know it's done?)
- Technical complexity (simple/medium/complex)
- Dependencies (what needs to be built first?)

Does this breakdown make sense? Should we adjust the priorities?"
```

### When Implementing Features

#### Implementation Planning

```
"I'll implement [feature name] with the following approach:

1. **Database Changes**: [Describe schema changes needed]
2. **API Endpoints**: [List new endpoints and their functionality]
3. **Frontend Components**: [Describe UI components needed]
4. **Testing**: [Describe test coverage needed]
5. **Documentation**: [Describe docs that need updating]

**Estimated Complexity**: [Simple/Medium/Complex]
**Dependencies**: [List what needs to be done first]
**Risks**: [List potential issues and mitigation strategies]

Does this approach look good? Any concerns or changes needed?"
```

#### Progress Updates

```
"Progress update on [feature name]:

✅ **Completed**: [List what's been done]
🔄 **In Progress**: [List what's currently being worked on]
⏳ **Next Steps**: [List what's coming next]
⚠️ **Issues**: [List any problems encountered and solutions]

**Current Status**: [Overall progress percentage]
**ETA**: [Estimated completion time]

Any questions or changes needed?"
```

### When Handling Errors

#### Error Analysis

```
"I've identified the issue with [problem description].

**Root Cause**: [Technical explanation]
**Impact**: [What's affected and how]
**Solution**: [Proposed fix]
**Testing**: [How to verify the fix works]
**Prevention**: [How to avoid this in the future]

I'll implement the fix now and run tests to ensure it works properly."
```

#### Debugging Assistance

```
"To help debug this issue, I need to understand:

1. **When does it happen**: [Specific conditions or triggers]
2. **What's the expected behavior**: [What should happen]
3. **What's actually happening**: [Current behavior]
4. **Error messages**: [Any error messages or logs]
5. **Environment**: [Browser, device, user account type]

Let me check the logs and run some diagnostic tests to identify the root cause."
```

### When Making Recommendations

#### Technical Recommendations

```
"Based on your requirements, I recommend [approach/technology/pattern] because:

**Pros**:
- [Benefit 1]
- [Benefit 2]
- [Benefit 3]

**Cons**:
- [Limitation 1]
- [Limitation 2]

**Alternatives**: [Other options and why they might not be as good]

**Implementation Plan**: [Step-by-step approach]

Does this recommendation work for your needs?"
```

#### Architecture Decisions

```
"For [feature/component], I suggest we use [architecture pattern] because:

**Why this approach**:
- [Technical reason 1]
- [Technical reason 2]
- [Business reason]

**How it fits with existing code**:
- [Integration point 1]
- [Integration point 2]

**Future considerations**:
- [Scalability implications]
- [Maintenance implications]

**Alternative approaches**:
- [Option 1]: [Pros/cons]
- [Option 2]: [Pros/cons]

What do you think? Any concerns about this approach?"
```

## Communication Best Practices

### For Users

1. **Be specific**: Instead of "make it better", describe exactly what you want
2. **Provide context**: Explain why you need the feature or change
3. **Give examples**: Use concrete examples to illustrate your point
4. **Ask questions**: Don't hesitate to ask for clarification or alternatives
5. **Provide feedback**: Let the AI know if something isn't working as expected

### For AI Agents

1. **Ask clarifying questions**: Don't assume - ask for specifics
2. **Explain your approach**: Help users understand what you're doing and why
3. **Provide options**: Give users choices when there are multiple valid approaches
4. **Check understanding**: Confirm you understand requirements correctly
5. **Update progress**: Keep users informed of what's happening

## Common Scenarios

### Scenario 1: Building a New Application

**User**: "I want to build a [application type]"
**AI Response**: Use the requirements clarification template above

### Scenario 2: Adding a Feature

**User**: "I need to add [feature] to my app"
**AI Response**: Use the feature planning template above

### Scenario 3: Fixing a Bug

**User**: "There's a problem with [component]"
**AI Response**: Use the bug report analysis template above

### Scenario 4: UI Changes

**User**: "I want to change how [component] looks/works"
**AI Response**: Use the implementation planning template above

### Scenario 5: Performance Issues

**User**: "The app is running slowly"
**AI Response**: Use the debugging assistance template above

These templates provide a structured approach to communication that helps ensure successful collaboration between users and AI agents when building applications.
