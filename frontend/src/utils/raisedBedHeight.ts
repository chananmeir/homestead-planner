/**
 * Raised Bed Height Utilities
 *
 * Provides metadata, benefits, and guidance for different raised bed heights.
 * Raised beds offer better drainage, soil warming, accessibility, and root depth.
 */

export interface HeightPreset {
  height: number; // inches
  label: string;
  category: 'low' | 'standard' | 'tall' | 'accessible';
  description: string;
  benefits: string[];
  considerations: string[];
  bestFor: string[];
  soilVolume?: string; // Example volume for 4×8 bed
}

/**
 * Preset raised bed heights with detailed metadata
 */
export const HEIGHT_PRESETS: HeightPreset[] = [
  {
    height: 6,
    label: '6" Low Profile',
    category: 'low',
    description: 'Minimal raised bed for shallow-rooted crops',
    benefits: [
      'Lower material and soil costs',
      'Easier to construct',
      'Good drainage improvement',
      'Warms soil faster than ground level'
    ],
    considerations: [
      'Limited root depth for deep-rooted crops',
      'Dries out faster than ground level',
      'Not suitable for root vegetables (carrots, parsnips)'
    ],
    bestFor: [
      'Lettuce and leafy greens',
      'Herbs (basil, cilantro)',
      'Strawberries',
      'Radishes',
      'Shallow-rooted flowers'
    ],
    soilVolume: '16 cubic feet (120 gallons)'
  },
  {
    height: 8,
    label: '8" Low',
    category: 'low',
    description: 'Minimum depth for most vegetables',
    benefits: [
      'Suitable for most vegetables',
      'Good drainage',
      'Moderate soil warming',
      'Lower material costs than taller beds'
    ],
    considerations: [
      'Marginal for deep-rooted crops',
      'May need more frequent watering',
      'Limited for root vegetables'
    ],
    bestFor: [
      'Salad greens',
      'Bush beans',
      'Peas',
      'Most herbs',
      'Beets (smaller varieties)'
    ],
    soilVolume: '21 cubic feet (160 gallons)'
  },
  {
    height: 12,
    label: '12" Standard',
    category: 'standard',
    description: 'Most common and versatile raised bed height',
    benefits: [
      'Excellent for all vegetables',
      'Good root depth',
      'Improved drainage and aeration',
      'Soil warms 2-3 weeks earlier in spring',
      'Easier weeding (less bending)',
      'Better pest control (slugs, ground insects)'
    ],
    considerations: [
      'Moderate material costs',
      'Requires ~32 cubic feet of soil per 4×8 bed',
      'Needs consistent watering in hot weather'
    ],
    bestFor: [
      'All vegetables',
      'Root crops (carrots, beets)',
      'Tomatoes and peppers',
      'Squash and cucumbers',
      'General-purpose gardening'
    ],
    soilVolume: '32 cubic feet (240 gallons)'
  },
  {
    height: 18,
    label: '18" Tall',
    category: 'tall',
    description: 'Deep root zone for large plants and root crops',
    benefits: [
      'Excellent root depth',
      'Ideal for large fruiting plants',
      'Minimal bending for maintenance',
      'Superior drainage',
      'Longer growing season (warmer soil)',
      'Can support heavy feeders better'
    ],
    considerations: [
      'Higher material and soil costs',
      'More structural support needed',
      'Dries out faster - needs irrigation or mulch',
      'Soil temperature can get too warm in hot climates'
    ],
    bestFor: [
      'Tomatoes (indeterminate)',
      'Deep root vegetables (parsnips, carrots)',
      'Potatoes (excellent yield)',
      'Large brassicas (broccoli, cauliflower)',
      'Melons and squash'
    ],
    soilVolume: '48 cubic feet (360 gallons)'
  },
  {
    height: 24,
    label: '24" Accessible',
    category: 'accessible',
    description: 'Wheelchair accessible and reduced bending',
    benefits: [
      'Wheelchair and mobility aid accessible',
      'Standing height work (no bending)',
      'Maximum root depth',
      'Excellent drainage',
      'Extended growing season',
      'Therapeutic gardening friendly'
    ],
    considerations: [
      'High material and soil costs',
      'Requires strong construction',
      'Significant watering needs',
      'May need structural reinforcement',
      'Difficult to reach center without path access'
    ],
    bestFor: [
      'Accessible gardening',
      'Therapeutic programs',
      'Seniors and people with mobility issues',
      'All deep-rooted crops',
      'Perennial vegetables and herbs'
    ],
    soilVolume: '64 cubic feet (480 gallons)'
  },
  {
    height: 30,
    label: '30" Waist-High',
    category: 'accessible',
    description: 'Waist-high for standing work',
    benefits: [
      'Full standing height work',
      'Zero bending required',
      'Ideal for back issues',
      'Maximum accessibility',
      'Can double as outdoor workspace',
      'Impressive visual impact'
    ],
    considerations: [
      'Very expensive (materials and soil)',
      'Must be narrow (2-3 ft) for reachability',
      'Requires engineered structure',
      'Heavy irrigation needs',
      'Wind exposure for tall plants'
    ],
    bestFor: [
      'Accessible gardening',
      'Seniors and limited mobility',
      'Intensive production in small space',
      'Herbs and salad greens',
      'Decorative kitchen gardens'
    ],
    soilVolume: '80 cubic feet (600 gallons) for 4×8'
  }
];

/**
 * Get height preset by height value
 */
export function getHeightPreset(height: number): HeightPreset | undefined {
  return HEIGHT_PRESETS.find(preset => preset.height === height);
}

/**
 * Get nearest height preset
 */
export function getNearestPreset(height: number): HeightPreset {
  let nearest = HEIGHT_PRESETS[0];
  let minDiff = Math.abs(height - nearest.height);

  for (const preset of HEIGHT_PRESETS) {
    const diff = Math.abs(height - preset.height);
    if (diff < minDiff) {
      minDiff = diff;
      nearest = preset;
    }
  }

  return nearest;
}

/**
 * Calculate soil volume for a bed
 */
export function calculateSoilVolume(
  widthFeet: number,
  lengthFeet: number,
  heightInches: number
): { cubicFeet: number; cubicYards: number; gallons: number; bags40lb: number } {
  const cubicFeet = widthFeet * lengthFeet * (heightInches / 12);
  const cubicYards = cubicFeet / 27;
  const gallons = cubicFeet * 7.48; // 1 cubic foot = 7.48 gallons
  const bags40lb = Math.ceil(cubicFeet / 0.75); // 40lb bag ≈ 0.75 cubic feet

  return {
    cubicFeet: Math.round(cubicFeet * 10) / 10,
    cubicYards: Math.round(cubicYards * 100) / 100,
    gallons: Math.round(gallons),
    bags40lb
  };
}

/**
 * Get drainage rating based on height
 */
export function getDrainageRating(heightInches: number): {
  rating: 'poor' | 'fair' | 'good' | 'excellent' | 'superior';
  description: string;
} {
  if (heightInches < 6) {
    return {
      rating: 'poor',
      description: 'Similar to ground level - may have drainage issues in clay soil'
    };
  } else if (heightInches < 8) {
    return {
      rating: 'fair',
      description: 'Improved drainage over ground level, good for most soils'
    };
  } else if (heightInches < 12) {
    return {
      rating: 'good',
      description: 'Good drainage prevents waterlogging, suitable for most vegetables'
    };
  } else if (heightInches < 18) {
    return {
      rating: 'excellent',
      description: 'Excellent drainage eliminates standing water, ideal for root crops'
    };
  } else {
    return {
      rating: 'superior',
      description: 'Superior drainage, prevents all waterlogging issues'
    };
  }
}

/**
 * Get soil warming benefit based on height
 */
export function getSoilWarmingBenefit(heightInches: number): {
  benefit: 'minimal' | 'moderate' | 'significant' | 'excellent';
  description: string;
  earlierPlanting: string;
} {
  if (heightInches < 6) {
    return {
      benefit: 'minimal',
      description: 'Soil warms slightly faster than ground level',
      earlierPlanting: '3-5 days earlier'
    };
  } else if (heightInches < 10) {
    return {
      benefit: 'moderate',
      description: 'Soil warms noticeably earlier, extends growing season',
      earlierPlanting: '1-2 weeks earlier'
    };
  } else if (heightInches < 16) {
    return {
      benefit: 'significant',
      description: 'Soil warms 2-3 weeks earlier, longer growing season',
      earlierPlanting: '2-3 weeks earlier'
    };
  } else {
    return {
      benefit: 'excellent',
      description: 'Soil warms significantly earlier, maximum season extension',
      earlierPlanting: '3-4 weeks earlier'
    };
  }
}

/**
 * Get ergonomic benefit based on height
 */
export function getErgonomicBenefit(heightInches: number): {
  benefit: 'minimal' | 'moderate' | 'significant' | 'excellent';
  description: string;
} {
  if (heightInches < 8) {
    return {
      benefit: 'minimal',
      description: 'Still requires significant bending for weeding and harvesting'
    };
  } else if (heightInches < 16) {
    return {
      benefit: 'moderate',
      description: 'Reduces bending, easier on back during maintenance'
    };
  } else if (heightInches < 24) {
    return {
      benefit: 'significant',
      description: 'Minimal bending required, comfortable for most tasks'
    };
  } else {
    return {
      benefit: 'excellent',
      description: 'Standing height work, accessible for wheelchairs and mobility aids'
    };
  }
}

/**
 * Get watering consideration based on height
 */
export function getWateringConsideration(heightInches: number): {
  frequency: 'normal' | 'moderate' | 'frequent' | 'very-frequent';
  description: string;
  recommendation: string;
} {
  if (heightInches < 8) {
    return {
      frequency: 'normal',
      description: 'Similar watering needs to ground level gardening',
      recommendation: 'Water when top 1-2" of soil is dry'
    };
  } else if (heightInches < 14) {
    return {
      frequency: 'moderate',
      description: 'Needs slightly more frequent watering than ground level',
      recommendation: 'Consider mulch to retain moisture; check soil daily'
    };
  } else if (heightInches < 20) {
    return {
      frequency: 'frequent',
      description: 'Dries out faster, needs regular watering',
      recommendation: 'Drip irrigation or soaker hoses recommended; 2-3" mulch layer'
    };
  } else {
    return {
      frequency: 'very-frequent',
      description: 'High evaporation rate, needs consistent watering',
      recommendation: 'Automatic irrigation highly recommended; 3-4" mulch layer essential'
    };
  }
}

/**
 * Get construction recommendation based on height
 */
export function getConstructionRecommendation(heightInches: number): {
  difficulty: 'easy' | 'moderate' | 'challenging' | 'complex';
  materials: string[];
  considerations: string[];
} {
  if (heightInches <= 8) {
    return {
      difficulty: 'easy',
      materials: ['Single 2×6 or 2×8 boards', 'Corner posts', 'Deck screws'],
      considerations: [
        'Simple construction',
        'No structural reinforcement needed',
        'Can use untreated cedar or pine with liner'
      ]
    };
  } else if (heightInches <= 12) {
    return {
      difficulty: 'moderate',
      materials: ['Two stacked 2×6 boards', 'Corner posts', 'Brackets', 'Deck screws'],
      considerations: [
        'Stack and screw two boards',
        'Optional corner brackets for stability',
        'Consider rot-resistant wood (cedar, redwood)'
      ]
    };
  } else if (heightInches <= 18) {
    return {
      difficulty: 'challenging',
      materials: ['2×12 or three 2×6 boards', 'Posts every 4 feet', 'Brackets', 'Screws/bolts'],
      considerations: [
        'Requires corner posts and mid-span posts',
        'Brackets or diagonal bracing recommended',
        'Use rot-resistant or treated lumber',
        'May need landscape fabric liner'
      ]
    };
  } else {
    return {
      difficulty: 'complex',
      materials: ['2×12 boards', 'Posts every 3-4 feet', 'Metal brackets', 'Structural reinforcement'],
      considerations: [
        'Engineered design recommended',
        'Requires internal/external bracing',
        'Must use rot-resistant lumber',
        'Consider concrete footing for posts',
        'Professional construction advised for 30"+'
      ]
    };
  }
}
