"""
Breed-specific production rates and age-based adjustments for livestock.

This service provides breed-specific production rates (eggs, milk) and applies
age-based production curves to calculate realistic annual yields.
"""

import json
import os
from typing import Dict, Optional, Tuple
from datetime import datetime


class BreedService:
    """Service for managing breed-specific production rates and age adjustments."""

    def __init__(self):
        """Initialize the breed service and load breed data."""
        self.breed_data = self._load_breed_data()

    def _load_breed_data(self) -> Dict:
        """Load breed production rates from JSON file."""
        # Get the path relative to this file
        current_dir = os.path.dirname(os.path.abspath(__file__))
        data_path = os.path.join(current_dir, '..', 'data', 'breed_production_rates.json')

        try:
            with open(data_path, 'r') as f:
                return json.load(f)
        except FileNotFoundError:
            print(f"Warning: Breed data file not found at {data_path}")
            return self._get_fallback_data()
        except json.JSONDecodeError:
            print(f"Warning: Invalid JSON in breed data file")
            return self._get_fallback_data()

    def _get_fallback_data(self) -> Dict:
        """Return minimal fallback data if JSON file can't be loaded."""
        return {
            "chickens": {"breeds": {}, "default": {"peak_eggs_per_year": 250, "laying_start_weeks": 18}},
            "ducks": {"breeds": {}, "default": {"peak_eggs_per_year": 200, "laying_start_weeks": 22}},
            "goats": {"breeds": {}, "default": {"peak_milk_lbs_per_year": 1800, "milking_start_months": 10}}
        }

    def get_breed_info(self, species: str, breed: Optional[str]) -> Dict:
        """
        Get breed information with fallback to species default.

        Args:
            species: 'chickens', 'ducks', or 'goats'
            breed: Breed identifier (kebab-case, e.g., 'rhode-island-red')

        Returns:
            Dict with production rates and other breed data
        """
        if species not in self.breed_data:
            return {}

        species_data = self.breed_data[species]

        # If no breed specified or breed not found, use species default
        if not breed or breed not in species_data.get('breeds', {}):
            return species_data.get('default', {})

        return species_data['breeds'][breed]

    def calculate_egg_production_factor(
        self,
        age_weeks: Optional[int],
        laying_start_weeks: int
    ) -> float:
        """
        Calculate age-based egg production factor for chickens and ducks.

        Production curve:
        - Before laying_start: 0% (not laying yet)
        - First 8 weeks of laying: 50% → 100% (ramping up)
        - Year 1 (peak): 100%
        - Year 2: 85%
        - Year 3: 70%
        - Year 4: 50%
        - Year 5+: 30%

        Args:
            age_weeks: Age of the bird in weeks (None = assume peak)
            laying_start_weeks: Age when breed starts laying

        Returns:
            Production factor (0.0 to 1.0)
        """
        # If age not provided, assume peak production
        if age_weeks is None:
            return 1.0

        # Not yet laying
        if age_weeks < laying_start_weeks:
            return 0.0

        # Ramping up (first 8 weeks of laying)
        weeks_laying = age_weeks - laying_start_weeks
        if weeks_laying < 8:
            # Linear ramp from 50% to 100%
            return 0.5 + (weeks_laying / 8) * 0.5

        # Determine which year of laying they're in
        # Year 1 is weeks 0-52 after laying start
        laying_year = weeks_laying // 52 + 1

        if laying_year == 1:
            return 1.0  # Peak production
        elif laying_year == 2:
            return 0.85  # Year 2: 85%
        elif laying_year == 3:
            return 0.70  # Year 3: 70%
        elif laying_year == 4:
            return 0.50  # Year 4: 50%
        else:
            return 0.30  # Year 5+: 30%

    def calculate_milk_production_factor(
        self,
        age_months: Optional[int],
        sex: Optional[str],
        purpose: Optional[str],
        milking_start_months: int
    ) -> float:
        """
        Calculate age-based milk production factor for goats.

        Production curve:
        - Males: 0%
        - Meat breeds: 0%
        - Before first freshening (milking_start_months): 0%
        - First lactation (Year 1): 70%
        - Peak years (2-5): 100%
        - Year 6: 85%
        - Year 7+: 70%

        Args:
            age_months: Age of the goat in months (None = assume peak)
            sex: 'male', 'female', or None
            purpose: 'dairy', 'meat', or None
            milking_start_months: Age when breed typically starts milking

        Returns:
            Production factor (0.0 to 1.0)
        """
        # Males don't produce milk
        if sex and sex.lower() in ['male', 'buck', 'wether']:
            return 0.0

        # Meat breeds typically don't produce significant milk
        if purpose and purpose.lower() == 'meat':
            return 0.0

        # If age not provided, assume peak production
        if age_months is None:
            return 1.0

        # Not yet mature enough for breeding/milking
        if age_months < milking_start_months:
            return 0.0

        # Determine which year of production
        # Assuming first freshening at milking_start_months, then yearly after
        production_year = ((age_months - milking_start_months) // 12) + 1

        if production_year == 1:
            return 0.70  # First lactation: 70%
        elif 2 <= production_year <= 5:
            return 1.0   # Peak years: 100%
        elif production_year == 6:
            return 0.85  # Year 6: 85%
        else:
            return 0.70  # Year 7+: 70%

    def calculate_age_adjusted_production(
        self,
        species: str,
        breed: Optional[str],
        age_weeks: Optional[int],
        age_months: Optional[int],
        quantity: int,
        sex: Optional[str] = None,
        purpose: Optional[str] = None
    ) -> Tuple[float, Dict]:
        """
        Calculate age-adjusted annual production for a group of animals.

        Args:
            species: 'chickens', 'ducks', or 'goats'
            breed: Breed identifier (kebab-case)
            age_weeks: Age in weeks (for chickens/ducks)
            age_months: Age in months (for goats)
            quantity: Number of animals
            sex: 'male'/'female' (for goats)
            purpose: 'dairy'/'meat'/'eggs'/etc.

        Returns:
            Tuple of (annual_production, metadata_dict)

        Example:
            - 10 Rhode Island Red chickens, 40 weeks old
            - breed_info: 250 peak eggs/year, starts at 18 weeks
            - age_factor: 1.0 (peak production)
            - Result: (2500.0, {...metadata...})
        """
        breed_info = self.get_breed_info(species, breed)

        if not breed_info:
            return (0.0, {"error": f"Unknown species: {species}"})

        metadata = {
            "species": species,
            "breed": breed or "default",
            "breed_name": breed_info.get('name', 'Unknown'),
            "quantity": quantity
        }

        # Calculate based on species
        if species in ['chickens', 'ducks']:
            peak_eggs = breed_info.get('peak_eggs_per_year', 0)
            laying_start_weeks = breed_info.get('laying_start_weeks', 18)

            age_factor = self.calculate_egg_production_factor(age_weeks, laying_start_weeks)
            annual_production = peak_eggs * age_factor * quantity

            metadata.update({
                "peak_eggs_per_year": peak_eggs,
                "laying_start_weeks": laying_start_weeks,
                "age_weeks": age_weeks,
                "age_factor": age_factor,
                "annual_eggs": annual_production
            })

        elif species == 'goats':
            peak_milk_lbs = breed_info.get('peak_milk_lbs_per_year', 0)
            milking_start_months = breed_info.get('milking_start_months', 10)

            age_factor = self.calculate_milk_production_factor(
                age_months, sex, purpose, milking_start_months
            )
            annual_production = peak_milk_lbs * age_factor * quantity

            metadata.update({
                "peak_milk_lbs_per_year": peak_milk_lbs,
                "milking_start_months": milking_start_months,
                "age_months": age_months,
                "sex": sex,
                "purpose": purpose,
                "age_factor": age_factor,
                "annual_milk_lbs": annual_production
            })
        else:
            annual_production = 0.0
            metadata["error"] = f"Unsupported species: {species}"

        return (annual_production, metadata)

    def normalize_breed_name(self, breed_name: Optional[str]) -> Optional[str]:
        """
        Convert breed name to kebab-case identifier.

        Examples:
            'Rhode Island Red' -> 'rhode-island-red'
            'ISA Brown' -> 'isa-brown'
            'LaMancha' -> 'lamancha'

        Args:
            breed_name: Human-readable breed name

        Returns:
            Kebab-case identifier or None
        """
        if not breed_name:
            return None

        # Convert to lowercase and replace spaces with hyphens
        normalized = breed_name.lower().strip()
        normalized = normalized.replace(' ', '-')

        # Remove any non-alphanumeric characters except hyphens
        normalized = ''.join(c for c in normalized if c.isalnum() or c == '-')

        # Remove consecutive hyphens
        while '--' in normalized:
            normalized = normalized.replace('--', '-')

        # Remove leading/trailing hyphens
        normalized = normalized.strip('-')

        return normalized if normalized else None


# Convenience function for quick calculations
def calculate_livestock_production(
    species: str,
    breed: Optional[str],
    age_weeks: Optional[int] = None,
    age_months: Optional[int] = None,
    quantity: int = 1,
    sex: Optional[str] = None,
    purpose: Optional[str] = None
) -> Tuple[float, Dict]:
    """
    Convenience function for calculating livestock production.

    See BreedService.calculate_age_adjusted_production for details.
    """
    service = BreedService()
    return service.calculate_age_adjusted_production(
        species, breed, age_weeks, age_months, quantity, sex, purpose
    )
