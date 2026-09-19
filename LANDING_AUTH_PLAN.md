# Landing Page + Auth Page — Build Plan

## Routes

- `/` — Landing page (public)
- `/auth` — Single page, animated toggle between Login and Signup (recommended over two separate routes: it lets the switch itself be a smooth crossfade/slide transition, which fits the "smooth transitions" brief, and it's one component instead of two near-duplicate ones)
- On successful login/signup → redirect to `/overview` (your existing dashboard)

## Landing page — structure (top to bottom)
1. **Navbar** — Duewell logo + wordmark (reuse from your sidebar), a couple of nav links (Features, maybe nothing else — keep it light since this isn't a full marketing site), a "Sign in" text link + a filled "Get started" button (both go to `/auth`, get-started opens on the signup tab)
2. **Hero** — Big serif headline (matching the "Good evening, Alex" style from your dashboard), a short subheadline, two CTA buttons (primary "Get started" filled indigo, secondary "Sign in" outlined/ghost). Fades/slides in on page load, not scroll-triggered (it's the first thing visible).
3. **Product preview** — A framed mockup/screenshot of the actual dashboard (reuse a cropped version of your real Overview screen). This is scroll-triggered: starts slightly scaled-down and translated, animates to full scale/position as the user scrolls it into view. This is the centerpiece scroll animation.
4. **Feature highlights** — 3 short blocks (e.g. "Smart reminders", "Ask Duewell — AI assistant", "One view of every bill"), each with a small icon, title, one line of copy. They animate in with a stagger as the section enters the viewport (fade + slight upward movement, offset by ~0.1s each).
5. **Closing CTA** — Short line + one button ("Get started free"), centered, simple fade-in on scroll.
6. **Footer** — Minimal: logo, one line of copyright, maybe 2-3 links.

## Animation approach (Framer Motion, no new dependency)

- Page-load elements (navbar, hero): `initial`/`animate` with a fade + slight y-offset.
- Scroll-triggered sections (product preview, features, CTA): `whileInView` with `viewport={{ once: true, amount: 0.3 }}` for simple reveals.
- The product preview's scale/parallax effect specifically: `useScroll` with a `target` ref on that section + `useTransform` mapping scroll progress to `scale` and `y` — this is the "scroll trigger" effect that tracks scroll position continuously rather than firing once.
- Stagger on the feature grid: a parent `variants` object with `staggerChildren`, children fade+rise individually.
- Keep durations short (0.4–0.6s) and easing consistent (`ease: [0.16, 1, 0.3, 1]` or similar — matches the calm, premium feel of the dashboard).

## Auth page — structure

- Centered card (same visual language as your dashboard cards: white surface, soft border, `rounded-2xl`, minimal shadow) on the same warm off-white background as the rest of the app.
- Top of the card: Duewell logo, a heading that changes with the toggle ("Welcome back" for login / "Create your account" for signup).
- Toggle: two tabs or a pill switch ("Log in" / "Sign up") — switching triggers an `AnimatePresence` crossfade between the two forms, not a full page navigation.
- **Login form**: email, password, "Forgot password?" link (can be a dead link for now if you haven't built that flow), submit button.
- **Signup form**: name, email, password, confirm password, submit button.
- Inline validation errors (red text under the field, small shake animation on submit failure), matching the status-pill red used on your dashboard's "Needs attention" card.
- On submit: call your existing `/auth/login` or `/auth/signup` endpoint, store the JWT, redirect to `/overview`.

## New components to add

- `Navbar.jsx`
- `Hero.jsx`
- `ProductPreview.jsx`
- `FeatureGrid.jsx`
- `ClosingCTA.jsx`
- `Footer.jsx`
- `AuthPage.jsx` (with `LoginForm.jsx` / `SignupForm.jsx` as children, or inlined if small enough)

## Build order

1. Navbar + Hero (static first, get the layout and copy right before animating)
2. Auth page — both forms, wired to your real endpoints, toggle working (no animation yet)
3. Add the toggle crossfade animation
4. Product preview section — get the static layout right, then add the scroll-linked `useScroll`/`useTransform` effect
5. Feature grid with stagger-on-scroll
6. Closing CTA + footer
7. Polish pass: consistent spacing, dark mode check, mobile responsiveness (stack the hero CTAs, scale down the preview mockup)
