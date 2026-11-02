# Otion × LumaClone UI/UX implementation plan

Last updated: 2026-11-03

Implementation status: **completed and verified**

## 1. Objective

Translate the strongest visual and interaction patterns from `client/LumaClone` into Otion while preserving Otion's document-workspace domain, existing React/Vite architecture, realtime collaboration behavior, accessibility requirements, and light/dark themes.

This is a design-language adaptation, not a feature or code transplant. Event-management concepts, assets, copy, navigation, and data models must not enter Otion.

## 2. Reference audit

### Technology findings

- **Next.js:** LumaClone uses App Router pages, layouts, `next/link`, `next/image`, and client boundaries. Otion already has a stable Vite + React Router client, so only component composition and route-level UX patterns transfer. A Next.js migration is intentionally excluded.
- **React:** Both products are component-driven. Otion will retain React 19 and its current context/hooks architecture.
- **Zod:** LumaClone uses schema-first form validation. Otion will add client-side Zod schemas for authentication and high-value forms while retaining server validation as the authority.
- **Motion:** LumaClone uses entrance fades/scales, spring reveals, and hover transitions. Otion will use `motion/react` for route hero reveals, dialogs, cards, and navigation state without animating the editor's content model.
- **Lucide React:** Otion already uses Lucide. Icons will be normalized to consistent 16/18/20 px sizes and paired with accessible labels/tooltips.

### Visual system findings

- Inter-based typography with medium/semibold weights and restrained tracking.
- Zinc-neutral foregrounds and surfaces instead of high-saturation UI chrome.
- Low-opacity cyan/violet/pink/orange ambient gradients behind otherwise neutral layouts.
- Translucent panels with backdrop blur, hairline borders, and soft large-radius shadows.
- Rounded controls: 10–14 px controls, 16–24 px cards/dialogs, and full pill navigation/status elements.
- Strong primary/secondary hierarchy: one high-contrast action per region, quiet secondary actions, icon-only tertiary controls.
- Dark mode is designed as a first-class palette rather than a color inversion.
- Spacious marketing/authentication views and denser application/editor views.

### Interaction findings

- Short opacity/translate/scale entrances establish hierarchy without blocking interaction.
- Hover states use brightness, surface tint, and small elevation changes rather than large movement.
- Dropdowns and dialogs are compact, rounded, and visually attached to their trigger.
- Forms put labels, help, errors, and actions in one clear vertical path.
- Responsive navigation progressively removes labels before hiding actions.

### UX strengths to retain

- Low cognitive load and clear focal actions.
- Consistent surface hierarchy.
- Friendly, polished first-run/authentication experience.
- Visible system feedback for loading, selected, active, and disabled states.
- Compact global navigation with recognizable Lucide icons.

### Reference weaknesses not to copy

- Direct `localStorage` access during render.
- Inconsistent durations such as invalid `transition 2s` utility usage.
- Mixed React icon libraries and inconsistent icon sizing.
- Some low-contrast zinc-on-zinc combinations.
- Desktop-first fixed widths and incomplete authenticated home content.
- Client-only validation or navigation assumptions that would weaken Otion's server-enforced permissions.

## 3. Otion design direction

### Product character

Otion should feel calm, luminous, collaborative, and precise. The gradient is atmospheric rather than decorative; document content remains the highest-contrast layer.

### Semantic tokens

- Canvas: warm near-white / near-black.
- Surface: translucent white or zinc-black.
- Elevated surface: higher-opacity surface with stronger border and shadow.
- Text: high-contrast neutral.
- Muted text: WCAG-safe zinc neutral.
- Accent: violet-indigo for focus, selection, links, and collaboration.
- Ambient gradient: cyan → indigo → violet → pink → orange at low opacity.
- Success, warning, and destructive colors remain semantic and are never replaced by the ambient palette.

### Shape and depth

- Small controls: 10 px radius.
- Standard controls: 12 px radius.
- Cards/panels: 18–24 px radius.
- Dialogs: 22 px radius.
- Shadows: broad, low-alpha shadows; dark mode uses borders more than shadow.

### Motion rules

- Page/hero reveal: 320–500 ms, 12–20 px travel.
- Dialog: 180–240 ms fade + scale from 0.97.
- Card hover: 160–200 ms, maximum 2 px vertical lift.
- Menus/popovers: 140–180 ms.
- Respect `prefers-reduced-motion` and never animate editor text positions, remote cursors, or autosave layout.

## 4. Information architecture mapping

| LumaClone pattern | Otion adaptation |
| --- | --- |
| Ambient gradient page background | Shared `AmbientBackground` behind marketing, auth, dashboard, settings, trash, and editor shell |
| Compact top navigation | Otion document navbar with translucent chrome and grouped icon actions |
| User dropdown card | Existing profile/settings/logout region styled as a compact identity surface |
| Glass sign-in card | Login/register glass authentication panel with schema validation and motion reveal |
| Large landing hero | Otion collaboration hero with gradient emphasis and an original workspace preview |
| Event cards | Recent-document cards with icon, title, updated timestamp, and hover elevation |
| Settings tabs/sections | Otion account sections using elevated, grouped panels and sticky visual hierarchy |
| Motion onboarding | Restrained route/card/dialog entrances and loading feedback |

## 5. Implementation phases

### Phase A — Foundation

- Add `motion` and client-side `zod` dependencies.
- Extend semantic CSS tokens for ambient color, surfaces, elevation, focus, and control states.
- Add reusable CSS component classes for glass panels, surface cards, primary/secondary/icon buttons, fields, gradient text, and focus rings.
- Add `AmbientBackground`, `BrandMark`, and `PageTransition` components.
- Preserve the existing reduced-motion override.

### Phase B — Marketing and authentication

- Rebuild Home with a compact translucent header, gradient-emphasis hero, Otion-native product preview, and simple footer.
- Rebuild Login/Register around a shared glass auth shell.
- Use Zod for email/password/name/confirm-password validation before requests.
- Add motion reveals and explicit inline validation states.

### Phase C — Application shell

- Restyle Sidebar as a translucent workspace rail with pill active states, clearer section labels, and consistent icon buttons.
- Restyle Navbar as a blurred command strip with grouped actions, compact collaborator presence, and responsive labels.
- Keep the 240 px desktop layout and existing mobile drawer behavior.
- Preserve all search, create, drag/reparent, favorite, archive, notification, and logout behavior.

### Phase D — Core views

- Dashboard: improve greeting hierarchy, primary create action, empty state, and recent-document cards.
- Note editor: retain content geometry and CRDT behavior; improve canvas framing, toolbar surface, title styling, collaborator affordances, and status presentation.
- Trash: apply the same section/card/action hierarchy.
- Settings: regroup account areas into polished surface cards while preserving destructive-action separation.
- Public note: use the same document canvas without authenticated application chrome.

### Phase E — Overlays and feedback

- Animate Modal with `AnimatePresence`, accessible overlay dismissal, focus handling, and reduced-motion compliance.
- Normalize Share, Comments, Page Style, Version History, notifications, command menu, and link popover surfaces.
- Ensure loading, saved, disabled, empty, error, selected, and hover states are visible in both themes.

### Phase F — Verification

- Run ESLint and production build.
- Check all routes at mobile, tablet, and desktop widths.
- Check light/dark contrast, keyboard focus, modal focus trap, reduced motion, and icon labels.
- Verify editor autosave, manual save, Yjs updates, search, sharing, favorites, notifications, and archive flows remain behaviorally unchanged.

## 6. Acceptance criteria

- Otion has a coherent Luma-inspired visual language without event-management content or copied branding.
- No change to API contracts, realtime protocols, permission enforcement, or document data.
- All primary controls have readable light/dark contrast and visible focus states.
- Layout works from 320 px mobile through large desktop sizes.
- Motion is purposeful, subtle, and disabled/reduced according to user preference.
- Login/register validation is immediate and server errors remain visible.
- Client lint and production build pass with zero errors.

## 7. Out of scope

- Migrating Vite/React Router to Next.js.
- Importing LumaClone images, videos, logos, translations, event flows, Prisma models, Firebase, Cloudinary, or authentication logic.
- Replacing Otion's editor, Socket.io/Yjs collaboration engine, backend validation, or API layer.
- Reintroducing object/file uploads.

## 8. Completed implementation record

- Added semantic light/dark tokens, ambient gradients, glass/elevated surfaces, action variants, fields, focus treatment, and responsive rules.
- Added reusable `AmbientBackground`, `BrandMark`, and `PageTransition` components.
- Added `motion` with user-preference reduced-motion handling through `MotionConfig`.
- Added Zod validation to login and registration, including accessible inline errors and confirm-password validation.
- Rebuilt Home with an Otion-native collaboration preview, responsive hero, compact navigation, theme control, and focused calls to action.
- Rebuilt Login and Register with translucent authentication cards and restrained entrance motion.
- Restyled Sidebar, Navbar, Dashboard, Note Editor, Settings, Trash, and Public Note views.
- Restyled Modal, notifications, editor formatting/command surfaces, Share, Comments, Page Style, and Version History overlays.
- Excluded `LumaClone`, `notion-clone`, and Stitch reference sources from Otion's ESLint and Tailwind source scans.
- Verified desktop and 390 px mobile layouts, light/dark authentication contrast, Zod error rendering, and an error-free browser console.
- Verified ESLint, Vite production build, and production dependency audit.
