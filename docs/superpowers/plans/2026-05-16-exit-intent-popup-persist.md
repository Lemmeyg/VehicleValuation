# Exit-Intent Popup Persist Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the exit-intent popup from being bypassed by Next.js navigation — the popup must stay visible until the user explicitly accepts the offer or clicks X.

**Architecture:** Two changes to `components/ExitIntentPopup.tsx`: (1) switch the document click listener from bubbling phase to capture phase so `e.preventDefault()` fires before React/Next.js processes the click; (2) remove `onClick` from the backdrop overlay so clicking outside the card does nothing.

**Tech Stack:** Next.js 16, React 19, React Testing Library, Jest

---

## File Map

| File                                            | Action                                                                 |
| ----------------------------------------------- | ---------------------------------------------------------------------- |
| `components/ExitIntentPopup.tsx`                | Modify — capture-phase listener + remove backdrop onClick + add testid |
| `__tests__/components/ExitIntentPopup.test.tsx` | Modify — add backdrop-inertness test                                   |

---

### Task 1: Write failing test for inert backdrop

**Files:**

- Modify: `__tests__/components/ExitIntentPopup.test.tsx`

- [ ] **Step 1: Add the failing test**

Open `__tests__/components/ExitIntentPopup.test.tsx` and add this `describe` block after the existing `ExitIntentPopup — CTA action` block (around line 129):

```tsx
describe('ExitIntentPopup — dismiss behaviour', () => {
  it('does NOT dismiss when the backdrop overlay is clicked', () => {
    render(
      <>
        <ExitIntentPopup vin="1HGCM82633A123456" reportId="r1" onSelectPlan={jest.fn()} />
        <a href="/home">Home</a>
      </>
    )
    // Trigger popup
    fireEvent.click(screen.getByText('Home'))
    expect(screen.getByText(/insurance company/i)).toBeInTheDocument()

    // Click the backdrop (outside the card)
    fireEvent.click(screen.getByTestId('popup-backdrop'))
    // Popup must still be visible
    expect(screen.getByText(/insurance company/i)).toBeInTheDocument()
  })

  it('dismisses when the X button is clicked', () => {
    render(
      <>
        <ExitIntentPopup vin="1HGCM82633A123456" reportId="r1" onSelectPlan={jest.fn()} />
        <a href="/home">Home</a>
      </>
    )
    fireEvent.click(screen.getByText('Home'))
    expect(screen.getByText(/insurance company/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(screen.queryByText(/insurance company/i)).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the new tests to confirm they fail**

```bash
cd "C:/Users/Gordo/Documents/Vehicle Comparison Site"
npx jest __tests__/components/ExitIntentPopup.test.tsx --testNamePattern="dismiss" --no-coverage
```

Expected: both new tests **FAIL**.

- `does NOT dismiss...` fails because `getByTestId('popup-backdrop')` throws — the testid doesn't exist yet.
- `dismisses when the X button...` may pass already (that's fine — it documents existing correct behaviour).

---

### Task 2: Implement the fix in ExitIntentPopup

**Files:**

- Modify: `components/ExitIntentPopup.tsx`

- [ ] **Step 3: Apply all three edits**

Open `components/ExitIntentPopup.tsx`. Make the following three changes:

**Edit A** — Add `data-testid` to the backdrop div and remove its `onClick` handler.

Find (line 86–88):

```tsx
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={handleDismiss}
    >
```

Replace with:

```tsx
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      data-testid="popup-backdrop"
    >
```

**Edit B** — Switch the click listener to capture phase.

Find (line 58):

```ts
document.addEventListener('click', handleClick)
```

Replace with:

```ts
document.addEventListener('click', handleClick, { capture: true })
```

**Edit C** — Match the cleanup to use capture phase.

Find (line 60):

```ts
document.removeEventListener('click', handleClick)
```

Replace with:

```ts
document.removeEventListener('click', handleClick, { capture: true })
```

- [ ] **Step 4: Run the full test suite for this component**

```bash
cd "C:/Users/Gordo/Documents/Vehicle Comparison Site"
npx jest __tests__/components/ExitIntentPopup.test.tsx --no-coverage
```

Expected: **all tests PASS**.

- [ ] **Step 5: Run the full project test suite to check for regressions**

```bash
cd "C:/Users/Gordo/Documents/Vehicle Comparison Site"
npm run test:ci
```

Expected: all tests pass, no regressions.

---

### Task 3: Commit

- [ ] **Step 6: Commit the changes**

```bash
cd "C:/Users/Gordo/Documents/Vehicle Comparison Site"
git add components/ExitIntentPopup.tsx __tests__/components/ExitIntentPopup.test.tsx
git commit -m "fix: persist exit-intent popup until user explicitly acts

- Switch document click listener to capture phase so e.preventDefault()
  fires before Next.js processes the event, blocking navigation
- Remove onClick from backdrop overlay — only X button and CTA can close
- Add data-testid to backdrop for testability"
```
