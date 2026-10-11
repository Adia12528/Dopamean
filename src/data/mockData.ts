import type { Product, Offer, Order } from '../types';

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'prod-1',
    title: 'Vintage Daisy Granny Square Tote',
    tagline: 'Artisanal daily carryall hand-stitched with love',
    category: 'Bags & Totes',
    price: 48,
    originalPrice: 62,
    rating: 4.9,
    reviewsCount: 38,
    stock: 7,
    image: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=800&q=80',
    secondaryImages: [
      'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=800&q=80'
    ],
    yarnType: '100% Organic Combed Milk Cotton',
    craftTimeHours: 14,
    careInstructions: 'Hand wash cold with wool detergent. Lay flat on towel to dry.',
    description: 'Each square is individually hand-crocheted featuring raised 3D daisy petals against creamy oat backdrop with sage foliage border. Reinforced canvas lining inside prevents yarn stretching when carrying laptops or books.',
    tags: ['Bestseller', 'Floral', 'Eco-Friendly', 'Lined Interior'],
    isFeatured: true,
    isBestSeller: true,
    createdAt: '2026-03-15'
  },
  {
    id: 'prod-2',
    title: 'Pastel Lavender Checkered Bucket Hat',
    tagline: 'Sun-dappled cozy festival & picnic headwear',
    category: 'Headwear',
    price: 34,
    originalPrice: 42,
    rating: 4.8,
    reviewsCount: 24,
    stock: 12,
    image: 'https://images.unsplash.com/photo-1576871337622-98d48d1cf531?auto=format&fit=crop&w=800&q=80',
    yarnType: 'Double-Ply Breathable Cotton Blend',
    craftTimeHours: 6,
    careInstructions: 'Spot clean or gentle hand wash. Reshape around a bowl to dry.',
    description: 'Chic dual-tone checkered bucket hat crocheted in soft lilac and marshmallow cream. Structured brim keeps its silhouette without flopping into eyes.',
    tags: ['Trending', 'Festival', 'UV Protection'],
    isFeatured: true,
    createdAt: '2026-03-20'
  },
  {
    id: 'prod-3',
    title: 'Strawberry Shortcake Amigurumi Charm',
    tagline: 'Whimsical sweet berry companion for bags & keys',
    category: 'Amigurumi & Charms',
    price: 16,
    originalPrice: 20,
    rating: 5.0,
    reviewsCount: 52,
    stock: 18,
    image: 'https://images.unsplash.com/photo-1607344645866-009c320c5ab8?auto=format&fit=crop&w=800&q=80',
    yarnType: 'Anti-Pilling Fine Turkish Microfiber Cotton',
    craftTimeHours: 3.5,
    careInstructions: 'Spot wipe with damp cloth.',
    description: 'Adorably tiny amigurumi strawberry accented with hand-embroidered seed beads, miniature blossom charm, and a 14k gold-plated swivel lobster clasp.',
    tags: ['Gift Idea', 'Under $20', 'Kawaii'],
    isFeatured: true,
    isBestSeller: true,
    createdAt: '2026-03-22'
  },
  {
    id: 'prod-4',
    title: 'Blooming Tulip Flower Coaster Set',
    tagline: 'Set of 4 tabletop floral cup cozies in woven basket',
    category: 'Coasters & Home',
    price: 26,
    originalPrice: 32,
    rating: 4.9,
    reviewsCount: 19,
    stock: 9,
    image: 'https://images.unsplash.com/photo-1584992236310-6edddc08acff?auto=format&fit=crop&w=800&q=80',
    yarnType: 'Absorbent Thick Mercerized Cotton',
    craftTimeHours: 5,
    careInstructions: 'Machine washable in mesh laundry bag on delicate cold cycle.',
    description: 'Transforms your coffee nook into a French countryside garden. Includes 4 absorbent tulip petal coasters that nest together inside a matching miniature crochet flowerpot holder.',
    tags: ['Home Decor', 'Handmade Gift', 'Set of 4'],
    isFeatured: false,
    createdAt: '2026-03-28'
  },
  {
    id: 'prod-5',
    title: 'Chunky Twist Ear-Warmer Headband',
    tagline: 'Thermal textured weave in warm terracotta yarn',
    category: 'Headwear',
    price: 24,
    originalPrice: 30,
    rating: 4.7,
    reviewsCount: 16,
    stock: 14,
    image: 'https://images.unsplash.com/photo-1520903920243-00d872a2d1c9?auto=format&fit=crop&w=800&q=80',
    yarnType: 'Super-Soft Merino & Cashmere Blend',
    craftTimeHours: 4,
    careInstructions: 'Gentle hand wash in lukewarm water, dry flat.',
    description: 'Designed with an elegant twisted knot front that flatters every hairstyle. Super plush ribbing keeps ears blissfully warm on brisk outdoor strolls.',
    tags: ['Warm & Cozy', 'Merino Wool', 'Autumn/Winter'],
    isFeatured: false,
    createdAt: '2026-04-01'
  },
  {
    id: 'prod-6',
    title: 'Cloud Nine Chenille Slouchy Pouch',
    tagline: 'Velvety clutch bag with drawstring pearl toggle',
    category: 'Bags & Totes',
    price: 42,
    originalPrice: 55,
    rating: 4.9,
    reviewsCount: 31,
    stock: 5,
    image: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=800&q=80',
    yarnType: 'High-Density Velvet Chenille',
    craftTimeHours: 9,
    careInstructions: 'Gentle steam or dry clean only to maintain velvet nap.',
    description: 'Unbelievably soft cloud-texture pouch bag. Perfect evening clutch or makeup sanctuary, equipped with secure satin lining and freshwater pearl drawstring toggles.',
    tags: ['Luxury Feel', 'Limited Edition', 'Evening Wear'],
    isFeatured: true,
    createdAt: '2026-04-03'
  },
  {
    id: 'prod-7',
    title: 'Botanical Herbarium Crochet Book Sleeve',
    tagline: 'Padded e-reader & paperback protector sleeve',
    category: 'Accessories',
    price: 29,
    originalPrice: 35,
    rating: 4.8,
    reviewsCount: 17,
    stock: 8,
    image: 'https://images.unsplash.com/photo-1606760227091-3dd870d97f1d?auto=format&fit=crop&w=800&q=80',
    yarnType: 'Heavyweight Cotton Twill Crochet Cord',
    craftTimeHours: 7,
    careInstructions: 'Machine washable delicate, lay flat to dry.',
    description: 'Safeguard your favorite books, journals, or Kindle Paperwhite in a cushion of textured crochet loops with wooden toggle closure.',
    tags: ['Book Lover', 'Padded', 'Protection'],
    isFeatured: false,
    createdAt: '2026-04-05'
  },
  {
    id: 'prod-8',
    title: 'Sweet Pea Whimsical Hair Bandana',
    tagline: 'Cottagecore mesh kerchief with scalloped edge',
    category: 'Headwear',
    price: 22,
    originalPrice: 28,
    rating: 4.9,
    reviewsCount: 41,
    stock: 15,
    image: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=800&q=80',
    yarnType: 'Fine Featherlight Bamboo Cotton',
    craftTimeHours: 4.5,
    careInstructions: 'Hand wash, air dry flat. Iron on lowest setting if desired.',
    description: 'Airy, breezy open-mesh triangular hair bandana tied with braided ribbons. Keeps hair in place while serving effortless French-riviera vintage charm.',
    tags: ['Cottagecore', 'Bestseller', 'Lightweight'],
    isFeatured: true,
    createdAt: '2026-04-07'
  }
];

export const INITIAL_OFFERS: Offer[] = [
  {
    id: 'offer-1',
    title: 'Spring Blossom Handcrafted Collection Sale',
    description: 'Enjoy 20% off all floral totes, daisy bucket hats, and botanical accessories.',
    badge: 'SEASONAL DEAL',
    code: 'YARNLOVE20',
    discountType: 'percentage',
    discountValue: 20,
    minOrderValue: 40,
    image: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=1200&q=80',
    endDate: '2026-11-30',
    isActive: true,
    accentColor: '#D97706',
    highlightCategory: 'Bags & Totes'
  },
  {
    id: 'offer-2',
    title: 'Free Artisan Mini Strawberry Charm on Orders $50+',
    description: 'Every handcrafted bundle over $50 receives a complimentary amigurumi berry key charm!',
    badge: 'FREE GIFT',
    code: 'SWEETBERRY',
    discountType: 'fixed',
    discountValue: 16,
    minOrderValue: 50,
    image: 'https://images.unsplash.com/photo-1607344645866-009c320c5ab8?auto=format&fit=crop&w=1200&q=80',
    endDate: '2026-12-15',
    isActive: true,
    accentColor: '#E11D48',
    highlightCategory: 'Amigurumi & Charms'
  },
  {
    id: 'offer-3',
    title: 'Welcome First-Timer Craft Discount',
    description: 'Use code WELCOME10 at checkout to take $10 off your first handcrafted crochet order.',
    badge: 'NEW PATRONS',
    code: 'WELCOME10',
    discountType: 'fixed',
    discountValue: 10,
    minOrderValue: 35,
    image: 'https://images.unsplash.com/photo-1584992236310-6edddc08acff?auto=format&fit=crop&w=1200&q=80',
    endDate: '2026-12-31',
    isActive: true,
    accentColor: '#059669'
  }
];

export const INITIAL_ORDERS: Order[] = [
  {
    id: 'ORD-9821',
    customerName: 'Clara Montgomery',
    customerEmail: 'clara.m@gmail.com',
    customerAddress: '42 Blossom Grove Lane, Seattle, WA',
    items: [
      {
        productId: 'prod-1',
        productTitle: 'Vintage Daisy Granny Square Tote',
        price: 48,
        quantity: 1,
        image: 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=800&q=80'
      },
      {
        productId: 'prod-3',
        productTitle: 'Strawberry Shortcake Amigurumi Charm',
        price: 16,
        quantity: 1,
        image: 'https://images.unsplash.com/photo-1607344645866-009c320c5ab8?auto=format&fit=crop&w=800&q=80'
      }
    ],
    subtotal: 64,
    discountAmount: 12.8,
    promoCodeApplied: 'YARNLOVE20',
    total: 51.2,
    status: 'In Crafting',
    createdAt: '2026-10-10'
  },
  {
    id: 'ORD-9820',
    customerName: 'Harper Lin',
    customerEmail: 'harper.lin@design.co',
    customerAddress: '188 Birchwood Terrace, Portland, OR',
    items: [
      {
        productId: 'prod-2',
        productTitle: 'Pastel Lavender Checkered Bucket Hat',
        price: 34,
        quantity: 2,
        image: 'https://images.unsplash.com/photo-1576871337622-98d48d1cf531?auto=format&fit=crop&w=800&q=80'
      }
    ],
    subtotal: 68,
    discountAmount: 10,
    promoCodeApplied: 'WELCOME10',
    total: 58,
    status: 'Shipped',
    createdAt: '2026-10-09'
  },
  {
    id: 'ORD-9818',
    customerName: 'Sophie Bennett',
    customerEmail: 'sophie.b@outlook.com',
    customerAddress: '12 Willow Creek Way, Austin, TX',
    items: [
      {
        productId: 'prod-4',
        productTitle: 'Blooming Tulip Flower Coaster Set',
        price: 26,
        quantity: 1,
        image: 'https://images.unsplash.com/photo-1584992236310-6edddc08acff?auto=format&fit=crop&w=800&q=80'
      }
    ],
    subtotal: 26,
    discountAmount: 0,
    total: 26,
    status: 'Delivered',
    createdAt: '2026-10-06'
  }
];
