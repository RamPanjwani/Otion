---
name: Otion
colors:
  surface: '#fcf9f8'
  surface-dim: '#dcd9d9'
  surface-bright: '#fcf9f8'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f6f3f2'
  surface-container: '#f0eded'
  surface-container-high: '#eae7e7'
  surface-container-highest: '#e5e2e1'
  on-surface: '#1c1b1b'
  on-surface-variant: '#444748'
  inverse-surface: '#313030'
  inverse-on-surface: '#f3f0ef'
  outline: '#747878'
  outline-variant: '#c4c7c7'
  surface-tint: '#5f5e5e'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#1c1b1b'
  on-primary-container: '#858383'
  inverse-primary: '#c8c6c5'
  secondary: '#006c49'
  on-secondary: '#ffffff'
  secondary-container: '#6cf8bb'
  on-secondary-container: '#00714d'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#1d1b1a'
  on-tertiary-container: '#868381'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e5e2e1'
  primary-fixed-dim: '#c8c6c5'
  on-primary-fixed: '#1c1b1b'
  on-primary-fixed-variant: '#474646'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#e6e1df'
  tertiary-fixed-dim: '#cac6c3'
  on-tertiary-fixed: '#1d1b1a'
  on-tertiary-fixed-variant: '#484645'
  background: '#fcf9f8'
  on-background: '#1c1b1b'
  surface-variant: '#e5e2e1'
typography:
  display-title:
    fontFamily: Inter
    fontSize: 40px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  h1:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '700'
    lineHeight: '1.3'
    letterSpacing: -0.01em
  h1-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: '1.3'
  h2:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: '1.4'
  body:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: '1.6'
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: '1.5'
  label:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1'
    letterSpacing: 0.02em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  sidebar-width: 240px
  container-max: 900px
---

## Brand & Style
The design system focuses on **Utility-driven Minimalism**, optimized for high-density information and focused deep work. It prioritizes clarity over decoration, utilizing a monochromatic core palette to ensure that user content remains the primary focus. 

The aesthetic is inspired by architectural blueprints and modern editorial design—relying on precise alignment, generous white space, and a clear typographic hierarchy. The emotional response is one of calm, organized productivity, stripping away visual noise to lower cognitive load during real-time collaboration.

## Colors
The palette is built on a foundation of "Functional Neutrals."
- **Canvas & Surface:** The main workspace uses `#FFFFFF`, while navigation and sidebars use a subtle `#FBFBFB` to create a logical separation without harsh lines.
- **Typography:** Primary text uses Deep Slate (`#191919`) for high legibility, while secondary metadata and placeholders use Neutral Gray (`#787774`).
- **Accents:** Charcoal (`#0F0F0F`) is reserved for primary actions and bold UI elements. Emerald Green (`#10B981`) serves as the success and "active session" indicator.
- **Roles:** Specific semantic colors are assigned to collaboration roles (Indigo, Amber, Cyan) to allow for quick identification in multi-user environments.

## Typography
This design system utilizes a systematic sans-serif stack led by **Inter**. The type scale is optimized for reading long-form documentation and scanning nested lists.
- **Vertical Rhythm:** A strict 1.6 line-height for body text ensures breathability in dense paragraphs.
- **Hierarchy:** Weight is used sparingly to denote importance; Bold is reserved for titles and headers, while Semi-bold is used for interactive elements and labels.
- **Letter Spacing:** Headlines utilize slight negative tracking (-0.01em to -0.02em) to maintain a compact, professional appearance at larger sizes.

## Layout & Spacing
The layout follows a **Fixed-Fluid Hybrid** model.
- **Sidebar:** A fixed 240px sidebar on the left for navigation.
- **Workspace:** A centered content container with a maximum width of 900px to maintain optimal line lengths for readability.
- **Rhythm:** An 8px grid governs all spacing. Vertical gaps between blocks are typically 4px or 8px, while section margins use 24px or 40px to create distinct visual breaks.
- **Responsive:** On mobile, sidebars collapse into a hamburger menu or bottom sheet, and horizontal margins shrink to 16px.

## Elevation & Depth
Depth is communicated through **Hairline Borders** and **Flat Tonal Layering** rather than heavy shadows.
- **Level 0 (Canvas):** Pure White.
- **Level 1 (Sidebar/In-set):** Off-white (`#FBFBFB`) with a 1px right-border (`#E9E9E9`).
- **Level 2 (Dropdowns/Popovers):** Pure White surface, 1px border (`#E9E9E9`), and a crisp, tight shadow: `0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)`.
- **Level 3 (Modals):** Pure White surface, 1px border, and a more pronounced shadow to pull the element forward: `0 20px 25px -5px rgba(0,0,0,0.1)`.

## Shapes
The shape language is "Soft Geometry." All standard UI components (buttons, inputs, cards) use a consistent **6px (0.375rem) corner radius**. This provides a subtle modern touch without feeling overly bubbly or "toy-like."

- **Role Badges:** Use a slightly higher radius (4px) or full pill-shape depending on context.
- **Checkboxes:** Maintain a small 3px radius for a crisp, functional look.

## Components
- **Buttons:**
  - *Primary:* Charcoal (`#0F0F0F`) background, White text.
  - *Ghost:* No background, Deep Slate text, Soft Gray (`#EFEFEF`) hover state.
- **Input Fields:** 1px border (`#E9E9E9`), 6px radius. Focused state changes border color to Neutral Gray (`#787774`).
- **Role Badges:** Small text (11px-12px), Semi-bold. Backgrounds use a 10% opacity tint of the role color with a 100% opacity text color (e.g., Owner: Indigo text on light Indigo tint).
- **Cards:** 1px border (`#E9E9E9`), no shadow. Use for grouping dashboard metrics or document templates.
- **Collaborator Cursors:** 1px vertical line in the user's role color with a small flag label displaying the user's name.
- **Context Menus:** Use 1px borders and slight transparency (98% white) to allow background hints to show through.