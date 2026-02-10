# Misir Frontend UI Structure — Linear Edition

This document provides a comprehensive overview of the UI structure for each page in the Misir application, following the **Linear aesthetic**: high-density, dark mode, keyboard-centric, and border-defined.

## Design System Overview

### Visual Philosophy
Misir follows Linear's design principles:
- **High Density**: Information-rich layouts with minimal chrome
- **Dark First**: Deep blacks with subtle gradients
- **Border-Defined**: Structural clarity through 1px borders
- **Keyboard-Centric**: Every action is keyboard accessible
- **Desktop First**: Optimized for productivity workflows, responsive down to mobile

### Design Tokens (Tailwind v4)

#### Backgrounds
| Token | Value | Usage |
|-------|-------|-------|
| `bg-[#0B0C0E]` | The Void | Main app background |
| `bg-[#141517]` | The Surface | Cards, sidebars, modals |
| `bg-[#191A1D]` | Hover State | List item hover |

#### Borders
| Token | Value | Usage |
|-------|-------|-------|
| `border-white/5` | Subtle | Structural dividers |
| `border-white/10` | Active | Hover states, focused inputs |
| `border-white/[0.02]` | Ultra-subtle | List dividers |

#### Typography
| Token | Value | Usage |
|-------|-------|-------|
| `font-inter` | Inter | Primary font family |
| `text-[13px]` | 13px | Base font size |
| `text-[#EEEEF0]` | Primary | High contrast text |
| `text-[#8A8F98]` | Muted | Secondary text (Linear grey) |
| `text-[#5F646D]` | Subtle | Tertiary text, labels |

#### Accents
| Token | Value | Usage |
|-------|-------|-------|
| `text-[#5E6AD2]` | Linear Purple | Primary brand color |
| `bg-[#5E6AD2]` | Linear Purple | Primary buttons, active states |
| `shadow-glow` | `0 0 20px rgba(94,106,210,0.15)` | Accent glow effect |

#### Effects
- **Transitions**: `duration-150 ease-out` (Fast, snappy)
- **Hover**: No scale. Only brightness and border opacity changes
- **Modal Pop**: Scale 0.95 → 1.00, Opacity 0 → 1 (Very subtle)

---

## Core Layout Structure

### 1. The Global Shell

The application uses a **Two-Column Shell** layout. The sidebar is the primary navigation anchor, while the main content area handles specific views.

#### Layout Structure (`app/layout.tsx`)

```tsx
<body className="bg-[#0B0C0E] text-[#EEEEF0] font-sans antialiased overflow-hidden selection:bg-[#5E6AD2]/30">
  <div className="flex h-screen w-full">
    
    {/* 1. The Sidebar (Fixed) */}
    <aside className="w-[260px] flex-shrink-0 border-r border-white/5 bg-[#0B0C0E]/95 backdrop-blur-xl z-20">
      <AppSidebar />
    </aside>

    {/* 2. Main Content (Fluid) */}
    <main className="flex-1 flex flex-col min-w-0 bg-[#0B0C0E] relative overflow-hidden">
      
      {/* 2a. Page Header (Sticky) */}
      <header className="h-12 flex-shrink-0 border-b border-white/5 flex items-center px-6 sticky top-0 z-10 bg-[#0B0C0E]/80 backdrop-blur-md">
        <PageHeader />
      </header>

      {/* 2b. Scrollable Canvas */}
      <div className="flex-1 overflow-y-auto p-0 scrollbar-hide">
        {children}
      </div>

    </main>

  </div>
</body>
```

#### Visual Diagram
```
┌──────────────────┬──────────────────────────────────────────────────┐
│  SIDEBAR         │  HEADER (Sticky, Glass)            [Actions]     │
│  w-[260px]       ├──────────────────────────────────────────────────┤
│  bg-[#0B0C0E]    │                                                  │
│  border-r        │  MAIN CONTENT                                    │
│  border-white/5  │  flex-1                                          │
│                  │  overflow-y-auto                                 │
│  [Workspace]     │                                                  │
│                  │  [View: Dashboard / List / Settings]             │
│  [Nav Items]     │                                                  │
│                  │                                                  │
│  [User Profile]  │                                                  │
│                  │                                                  │
└──────────────────┴──────────────────────────────────────────────────┘
```

---

### 2. Component Specifications

#### A. The Sidebar (AppSidebar)

The navigation hub. It relies on subtle hover states and grouping.

**Dimensions**
- Width: `w-[260px]` (constant)
- Height: `h-screen` (100vh)
- Background: `bg-[#0B0C0E]/95 backdrop-blur-xl`
- Border: `border-r border-white/5`
- Z-Index: `z-20` (above content, below overlays)

**Typography**
- Group Labels: `text-[11px] font-medium text-[#5F646D] uppercase tracking-wider`
- Nav Items: `text-[13px] font-medium text-[#8A8F98]`

**Navigation Items**
- Height: `h-7` (28px)
- Padding: `px-3`
- Hover State: `hover:bg-white/[0.04] hover:text-[#EEEEF0] rounded-md transition-colors duration-150`
- Active State: `bg-white/[0.06] text-[#EEEEF0] rounded-md`
- Icon Size: `size-[15px]` (15px)

**Visual Structure**
```
┌───────────────────────────────┐
│  [⚡] Misir                    │  <-- Static Header
├───────────────────────────────┤
│                               │
│  [🔍] Search           ⌘K     │  <-- Global Actions
│  [+] New Topic          C     │
│                               │
│  INSIGHTS                     │  <-- Section 1
│  • Analytics                  │
│  • Weekly Report              │
│                               │
│  SPACES                       │  <-- Section 2
│  # Engineering        [+]     │
│  # Design System              │
│  # React Patterns             │
│  ⚡ All Spaces                │
│                               │
│  [Flex Spacer]                │
├───────────────────────────────┤
│  [👤] User Name        [⚙]    │  <-- Footer
└───────────────────────────────┘
```

**Composition**

1. **Header (Static Brand)**
   - Height: `h-12`
   - Logo: `size-5` with glow effect
   - Brand name: `text-[14px] font-semibold`
   - Border bottom: `border-b border-white/5`
   - No dropdown (simplified)

2. **Global Actions**
   - Search: Opens command palette (`Cmd+K`)
   - New Topic: Creates new learning topic (`C`)
   - Height: `h-8` per action
   - Shows keyboard shortcut on right

3. **Section: Insights** (Previously "Your Work")
   - Analytics: Data dashboard
   - Weekly Report: Generated summaries
   - Section represents "value extraction" from data

4. **Section: Spaces**
   - List of user spaces with `#` icon
   - "All Spaces" link at bottom (shows count)
   - Hover on header shows `[+]` button
   - Active space gets `bg-white/[0.06]` + purple icon

5. **Footer: User Profile**
   - Height: `h-[52px]`
   - Avatar: `size-6` with gradient
   - Username: `text-[13px] font-medium`
   - Settings icon: `size-3.5` (right side)
   - Border top: `border-t border-white/5`

---

**Complete Component Implementation**

```tsx
// components/layout/AppSidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Search, 
  PlusSquare, 
  BarChart2, 
  FileText, 
  Layers, 
  Hash, 
  Settings 
} from "lucide-react";
import { cn } from "@/lib/utils";

// --- Sub-Components ---

const SidebarHeader = () => (
  <div className="h-12 flex items-center px-4 mb-2 border-b border-white/5">
    <div className="flex items-center gap-2.5 text-[#EEEEF0]">
      {/* Brand Icon (Static, with glow) */}
      <div className="size-5 bg-[#5E6AD2] rounded flex items-center justify-center shadow-[0_0_10px_rgba(94,106,210,0.4)]">
        <svg 
          className="w-3 h-3 text-white" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor" 
          strokeWidth={3}
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            d="M13 10V3L4 14h7v7l9-11h-7z" 
          />
        </svg>
      </div>
      <span className="text-[14px] font-semibold tracking-tight">Misir</span>
    </div>
  </div>
);

interface SidebarActionProps {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  shortcut?: string;
  onClick?: () => void;
}

const SidebarAction = ({ icon: Icon, label, shortcut, onClick }: SidebarActionProps) => (
  <button 
    onClick={onClick}
    className="flex items-center gap-2.5 px-3 h-8 w-full text-left rounded-md text-[#8A8F98] hover:bg-white/[0.04] hover:text-[#EEEEF0] transition-colors group"
  >
    <Icon className="size-[15px] opacity-70 group-hover:opacity-100" strokeWidth={1.5} />
    <span className="text-[13px] font-medium flex-1">{label}</span>
    {shortcut && (
      <kbd className="text-[10px] text-[#5F646D] font-mono border border-white/10 px-1 rounded bg-white/[0.02]">
        {shortcut}
      </kbd>
    )}
  </button>
);

interface SectionHeaderProps {
  label: string;
  onAdd?: () => void;
}

const SectionHeader = ({ label, onAdd }: SectionHeaderProps) => (
  <div className="flex items-center justify-between mt-6 mb-1 px-3 group">
    <span className="text-[11px] font-medium text-[#5F646D] uppercase tracking-wider">
      {label}
    </span>
    {onAdd && (
      <button 
        onClick={onAdd}
        className="text-[#5F646D] hover:text-[#EEEEF0] opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <PlusSquare className="size-3" strokeWidth={1.5} />
      </button>
    )}
  </div>
);

interface NavItemProps {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  href: string;
  active?: boolean;
}

const NavItem = ({ icon: Icon, label, href, active }: NavItemProps) => (
  <Link 
    href={href}
    className={cn(
      "flex items-center gap-2.5 px-3 h-7 rounded-md transition-all duration-150",
      active 
        ? "text-[#EEEEF0] bg-white/[0.06]" 
        : "text-[#8A8F98] hover:bg-white/[0.04] hover:text-[#EEEEF0]"
    )}
  >
    <Icon 
      className={cn(
        "size-[15px]", 
        active ? "text-[#5E6AD2]" : "text-[#5F646D]"
      )} 
      strokeWidth={1.5} 
    />
    <span className="text-[13px] font-medium">{label}</span>
  </Link>
);

// --- Main Sidebar Component ---

export const AppSidebar = () => {
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path;

  return (
    <aside className="w-[260px] h-screen flex flex-col bg-[#0B0C0E]/95 backdrop-blur-xl border-r border-white/5">
      
      {/* 1. Static Header */}
      <SidebarHeader />

      <div className="flex-1 overflow-y-auto px-2 py-2 scrollbar-hide">
        
        {/* 2. Global Actions */}
        <div className="space-y-0.5">
          <SidebarAction 
            icon={Search} 
            label="Search" 
            shortcut="⌘K" 
            onClick={() => {/* Open command palette */}}
          />
          <SidebarAction 
            icon={PlusSquare} 
            label="New Topic" 
            shortcut="C" 
            onClick={() => {/* Open create modal */}}
          />
        </div>

        {/* 3. Section: Insights */}
        <SectionHeader label="Insights" />
        <div className="space-y-0.5">
          <NavItem 
            icon={BarChart2} 
            label="Analytics" 
            href="/dashboard/analytics" 
            active={isActive("/dashboard/analytics")}
          />
          <NavItem 
            icon={FileText} 
            label="Weekly Report" 
            href="/dashboard/report" 
            active={isActive("/dashboard/report")}
          />
        </div>

        {/* 4. Section: Spaces */}
        <SectionHeader 
          label="Spaces" 
          onAdd={() => console.log("Create new space")} 
        />
        <div className="space-y-0.5">
          <NavItem 
            icon={Hash} 
            label="Engineering" 
            href="/spaces/engineering" 
            active={isActive("/spaces/engineering")}
          />
          <NavItem 
            icon={Hash} 
            label="Design System" 
            href="/spaces/design" 
            active={isActive("/spaces/design")}
          />
          <NavItem 
            icon={Hash} 
            label="React Patterns" 
            href="/spaces/react" 
            active={isActive("/spaces/react")}
          />
          <NavItem 
            icon={Layers} 
            label="All Spaces" 
            href="/spaces" 
            active={isActive("/spaces")}
          />
        </div>

      </div>

      {/* 5. Footer: User Profile */}
      <div className="h-[52px] border-t border-white/5 flex items-center px-4 hover:bg-white/[0.02] cursor-pointer transition-colors">
        <div className="size-6 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 border border-white/10 mr-2.5" />
        <span className="text-[13px] font-medium text-[#EEEEF0]">User Name</span>
        <Settings className="ml-auto size-3.5 text-[#5F646D]" strokeWidth={1.5} />
      </div>

    </aside>
  );
};
```

**Why "Insights"?**

The section name was changed from "Your Work" to **"Insights"** because it better represents the purpose:

| Name | Meaning | Fit |
|------|---------|-----|
| **Insights** ✅ | Value extraction, actionable intelligence | Perfect for Analytics + Reports |
| Analytics | Raw data (charts, graphs) | Too narrow |
| Reports | Summarized data | Too narrow |
| Intelligence | AI/Learning theme | Good alternative |
| Overview | Classic, safe | Generic |
| Performance | Learning speed focus | Too specific |

The term "Insights" implies that both analytics and reports serve the same goal: **extracting meaningful patterns from your learning data**.

---

#### B. The Page Header (PageHeader)

Contextual navigation and view controls.

**Dimensions**
- Height: `h-12` (48px, fixed)
- Padding: `px-6`
- Border: `border-b border-white/5`
- Background: `bg-[#0B0C0E]/80 backdrop-blur-md`
- Position: `sticky top-0`
- Z-Index: `z-10`

**Layout**
```tsx
<header className="h-12 flex items-center justify-between px-6 border-b border-white/5 bg-[#0B0C0E]/80 backdrop-blur-md sticky top-0 z-10">
  {/* Left: Breadcrumbs */}
  <nav className="flex items-center gap-2 text-[13px]">
    <a href="/" className="text-[#8A8F98] hover:text-[#EEEEF0] transition-colors">Dashboard</a>
    <span className="text-[#5F646D]">/</span>
    <span className="text-[#EEEEF0] font-medium">Spaces</span>
  </nav>

  {/* Right: View Controls */}
  <div className="flex items-center gap-2">
    <ViewToggle />
    <FilterButton />
    <DisplayOptions />
  </div>
</header>
```

**Breadcrumbs**
- Size: `text-[13px]`
- Color: `text-[#8A8F98]` (inactive), `text-[#EEEEF0]` (active)
- Hover: `hover:text-[#EEEEF0]`
- Separator: `/` with `text-[#5F646D]`

---

#### C. The Content Canvas

Where the page actually lives. Linear uses two distinct layout modes:

**Mode 1: The List View** (Default)
Used for Artifacts, Search, Issues.

```tsx
<div className="w-full">
  {/* Header: sticky */}
  <div className="sticky top-0 z-10 bg-[#0B0C0E]/95 backdrop-blur-sm border-b border-white/5">
    <div className="h-10 flex items-center px-6 text-[11px] uppercase tracking-widest text-[#5F646D]">
      <div className="w-20">ID</div>
      <div className="flex-1">TITLE</div>
      <div className="w-32">SPACE</div>
      <div className="w-20 text-right">UPDATED</div>
    </div>
  </div>

  {/* Rows */}
  {items.map(item => (
    <div className="h-10 flex items-center px-6 border-b border-white/[0.03] hover:bg-[#121315] cursor-pointer transition-colors duration-150">
      {/* Row content */}
    </div>
  ))}
</div>
```

**Specifications**
- Container: Full width, `px-0`
- Row Height: `h-10` (40px, high density)
- Row Padding: `px-6`
- Row Border: `border-b border-white/[0.03]` (ultra-subtle)
- Row Hover: `hover:bg-[#121315]`
- Header: Sticky with backdrop blur

**Mode 2: The Document View** (Settings, Onboarding)
Used for text-heavy or form-heavy pages.

```tsx
<div className="max-w-[850px] mx-auto pt-12 pb-24 px-8">
  <h1 className="text-2xl font-bold text-[#EEEEF0] mb-6">Page Title</h1>
  <p className="text-[13px] text-[#8A8F98] leading-relaxed mb-8">
    Description text...
  </p>
  
  {/* Form or content sections */}
</div>
```

**Specifications**
- Max Width: `max-w-[850px]`
- Centering: `mx-auto`
- Padding: `pt-12 pb-24 px-8`
- Typography: Standard document hierarchy

---

### 3. Responsive Behavior

The layout adapts for mobile without losing the "density" feel.

| Breakpoint | Sidebar Behavior | Content Behavior |
|------------|------------------|------------------|
| **Desktop (lg+)** | Fixed, visible | Fluid, adjacent to sidebar |
| **Tablet (md)** | Collapsed to icons or Drawer | Full width |
| **Mobile (sm)** | Hidden behind Hamburger Menu | Full width, header gains menu trigger |

**Mobile Sidebar (Drawer)**
- Implementation: Shadcn `Sheet` component
- Transition: Slide from left (150ms)
- Overlay: `bg-black/60 backdrop-blur-sm`
- Width: `w-[260px]` (same as desktop)

```tsx
// Mobile Header with Menu Trigger
<header className="lg:hidden">
  <button className="size-8 flex items-center justify-center text-[#8A8F98] hover:text-[#EEEEF0]">
    <MenuIcon className="size-4" />
  </button>
</header>

// Sidebar visibility
<aside className="hidden lg:flex w-[260px] ...">
  {/* Desktop sidebar */}
</aside>

<Sheet>
  <SheetContent side="left" className="w-[260px] p-0">
    <AppSidebar />
  </SheetContent>
</Sheet>
```

---

### 4. Layering & Z-Index Strategy

To maintain the "Glass" effect, strict layering is required.

| Layer | Z-Index | Usage |
|-------|---------|-------|
| Base | `z-0` | Main content background |
| Content | `z-1` | Text, cards, lists |
| Sticky Headers | `z-10` | Page headers, table headers |
| Sidebar | `z-20` | Navigation (must sit above page scroll) |
| Overlays | `z-30` | Modals, Command Palette (⌘K) |
| Popovers | `z-40` | Dropdowns, Tooltips |
| Toasts | `z-50` | Notifications (top-center) |

**Implementation**
```tsx
// Page Header
<header className="sticky top-0 z-10 bg-[#0B0C0E]/80 backdrop-blur-md">

// Sidebar
<aside className="z-20 bg-[#0B0C0E]/95 backdrop-blur-xl">

// Command Palette
<Dialog className="z-30">

// Dropdown Menu
<DropdownMenu className="z-40">

// Toast Notifications
<Toaster className="z-50" />
```

---

### 5. Key Design Tokens for Layout

Add these to your `tailwind.config.ts` or CSS variables to enforce layout consistency.

```css
:root {
  /* Layout Dimensions */
  --sidebar-width: 260px;
  --header-height: 48px;
  
  /* Layout Colors */
  --bg-app: #0B0C0E;
  --bg-sidebar: rgba(11, 12, 14, 0.95);
  --bg-surface: #141517;
  --bg-hover: #191A1D;
  
  /* Layout Borders */
  --border-layout: rgba(255, 255, 255, 0.05); /* Main dividers */
  --border-subtle: rgba(255, 255, 255, 0.03); /* List items */
  --border-active: rgba(255, 255, 255, 0.10); /* Focus states */
}
```

**Usage Example**
```tsx
<div className="h-[var(--header-height)] border-b border-[var(--border-layout)]">
  {/* Header Content */}
</div>

<aside className="w-[var(--sidebar-width)] bg-[var(--bg-sidebar)]">
  {/* Sidebar Content */}
</aside>
```

---

## Page Structure Reference

### 1. Root Page (`/`)
**File**: `app/page.tsx`

#### Purpose
- Authentication gate with instant redirect
- No loading UI needed — handled by layout

#### Layout
```
[Instant redirect based on auth state]
→ Authenticated: /dashboard
→ Unauthenticated: /login
```

#### Implementation
- Server-side redirect preferred
- No spinner needed (seamless transition)

---

### 2. Login Page (`/login`)
**File**: `app/login/page.tsx`

#### Visual: "The Monolith"

```
┌─────────────────────────────────────────────────┐
│        Radial gradient background               │
│        from-[#18191D] to-[#0B0C0E]             │
│                                                 │
│          ┌─────────────────────┐                │
│          │  [48px Purple Icon] │                │
│          │                     │                │
│          │  Misir              │                │
│          │  Orientation OS     │                │
│          │                     │                │
│          │  ───────────────    │                │
│          │                     │                │
│          │  Email              │                │
│          │  [Input]            │                │
│          │                     │                │
│          │  Password           │                │
│          │  [Input]            │                │
│          │                     │                │
│          │  [Sign In Button]   │                │
│          │                     │                │
│          │  New? Sign up →     │                │
│          └─────────────────────┘                │
│                                                 │
└─────────────────────────────────────────────────┘
```

#### Card Specifications
- **Container**: `w-[400px] mx-auto`
- **Card**: 
  - Background: `bg-[#141517]`
  - Border: `border border-white/5`
  - Shadow: `shadow-2xl`
  - Padding: `p-8`

#### Input Fields
- **Background**: `bg-[#0B0C0E]`
- **Border**: `border-white/10`
- **Focus**: `focus:border-[#5E6AD2] focus:ring-1 focus:ring-[#5E6AD2]`
- **Height**: `h-10`
- **Text**: `text-[13px] text-[#EEEEF0]`
- **Placeholder**: `text-[#5F646D]`

#### Button
- **Primary**: 
  - Background: `bg-[#5E6AD2]`
  - Hover: `hover:bg-[#4E5AC0]`
  - Shadow: `shadow-glow`
  - Size: `h-10 w-full`
  - Text: `text-[13px] font-medium`

#### Animations
- Card entrance: Opacity 0→1, Scale 0.95→1.0 (150ms)
- No slide animations — instant and snappy

---

### 3. Signup Page (`/signup`)
**File**: `app/signup/page.tsx`

#### Layout
Similar to login with additional fields:

```
┌─────────────────────────────────────┐
│  [Icon] Misir                       │
│                                     │
│  Create Account                     │
│  ─────────────────                  │
│                                     │
│  Email                              │
│  [Input]                            │
│                                     │
│  Password                           │
│  [Input]                            │
│                                     │
│  Confirm Password                   │
│  [Input]                            │
│                                     │
│  [Create Account]                   │
│                                     │
│  Have an account? Sign in →         │
└─────────────────────────────────────┘
```

#### Validation
- Real-time validation with inline errors
- Error text: `text-[11px] text-red-400 mt-1`
- Error border: `border-red-500/50`

---

### 4. Onboarding Page (`/onboarding`)
**File**: `app/onboarding/page.tsx`

#### Visual: "The Corridor"

Progressive disclosure with command-palette style:

```
Step 1: Welcome
┌─────────────────────────────────────┐
│  Welcome to Misir                   │
│  Let's set up your workspace        │
│                                     │
│  [Continue →]                       │
└─────────────────────────────────────┘

Step 2: Topics
┌─────────────────────────────────────┐
│  What are you learning?             │
│  ─────────────────                  │
│                                     │
│  [Topic 1                        ]  │
│  [Topic 2                        ]  │
│  [Topic 3                        ]  │
│                                     │
│  Press ↵ to continue                │
└─────────────────────────────────────┘
```

#### Specifications
- **Card**: Same as login (400px, centered)
- **Inputs**: One per row, focused sequentially
- **Keyboard**: 
  - `Enter`: Next input or submit
  - `Cmd+K`: Skip onboarding
- **Progress**: Dots at bottom (white/5 inactive, white/100 active)

---

### 5. Dashboard Home (`/dashboard`)
**File**: `app/dashboard/page.tsx`

#### Visual: "The Command Center"

```
┌─────────────────────────────────────────────────┐
│  Dashboard                      [⌘K] [Profile]  │
├─────────────────────────────────────────────────┤
│                                                 │
│  Overview Metrics (4-column grid)               │
│  ┌────────┬────────┬────────┬────────┐          │
│  │SPACES  │ARTIFACTS│VELOCITY│ DRIFT  │          │
│  │  12    │   347   │   87%  │  45%   │          │
│  │ +2     │  +23    │  ↑     │  ↓     │          │
│  └────────┴────────┴────────┴────────┘          │
│                                                 │
│  Activity (Linear Graph)                        │
│  ┌───────────────────────────────────────┐      │
│  │              ╱╲     ╱╲                 │      │
│  │         ╱╲  ╱  ╲   ╱  ╲    ╱╲          │      │
│  │    ╱╲  ╱  ╲    ╲ ╱    ╲  ╱  ╲         │      │
│  │───╱──╲╱────╲────╳──────╲╱────╲────────│      │
│  │   7d   14d   21d   28d          90d   │      │
│  └───────────────────────────────────────┘      │
│                                                 │
│  Recent Artifacts                               │
│  ┌─────────────────────────────────────┐        │
│  │ ID    TITLE              SPACE  DATE │        │
│  ├─────────────────────────────────────┤        │
│  │ MIS-1 TypeScript Guide   Learn  2m   │        │
│  │ MIS-2 Linear Design Sys  Design 5m   │        │
│  └─────────────────────────────────────┘        │
└─────────────────────────────────────────────────┘
```

#### Overview Cards
- **Grid**: `grid-cols-4 gap-px` (no gap, just 1px border)
- **Card**: 
  - `group relative border border-white/5 bg-[#141517]`
  - `hover:border-white/10 hover:bg-white/[0.02]`
  - `transition-all duration-150`
- **Label**: `text-[11px] uppercase tracking-widest text-[#5F646D]`
- **Value**: `text-2xl font-medium tabular-nums text-[#EEEEF0]`
- **Change**: `text-[11px] text-[#8A8F98] mt-1`

#### Activity Graph
- **Container**: `h-[200px] w-full border border-white/5 rounded-lg`
- **Background**: `bg-gradient-to-b from-white/[0.02] to-transparent`
- **Line**: `stroke-[#5E6AD2] stroke-[1.5px] fill-none`
- **Gradient Fill**: Optional `fill-[#5E6AD2]/10`
- **X-axis**: `text-[11px] text-[#5F646D]`

#### Recent List
- **Header**: `text-[11px] text-[#5F646D] uppercase border-b border-white/5 py-2`
- **Row**: `h-10 border-b border-white/[0.02] hover:bg-[#191A1D] group cursor-pointer`
- **Columns**:
  - ID: `font-mono text-[11px] text-[#5F646D]`
  - Title: `text-[13px] text-[#EEEEF0] font-medium`
  - Space: `badge-linear` (see components)
  - Date: `text-[11px] text-[#8A8F98] text-right`

---

### 6. Search & Command (`/dashboard/search`)
**File**: `app/dashboard/search/page.tsx`

#### Visual: "The Palette"

Linear-style command menu:

```
┌─────────────────────────────────────────────────┐
│  Search                         [⌘K] [Profile]  │
├─────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────┐  │
│  │ [🔍] Search by meaning...         [↵]    │  │
│  └───────────────────────────────────────────┘  │
│                                                 │
│  Results (12)                     [#MIS-432]    │
│  ┌───────────────────────────────────────────┐  │
│  │ TypeScript Advanced Patterns              │  │
│  │ 94% • 2m ago • Learn                      │  │
│  │ Deep dive covering generics, mapped...    │  │
│  └───────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────┐  │
│  │ React Hooks Best Practices                │  │
│  │ 89% • 5m ago • Learn                      │  │
│  │ useEffect dependencies, custom hooks...   │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

#### Input Field
- **Container**: `relative w-full max-w-3xl mx-auto`
- **Input**:
  - `h-12 bg-[#0B0C0E] border border-white/10`
  - `focus:border-[#5E6AD2]`
  - `text-[13px] placeholder:text-[#5F646D]`
  - `pl-10` (for icon)
- **Icon**: `absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#5F646D]`
- **Keyboard**: `⌘K` or `/` to focus

#### Results List
- **Header**: `text-[11px] uppercase tracking-widest text-[#5F646D] mb-2`
- **Card**:
  - `border border-white/5 bg-[#141517]`
  - `hover:border-white/10 hover:bg-white/[0.02]`
  - `py-3 px-4`
- **Title**: `text-[13px] font-medium text-[#EEEEF0] mb-1`
- **Meta**: 
  - Similarity: `text-[11px] font-mono text-[#5E6AD2]`
  - Time: `text-[11px] text-[#8A8F98]`
  - Space: `badge-linear`
- **Preview**: `text-[13px] text-[#8A8F98] line-clamp-2`

#### Empty State
- Icon: `size-8 text-[#5F646D]`
- Text: `text-[13px] text-[#8A8F98]`
- Suggestion: "Try searching for 'design systems' or press ⌘N to create"

---

### 7. Artifacts Page (`/dashboard/artifacts`)
**File**: `app/dashboard/artifacts/page.tsx`

#### Visual: "The Archive"

High-density table/list hybrid:

```
┌─────────────────────────────────────────────────┐
│  Artifacts                      [⌘K] [Profile]  │
├─────────────────────────────────────────────────┤
│  All Artifacts (347)                [+ New]     │
│  ─────────────────                              │
│  ┌───────────────────────────────────────────┐  │
│  │ [🔍] Search artifacts...        [Filter] │  │
│  └───────────────────────────────────────────┘  │
│                                                 │
│  ┌───────────────────────────────────────────┐  │
│  │ ID     TITLE           SPACE  UPDATED    │  │
│  ├───────────────────────────────────────────┤  │
│  │ MIS-1  TypeScript      Learn  2m         │  │
│  │ MIS-2  Linear Design   Design 5m         │  │
│  │ MIS-3  React Patterns  Learn  1h         │  │
│  │ ...                                      │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

#### List Specifications
- **Row**: 
  - `h-10 border-b border-white/[0.02]`
  - `hover:bg-[#191A1D] transition-colors duration-150`
  - `cursor-pointer group`
- **Columns**:
  - ID: `w-20 font-mono text-[11px] text-[#5F646D]`
  - Title: `flex-1 text-[13px] text-[#EEEEF0] font-medium truncate`
  - Space: `w-32 badge-linear`
  - Updated: `w-20 text-right text-[11px] text-[#8A8F98]`
- **Header**:
  - `text-[11px] uppercase tracking-widest text-[#5F646D]`
  - `border-b border-white/5 py-2`
  - `sticky top-0 bg-[#0B0C0E]/95 backdrop-blur-sm z-10`

#### Interactions
- **Click Row**: Navigate to artifact detail
- **Cmd+Click**: Open in new tab
- **Hover**: Tooltip with full title (if truncated)
- **Quick Actions**: Appear on row hover (right side)

---

### 8. Spaces Page (`/dashboard/spaces`)
**File**: `app/dashboard/spaces/page.tsx`

#### Visual: "The Grid" (Card Grid)

Unlike artifacts, spaces use a card grid (more visual prominence):

```
┌─────────────────────────────────────────────────┐
│  Spaces                         [⌘K] [Profile]  │
├─────────────────────────────────────────────────┤
│  Your Learning Spaces (12)            [+ New]   │
│                                                 │
│  ┌──────────────┬──────────────┬──────────────┐ │
│  │ [Gradient]   │ [Gradient]   │ [Gradient]   │ │
│  │              │              │              │ │
│  │ Learn        │ Design       │ Systems      │ │
│  │ 12 artifacts │ 8 artifacts  │ 5 artifacts  │ │
│  │ Updated 2m   │ Updated 1h   │ Updated 3h   │ │
│  └──────────────┴──────────────┴──────────────┘ │
│  ┌──────────────┬──────────────┬──────────────┐ │
│  │ [Gradient]   │ [Gradient]   │ [Gradient]   │ │
│  └──────────────┴──────────────┴──────────────┘ │
└─────────────────────────────────────────────────┘
```

#### Card Specifications
- **Grid**: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3`
- **Card**:
  - Size: `aspect-[4/3]`
  - Background header: Gradient based on space color
    - `bg-gradient-to-br from-[color]/20 to-[color]/5`
  - Body: `bg-[#141517] border border-white/5`
  - Hover: `border-white/10 shadow-glow`
- **Header**: 
  - Height: `h-24`
  - Gradient overlay
  - Icon: `size-8 text-white/80`
- **Body**:
  - Padding: `p-4`
  - Title: `text-[15px] font-semibold text-[#EEEEF0]`
  - Meta: `text-[11px] text-[#8A8F98]`
  - Stats: Artifact count, last updated

#### Create Space Modal
- **Trigger**: `+ New` button (top-right)
- **Modal**: 
  - `w-[480px]`
  - Background: `bg-[#141517] border border-white/10`
  - Shadow: `shadow-2xl`
- **Form**:
  - Title input: `h-10`
  - Description textarea: `min-h-20`
  - Topics (optional): 3 inputs
  - AI Generate toggle: Switch component
- **Entrance**: Scale 0.95→1.0, Opacity 0→1 (150ms)

---

### 9. Space Detail (`/dashboard/spaces/[spaceId]`)
**File**: `app/dashboard/spaces/[spaceId]/page.tsx`

#### Visual: "The Subspace"

```
┌─────────────────────────────────────────────────┐
│  Dashboard > Spaces > Learn     [⌘K] [Profile]  │
├─────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────┐  │
│  │  [Gradient Header]                        │  │
│  │  Learn                          [Edit]    │  │
│  │  TypeScript, React, Patterns              │  │
│  │  12 artifacts • Created 2w ago            │  │
│  └───────────────────────────────────────────┘  │
│                                                 │
│  Artifacts in this space                        │
│  ┌───────────────────────────────────────────┐  │
│  │ MIS-1  TypeScript Guide            2m    │  │
│  │ MIS-3  React Patterns              1h    │  │
│  └───────────────────────────────────────────┘  │
│                                                 │
│  Activity                                       │
│  [Similar to dashboard activity graph]         │
└─────────────────────────────────────────────────┘
```

#### Header Card
- **Gradient**: Based on space color (same as space card)
- **Height**: `h-32`
- **Overlay**: `bg-gradient-to-br from-[color]/30 to-transparent`
- **Title**: `text-2xl font-bold text-white`
- **Description**: `text-[13px] text-white/70 mt-1`
- **Meta**: 
  - Count: `text-[11px] text-white/60`
  - Badge: `bg-white/10 backdrop-blur-sm`

#### Artifacts Section
- Reuses artifact list pattern from main artifacts page
- Filtered to current space
- Empty state: "No artifacts yet. Create your first artifact."

---

### 10. Analytics Page (`/dashboard/analytics`)
**File**: `app/dashboard/analytics/page.tsx`

#### Visual: "The Observatory"

Data-dense layout with charts:

```
┌─────────────────────────────────────────────────┐
│  Analytics                      [⌘K] [Profile]  │
├─────────────────────────────────────────────────┤
│  Time Range: [Last 90 days ▼]                   │
│                                                 │
│  Overview Metrics                               │
│  ┌────────┬────────┬────────┬────────┐          │
│  │TOTAL   │AVG/DAY │VELOCITY│ DRIFT  │          │
│  │  347   │   12   │   87%  │  45%   │          │
│  └────────┴────────┴────────┴────────┘          │
│                                                 │
│  ┌───────────────────────────────────────────┐  │
│  │ Engagement Timeline                       │  │
│  │ [Line chart with area fill]              │  │
│  └───────────────────────────────────────────┘  │
│                                                 │
│  ┌──────────────────┬────────────────────────┐  │
│  │ By Space         │ By Day of Week        │  │
│  │ [Bar chart]      │ [Heatmap]             │  │
│  └──────────────────┴────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

#### Chart Specifications
- **Container**: `bg-[#141517] border border-white/5 rounded-lg p-6`
- **Title**: `text-[13px] font-medium text-[#EEEEF0] mb-4`
- **Chart Background**: `bg-transparent`
- **Grid**: `stroke-white/5`
- **Data Line**: `stroke-[#5E6AD2] stroke-[1.5px]`
- **Area Fill**: `fill-[#5E6AD2]/10`
- **Axes**: `text-[11px] text-[#5F646D]`
- **Tooltip**: 
  - `bg-[#0B0C0E] border border-white/10`
  - `text-[11px] text-[#EEEEF0]`
  - `shadow-xl`

#### Time Range Selector
- **Dropdown**: 
  - `h-8 px-3 text-[13px]`
  - `bg-[#0B0C0E] border border-white/5`
  - `hover:border-white/10`
- **Options**: Last 7d, 30d, 90d, All time

---

### 11. Report Generation (`/dashboard/report`)
**File**: `app/dashboard/report/page.tsx`

#### Visual: "The Compiler"

Report configuration with live preview:

```
┌─────────────────────────────────────────────────┐
│  Generate Report                [⌘K] [Profile]  │
├─────────────────────────────────────────────────┤
│  ┌─────────────────┬─────────────────────────┐  │
│  │ Configuration   │ Preview                 │  │
│  │ (380px)         │ (flex-1)                │  │
│  │                 │                         │  │
│  │ Space           │  # Report Title         │  │
│  │ [Select ▼]      │                         │  │
│  │                 │  ## Overview            │  │
│  │ Date Range      │  - 12 artifacts         │  │
│  │ [From] [To]     │  - 87% velocity         │  │
│  │                 │                         │  │
│  │ Format          │  ## Key Insights        │  │
│  │ ○ Markdown      │  ...                    │  │
│  │ ○ PDF           │                         │  │
│  │                 │                         │  │
│  │ [Generate]      │                         │  │
│  └─────────────────┴─────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

#### Left Panel (Config)
- **Width**: `w-[380px]` fixed
- **Background**: `bg-[#141517] border-r border-white/5`
- **Padding**: `p-6`
- **Sections**:
  - Space selector: Dropdown with search
  - Date range: Two date inputs (from/to)
  - Format: Radio group (Markdown, PDF, JSON)
  - Options: Checkboxes (Include charts, Include artifacts, etc.)
- **Generate Button**:
  - Full width, h-10
  - `bg-[#5E6AD2] hover:bg-[#4E5AC0]`
  - Shows loading spinner when generating

#### Right Panel (Preview)
- **Background**: `bg-[#0B0C0E]`
- **Content**: 
  - Rendered markdown preview
  - Resembles actual report output
  - Updates in real-time as config changes
- **Typography**:
  - H1: `text-2xl font-bold`
  - H2: `text-xl font-semibold mt-6 mb-3`
  - Body: `text-[13px] text-[#8A8F98] leading-relaxed`
  - Code: `bg-white/5 border border-white/5 rounded px-1.5 py-0.5 font-mono text-[12px]`

#### Generation States
1. **Idle**: Show preview
2. **Generating**: 
   - Disable form
   - Show progress indicator
   - Animate preview skeleton
3. **Complete**: 
   - Show success toast
   - Offer download button
   - Enable "Generate Another"

---

## Component Primitives (Linear Edition)

### Buttons

```tsx
// Primary
<button className="h-8 px-3 bg-[#5E6AD2] text-white text-[13px] font-medium rounded-md hover:bg-[#4E5AC0] transition-colors duration-150 shadow-glow">
  Label
</button>

// Secondary
<button className="h-8 px-3 bg-white/5 text-[#EEEEF0] text-[13px] font-medium rounded-md hover:bg-white/10 border border-white/10 transition-colors duration-150">
  Label
</button>

// Ghost
<button className="h-8 px-3 text-[#EEEEF0] text-[13px] font-medium rounded-md hover:bg-white/5 transition-colors duration-150">
  Label
</button>

// Danger
<button className="h-8 px-3 bg-red-500/10 text-red-400 text-[13px] font-medium rounded-md hover:bg-red-500/20 border border-red-500/20 transition-colors duration-150">
  Delete
</button>
```

### Badges

```tsx
// Space Badge
<span className="inline-flex items-center h-5 px-1.5 text-[11px] font-medium rounded bg-[#5E6AD2]/10 text-[#5E6AD2] border border-[#5E6AD2]/20">
  Space
</span>

// Status Badge (Success)
<span className="inline-flex items-center h-5 px-1.5 text-[11px] font-medium rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
  Active
</span>

// Count Badge
<span className="inline-flex items-center justify-center size-5 text-[11px] font-medium rounded-full bg-white/10 text-[#EEEEF0] tabular-nums">
  12
</span>
```

### Avatars

```tsx
// Small (20px)
<div className="size-5 rounded-full bg-gradient-to-br from-[#5E6AD2] to-[#4E5AC0] flex items-center justify-center text-[11px] font-medium text-white">
  JD
</div>

// Medium (28px)
<div className="size-7 rounded-full bg-gradient-to-br from-[#5E6AD2] to-[#4E5AC0] flex items-center justify-center text-[13px] font-medium text-white">
  JD
</div>

// With Image
<img src="/avatar.jpg" className="size-7 rounded-full border border-white/10" alt="User" />
```

### Inputs

```tsx
// Text Input
<input 
  type="text" 
  className="h-10 px-3 w-full bg-[#0B0C0E] border border-white/10 rounded-md text-[13px] text-[#EEEEF0] placeholder:text-[#5F646D] focus:border-[#5E6AD2] focus:ring-1 focus:ring-[#5E6AD2] transition-colors duration-150"
  placeholder="Enter text..."
/>

// Search Input
<div className="relative">
  <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#5F646D]" />
  <input 
    type="search" 
    className="h-10 pl-10 pr-3 w-full bg-[#0B0C0E] border border-white/10 rounded-md text-[13px] text-[#EEEEF0] placeholder:text-[#5F646D] focus:border-[#5E6AD2] focus:ring-1 focus:ring-[#5E6AD2]"
    placeholder="Search..."
  />
</div>

// Textarea
<textarea 
  className="min-h-20 px-3 py-2 w-full bg-[#0B0C0E] border border-white/10 rounded-md text-[13px] text-[#EEEEF0] placeholder:text-[#5F646D] focus:border-[#5E6AD2] focus:ring-1 focus:ring-[#5E6AD2] resize-none"
  placeholder="Description..."
/>
```

### Keyboard Shortcuts

```tsx
// kbd component
<kbd className="inline-flex items-center h-5 px-1.5 text-[11px] font-medium rounded bg-white/5 text-[#8A8F98] border border-white/10 font-mono">
  ⌘K
</kbd>

// Usage examples
<span className="text-[13px] text-[#8A8F98]">
  Press <kbd>⌘K</kbd> to search
</span>

<span className="text-[13px] text-[#8A8F98]">
  <kbd>↵</kbd> to select, <kbd>Esc</kbd> to cancel
</span>
```

---

## Iconography System: Linear Edition

Icons in Misir are treated as **typography**: consistent, high-precision, and scale-relative. This section defines the strict rules for achieving the Linear aesthetic through iconography.

### 1. The Source of Truth

We use **Lucide React** (`lucide-react`) as our core icon library. It is the closest open-source equivalent to Linear's custom set due to its geometric precision and consistent stroke weights.

**Installation**
```bash
npm install lucide-react
```

---

### 2. The Golden Rules

To match the Linear aesthetic, override default Lucide settings globally via a wrapper component.

#### Rule A: The 1.5px Stroke

Default icons (2px stroke) look "chunky" and childish in high-density interfaces.

**Requirement**: All icons must use `strokeWidth={1.5}`

**Why**: This creates a "technical" look that matches the Inter font weight at small sizes.

#### Rule B: The 16px Standard

Linear interfaces are dense. 24px icons are massive and rarely used.

| Size | Usage | Tailwind Class | Pixels |
|------|-------|----------------|--------|
| **Micro** | Metadata, timestamps | `size-3` / `size-3.5` | 12px / 14px |
| **Standard** | Lists, buttons, forms | `size-4` | 16px |
| **Navigation** | Sidebar items | `size-[18px]` | 18px |
| **Hero** | Empty states, modals | `size-6` | 24px |

#### Rule C: Opacity over Color

Icons rarely use full white (`#FFFFFF`). They use opacity levels to indicate hierarchy.

| State | Color Token | Opacity | Usage |
|-------|-------------|---------|-------|
| **Inactive/Default** | `text-[#8A8F98]` | ~60% | Standard icons |
| **Hover** | `text-[#C4C9D6]` | ~80% | Hover state |
| **Active/Selected** | `text-[#EEEEF0]` | 100% | Selected items |
| **Primary** | `text-[#5E6AD2]` | 100% | Brand actions |
| **Muted** | `text-[#5F646D]` | ~40% | Subtle hints |

---

### 3. The Icon Component Wrapper

**Do not use raw Lucide imports repeatedly.** Use this wrapper to enforce the system.

```tsx
// components/ui/icon.tsx
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface IconProps extends React.ComponentPropsWithoutRef<"svg"> {
  icon: LucideIcon;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  variant?: "default" | "muted" | "active" | "primary";
}

const sizeMap = {
  xs: "size-3",      // 12px - Metadata
  sm: "size-3.5",    // 14px - Sub-items
  md: "size-4",      // 16px - Standard (Buttons, Lists)
  lg: "size-[18px]", // 18px - Sidebar Navigation
  xl: "size-6",      // 24px - Hero sections
};

const variantMap = {
  default: "text-[#8A8F98] group-hover:text-[#C4C9D6]",
  muted: "text-[#5F646D]",
  active: "text-[#EEEEF0]",
  primary: "text-[#5E6AD2]",
};

export const Icon = ({ 
  icon: IconComponent, 
  size = "md", 
  variant = "default", 
  className,
  ...props 
}: IconProps) => {
  return (
    <IconComponent 
      strokeWidth={1.5} // The Linear Rule
      className={cn(
        sizeMap[size], 
        variantMap[variant], 
        "transition-colors duration-150", 
        className
      )} 
      {...props} 
    />
  );
};
```

**Usage Example**
```tsx
import { Search } from "lucide-react";
import { Icon } from "@/components/ui/icon";

// Standard button icon
<Icon icon={Search} size="md" variant="default" />

// Active sidebar item
<Icon icon={LayoutGrid} size="lg" variant="active" />

// Primary action
<Icon icon={Plus} size="md" variant="primary" />
```

---

### 4. Semantic Mapping

Use these **specific Lucide icons** for these **specific concepts** to maintain consistency across the application.

#### Navigation & Shell

| Concept | Icon Name | Context | Size |
|---------|-----------|---------|------|
| **Dashboard** | `LayoutGrid` | Main view | `lg` |
| **Search** | `Search` | Command palette trigger | `md` |
| **Spaces** | `Layers` | Collection of knowledge | `lg` |
| **Artifacts** | `FileText` | Individual learning item | `md` |
| **Analytics** | `BarChart3` | Analytics dashboard | `lg` |
| **Settings** | `Settings2` | Use "2" variant (sliders) for technical feel | `lg` |
| **User** | `User2` | User profile | `md` |
| **Help** | `HelpCircle` | Help/documentation | `md` |

#### Status Indicators (The "Cycles")

Linear uses circles heavily to indicate state. Follow this pattern strictly.

| State | Icon Name | Style | Color |
|-------|-----------|-------|-------|
| **Backlog** | `CircleDashed` | Dashed outline | `text-[#5F646D]` (40% opacity) |
| **Todo** | `Circle` | Empty circle | `text-[#8A8F98]` (70% opacity) |
| **In Progress** | `CircleDot` | Filled dot | `text-yellow-400` |
| **Done** | `CheckCircle2` | Check inside | `text-[#5E6AD2]` (Primary) |
| **Canceled** | `XCircle` | X inside | `text-red-500/50` |

**Usage Example**
```tsx
// Status badge with icon
<div className="inline-flex items-center gap-1.5 h-5 px-1.5 rounded bg-[#5E6AD2]/10 border border-[#5E6AD2]/20">
  <CheckCircle2 className="size-3 text-[#5E6AD2]" strokeWidth={1.5} />
  <span className="text-[11px] font-medium text-[#5E6AD2]">Done</span>
</div>
```

#### Actions

| Action | Icon Name | Context | Keyboard Hint |
|--------|-----------|---------|---------------|
| **Create** | `Plus` | Standard add action | `C` |
| **Edit** | `Pencil` | Rarely used, prefer direct click | — |
| **Delete** | `Trash2` | Destructive action | — |
| **More** | `MoreHorizontal` | Context menus (always horizontal) | — |
| **Filter** | `ListFilter` | View options | `F` |
| **Sort** | `ArrowUpDown` | Column headers | — |
| **Copy** | `Copy` | Copy to clipboard | — |
| **Link** | `Link2` | External links | — |
| **Download** | `Download` | Export actions | — |

#### Data & Visualization

| Concept | Icon Name | Context |
|---------|-----------|---------|
| **Activity** | `Activity` | Pulse/engagement metrics |
| **Velocity** | `Zap` | Speed/velocity metrics |
| **Trending Up** | `TrendingUp` | Positive metrics |
| **Trending Down** | `TrendingDown` | Negative metrics |
| **Calendar** | `Calendar` | Date ranges |
| **Clock** | `Clock` | Timestamps |

---

### 5. Special "Brand" Icons

For unique concepts in Misir, we compose icons or use specific metaphors.

#### The "Space" Metaphor

Use **distinct shapes** to differentiate Spaces from standard folders.

**Why**: Misir "Spaces" are 3D knowledge graphs, not flat directories.

```tsx
// Space card icon
<div className="size-12 rounded-lg bg-gradient-to-br from-[#5E6AD2] to-[#4E5AC0] flex items-center justify-center">
  <Hexagon className="size-6 text-white" strokeWidth={1.5} />
</div>

// Alternative: Box for structured spaces
<Box className="size-6 text-[#5E6AD2]" strokeWidth={1.5} />
```

#### The "Artifact" Metaphor

Differentiate artifact types with specific icons:

| Artifact Type | Icon | Usage |
|---------------|------|-------|
| **Article/Note** | `FileText` | Default artifact type |
| **Code Snippet** | `Code2` | Technical content |
| **External URL** | `Link2` | Linked resources |
| **Document** | `FileCode` | Structured documents |
| **Research** | `BookOpen` | Learning materials |

```tsx
// Artifact type indicator
const artifactIcons = {
  article: FileText,
  code: Code2,
  link: Link2,
  document: FileCode,
  research: BookOpen,
};

<Icon 
  icon={artifactIcons[artifact.type]} 
  size="sm" 
  variant="muted" 
/>
```

#### The "Velocity" Metaphor

Use specific icons for metrics:

```tsx
// Velocity card
<div className="flex items-center gap-2">
  <Zap className="size-4 text-[#5E6AD2]" strokeWidth={1.5} />
  <span className="text-2xl font-medium tabular-nums">87%</span>
</div>

// Engagement/Activity
<div className="flex items-center gap-2">
  <Activity className="size-4 text-emerald-400" strokeWidth={1.5} />
  <span className="text-2xl font-medium tabular-nums">2.4k</span>
</div>
```

---

### 6. Icon Effects & Animations

#### The "Halo" Effect (Active State)

When an item is active (like in the sidebar), the icon should have a subtle glow.

```css
/* globals.css */
.icon-glow {
  filter: drop-shadow(0 0 8px rgba(94, 106, 210, 0.5));
  color: #EEEEF0;
}
```

**Usage**
```tsx
// Active sidebar item
<div className={cn(
  "flex items-center gap-2 h-7 px-2 rounded-md",
  isActive && "bg-white/5"
)}>
  <LayoutGrid 
    className={cn(
      "size-[18px]",
      isActive ? "icon-glow text-[#EEEEF0]" : "text-[#8A8F98]"
    )}
    strokeWidth={1.5}
  />
  <span className={isActive ? "text-[#EEEEF0]" : "text-[#8A8F98]"}>
    Dashboard
  </span>
</div>
```

#### The "Spin" Animation (Loading)

For loading states, use `Loader2` (the standard spinner) with strict animation.

```tsx
// Loading button
<Button disabled>
  <Loader2 
    className="size-4 animate-spin text-[#8A8F98]" 
    strokeWidth={1.5} 
  />
  <span className="ml-2">Loading...</span>
</Button>

// Inline loading
<div className="flex items-center gap-2 text-[13px] text-[#8A8F98]">
  <Loader2 className="size-3.5 animate-spin" strokeWidth={1.5} />
  <span>Generating report...</span>
</div>
```

#### Animated Icons for Empty States

Use subtle motion for empty state illustrations:

```tsx
import { motion } from "framer-motion";
import { Search } from "lucide-react";

// Empty search state
<motion.div
  initial={{ opacity: 0, scale: 0.95 }}
  animate={{ opacity: 1, scale: 1 }}
  transition={{ duration: 0.15 }}
  className="flex flex-col items-center justify-center py-12"
>
  <div className="size-12 rounded-full bg-white/5 flex items-center justify-center mb-4">
    <Search className="size-6 text-[#5F646D]" strokeWidth={1.5} />
  </div>
  <p className="text-[13px] text-[#8A8F98]">No results found</p>
</motion.div>
```

---

### 7. Icon Grid (Quick Reference)

Visual reference for most-used icons in Misir:

```tsx
// Example: Icon showcase component for documentation
const iconShowcase = [
  { name: "Dashboard", icon: LayoutGrid, usage: "Main navigation" },
  { name: "Search", icon: Search, usage: "Command palette" },
  { name: "Spaces", icon: Layers, usage: "Knowledge collections" },
  { name: "Artifacts", icon: FileText, usage: "Learning items" },
  { name: "Create", icon: Plus, usage: "Add actions" },
  { name: "Filter", icon: ListFilter, usage: "View filters" },
  { name: "More", icon: MoreHorizontal, usage: "Context menus" },
  { name: "Done", icon: CheckCircle2, usage: "Completed state" },
  { name: "Velocity", icon: Zap, usage: "Speed metrics" },
  { name: "Activity", icon: Activity, usage: "Engagement" },
];

// Render grid
<div className="grid grid-cols-5 gap-4">
  {iconShowcase.map(({ name, icon: IconComponent, usage }) => (
    <div 
      key={name} 
      className="flex flex-col items-center gap-2 p-4 rounded-lg border border-white/5 bg-[#141517]"
    >
      <IconComponent className="size-6 text-[#8A8F98]" strokeWidth={1.5} />
      <span className="text-[11px] font-medium text-[#EEEEF0]">{name}</span>
      <span className="text-[11px] text-[#5F646D] text-center">{usage}</span>
    </div>
  ))}
</div>
```

---

### 8. Implementation Checklist

To fully implement the Linear iconography system:

- [ ] Install `lucide-react` package
- [ ] Create `components/ui/icon.tsx` wrapper component
- [ ] Update `globals.css` with `.icon-glow` effect
- [ ] Replace all raw icon imports with `<Icon>` wrapper
- [ ] Enforce `strokeWidth={1.5}` across all icons
- [ ] Standardize sizes: 12px (metadata), 16px (standard), 18px (navigation)
- [ ] Apply semantic mapping (Dashboard = LayoutGrid, etc.)
- [ ] Implement status indicators with Circle variants
- [ ] Add loading states with `Loader2` + `animate-spin`
- [ ] Update sidebar active states with icon glow effect
- [ ] Add keyboard shortcut hints next to action icons
- [ ] Test icon visibility at 13px base font size

---

## Animation Vault: Linear Edition

This section defines the **Motion Primitives** for Misir. To achieve the "Linear feel," animations must be **fast**, **tight**, and **subtle**.

### The Golden Rule

> **"If you notice the animation, it's too slow."**

**Core Principles:**
- **Duration**: 0.15s - 0.25s (150ms - 250ms)
- **Easing**: `ease-out` (Power2 or Power3 curves)
- **Distance**: Small movements (4px - 8px vertical)
- **Scale**: Minimal scale changes (0.95 - 1.0)
- **Blur**: Optional 4px blur for page transitions

---

### 1. The Physics (Core Config)

Use this configuration object as the **default transition prop** for 90% of UI elements. This ensures consistency across the app.

```ts
// lib/animation.ts

/**
 * The "Linear" transition config
 * Snappy start, soft landing
 */
export const linearTransition = {
  duration: 0.2,
  ease: [0.16, 1, 0.3, 1], // Custom bezier curve (easeOutCubic variant)
};

/**
 * For list items - extremely tight stagger
 */
export const linearStagger = 0.03; // 30ms between items

/**
 * For modals/dialogs - spring physics
 */
export const springConfig = {
  type: "spring" as const,
  damping: 25,
  stiffness: 300,
};

/**
 * For micro-interactions (buttons, toggles)
 */
export const microTransition = {
  duration: 0.15,
  ease: [0.16, 1, 0.3, 1],
};
```

---

### 2. Page Transitions (PageEntrance)

Pages should not "whoosh" in. They should simply **appear** with a subtle upward drift to indicate freshness.

```tsx
// components/motion/PageEntrance.tsx
"use client";

import { motion } from "framer-motion";
import { linearTransition } from "@/lib/animation";

interface PageEntranceProps {
  children: React.ReactNode;
}

export const PageEntrance = ({ children }: PageEntranceProps) => (
  <motion.div
    initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
    exit={{ opacity: 0, y: -4 }} // Faster exit, opposite direction
    transition={linearTransition}
    className="w-full h-full"
  >
    {children}
  </motion.div>
);
```

**Usage in Pages**
```tsx
// app/dashboard/page.tsx
import { PageEntrance } from "@/components/motion/PageEntrance";

export default function DashboardPage() {
  return (
    <PageEntrance>
      {/* Page content */}
    </PageEntrance>
  );
}
```

**When to Skip:**
- Navigation between tabs (too jarring)
- High-frequency page switches (command palette results)
- Modal content changes (use content-specific animations)

---

### 3. The List Cascade (ListStagger)

This is the **most critical animation** for Artifacts and Search views. Items should flow in like a waterfall, but **extremely quickly**.

```tsx
// components/motion/ListContainer.tsx
"use client";

import { motion } from "framer-motion";
import { linearStagger } from "@/lib/animation";

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: linearStagger, // 0.03s - The "Linear" speed
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 5 },
  show: { 
    opacity: 1, 
    y: 0, 
    transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] } 
  },
};

interface ListContainerProps {
  children: React.ReactNode;
  className?: string;
}

export const ListContainer = ({ children, className }: ListContainerProps) => (
  <motion.ul
    variants={containerVariants}
    initial="hidden"
    animate="show"
    className={className}
  >
    {children}
  </motion.ul>
);

export const ListItem = ({ children }: { children: React.ReactNode }) => (
  <motion.li variants={itemVariants}>
    {children}
  </motion.li>
);
```

**Usage Example**
```tsx
// app/dashboard/artifacts/page.tsx
import { ListContainer, ListItem } from "@/components/motion/ListContainer";

export default function ArtifactsPage() {
  return (
    <ListContainer className="w-full">
      {artifacts.map((artifact) => (
        <ListItem key={artifact.id}>
          <div className="h-10 flex items-center px-6 border-b border-white/[0.02] hover:bg-[#191A1D]">
            {/* Artifact row content */}
          </div>
        </ListItem>
      ))}
    </ListContainer>
  );
}
```

**Performance Note:**
- Limit stagger to first 20-30 items
- For long lists (100+), only animate visible viewport items
- Use `layoutScroll` for scroll-triggered animations

---

### 4. Modal & Command Palette (ModalPop)

Dialogs should **scale up slightly** from the center. No massive bounces.

```tsx
// components/motion/Modal.tsx
"use client";

import { motion, AnimatePresence } from "framer-motion";
import { springConfig } from "@/lib/animation";

const overlayVariants = {
  hidden: { opacity: 0, backdropFilter: "blur(0px)" },
  show: { 
    opacity: 1, 
    backdropFilter: "blur(4px)", 
    transition: { duration: 0.2 } 
  },
};

const contentVariants = {
  hidden: { opacity: 0, scale: 0.96, y: 8 },
  show: { 
    opacity: 1, 
    scale: 1, 
    y: 0,
    transition: springConfig, // Slight snap for "poppy" feel
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    y: 4,
    transition: { duration: 0.15 },
  },
};

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export const Modal = ({ isOpen, onClose, children }: ModalProps) => (
  <AnimatePresence>
    {isOpen && (
      <>
        {/* Backdrop */}
        <motion.div
          variants={overlayVariants}
          initial="hidden"
          animate="show"
          exit="hidden"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        />

        {/* Content */}
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            variants={contentVariants}
            initial="hidden"
            animate="show"
            exit="exit"
            className="w-full max-w-lg bg-[#141517] border border-white/10 rounded-lg shadow-2xl"
          >
            {children}
          </motion.div>
        </div>
      </>
    )}
  </AnimatePresence>
);
```

**Command Palette Variant**
For `Cmd+K` palette, use **no scale** (feels more "summoned"):

```tsx
const paletteVariants = {
  hidden: { opacity: 0, y: -20 },
  show: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.15, ease: [0.16, 1, 0.3, 1] },
  },
};
```

---

### 5. Micro-Interactions (The Polish)

#### A. The "Click" (Active State)

Buttons should shrink **microscopically** when pressed to give tactile feedback.

```tsx
// components/ui/button.tsx (snippet)
import { motion } from "framer-motion";

<motion.button
  whileTap={{ scale: 0.98 }}
  transition={{ duration: 0.05 }} // Instant
  className="h-8 px-3 bg-[#5E6AD2] text-white rounded-md"
>
  Click Me
</motion.button>
```

**When NOT to use:**
- List row clicks (too distracting in high-density views)
- Text input focus
- Checkbox/radio clicks (use native browser feedback)

#### B. The "Toggle" Switch

Switches need a **snappy spring**. Use `layoutId` for smooth transitions.

```tsx
// components/ui/switch.tsx
import { motion } from "framer-motion";

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export const Switch = ({ checked, onChange }: SwitchProps) => (
  <button
    onClick={() => onChange(!checked)}
    className={cn(
      "relative w-9 h-5 rounded-full transition-colors duration-150",
      checked ? "bg-[#5E6AD2]" : "bg-white/10"
    )}
  >
    <motion.div
      layout
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className={cn(
        "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm",
        checked ? "left-[18px]" : "left-0.5"
      )}
    />
  </button>
);
```

#### C. The Hover Glow

Instead of animating the card, animate a **"spotlight" gradient** behind it.

```tsx
// Usage: Put this INSIDE a 'group relative' container
<div className="group relative">
  {/* The glow layer (behind content) */}
  <motion.div
    className="absolute inset-0 -z-10 rounded-lg bg-white/5 opacity-0"
    initial={false}
    animate={{ opacity: 0 }}
    whileHover={{ opacity: 1 }}
    transition={{ duration: 0.15 }}
  />

  {/* The actual card content */}
  <div className="relative z-10 p-4 border border-white/5 rounded-lg">
    Content here
  </div>
</div>
```

**Advanced Pattern: Gradient Tracking**
For "spotlight" effect that follows cursor:

```tsx
const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

<motion.div
  onMouseMove={(e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  }}
  className="relative group"
  style={{
    "--mouse-x": `${mousePosition.x}px`,
    "--mouse-y": `${mousePosition.y}px`,
  } as React.CSSProperties}
>
  <div 
    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
    style={{
      background: `radial-gradient(400px circle at var(--mouse-x) var(--mouse-y), rgba(94, 106, 210, 0.1), transparent 40%)`,
    }}
  />
  {/* Content */}
</motion.div>
```

#### D. Number Tickers

For metric cards with changing values, use smooth number transitions:

```tsx
import { motion, useSpring, useTransform } from "framer-motion";
import { useEffect } from "react";

function AnimatedNumber({ value }: { value: number }) {
  const spring = useSpring(0, { stiffness: 100, damping: 30 });
  const display = useTransform(spring, (current) =>
    Math.round(current).toLocaleString()
  );

  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  return <motion.span>{display}</motion.span>;
}

// Usage
<div className="text-2xl font-medium tabular-nums">
  <AnimatedNumber value={347} />
</div>
```

---

### 6. Loading States

#### Skeleton (No Shimmer)

Linear avoids "glittering" skeletons. Use simple pulse.

```tsx
<div className="h-10 bg-white/5 rounded animate-pulse" />

// Multiple skeletons
<div className="space-y-3">
  {Array.from({ length: 5 }).map((_, i) => (
    <div key={i} className="h-10 bg-white/5 rounded animate-pulse" />
  ))}
</div>
```

#### Spinner (Minimal)

Use Lucide's `Loader2` with strict sizing:

```tsx
import { Loader2 } from "lucide-react";

// Inline loading
<div className="flex items-center gap-2 text-[13px] text-[#8A8F98]">
  <Loader2 className="size-3.5 animate-spin" strokeWidth={1.5} />
  <span>Loading artifacts...</span>
</div>

// Button loading
<Button disabled>
  <Loader2 className="size-4 animate-spin mr-2" strokeWidth={1.5} />
  Generating...
</Button>
```

#### Progress Bars

For long operations (report generation), use determinate progress:

```tsx
import { motion } from "framer-motion";

function ProgressBar({ progress }: { progress: number }) {
  return (
    <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
      <motion.div
        className="h-full bg-[#5E6AD2]"
        initial={{ width: 0 }}
        animate={{ width: `${progress}%` }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      />
    </div>
  );
}
```

---

### 7. Empty States (Subtle Motion)

Empty states should feel **calm** but not lifeless.

```tsx
import { motion } from "framer-motion";
import { Search } from "lucide-react";

function EmptySearchState() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col items-center justify-center py-12"
    >
      {/* Icon container with subtle pulse */}
      <motion.div
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        className="size-12 rounded-full bg-white/5 flex items-center justify-center mb-4"
      >
        <Search className="size-6 text-[#5F646D]" strokeWidth={1.5} />
      </motion.div>

      <p className="text-[13px] text-[#8A8F98] mb-2">No results found</p>
      <p className="text-[11px] text-[#5F646D]">
        Try searching with different keywords
      </p>
    </motion.div>
  );
}
```

---

### 8. Implementation Strategy

#### Installation
```bash
npm install framer-motion
```

#### Global Provider (Optional)

For page transitions, wrap your layout:

```tsx
// app/layout.tsx
import { AnimatePresence } from "framer-motion";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AnimatePresence mode="wait">
          {children}
        </AnimatePresence>
      </body>
    </html>
  );
}
```

**Warning**: `AnimatePresence` at root level can be jarring for navigation. Use sparingly. Prefer component-level animations.

#### Reduced Motion Support

**Always respect user preferences:**

```tsx
import { useReducedMotion } from "framer-motion";

function MyComponent() {
  const shouldReduceMotion = useReducedMotion();
  const transition = shouldReduceMotion ? { duration: 0 } : linearTransition;

  return (
    <motion.div
      initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={transition}
    >
      {/* Content */}
    </motion.div>
  );
}
```

**Global Tailwind Config:**
```js
// tailwind.config.ts
module.exports = {
  theme: {
    extend: {
      transitionDuration: {
        'linear': '200ms', // The standard Linear duration
      },
    },
  },
};
```

---

### 9. Animation Checklist

To fully implement the Linear animation system:

- [ ] Install `framer-motion` package
- [ ] Create `lib/animation.ts` with core config (linearTransition, linearStagger, springConfig)
- [ ] Build `PageEntrance` component for page transitions
- [ ] Build `ListContainer` and `ListItem` for staggered lists
- [ ] Build `Modal` component with scale + spring animation
- [ ] Add `whileTap={{ scale: 0.98 }}` to all primary buttons
- [ ] Implement `Switch` component with spring physics
- [ ] Add hover glow effect to cards/list items
- [ ] Replace shimmer skeletons with simple `animate-pulse`
- [ ] Use `Loader2` icon for all loading spinners
- [ ] Add `useReducedMotion()` checks to animated components
- [ ] Test animations at 60fps on low-end devices
- [ ] Ensure all transitions are ≤ 250ms duration

---

### 10. Animation Performance Tips

#### Do's ✅
- Animate `opacity`, `transform` (translate, scale, rotate)
- Use `will-change: transform` for frequently animated elements
- Limit stagger to visible items (< 30 items)
- Use `layout` prop sparingly (expensive)
- Prefer CSS transitions for simple hover states

#### Don'ts ❌
- Never animate `width`, `height`, `top`, `left` (causes reflow)
- Avoid animating `filter` on long lists (GPU expensive)
- Don't stagger 100+ items (janky on mobile)
- Don't use `blur()` on low-end devices
- Avoid `box-shadow` animations (use `opacity` on shadow layer instead)

---

### 11. Testing Animations

```tsx
// __tests__/animations.test.tsx
import { render } from "@testing-library/react";
import { PageEntrance } from "@/components/motion/PageEntrance";

test("respects reduced motion preference", () => {
  // Mock matchMedia
  window.matchMedia = jest.fn().mockImplementation(query => ({
    matches: query === "(prefers-reduced-motion: reduce)",
    media: query,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  }));

  const { container } = render(
    <PageEntrance>
      <div>Content</div>
    </PageEntrance>
  );

  // Animation should be instant with reduced motion
  expect(container.firstChild).toHaveStyle({ opacity: 1 });
});
```

---

## Responsive Breakpoints

### Desktop-First Strategy

Linear is designed for desktop. Mobile is functional, not feature-complete.

```tsx
// Tailwind breakpoints (desktop-first approach)
// No prefix: mobile base
// md: 768px+  (tablet)
// lg: 1024px+ (laptop)
// xl: 1280px+ (desktop)
// 2xl: 1536px+ (large desktop)
```

### Sidebar Behavior
```tsx
// Mobile: Hidden by default, toggle with menu button
// lg+: Always visible, fixed 240px width

<aside className="hidden lg:block w-[240px] border-r border-white/5">
  {/* Sidebar content */}
</aside>

// Mobile menu button (only visible < lg)
<button className="lg:hidden">
  <MenuIcon />
</button>
```

### Grid Adaptations
```tsx
// Spaces grid
className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3"

// Metric cards
className="grid grid-cols-1 @xl:grid-cols-2 @5xl:grid-cols-4 gap-px"

// Two-column layouts
className="grid grid-cols-1 lg:grid-cols-[2fr,1fr] gap-6"
```

### Typography Scaling
```tsx
// Headlines scale down on mobile
className="text-xl lg:text-2xl font-bold"

// Body text stays 13px
className="text-[13px]"

// Small text stays 11px
className="text-[11px]"
```

### Spacing Adjustments
```tsx
// Reduce padding on mobile
className="p-4 lg:p-6"

// Tighter gaps on mobile grids
className="gap-3 lg:gap-6"
```

---

## User Flows: Linear Edition

This section outlines the core user journeys within Misir. The flows are designed for **speed**, **keyboard-centric interaction**, and **high-density information retrieval**, mimicking the Linear efficiency model.

---

### 1. Authentication (The Gate)

**Goal**: Secure, friction-less entry.

**Key Interaction**: "The Monolith" (Centralized Card).

#### Flow Steps

**Landing (`/`)**
1. User arrives. System checks for active session token.
2. **If Valid**: Immediate redirect to `/dashboard`
3. **If Invalid**: Redirect to `/login`

**Login (`/login`)**
1. User focuses Email Input (autofocus)
2. **Action**: User types email → `Tab` → Password → `Enter`
3. **Feedback**: Button displays spinner (local state)
4. **Success**: 
   - "Welcome back" Toast appears top-center
   - Redirect to `/dashboard` (< 200ms)
5. **Failure**: 
   - Input shakes (animation)
   - Error message appears inline: `text-[11px] text-red-400 mt-1`

**Signup (`/signup`)**
1. Alternative path via "Create an account" link
2. **Action**: Email → Password → Confirm → `Cmd+Enter` (Submit)
3. Same feedback pattern as login

#### Visual Flow
```
┌─────────────────────────────────────────┐
│ Landing (/)                             │
│ ├─ Token Valid? ─────────> Dashboard   │
│ └─ Token Invalid? ────────> Login      │
│                                         │
│ Login (/login)                          │
│ ├─ Email Input (autofocus)             │
│ ├─ Tab → Password                       │
│ ├─ Enter → Validate                    │
│ └─ Success → Dashboard (< 200ms)       │
└─────────────────────────────────────────┘
```

---

### 2. Onboarding (The Setup)

**Goal**: Configure the initial "Knowledge Graph" (Spaces) without overwhelming the user.

**Key Interaction**: "The Wizard" (Step-by-step modal).

#### Flow Steps

**Welcome State**
1. User lands on `/onboarding`
2. **Visual**: Large, animated "Compass" icon. Minimal text.
3. **Action**: Press `Enter` to start

**Topic Definition**
1. **UI**: Single input field, centered
2. **Action**: User types a topic (e.g., "React Performance") → Press `Enter`
3. **Result**: Topic becomes a "Tag" pill below the input
4. **Repeat**: User adds 2-3 more topics
5. **Completion**: Press `Cmd+Enter` to continue

**Seeding (The Wait)**
1. **UI**: Progress bar with "terminal-style" logs
   - Examples: "Initializing graph...", "Fetching artifacts..."
2. **System**: Backend generates initial Spaces and fetches ~5-10 artifacts
3. **Transition**: Auto-redirect to `/dashboard` upon completion

#### Visual Flow
```
Step 1: Welcome
┌───────────────────────────┐
│ [Compass Icon]            │
│ Welcome to Misir          │
│                           │
│ Press ↵ to start          │
└───────────────────────────┘

Step 2: Topics
┌───────────────────────────┐
│ What are you learning?    │
│                           │
│ [Input: Topic 1_____]     │
│                           │
│ [React] [TypeScript]      │
│                           │
│ Press ⌘↵ to continue      │
└───────────────────────────┘

Step 3: Seeding
┌───────────────────────────┐
│ [Progress: ████░░░░░] 60% │
│                           │
│ Creating spaces...        │
│ Fetching artifacts...     │
└───────────────────────────┘
```

---

### 3. The Discovery Loop (Triage)

**Goal**: Rapidly find, assess, and organize learning artifacts.

**Key Interaction**: `Cmd+K` (Command Palette) & Keyboard Navigation.

#### Flow Steps

**Trigger**
1. User presses `Cmd+K` anywhere in the app
2. **UI**: Command Palette modal opens instantly (`z-50`). Backdrop blurs.

**Search**
1. User types query (e.g., "rendering patterns")
2. **UI**: Results list updates in real-time (debounced 150ms)
3. **Visuals**: High relevance items show "Score" badge

**Navigation**
1. User uses `↑` / `↓` arrows to highlight results
2. **Preview**: Hitting `Space` opens a quick side-panel preview of the artifact

**Action**
- **Open**: Press `Enter` to navigate to full Artifact view
- **Quick Actions**:
  - `S`: Save to active Space
  - `C`: Copy Link
  - `Esc`: Close Palette

#### Command Palette Specifications
```tsx
<Dialog open={isOpen} onOpenChange={setIsOpen} className="z-50">
  <DialogContent className="p-0 max-w-2xl bg-[#141517] border border-white/10 overflow-hidden">
    {/* Search Input */}
    <div className="border-b border-white/5 p-4">
      <input 
        type="text"
        placeholder="Search or type a command..."
        className="w-full bg-transparent border-none text-[13px] text-[#EEEEF0] placeholder:text-[#5F646D] focus:outline-none"
        autoFocus
      />
    </div>

    {/* Results List */}
    <div className="max-h-[400px] overflow-y-auto">
      {results.map((result, i) => (
        <div 
          key={result.id}
          className={cn(
            "h-10 px-4 flex items-center justify-between cursor-pointer",
            "border-b border-white/[0.02] transition-colors duration-150",
            i === selectedIndex ? "bg-[#191A1D]" : "hover:bg-[#121315]"
          )}
        >
          {/* Result content */}
        </div>
      ))}
    </div>

    {/* Footer with shortcuts */}
    <div className="border-t border-white/5 p-2 flex items-center gap-4 text-[11px] text-[#5F646D]">
      <span><kbd>↵</kbd> Open</span>
      <span><kbd>Space</kbd> Preview</span>
      <span><kbd>Esc</kbd> Close</span>
    </div>
  </DialogContent>
</Dialog>
```

#### Visual Flow
```
Cmd+K Triggered
┌──────────────────────────────────────┐
│ [🔍] Search or type a command...     │
├──────────────────────────────────────┤
│ → TypeScript Patterns          94%   │
│   React Hooks Guide            89%   │
│   Linear Design System         87%   │
├──────────────────────────────────────┤
│ ↵ Open  Space Preview  Esc Close    │
└──────────────────────────────────────┘
```

---

### 4. Space Management

**Goal**: Create and structure knowledge domains.

**Key Interaction**: Sidebar & Modals.

#### Flow Steps

**Create Space**
1. **Trigger**: Click `+` icon in Sidebar OR press `C` (Create)
2. **UI**: "Create Space" modal appears
3. **Input**:
   - Name (autofocus)
   - Icon (auto-suggested based on name)
   - Description (optional)
4. **Action**: Press `Cmd+Enter` to save
5. **Feedback**: 
   - Toast: "Space created"
   - Sidebar updates optimistically

**View Space**
1. User navigates to `/spaces/[id]`
2. **UI**: "List View" of artifacts
3. **Sorting**: User presses `F` (Filter) to toggle display options (Date, Engagement, Score)

#### Create Space Modal
```tsx
<Dialog>
  <DialogContent className="w-[480px] bg-[#141517] border border-white/10">
    <DialogHeader>
      <DialogTitle className="text-[15px] font-semibold text-[#EEEEF0]">
        Create Space
      </DialogTitle>
    </DialogHeader>

    <div className="space-y-4 py-4">
      {/* Icon Selector */}
      <div className="flex items-center gap-3">
        <div className="size-12 rounded-lg bg-gradient-to-br from-[#5E6AD2] to-[#4E5AC0] flex items-center justify-center text-xl">
          📚
        </div>
        <Button variant="ghost" size="sm">Change</Button>
      </div>

      {/* Name Input */}
      <div>
        <Label className="text-[11px] uppercase tracking-wider text-[#5F646D]">Name</Label>
        <Input 
          autoFocus
          placeholder="e.g., Frontend Development"
          className="h-10 mt-1"
        />
      </div>

      {/* Description */}
      <div>
        <Label className="text-[11px] uppercase tracking-wider text-[#5F646D]">Description</Label>
        <Textarea 
          placeholder="What will you learn here?"
          className="min-h-20 mt-1"
        />
      </div>
    </div>

    <DialogFooter>
      <Button variant="ghost" onClick={onClose}>Cancel</Button>
      <Button className="bg-[#5E6AD2] hover:bg-[#4E5AC0]">
        Create Space <kbd className="ml-2">⌘↵</kbd>
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

### 5. The Review Cycle (Analytics)

**Goal**: Assess learning velocity and drift.

**Key Interaction**: Data Visualization & Tabs.

#### Flow Steps

**Access**
1. User navigates to `/dashboard/analytics` via Sidebar

**Period Selection**
1. **Default view**: "Last 7 Days"
2. **Action**: User clicks "30D" or "90D" toggle (top right)
3. **Transition**: Charts re-render with morph transition (150ms)

**Drill Down**
1. User hovers over "Activity Heatmap" cell
2. **Feedback**: Tooltip shows specific stats for that day
3. **Action**: Click cell → Filters standard Artifacts list to that specific date

#### Interaction Pattern
```
Analytics Page
┌──────────────────────────────────────────────┐
│ Analytics              [7D] [30D] [90D]      │
├──────────────────────────────────────────────┤
│ [Metric Cards: 4-col grid]                   │
│                                              │
│ [Engagement Timeline Chart]                  │
│ ├─ Hover: Tooltip with stats                │
│ └─ Click: Filter artifacts to date          │
│                                              │
│ [Heatmap: Activity by Day]                   │
│ ├─ Hover: Day stats                         │
│ └─ Click: Jump to day view                  │
└──────────────────────────────────────────────┘
```

---

### 6. Keyboard Shortcuts Reference

The following shortcuts are **global** and drive the user flows:

| Key | Action | Context |
|-----|--------|---------|
| `Cmd+K` | Command Palette | Global search & actions |
| `C` | Create New | Create Space (Global) or Artifact (within Space) |
| `G` then `D` | Go to Dashboard | Navigation |
| `G` then `S` | Go to Spaces | Navigation |
| `Esc` | Close / Cancel | Modals, Sidebars, Inputs |
| `Cmd+Enter` | Submit | Forms, Modals |
| `/` | Focus Search | Focuses the main search input |
| `J` / `K` | Next / Prev | List navigation (Vim style) |
| `↑` / `↓` | Navigate Up/Down | Command Palette, Lists |
| `Space` | Quick Preview | Opens side panel preview |
| `Enter` | Open / Select | Confirms selection |
| `F` | Filter | Toggle filter options |
| `S` | Save | Save to Space (in Command Palette) |

#### Implementation: Keyboard Handler
```tsx
// hooks/use-keyboard-shortcuts.ts
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function useKeyboardShortcuts() {
  const router = useRouter()
  const [isCommandOpen, setIsCommandOpen] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Command Palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsCommandOpen(true)
      }

      // Navigation
      if (e.key === 'g') {
        const nextKey = await waitForNextKey()
        if (nextKey === 'd') router.push('/dashboard')
        if (nextKey === 's') router.push('/dashboard/spaces')
      }

      // Create
      if (e.key === 'c' && !e.metaKey && !e.ctrlKey) {
        const target = e.target as HTMLElement
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
        // Open create modal
      }

      // Focus Search
      if (e.key === '/' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        document.getElementById('main-search')?.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [router])

  return { isCommandOpen, setIsCommandOpen }
}
```

#### Keyboard Hints UI
Display keyboard shortcuts throughout the interface:

```tsx
// Example: Button with keyboard hint
<Button className="gap-2">
  Create Space
  <kbd className="h-5 px-1.5 text-[11px] font-mono bg-white/5 border border-white/10 rounded">
    C
  </kbd>
</Button>

// Example: Footer shortcuts
<div className="fixed bottom-0 left-0 right-0 h-8 border-t border-white/5 bg-[#0B0C0E]/95 backdrop-blur-xl flex items-center justify-center gap-6 text-[11px] text-[#5F646D] z-30">
  <span><kbd>⌘K</kbd> Search</span>
  <span><kbd>C</kbd> Create</span>
  <span><kbd>G</kbd><kbd>D</kbd> Dashboard</span>
  <span><kbd>?</kbd> Help</span>
</div>
```

---

## Key Differences from Notion Aesthetic

| Aspect | Previous (Notion) | Current (Linear) |
|--------|-------------------|------------------|
| **Base Font Size** | 15px | 13px |
| **Font Family** | System fonts | Inter (tight tracking) |
| **Background** | Warm neutrals (#0F0F0F) | Cool void (#0B0C0E) |
| **Borders** | white/9 (subtle gray) | white/5 (very subtle), white/10 (active) |
| **Hover Effects** | Scale transforms common | No scale (colors/borders only) |
| **Transition Speed** | 300ms | 150ms (fast, snappy) |
| **Layout Density** | Spacious (py-8, gap-8) | High density (py-4, gap-3) |
| **Cards** | Rounded-xl, shadow-lg | Rounded-md, minimal shadow |
| **Buttons** | h-11 (44px) | h-8/h-10 (32-40px) |
| **Badges** | h-6 (24px) | h-5 (20px) |
| **Inputs** | h-11 (44px) | h-10 (40px) |
| **Typography** | Larger sizes (xl/2xl) | Smaller sizes (base/lg) |
| **Accent Color** | Warm purple/blue | Linear Purple (#5E6AD2) |
| **Loading** | Shimmer animations | Pulse animations (no shimmer) |
| **Lists** | Card-based grids | High-density rows (h-10) |

---

## Implementation Checklist

To fully convert from Notion → Linear aesthetic:

### Design Tokens
- [ ] Update `globals.css` color variables to Linear palette
- [ ] Change base font size from 15px to 13px
- [ ] Import Inter font with tight tracking
- [ ] Update transition durations from 300ms → 150ms

### Layout
- [ ] Convert sidebar to fixed 240px width
- [ ] Update bg colors: #0B0C0E (void), #141517 (surface)
- [ ] Change all border-border/40 → border-white/5
- [ ] Reduce padding/spacing (py-8 → py-4, gap-8 → gap-3)

### Components
- [ ] Reduce button heights: h-11 → h-8/h-10
- [ ] Reduce badge heights: h-6 → h-5
- [ ] Update input styles to Linear spec
- [ ] Remove scale transforms from hover states
- [ ] Update shadow usage (minimal, primarily on modals)

### Typography
- [ ] Scale down all text sizes by ~2px
- [ ] Update colors: primary (#EEEEF0), muted (#8A8F98), subtle (#5F646D)
- [ ] Add uppercase + tracking-widest to section labels
- [ ] Use tabular-nums for all numeric data

### Lists & Tables
- [ ] Convert card grids to high-density lists where appropriate
- [ ] Implement h-10 row pattern for artifacts/data
- [ ] Add border-white/[0.02] row dividers
- [ ] Sticky table headers with backdrop-blur

### Animations
- [ ] Remove shimmer loading animations
- [ ] Speed up all transitions to 150ms
- [ ] Remove scale on hover (except modals)
- [ ] Simplify page transitions (instant navigation)

### Keyboard Shortcuts
- [ ] Add kbd components throughout UI
- [ ] Implement ⌘K global search
- [ ] Add keyboard hints to buttons/actions
- [ ] Show shortcuts in tooltips

---

## File Reference

| Page | File Path | Primary Components |
|------|-----------|-------------------|
| Root | `app/page.tsx` | Redirect logic |
| Login | `app/login/page.tsx` | `LoginForm` |
| Signup | `app/signup/page.tsx` | `SignupForm` |
| Onboarding | `app/onboarding/page.tsx` | Multi-step form |
| Dashboard | `app/dashboard/page.tsx` | `MisirSectionCards` |
| Search | `app/dashboard/search/page.tsx` | Search results |
| Artifacts | `app/dashboard/artifacts/page.tsx` | Artifact list |
| Spaces | `app/dashboard/spaces/page.tsx` | Space grid |
| Space Detail | `app/dashboard/spaces/[spaceId]/page.tsx` | Space header, artifact list |
| Analytics | `app/dashboard/analytics/page.tsx` | Charts, metrics |
| Report | `app/dashboard/report/page.tsx` | Config panel, preview |

---

**End of Document**  
*Last Updated: Linear Edition*  
*For questions or updates, reference the Linear Design Spec*
