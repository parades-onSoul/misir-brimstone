# Notion UI Redesign - Quick Start Guide

## 🎨 What Changed?

Your Misir frontend now features a **Notion-inspired design system** with:

✅ Clean, minimal Notion aesthetics  
✅ Warm neutral color palette  
✅ Professional polish and consistency  
✅ Modern shadcn/ui + Tailwind v4 stack (unchanged)  
✅ Full dark mode support  

## 🚀 Running the App

```bash
cd frontend
npm install  # Install dependencies (if needed)
npm run dev  # Start development server
```

Visit: `http://localhost:3000`

## 📦 What's Included

### New Files
- `lib/notion-theme.ts` - Design token system
- `NOTION_REDESIGN.md` - Complete documentation

### Updated Files
- `app/globals.css` - Notion color palette + utilities
- `components/app-sidebar.tsx` - Refined sidebar
- `app/dashboard/page.tsx` - Cleaner dashboard
- `components/spaces/create-space-modal.tsx` - Better modal
- `components/login-form.tsx` - Professional auth forms
- `components/signup-form.tsx` - Consistent styling
- `app/login/page.tsx` - Branded login page
- `app/signup/page.tsx` - Branded signup page

## 🎨 Using the Design System

### Buttons

```tsx
// Primary action
<button className="notion-button-primary">
  Create Space
</button>

// Secondary action
<button className="notion-button-secondary">
  Cancel
</button>

// Ghost/subtle action
<button className="notion-hover">
  View details
</button>
```

### Inputs

```tsx
<Input className="notion-input h-10" placeholder="Enter text..." />
```

### Cards

```tsx
<Card className="border-border/40 shadow-sm hover:shadow-md">
  <CardHeader className="border-b border-border/40 bg-secondary/20">
    <CardTitle>Card Title</CardTitle>
  </CardHeader>
  <CardContent>
    Card content
  </CardContent>
</Card>
```

### Pages with Hero Section

```tsx
<div className="min-h-screen bg-background">
  {/* Hero */}
  <div className="border-b border-border/40 bg-secondary/30">
    <div className="notion-page py-8">
      <h1 className="text-3xl font-semibold">Page Title</h1>
    </div>
  </div>

  {/* Content */}
  <div className="notion-page py-6">
    {/* Your content */}
  </div>
</div>
```

### Hover States

```tsx
<div className="notion-hover p-3 rounded-md">
  Interactive item
</div>
```

## 🎨 Color Reference

### CSS Variables (Use these!)

```css
/* Backgrounds */
bg-background         /* Main background */
bg-secondary          /* Subtle background */
bg-muted              /* Muted elements */

/* Text */
text-foreground       /* Primary text */
text-muted-foreground /* Secondary text */

/* Borders */
border-border/40      /* Subtle borders (Notion-style) */
border-border         /* Normal borders */

/* Accents */
bg-primary           /* Blue accent */
text-primary         /* Blue text */
```

### Utility Classes

```css
.notion-hover        /* Instant hover effect (20ms) */
.notion-page         /* Page container with max-width */
.notion-input        /* Form input styling */
.notion-button-primary    /* Primary blue button */
.notion-button-secondary  /* Secondary gray button */
```

## 🌗 Dark Mode

Dark mode works automatically! The system detects `html.dark` class.

All colors auto-adjust for proper contrast and visual hierarchy.

## 📐 Spacing & Typography

### Font Sizes
- Text: `text-sm` (13px), `text-base` (15px), `text-lg` (18px)
- Headings: `text-xl` (20px), `text-2xl` (24px), `text-3xl` (30px)

### Spacing Classes
- Padding: `p-2` (8px), `p-3` (12px), `p-4` (16px), `p-6` (24px)
- Gap: `gap-2` (8px), `gap-4` (16px), `gap-6` (24px)

### Border Radius
- Small: `rounded-md` (4px)
- Medium: `rounded-lg` (6px)
- Large: `rounded-xl` (8px)

## 🎯 Component Patterns

### Form Field

```tsx
<div className="space-y-2">
  <Label className="text-sm font-medium">Label</Label>
  <Input className="notion-input h-10" />
  <p className="text-xs text-muted-foreground">Helper text</p>
</div>
```

### Error State

```tsx
{error && (
  <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3">
    <p className="text-sm text-destructive">{error}</p>
  </div>
)}
```

### Loading State

```tsx
{isLoading ? (
  <Loader2 className="h-4 w-4 animate-spin" />
) : (
  'Submit'
)}
```

### Sidebar Item

```tsx
<SidebarMenuButton className="notion-hover h-8">
  <Icon className="h-4 w-4" />
  <span className="text-sm">Item Name</span>
</SidebarMenuButton>
```

## 🎨 Branding

The app now uses **Sparkles** (✨) icon for branding:

```tsx
import { Sparkles } from 'lucide-react'

<div className="size-8 rounded-lg bg-gradient-to-br from-primary/90 to-primary">
  <Sparkles className="size-4 text-primary-foreground" />
</div>
```

## 🔧 Customization

### Change Primary Color

Edit `app/globals.css`:

```css
:root {
  --primary: oklch(0.55 0.15 240); /* Current blue */
  /* Change to: */
  --primary: oklch(0.66 0.19 165); /* Green */
}
```

### Adjust Border Opacity

Throughout the app, borders use `/40` opacity:

```tsx
border-border/40  // 40% opacity (Notion-style)
border-border     // 100% opacity (more visible)
```

### Modify Transition Speed

Edit `app/globals.css`:

```css
.notion-hover {
  transition: background-color 20ms ease-in-out; /* Current */
  /* Change to: */
  transition: background-color 100ms ease-in-out; /* Slower */
}
```

## 📱 Responsive Design

All components are fully responsive:

- **Mobile**: Stacked layouts, touch-friendly targets
- **Tablet**: Adapted spacing, collapsible sidebar
- **Desktop**: Full sidebar, optimized layouts

Use standard Tailwind breakpoints:
- `md:` - Tablet and up (768px+)
- `lg:` - Desktop and up (1024px+)

## 🎓 Learn More

- **Full documentation**: See `NOTION_REDESIGN.md`
- **Design tokens**: See `lib/notion-theme.ts`
- **Component examples**: Browse `components/` directory

## ✅ Checklist for New Components

When creating new components:

- [ ] Use `.notion-hover` for interactive elements
- [ ] Apply `border-border/40` for Notion-style borders
- [ ] Use `text-sm` (13px) for body text, `text-base` (15px) for primary content
- [ ] Add `h-8` or `h-10` to buttons/inputs for consistent sizing
- [ ] Include dark mode support (test with `html.dark` class)
- [ ] Apply `shadow-sm hover:shadow-md` to cards
- [ ] Use `bg-secondary/20` for subtle section backgrounds

## 🚨 Migration from Old Components

If you have custom components using old styling:

**Before:**
```tsx
<button className="bg-primary hover:bg-primary/90">
  Click me
</button>
```

**After:**
```tsx
<button className="notion-button-primary">
  Click me
</button>
```

**Before:**
```tsx
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
  </CardHeader>
</Card>
```

**After:**
```tsx
<Card className="border-border/40 shadow-sm">
  <CardHeader className="border-b border-border/40 bg-secondary/20">
    <CardTitle>Title</CardTitle>
  </CardHeader>
</Card>
```

## 💡 Pro Tips

1. **Hover states**: Always use `.notion-hover` for instant feedback
2. **Borders**: Use `/40` opacity for Notion's subtle look
3. **Spacing**: Notion uses compact spacing—prefer `p-2` to `p-4`
4. **Typography**: Stick to `text-sm` and `text-base` for consistency
5. **Icons**: Use `h-4 w-4` (16px) for most icons
6. **Shadows**: Keep them subtle with `shadow-sm`

## 🎯 Common Patterns

### Full-Width Button
```tsx
<button className="notion-button-primary w-full h-10">
  Continue
</button>
```

### Icon with Text
```tsx
<div className="flex items-center gap-2">
  <Sparkles className="h-4 w-4" />
  <span>Label</span>
</div>
```

### Subtle Section Header
```tsx
<div className="px-2 py-1 text-[11px] font-medium text-muted-foreground">
  SECTION
</div>
```

### Card Grid
```tsx
<div className="grid gap-4 lg:grid-cols-2">
  <Card>...</Card>
  <Card>...</Card>
</div>
```

## 📞 Support

- **Bug reports**: Check console for errors
- **Styling issues**: Verify CSS is loading (`npm run dev`)
- **Dark mode problems**: Check `html.dark` class exists
- **Spacing issues**: Use browser DevTools to inspect

---

**Enjoy your new Notion-inspired design! 🎨✨**
