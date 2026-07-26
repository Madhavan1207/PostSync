# 1_ Postelligence Marketing Landing Page documentation

This document provides a comprehensive technical and design breakdown of the **Postelligence Marketing Landing Page** (`app/(marketing)/page.tsx`), detailing its visual design system, structure, components, animations, and SEO setups.

---

## 🎨 Visual Design System & Aesthetics

The landing page is designed to establish a **premium, tactile, and calm visual aura** that avoids standard startup templates. 

### 1. Color Palette & Typography
- **Background**: Soft cream-white `#f6f7f1` using a subtle grain overlay structure.
- **Accents**: 
  - Brand Teal: `#2f7867` (representing growth, peace, and sync quality).
  - Light Sage Green: `#eaf7ef` (for highlighted cards, badges, and positive states).
  - Coral Rust: `#d05945` (for micro-highlights, warnings, and accents).
- **Text**: Dark Charcoal `#1f2528` (representing clean structure and readability).
- **Typography**: Heavy, tracking-tight titles (`tracking-[-0.03em]`) using modern premium fonts like *Outfit* or *Inter*.

### 2. Ambient Visual Elements
- **Glow Blobs**: Layered, low-opacity radial gradients (e.g. `bg-gradient-to-b from-[#2f7867]/10 to-transparent`) blur-shielded behind containers to create depth.
- **Grid Pattern**: A clean CSS-grid background overlay (`opacity-40` of `72px x 72px` grid squares) that adds structural texture.
- **Glassmorphism**: Translucent frosted panels (`bg-white/80 backdrop-blur-sm shadow-sm`) with soft borders (`border-[#1f2528]/8`).

---

## 🏗️ Structure & Layout Sections

The page is organized into the following logical layout sections to guide conversion:

### 1. Navigation Header (Global Layout)
- Displays the `BrandMark` component on the left.
- Interactive navigation links: *Features*, *Platforms*, *Pricing*, *Changelog*, *About*.
- Right side: Call-To-Action (CTA) link for **Try Postelligence Free**.

### 2. Hero Section
- **Visual Pill**: An upfront badge *"The unified composer for purpose-driven creators"*.
- **Hero Title**: High-impact heading featuring bold text and gradient text highlights: *"Designed for creators who publish with purpose."*
- **Action Buttons**: Primary CTA button to launch login portal and secondary outline button to view features.
- **Interactive Showcase Frame**: A mock preview of the creator dashboard, rendering active scheduler stats, analytics charts, and draft lists.

### 3. Integrated Platforms Carousel
- Displays logo rows of all supported platforms (LinkedIn, Instagram, YouTube, Threads, Bluesky, Pinterest, etc.).
- Auto-scrolls and uses hover scale shifts to illustrate integration breadth.

### 4. Core Features Bento Grid
- Four modular bento-style feature cards with distinct icons:
  1. **Unified Composer**: Social-specific length limits and formatting previews.
  2. **AI Studio**: Brand tone matching and caption generation.
  3. **Visual Calendar**: Drag-and-drop post scheduling.
  4. **Analytics That Clarify**: Actionable statistics instead of clutter.

### 5. Pricing Grid (Tier Card Presentation)
- Displays transparent subscription tiers (Free vs. Pro/Creator) highlighting seat limits, connected accounts, and AI capacity to facilitate quick onboarding.

### 6. Interactive FAQ Panel
- A clean accordion component that toggle-reveals details about billing, APIs, secure platform auth, and account settings.

### 7. Global Footer Panel
- Nav links, copyright notices, and platform policies.

---

## 🎭 Animations & Transitions

Postelligence utilizes **Framer Motion** to drive a premium sense of interaction:

- **Reveal on Scroll (`Reveal`)**: Custom scroll-based animation wrapper that animates items up (`y: 16` to `0`) and fades them in (`opacity: 0` to `1`) using smooth bezier transitions (`duration: 0.6`, `ease: [0.22, 1, 0.36, 1]`).
- **Interactive Hover Shifts**: Bento cards apply `whileHover={{ y: -6, scale: 1.01 }}` transitions, creating a tangible sense of weight and tactile connection.
- **Radial Hover Gradient**: A radial hover background follows cursor shifting over card overlays, producing a glass-shining effect.