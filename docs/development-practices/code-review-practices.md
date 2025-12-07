# Code Review Best Practices

## Code Review Goals

1. **Catch bugs early** before they reach production
2. **Knowledge sharing** across the team
3. **Maintain code quality** and consistency
4. **Onboard new team members** through review process
5. **Foster collaboration** and team cohesion

## What to Review

### Correctness

```typescript
// Check for logic errors
// ❌ Off-by-one error
for (let i = 0; i <= items.length; i++) {  // Should be <, not <=
  process(items[i]);
}

// ❌ Incorrect condition
if (user.age >= 18 || user.hasParentalConsent) {  // Should be &&, not ||
  allowPurchase();
}

// ❌ Missing null check
const userName = user.profile.name;  // Crash if profile is null
```

### Security Vulnerabilities

```typescript
// ❌ SQL injection
const query = `SELECT * FROM users WHERE email = '${email}'`;

// ❌ XSS vulnerability
element.innerHTML = userInput;

// ❌ Hardcoded secrets
const apiKey = 'sk-1234567890abcdef';

// ❌ Missing authentication
app.delete('/api/users/:id', async (req, res) => {
  await db.deleteUser(req.params.id);  // No auth check!
});
```

### Performance Issues

```typescript
// ❌ N+1 queries
for (const user of users) {
  user.orders = await db.getOrders(user.id);  // N queries
}

// ❌ Inefficient algorithm
const hasDuplicate = (arr) => {
  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length; j++) {  // O(n²)
      if (arr[i] === arr[j]) return true;
    }
  }
  return false;
};

// ❌ Memory leak
class Component {
  constructor() {
    window.addEventListener('scroll', this.handleScroll);
    // Never removed!
  }
}
```

### Code Clarity

```typescript
// ❌ Unclear variable names
const d = new Date();
const x = users.filter(u => u.a > 18);

// ✅ Clear names
const currentDate = new Date();
const adultUsers = users.filter(user => user.age > 18);

// ❌ Magic numbers
if (status === 2) {  // What is 2?
  // ...
}

// ✅ Named constants
const OrderStatus = {
  PENDING: 1,
  PROCESSING: 2,
  SHIPPED: 3
};

if (status === OrderStatus.PROCESSING) {
  // Clear intent
}
```

### Error Handling

```typescript
// ❌ Silent failures
try {
  await sendEmail(user.email);
} catch (error) {
  // Error swallowed
}

// ❌ Generic error messages
throw new Error('Something went wrong');

// ✅ Proper error handling
try {
  await sendEmail(user.email);
} catch (error) {
  logger.error('Email send failed', {
    userId: user.id,
    email: user.email,
    error: error.message
  });

  throw new EmailDeliveryError(
    `Failed to send email to ${user.email}`,
    { userId: user.id, cause: error }
  );
}
```

### Testing

```typescript
// Check test coverage
// ❌ Missing edge cases
it('should calculate discount', () => {
  expect(calculateDiscount(100)).toBe(10);
  // Missing: negative numbers, zero, very large numbers
});

// ❌ Testing implementation details
it('should call helper method', () => {
  const spy = jest.spyOn(service, 'helperMethod');
  service.doSomething();
  expect(spy).toHaveBeenCalled();  // Brittle
});

// ✅ Comprehensive tests
describe('calculateDiscount', () => {
  it('should return 10% for orders over $100', () => {
    expect(calculateDiscount(150)).toBe(15);
  });

  it('should return 0 for orders under $100', () => {
    expect(calculateDiscount(50)).toBe(0);
  });

  it('should handle edge case at exactly $100', () => {
    expect(calculateDiscount(100)).toBe(0);
  });

  it('should throw for negative amounts', () => {
    expect(() => calculateDiscount(-10)).toThrow();
  });
});
```

## How to Give Feedback

### Be Constructive

```
❌ "This code is terrible"
✅ "Consider using a Map instead of nested loops for O(1) lookups"

❌ "You don't know how to write tests"
✅ "These tests could be improved by testing the edge cases. For example, what happens when the input is empty?"

❌ "This is wrong"
✅ "This condition might not handle the case where user is null. Consider adding a null check here."
```

### Ask Questions

```
Instead of: "This is inefficient"
Try: "Have you considered using a Set here for faster lookups?"

Instead of: "This won't work"
Try: "What happens if the API returns null? Should we handle that case?"

Instead of: "Bad naming"
Try: "Could this variable name be more descriptive? Maybe 'activeUsers' instead of 'users'?"
```

### Provide Context

```
❌ "Use async/await"

✅ "Consider using async/await instead of .then() chains for better readability:
    ```typescript
    // Current
    fetchUser()
      .then(user => fetchOrders(user.id))
      .then(orders => processOrders(orders))

    // Suggested
    const user = await fetchUser();
    const orders = await fetchOrders(user.id);
    await processOrders(orders);
    ```"
```

### Distinguish Severity

```markdown
**Blocking (must fix):**
- 🔴 Security vulnerability: SQL injection risk on line 45
- 🔴 Bug: Off-by-one error will cause array out of bounds

**Important (should fix):**
- 🟠 Performance: N+1 query detected, consider using JOIN
- 🟠 Missing error handling for API call

**Suggestion (nice to have):**
- 🟡 Nit: Consider extracting this into a separate function
- 🟡 Style: This could be more readable with destructuring
```

### Praise Good Code

```
✅ "Nice use of the Strategy pattern here!"
✅ "Great test coverage on this feature"
✅ "I like how this handles the edge case"
✅ "This is much cleaner than the previous implementation"
```

## Review Checklist

### Functional Requirements
- [ ] Does the code do what it's supposed to do?
- [ ] Are edge cases handled?
- [ ] Is the error handling appropriate?
- [ ] Are there any obvious bugs?

### Code Quality
- [ ] Is the code easy to understand?
- [ ] Are variable and function names clear?
- [ ] Is there unnecessary complexity?
- [ ] Can any code be reused instead of duplicated?
- [ ] Are there magic numbers or hardcoded values?

### Security
- [ ] Is user input validated?
- [ ] Are there SQL injection risks?
- [ ] Are there XSS vulnerabilities?
- [ ] Are secrets properly handled?
- [ ] Is authentication/authorization checked?

### Performance
- [ ] Are there any obvious performance issues?
- [ ] Are database queries optimized?
- [ ] Is caching used appropriately?
- [ ] Are there memory leaks?

### Testing
- [ ] Are there tests for new functionality?
- [ ] Do tests cover edge cases?
- [ ] Are tests meaningful (not just for coverage)?
- [ ] Do all tests pass?

### Documentation
- [ ] Is complex logic documented?
- [ ] Are API changes documented?
- [ ] Are breaking changes clearly noted?

## Code Review Workflow

### Small Pull Requests

```
❌ Large PR:
- 50 files changed
- 2,000+ lines added
- Multiple features mixed together
→ Hard to review, easy to miss bugs

✅ Small PR:
- 3-5 files changed
- 100-300 lines
- Single focused change
→ Easy to review thoroughly
```

### Self-Review First

Before requesting review:

```typescript
// 1. Review your own diff
// Look for:
// - Debugging console.logs left in
// - Commented-out code
// - TODOs that should be addressed
// - Formatting inconsistencies

// 2. Run tests locally
npm test

// 3. Check for type errors
npm run typecheck

// 4. Lint code
npm run lint

// 5. Update documentation
// - README if public API changed
// - CHANGELOG for notable changes
```

### Description Template

```markdown
## What does this PR do?
Brief description of the change

## Why is this change needed?
Context and motivation

## How was this tested?
- [ ] Unit tests added/updated
- [ ] Manual testing performed
- [ ] Integration tests pass

## Screenshots (if applicable)
Before/after screenshots for UI changes

## Deployment notes
Any special deployment steps or migrations needed

## Related issues
Closes #123
```

### Review Timeline

```
- Small PR (<100 lines): Review within 4 hours
- Medium PR (100-300 lines): Review within 1 day
- Large PR (>300 lines): Break into smaller PRs

Set team SLA for code reviews to keep momentum
```

## Automation

### Pre-Commit Hooks

```bash
# .husky/pre-commit
#!/bin/sh
npm run lint
npm run typecheck
npm test
```

### CI/CD Checks

```yaml
# .github/workflows/pr-checks.yml
name: PR Checks

on: pull_request

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - run: npm ci
      - run: npm run lint

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - run: npm ci
      - run: npm test

  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - run: npm ci
      - run: npm run build

  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - run: npm audit
      - uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
```

### Automated Feedback

```typescript
// Danger.js - Automated code review
import { danger, warn, fail, message } from 'danger';

// Warn if PR is too large
const bigPRThreshold = 500;
if (danger.github.pr.additions + danger.github.pr.deletions > bigPRThreshold) {
  warn(':exclamation: This PR is quite large. Consider breaking it into smaller PRs.');
}

// Fail if tests are missing
const hasAppChanges = danger.git.modified_files.some(f => f.startsWith('src/'));
const hasTestChanges = danger.git.modified_files.some(f => f.includes('.test.'));

if (hasAppChanges && !hasTestChanges) {
  fail('Tests are missing for app code changes');
}

// Remind about CHANGELOG
const hasChangelog = danger.git.modified_files.includes('CHANGELOG.md');
if (!hasChangelog) {
  warn('Consider updating CHANGELOG.md');
}

// Check for console.log
const jsFiles = danger.git.created_files.filter(f => f.endsWith('.ts') || f.endsWith('.js'));
for (const file of jsFiles) {
  const content = await danger.github.utils.fileContents(file);
  if (content.includes('console.log')) {
    warn(`\`console.log\` found in ${file}`);
  }
}
```

## Review Anti-Patterns

### ❌ Nitpicking

```
Reviewer: "Add a space after this comma"
Reviewer: "Use single quotes instead of double quotes"
Reviewer: "This line could be 79 characters instead of 80"

→ Use automated formatters (Prettier) instead
```

### ❌ Reviewing Line-by-Line

```
❌ Commenting on every single line
→ Focus on high-level architecture and logic

✅ Comment on:
- Design decisions
- Potential bugs
- Security issues
- Performance problems

Not:
- Formatting (automate it)
- Style preferences (define team standard)
```

### ❌ Approval Without Review

```
❌ "LGTM" without actually reading code
→ Defeats the purpose of code review

✅ Actually review the code or don't approve
```

### ❌ Being Defensive

```
Author (defensive):
"This is the only way to do it"
"The previous developer wrote it this way"
"I don't have time to change this"

✅ Better response:
"Good point. I'll refactor this to use a Map"
"I hadn't considered that edge case, will add a test"
"That's a better approach, thanks for the suggestion"
```

### ❌ Endless Debates

```
Reviewer: "Use tabs"
Author: "Spaces are better"
Reviewer: "Tabs are more flexible"
...

→ Define team standard, automate with Prettier
→ Don't debate style in PR comments
```

## Pair Programming as Review

### Real-Time Code Review

```
Instead of:
1. Write code alone
2. Submit PR
3. Wait for review
4. Address comments
5. Repeat

Try:
1. Pair program with another developer
2. Review happens in real-time
3. Submit pre-reviewed PR
4. Quick final check
5. Merge

Benefits:
- Faster feedback
- Knowledge sharing
- Fewer review cycles
- Better solutions through collaboration
```

## References

- [Google's Code Review Guidelines](https://google.github.io/eng-practices/review/)
- [Conventional Comments](https://conventionalcomments.org/)
- [How to Review Code](https://mtlynch.io/human-code-reviews-1/)
- [The Art of Giving and Receiving Code Reviews](https://www.alexandra-hill.com/2018/06/25/the-art-of-giving-and-receiving-code-reviews/)
