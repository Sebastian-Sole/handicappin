# Icons

**This project uses `@phosphor-icons/react`.** All icon imports should come from `@phosphor-icons/react`.

---

## Icons in Button use data-icon attribute

Add `data-icon="inline-start"` (prefix) or `data-icon="inline-end"` (suffix) to the icon. No sizing classes on the icon.

**Incorrect:**

```tsx
<Button>
  <MagnifyingGlass className="mr-2 size-4" />
  Search
</Button>
```

**Correct:**

```tsx
<Button>
  <MagnifyingGlass data-icon="inline-start"/>
  Search
</Button>

<Button>
  Next
  <ArrowRight data-icon="inline-end"/>
</Button>
```

---

## No sizing classes on icons inside components

Components handle icon sizing via CSS. Don't add `size-4`, `w-4 h-4`, or other sizing classes to icons inside `Button`, `DropdownMenuItem`, `Alert`, `Sidebar*`, or other shadcn components. Unless the user explicitly asks for custom icon sizes.

**Incorrect:**

```tsx
<Button>
  <MagnifyingGlass className="size-4" data-icon="inline-start" />
  Search
</Button>

<DropdownMenuItem>
  <GearSix className="mr-2 size-4" />
  Settings
</DropdownMenuItem>
```

**Correct:**

```tsx
<Button>
  <MagnifyingGlass data-icon="inline-start" />
  Search
</Button>

<DropdownMenuItem>
  <GearSix />
  Settings
</DropdownMenuItem>
```

---

## Pass icons as component objects, not string keys

Use `icon={Check}`, not a string key to a lookup map.

**Incorrect:**

```tsx
const iconMap = {
  check: Check,
  alert: Warning,
}

function StatusBadge({ icon }: { icon: string }) {
  const Icon = iconMap[icon]
  return <Icon />
}

<StatusBadge icon="check" />
```

**Correct:**

```tsx
import { Check } from "@phosphor-icons/react"

function StatusBadge({ icon: Icon }: { icon: React.ComponentType }) {
  return <Icon />
}

<StatusBadge icon={Check} />
```
