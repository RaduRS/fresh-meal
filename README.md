# FreshMeal - Smart Pantry & Recipe Suggestion App

# CRITICAL !
Always keep in mind DRY and separation of concerns , great design , and best coding practices.

## Project Overview

FreshMeal is a mobile-first Progressive Web App (PWA) that helps users discover healthy recipes based on ingredients they actually have at home. Users scan barcodes or take photos of food items to build their pantry inventory, then get AI-powered recipe suggestions filtered by meal type, serving size, and dietary preferences.

### Core Problem Solved
- Eliminates the friction of meal planning by showing what you can cook right now
- Reduces food waste by tracking pantry inventory
- Promotes healthy eating through AI-curated recipe recommendations
- Makes grocery shopping smarter by suggesting missing ingredients

### Target User
Single user (personal use), health-conscious, wants practical tools that fit naturally into daily cooking routines without adding complexity.

## Tech Stack

### Frontend & Framework
- **Next.js 14+** (App Router)
- **TypeScript** (strict mode)
- **Tailwind CSS** (for styling)
- **shadcn/ui** (component library)
- **PWA** (Progressive Web App with offline support)

### Backend & Database
- **Supabase**
  - PostgreSQL database
  - Real-time subscriptions (optional for future features)
  - Storage for food images
  - No authentication required for MVP

### APIs
1. **Gemini 2.5 Flash** (Google AI Studio API)
   - Image recognition for food items (fruits, vegetables, packaged goods)
   - Recipe generation (AI-only recipe discovery)
   - Missing ingredient suggestions (0 preferred, up to 2 if needed)
   - Free tier: unlimited requests for personal use

2. **Open Food Facts API**
   - Barcode scanning for packaged products
   - Product information (name, ingredients, nutrition)
   - Completely free, no API key required
   - Endpoint: `https://world.openfoodfacts.org/api/v0/product/[barcode].json`

3. **Nebius Image Generation**
   - Recipe image generation (stored in Supabase Storage)

### Camera Access
- HTML5 `getUserMedia()` API for real-time camera
- File input with `capture="environment"` attribute as fallback
- Works on iOS Safari (required for PWA installation)

## Project Goals

### MVP Features (Phase 1)
1. Scan/photograph food items to add to inventory
2. Confirm AI-detected items before adding to database
3. Manual inventory management (add, remove items)
4. Recipe search with dropdown filters (meal type, servings, adults/kids)
5. AI-enhanced recipe recommendations with missing ingredient suggestions
6. PWA installation on iPhone/iOS

### Future Enhancements (Post-MVP)
- Recipe-based automatic ingredient deduction
- Expiration date tracking and warnings
- Shopping list generation
- Favorite recipes
- Cooking history
- Nutrition tracking integration

## Features & Requirements

### 1. Inventory Management

#### Add Items via Barcode
**User Flow:**
1. User taps "Scan Barcode" button
2. Camera opens (via file input or getUserMedia)
3. User scans product barcode
4. App calls Open Food Facts API with barcode
5. **Confirmation screen** displays:
   - Product name
   - Product image (if available)
   - Category (auto-detected or manual select)
   - Edit button to correct name/category
   - Cancel button to reject
   - Confirm button to save
6. On confirm → save to Supabase `pantry_items` table
7. Show success toast, return to inventory view

**Technical Details:**
- Use `jsQR` or similar library for barcode detection from camera
- Open Food Facts API: `GET https://world.openfoodfacts.org/api/v0/product/{barcode}.json`
- Handle API failures gracefully (show manual entry form)
- Store barcode in database for future reference

#### Add Items via Photo (AI Vision)
**User Flow:**
1. User taps "Take Photo" button
2. Camera opens with preview
3. User takes photo of multiple food items
4. Photo uploads to Gemini 2.5 Flash API
5. AI returns detected items as structured JSON:
   ```json
   {
     "items": [
       {"name": "Tomatoes", "quantity": 2, "category": "Vegetable", "confidence": 0.95},
       {"name": "Milk", "quantity": 1, "category": "Dairy", "confidence": 0.88}
     ]
   }
```

6. **Confirmation screen** displays list of detected items:
    - Each item shows name, quantity, category
    - Edit icon to modify details
    - Delete icon to remove false detections
    - "Add All" button
    - "Add Selected" button
7. On confirm → save selected items to Supabase
8. Optionally save photo to Supabase Storage with reference to items

**Technical Details:**

- Gemini 2.5 Flash API prompt:

```
Analyze this image and identify all food items visible. Return a JSON array with:
- name: common name of the food item
- quantity: estimated number of items (use 1 if unclear)
- category: one of [Vegetable, Fruit, Dairy, Meat, Grain, Condiment, Beverage, Other]
- confidence: 0-1 score of detection confidence

Only include items you're confident about (confidence > 0.7).
```

- Upload image to Supabase Storage first, then send URL to Gemini API
- Implement retry logic for API failures


#### Manual Add Item

**User Flow:**

1. User taps "Add Manually" button
2. Form appears with:
    - Item name (text input, required)
    - Category (dropdown, required)
    - Optional: Quantity
3. User fills form and taps "Save"
4. Item saved to Supabase
5. Return to inventory view

#### View Inventory

**UI Requirements:**

- Grid or list view of all items in pantry
- Each item card shows:
    - Item name (large text)
    - Category (badge/chip)
    - Date added (small text, e.g., "Added 2 days ago")
    - Thumbnail image (if available)
    - Delete button (swipe-to-delete on mobile, X button on desktop)
- Search/filter bar at top (search by name, filter by category)
- Floating "+" button to add items (opens action sheet: Scan Barcode / Take Photo / Manual Add)
- Empty state when no items: illustration + "Add your first item" CTA


#### Remove Items

**User Flow:**

1. **Swipe left on item** (mobile) or **click X button** (desktop)
2. Item marked with "Undo" toast for 3 seconds
3. If no undo, permanently delete from Supabase
4. If undo clicked, restore item

**Technical Details:**

- Soft delete pattern: add `deleted_at` timestamp instead of hard delete
- Cleanup job can run later (not required for MVP)


### 2. Recipe Discovery

#### Dropdown Filters UI

**Design:**
Three consecutive dropdowns on recipe discovery screen:

1. **Meal Type** (required)
    - Options: Breakfast, Lunch, Dinner
    - Default: Based on current time (e.g., 7-11am = Breakfast, 11am-4pm = Lunch, 4pm+ = Dinner)
2. **Who's Eating** (required)
    - Options: Adults, Kids
    - Default: Adults
3. **Servings** (required)
    - Options: 1, 2, 3, 4+
    - Default: 2
4. **Dietary Preference** (optional, saved in app settings)
    - Options: None, Vegetarian, Vegan, Gluten-Free, Dairy-Free, Low-Carb
    - Set once in Settings, persists across sessions

**CTA Button:** "Find Recipes" (large, primary color)

#### Recipe Search Flow

**User Flow:**

1. User selects dropdown filters
2. User taps "Find Recipes"
3. Loading spinner appears
4. **Backend Process:**
a. Fetch all items from Supabase `pantry_items` where `deleted_at IS NULL`
b. Build comma-separated ingredient list
c. Call Gemini 2.5 Flash to generate recipe ideas:
    - Generate 3 recipes
    - Prefer 0 missing ingredients
    - Allow up to 2 missing items only if pantry coverage is high
d. Generate a recipe image (Nebius) and store in Supabase Storage
e. Display recipes
5. Show results in scrollable list

#### Recipe Card Design

Each recipe card shows:

- Recipe image (generated)
- Recipe title
- Cooking time
- Servings
- **Missing Ingredients chip** (e.g., "Need 2 items: olive oil, garlic")
- "View Recipe" button

**On Click:**

- Full recipe modal/page with:
    - Ingredients list (mark items user already has in green)
    - Step-by-step instructions
    - Nutrition facts
    - "Add Missing Items to Shopping List" button (optional for MVP)


### 3. PWA Configuration

#### Manifest.json

```json
{
  "name": "FreshMeal",
  "short_name": "FreshMeal",
  "description": "Smart pantry and recipe suggestions",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#10b981",
  "orientation": "portrait",
  "icons": [
    {
      "src": "/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```


#### Service Worker

- Uses `next-pwa` for service worker generation and caching
- Cache static assets (CSS, JS, fonts)
- Cache API responses for offline viewing (Supabase data, app API routes)
- Background sync for adding items when offline (optional for MVP)


#### iOS Safari Compatibility

- Test "Add to Home Screen" flow
- Ensure camera access works in standalone mode
- Handle iOS safe areas (notch, bottom bar)
- Use `viewport-fit=cover` in meta tag


### 4. Settings (Optional for MVP)

Simple settings page with:

- **Dietary Preference** (dropdown, saved to localStorage or Supabase user_settings table)
- **Health Goals** (text area, used in Gemini prompts)
- **Clear All Inventory** button (with confirmation dialog)
- **About/Help** section


## Database Schema

### Supabase Tables

#### `pantry_items`

```sql
CREATE TABLE pantry_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL, -- Vegetable, Fruit, Dairy, Meat, Grain, Condiment, Beverage, Other
  quantity INTEGER DEFAULT 1,
  barcode TEXT, -- Optional, from barcode scan
  image_url TEXT, -- Optional, from Supabase Storage
  added_date TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ, -- Soft delete
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pantry_items_deleted_at ON pantry_items(deleted_at);
CREATE INDEX idx_pantry_items_category ON pantry_items(category);
```


#### `user_settings` (Optional for MVP)

```sql
CREATE TABLE user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dietary_preference TEXT, -- None, Vegetarian, Vegan, Gluten-Free, Dairy-Free, Low-Carb
  health_goals TEXT, -- Free-form text
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```


### Supabase Storage Buckets

#### `food-images`

- Store photos taken by users
- Public read access
- File naming: `{timestamp}_{uuid}.jpg`
- Max file size: 5MB


## Component Structure

### Page Components

```
app/
├── layout.tsx (root layout, includes PWA meta tags)
├── page.tsx (home/dashboard - redirects to /inventory)
├── inventory/
│   └── page.tsx (main inventory view)
├── add-item/
│   └── page.tsx (barcode/photo/manual add with confirmation)
├── recipes/
│   ├── page.tsx (recipe discovery with filters)
│   └── [id]/
│       └── page.tsx (individual recipe detail)
└── settings/
    └── page.tsx (optional for MVP)
```


### Reusable Components

```
components/
├── ui/ (shadcn components: button, card, dialog, dropdown, etc.)
├── layout/
│   ├── Header.tsx (app header with title, back button)
│   ├── BottomNav.tsx (mobile navigation: Inventory, Recipes, Settings)
│   └── Container.tsx (responsive container wrapper)
├── inventory/
│   ├── InventoryGrid.tsx (displays pantry items)
│   ├── ItemCard.tsx (individual pantry item)
│   ├── AddItemButton.tsx (floating + button)
│   ├── AddItemSheet.tsx (bottom sheet with add options)
│   └── ConfirmItemsDialog.tsx (confirms AI-detected items)
├── camera/
│   ├── CameraCapture.tsx (camera interface with capture button)
│   └── BarcodeScanner.tsx (barcode scanning logic)
├── recipes/
│   ├── RecipeFilters.tsx (meal type, servings, dietary dropdowns)
│   ├── RecipeCard.tsx (recipe preview card)
│   ├── RecipeList.tsx (list of recipe cards)
│   └── RecipeDetail.tsx (full recipe view)
└── shared/
    ├── LoadingSpinner.tsx
    ├── EmptyState.tsx
    └── ErrorBoundary.tsx
```


## API Integration

### Gemini 2.5 Flash (Google AI Studio)

#### Setup

```typescript
// lib/gemini.ts
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

export async function analyzeFood(imageUrl: string) {
  const prompt = `Analyze this image and identify all food items visible. Return a JSON array with:
  - name: common name of the food item
  - quantity: estimated number of items (use 1 if unclear)
  - category: one of [Vegetable, Fruit, Dairy, Meat, Grain, Condiment, Beverage, Other]
  - confidence: 0-1 score of detection confidence
  
  Only include items you're confident about (confidence > 0.7).
  Return ONLY valid JSON, no markdown or explanations.`;
  
  const result = await model.generateContent([
    prompt,
    {
      inlineData: {
        mimeType: "image/jpeg",
        data: imageUrl // base64 or URL
      }
    }
  ]);
  
  const text = result.response.text();
  return JSON.parse(text);
}

export async function rankRecipes(recipes: any[], ingredients: string[], dietaryPreference: string) {
  const prompt = `Given these recipes and the user's goal of healthy eating, rank them from best to worst.
  Consider:
  - Nutritional balance (protein, veggies, whole grains)
  - Cooking complexity
  - Number of missing ingredients
  
  User's dietary preference: ${dietaryPreference}
  User has these ingredients: ${ingredients.join(", ")}
  
  Recipes:
  ${JSON.stringify(recipes)}
  
  Return ranked recipes as JSON with added fields:
  - health_score: 0-100
  - why_healthy: brief explanation (max 20 words)
  - missing_ingredients: array of ingredients user needs to buy
  - estimated_cost: "low" | "medium" | "high" for missing ingredients
  
  Return ONLY valid JSON array, no markdown.`;
  
  const result = await model.generateContent(prompt);
  const text = result.response.text();
  return JSON.parse(text);
}
```


### Spoonacular API

#### Setup

```typescript
// lib/spoonacular.ts
const SPOONACULAR_API_KEY = process.env.SPOONACULAR_API_KEY!;
const BASE_URL = "https://api.spoonacular.com";

export async function findRecipesByIngredients(
  ingredients: string[],
  mealType: string,
  servings: number
) {
  const ingredientsParam = ingredients.join(",");
  
  const response = await fetch(
    `${BASE_URL}/recipes/findByIngredients?` +
    `ingredients=${encodeURIComponent(ingredientsParam)}` +
    `&number=10` +
    `&ranking=2` +
    `&ignorePantry=false` +
    `&apiKey=${SPOONACULAR_API_KEY}`
  );
  
  if (!response.ok) throw new Error("Spoonacular API error");
  
  const recipes = await response.json();
  
  // Fetch detailed info for each recipe
  const detailedRecipes = await Promise.all(
    recipes.map(async (recipe: any) => {
      const detailResponse = await fetch(
        `${BASE_URL}/recipes/${recipe.id}/information?apiKey=${SPOONACULAR_API_KEY}`
      );
      return detailResponse.json();
    })
  );
  
  // Filter by meal type and servings
  return detailedRecipes.filter((r: any) => {
    const matchesMealType = r.dishTypes?.includes(mealType.toLowerCase());
    const matchesServings = Math.abs(r.servings - servings) <= 1;
    return matchesMealType && matchesServings;
  });
}
```


### Open Food Facts API

#### Setup

```typescript
// lib/openfoodfacts.ts
export async function getProductByBarcode(barcode: string) {
  const response = await fetch(
    `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`
  );
  
  if (!response.ok) throw new Error("Product not found");
  
  const data = await response.json();
  
  if (data.status !== 1) {
    throw new Error("Product not found in database");
  }
  
  return {
    name: data.product.product_name || "Unknown Product",
    category: data.product.categories?.split(",") || "Other",
    image: data.product.image_url,
    barcode: barcode,
    brands: data.product.brands,
    nutrition: {
      calories: data.product.nutriments?.energy_value,
      protein: data.product.nutriments?.proteins,
      carbs: data.product.nutriments?.carbohydrates,
      fat: data.product.nutriments?.fat
    }
  };
}
```


## User Flows (Detailed)

### Flow 1: Add Item via Photo

1. User opens app → lands on Inventory page
2. Taps floating "+" button
3. Bottom sheet appears with 3 options: "Scan Barcode", "Take Photo", "Add Manually"
4. Taps "Take Photo"
5. Camera view opens (full screen)
6. User positions camera over multiple food items
7. Taps capture button
8. Photo uploads to Supabase Storage
9. Loading spinner: "Analyzing image..."
10. Gemini API returns detected items
11. Confirmation dialog appears:
    - Title: "Confirm Items"
    - List of detected items with name, quantity, category
    - Each item has Edit and Delete icons
    - Bottom buttons: "Cancel" | "Add All"
12. User reviews, maybe deletes a false positive, taps "Add All"
13. Items saved to Supabase `pantry_items`
14. Success toast: "3 items added to pantry"
15. Returns to Inventory page, new items visible

### Flow 2: Find Recipe for Lunch (2 Adults)

1. User taps "Recipes" in bottom navigation
2. Recipe Discovery page loads
3. Three dropdowns pre-populated with smart defaults:
    - Meal Type: "Lunch" (based on current time 1:30 PM)
    - Who's Eating: "Adults"
    - Servings: "2"
4. User verifies selections (or changes them)
5. Taps "Find Recipes" button
6. Loading overlay: "Searching recipes..."
7. Backend:
    - Fetches 8 ingredients from Supabase
    - Calls Spoonacular with ingredients + filters
    - Gets 7 matching recipes
    - Sends to Gemini for ranking
    - Gemini adds health scores and missing ingredients
8. Results appear (7 recipe cards in list)
9. User scrolls, sees:
    - "Caprese Salad Sandwich" - 92/100 Healthy
        - "High in protein and fresh veggies"
        - Missing: olive oil, balsamic vinegar (Low cost)
    - "Chicken Caesar Wrap" - 78/100 Healthy
        - "Good protein, but high in sodium"
        - Missing: caesar dressing, parmesan (Medium cost)
10. User taps "Caprese Salad Sandwich"
11. Full recipe page opens:
    - Large recipe image
    - Title, servings, cooking time (15 min)
    - Health score badge
    - Ingredients list:
        - ✓ Tomatoes (you have this)
        - ✓ Mozzarella (you have this)
        - ✓ Bread (you have this)
        - ✗ Olive oil (need to buy)
        - ✗ Balsamic vinegar (need to buy)
    - Step-by-step instructions
    - Nutrition facts table
12. User follows recipe, makes lunch

### Flow 3: Remove Used Items

1. After cooking, user goes to Inventory page
2. Finds "Tomatoes" card
3. Swipes left on card (mobile)
4. Delete button revealed
5. Taps delete
6. Item fades out
7. Toast appears: "Tomatoes removed" with "Undo" button (3 seconds)
8. If user taps "Undo" within 3 seconds, item restored
9. Otherwise, item marked as deleted in database

## Development Guidelines

### Code Style

- Use TypeScript strict mode
- Follow Next.js App Router conventions
- Use async/await for all API calls
- Implement proper error boundaries
- Use Tailwind utility classes (avoid custom CSS when possible)
- Follow shadcn/ui component patterns


### Error Handling

- All API calls must have try/catch blocks
- Display user-friendly error messages (toast notifications)
- Log errors to console in development
- Implement retry logic for network failures
- Graceful degradation (e.g., if Gemini fails, still show Spoonacular results)


### Performance

- Lazy load recipe images
- Implement pagination for recipe results (if >20 recipes)
- Cache API responses in memory (React Query or SWR recommended)
- Optimize images (use Next.js Image component)
- Debounce search inputs


### Accessibility

- All interactive elements must have proper ARIA labels
- Keyboard navigation support
- Sufficient color contrast (WCAG AA minimum)
- Screen reader friendly
- Focus management for modals/dialogs


### Testing (Optional for MVP)

- Unit tests for utility functions (API parsers, date formatters)
- Integration tests for critical flows (add item, find recipes)
- E2E tests with Playwright (add item via photo, complete recipe search)


## Environment Variables

Create `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
GEMINI_API_KEY=your_gemini_api_key
SPOONACULAR_API_KEY=your_spoonacular_api_key
```


## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn or pnpm
- Supabase account (free tier)
- Google AI Studio API key (free tier)
- Spoonacular API key (free tier)


### Installation Steps

1. Clone repository (or create new Next.js project)
2. Install dependencies: `npm install`
3. Set up Supabase:
    - Create new project
    - Run SQL migrations from Database Schema section
    - Create storage bucket `food-images` (public)
    - Copy API credentials to `.env.local`
4. Get API keys:
    - Gemini: https://aistudio.google.com/api-keys
    - Spoonacular: https://spoonacular.com/food-api
5. Add keys to `.env.local`
6. Run development server: `npm run dev`
7. Open http://localhost:3000

### PWA Testing

1. Build production version: `npm run build`
2. Serve locally: `npm start`
3. Open on mobile device via local network (e.g., 192.168.x.x:3000)
4. Test "Add to Home Screen" on iOS Safari
5. Verify camera access works in standalone mode

## Deployment Notes

### Vercel Deployment

- User will deploy themselves
- Ensure environment variables are set in Vercel dashboard
- Enable "Automatically expose System Environment Variables"
- Recommended: Use Vercel Analytics (optional)


### Post-Deployment Checklist

- Test PWA installation on real iOS device
- Verify all API calls work in production
- Check Supabase RLS policies (none required for MVP since no auth)
- Monitor Gemini API usage (ensure staying under free tier)
- Monitor Spoonacular API usage (50 points/day limit)


## Future Enhancements (Not in MVP)

### Phase 2 Features

1. **Recipe-Based Deduction**: After user cooks a recipe, automatically remove used ingredients
2. **Expiration Tracking**: Add expiration dates, show warnings for items about to expire
3. **Shopping List**: Auto-generate shopping list from missing ingredients across multiple recipes
4. **Favorite Recipes**: Save recipes for quick access later
5. **Cooking History**: Track what recipes were made and when

### Phase 3 Features

1. **Multi-user support** (add authentication)
2. **Meal planning calendar**: Plan meals for the week
3. **Nutrition goals tracking**: Set daily calorie/macro targets
4. **Recipe ratings**: Rate recipes after cooking
5. **Social sharing**: Share recipes with friends
6. **Voice input**: "Hey FreshMeal, what can I make for dinner?"

## Notes for AI Coding Assistant

### Implementation Priority

1. **Start with database schema**: Set up Supabase tables and storage first
2. **Build inventory management**: This is the foundation (add, view, remove items)
3. **Implement camera/barcode scanning**: Test on actual device early
4. **Integrate APIs**: Gemini and Spoonacular, with proper error handling
5. **Build recipe discovery**: Filters and search
6. **Polish UI/UX**: Make it feel native and fast
7. **Configure PWA**: Manifest, service worker, iOS testing

### Critical Technical Decisions

- **Image Processing**: Upload to Supabase Storage first, then send URL to Gemini (not base64, too large)
- **API Rate Limits**: Implement client-side caching to minimize API calls
- **Offline Support**: Cache recent recipes and inventory in IndexedDB via service worker
- **Camera Library**: Use `react-webcam` or native file input with `capture="environment"`
- **Barcode Library**: Use `jsQR` for client-side barcode detection from camera feed


### Common Pitfalls to Avoid

1. **Don't** send large base64 images to Gemini (use URLs)
2. **Don't** make Spoonacular API calls on every keystroke (debounce or use button trigger)
3. **Don't** forget iOS safe areas (use `env(safe-area-inset-*)` in CSS)
4. **Don't** assume camera permission is granted (handle denial gracefully)
5. **Don't** hardcode API keys (use environment variables)

### Testing Recommendations

- Test on real iPhone (camera, PWA install, standalone mode)
- Test with slow network (throttle in DevTools)
- Test with API failures (mock 500 errors)
- Test with empty states (no inventory, no recipes found)
- Test with long ingredient lists (>20 items)


## Success Criteria

The MVP is considered complete when:

1. ✅ User can add items via barcode scan with confirmation
2. ✅ User can add items via photo with AI detection and confirmation
3. ✅ User can manually add/edit/delete items
4. ✅ Inventory page displays all items with proper categorization
5. ✅ Recipe search works with all 3 dropdown filters
6. ✅ AI ranks recipes and shows health scores + missing ingredients
7. ✅ Recipe detail page shows full instructions and nutrition
8. ✅ App installs as PWA on iOS
9. ✅ Camera works in PWA standalone mode
10. ✅ All API integrations work without authentication errors

## Project Philosophy

FreshMeal is designed to be:

- **Frictionless**: Adding items takes seconds, not minutes
- **Practical**: Focus on what you can cook NOW, not complex meal planning
- **Healthy**: AI nudges toward nutritious choices without being preachy
- **Personal**: Built for single-user simplicity, not enterprise complexity
- **Mobile-first**: Optimized for one-handed use while cooking

The app should feel like a helpful cooking assistant, not a data entry chore.
