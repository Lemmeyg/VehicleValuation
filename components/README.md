# Components Directory

React components organized by feature.

## Structure

- `/ui` - shadcn/ui components (buttons, inputs, cards, etc.)
- `/auth` - Authentication components (login form, register form)
- `/dashboard` - Dashboard-specific components (report list, stats)
- `/forms` - Form components (vehicle input form, accident details form)
- `/report` - Report-related components (valuation display, comparables list)

## Guidelines

- Use TypeScript for all components
- Export types for component props
- Keep components small and focused
- Use composition over props drilling
- Write tests for complex components
- Use shadcn/ui components as base when possible

## Example

```typescript
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface MyComponentProps {
  title: string
  onAction: () => void
  className?: string
}

export function MyComponent({ title, onAction, className }: MyComponentProps) {
  return (
    <div className={cn('p-4', className)}>
      <h2>{title}</h2>
      <Button onClick={onAction}>Click Me</Button>
    </div>
  )
}
```
