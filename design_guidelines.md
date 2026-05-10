# MTA Server Store - Design Guidelines

## Design Approach

**Reference-Based Approach**: Gaming E-commerce Platform

Drawing inspiration from modern gaming marketplaces (Steam, Epic Games Store, Discord) and competitive game item shops (Valorant, League of Legends). This creates an energetic, trust-building experience that excites users while maintaining professionalism for payment processing.

## Core Design Elements

### Typography System
- **Headings**: Bold, impactful sans-serif with strong weight (700-900) for product names, CTAs
- **Body**: Clean sans-serif (400-500) optimized for readability
- **Accent**: Geometric or gaming-inspired font for stats, badges, VIP indicators
- **Hierarchy**: 
  - Hero: 3xl-6xl
  - Section Headers: 2xl-4xl  
  - Product Titles: xl-2xl
  - Body: base-lg
  - Captions/Labels: sm-base

### Layout System
**Spacing Primitives**: Tailwind units of 2, 4, 6, 8, 12, 16, 20, 24
- Tight spacing: 2-4 for labels, badges
- Component padding: 6-8 for cards, buttons
- Section spacing: 12-20 for content blocks
- Page sections: 20-24 for major divisions

**Grid System**:
- Container: max-w-7xl with responsive padding
- Product grids: 1 col mobile → 2 col tablet → 3-4 col desktop
- Dashboard: 12-column responsive grid

## Page-Specific Layouts

### Landing/Marketing Page
**Hero Section** (70vh):
- Full-width dramatic background showcasing game environment
- Centered headline + subheadline emphasizing "Automated Activation"
- Dual CTA buttons (Browse Products, Login) with blur backdrop
- Floating trust indicators: "Instant Delivery • Secure Payments • 24/7 Support"

**Product Showcase** (grid):
- 3-column card grid featuring popular items
- Each card: product image, title, price, badge (HOT/NEW/VIP)
- Hover effect: subtle lift + glow

**How It Works** (3-step process):
- Horizontal timeline on desktop, vertical on mobile
- Icons → numbered steps → brief descriptions
- "Buy → Instant Payment → Auto-Activated in Game"

**Trust Section**:
- 4-column stats grid: Total Sales, Active VIPs, Avg Response Time, Success Rate
- Large numbers with animated counters
- Testimonial cards with player feedback

**Footer**:
- 4-column layout: About, Products, Support, Legal
- Newsletter signup with email input
- Social links, payment method badges (Stripe, Pix)

### Product Catalog Page
**Filter Sidebar** (1/4 width desktop, drawer mobile):
- Category chips (VIP, Vehicles, Coins, Items)
- Price range slider
- Sort dropdown (Popular, Price, Newest)

**Product Grid** (3/4 width):
- Responsive card grid (2-4 columns)
- Each card: image, title, price, "Add to Cart" button, discount badge if applicable
- Quick view modal on click

### Product Detail Page
**Split Layout**:
- Left (40%): Large product image with thumbnail gallery
- Right (60%): 
  - Product title + SKU
  - Price with original/sale formatting
  - Feature bullets with checkmark icons
  - Quantity selector + "Buy Now" CTA
  - Accordion: Description, Activation Details, FAQ

**Related Products**: Horizontal scroll carousel at bottom

### User Dashboard
**Sidebar Navigation** (fixed, 1/5 width):
- Profile avatar + username
- Nav items: Overview, Purchases, VIP Status, Account, Logout

**Main Content** (4/5 width):
- **Overview Tab**: Stats cards (Active VIP, Total Spent, Items Owned) + Recent Purchases table
- **Purchases Tab**: Transaction history table with status badges, filters, search
- **VIP Status Tab**: Progress bar, expiration date, benefits list, renewal CTA
- **Account Tab**: Form for MTA serial linking, email/password update

### Admin Dashboard
**Top Bar**: Site stats overview (Today's Revenue, Pending, Active Users)

**Content Area**:
- Tabbed interface: Products, Orders, Users, Logs, Settings
- **Products**: Table with inline edit, add new button, status toggles
- **Orders**: Filterable transaction list with action buttons (Resend, Refund)
- **Logs**: Real-time activity feed with severity indicators

## Component Library

### Cards
- Product Card: Image top, content below, hover lift effect
- Stat Card: Icon + large number + label
- Transaction Card: Status badge, date, amount, action button

### Buttons
- Primary: Large, full-width on mobile, blur backdrop on images
- Secondary: Outline style for less critical actions
- Icon Buttons: Square aspect, consistent sizing (8-12 units)

### Forms
- Floating labels with smooth transitions
- Input groups with prepended icons
- Inline validation with icon indicators
- Full-width on mobile, max-w-md on desktop

### Tables
- Striped rows for readability
- Sticky headers on scroll
- Action column with icon buttons
- Responsive: Cards on mobile, table on desktop

### Badges/Tags
- Rounded corners (rounded-full for status, rounded-lg for categories)
- Small text (text-xs-sm)
- Icon + text combinations

### Modals
- Centered overlay with backdrop blur
- Close button top-right
- Max width constraints (max-w-2xl)
- Smooth entrance/exit animations

## Navigation
**Header** (sticky):
- Logo left, nav center (Products, Support, About), account right
- Mobile: Hamburger menu with slide-in drawer

**Breadcrumbs**: On product/detail pages for context

## Images
- **Hero Image**: Full-width, high-energy game screenshot or server artwork showing vibrant gameplay
- **Product Images**: Square aspect (1:1), consistent styling across catalog
- **Dashboard**: Icons/illustrations for empty states
- **Admin**: Data visualization charts where applicable

## Animations
**Minimal, purposeful**:
- Smooth page transitions (fade)
- Hover states on cards (transform scale 1.02)
- Loading spinners for async actions
- Success checkmarks for completed purchases
- NO scroll-triggered animations or parallax

## Accessibility
- ARIA labels on all interactive elements
- Keyboard navigation throughout
- Focus visible states with outline
- Screen reader friendly table structures
- Color contrast ratios meet WCAG AA minimum

This design balances gaming excitement with e-commerce professionalism, building trust while creating urgency for in-game purchases.