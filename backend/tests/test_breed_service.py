"""
Unit tests for breed service
"""

import unittest
from services.breed_service import BreedService, calculate_livestock_production


class TestBreedService(unittest.TestCase):
    """Test breed service functionality"""

    def setUp(self):
        """Set up test fixtures"""
        self.service = BreedService()

    def test_breed_lookup_found(self):
        """Test breed lookup with known breed"""
        info = self.service.get_breed_info('chickens', 'rhode-island-red')
        self.assertEqual(info['peak_eggs_per_year'], 275)
        self.assertEqual(info['laying_start_weeks'], 18)

    def test_breed_lookup_fallback(self):
        """Test breed lookup with unknown breed falls back to species default"""
        info = self.service.get_breed_info('chickens', 'unknown-breed')
        self.assertEqual(info['peak_eggs_per_year'], 250)  # species default
        self.assertEqual(info['laying_start_weeks'], 18)

    def test_breed_lookup_no_breed(self):
        """Test breed lookup with None breed returns species default"""
        info = self.service.get_breed_info('chickens', None)
        self.assertEqual(info['peak_eggs_per_year'], 250)  # species default

    def test_breed_lookup_invalid_species(self):
        """Test breed lookup with invalid species"""
        info = self.service.get_breed_info('unicorns', 'rainbow')
        self.assertEqual(info, {})

    def test_leghorn_breed_data(self):
        """Test Leghorn breed has higher egg production"""
        info = self.service.get_breed_info('chickens', 'leghorn')
        self.assertEqual(info['peak_eggs_per_year'], 300)
        self.assertEqual(info['laying_start_weeks'], 16)

    def test_silkie_breed_data(self):
        """Test Silkie breed has lower egg production"""
        info = self.service.get_breed_info('chickens', 'silkie')
        self.assertEqual(info['peak_eggs_per_year'], 120)
        self.assertEqual(info['laying_start_weeks'], 22)

    def test_duck_breed_data(self):
        """Test duck breed lookup"""
        info = self.service.get_breed_info('ducks', 'khaki-campbell')
        self.assertEqual(info['peak_eggs_per_year'], 300)
        self.assertEqual(info['laying_start_weeks'], 20)

    def test_goat_breed_data(self):
        """Test goat breed lookup"""
        info = self.service.get_breed_info('goats', 'alpine')
        self.assertEqual(info['peak_milk_lbs_per_year'], 2500)
        self.assertEqual(info['milking_start_months'], 10)

    def test_nigerian_dwarf_smaller_production(self):
        """Test Nigerian Dwarf goats have lower milk production"""
        info = self.service.get_breed_info('goats', 'nigerian-dwarf')
        self.assertEqual(info['peak_milk_lbs_per_year'], 750)

    # Egg Production Factor Tests

    def test_age_factor_not_laying(self):
        """Test birds not yet laying have 0% production"""
        factor = self.service.calculate_egg_production_factor(age_weeks=12, laying_start_weeks=18)
        self.assertEqual(factor, 0.0)

    def test_age_factor_just_started(self):
        """Test birds just starting to lay have 50% production"""
        factor = self.service.calculate_egg_production_factor(age_weeks=18, laying_start_weeks=18)
        self.assertEqual(factor, 0.5)

    def test_age_factor_ramping_up(self):
        """Test birds ramping up production (4 weeks after laying start)"""
        factor = self.service.calculate_egg_production_factor(age_weeks=22, laying_start_weeks=18)
        self.assertAlmostEqual(factor, 0.75, places=2)

    def test_age_factor_peak(self):
        """Test birds at peak production (year 1)"""
        factor = self.service.calculate_egg_production_factor(age_weeks=40, laying_start_weeks=18)
        self.assertEqual(factor, 1.0)

    def test_age_factor_year_2(self):
        """Test birds in year 2 have 85% production"""
        # 18 (start) + 52 (year 1) + 10 (into year 2) = 80 weeks
        factor = self.service.calculate_egg_production_factor(age_weeks=80, laying_start_weeks=18)
        self.assertEqual(factor, 0.85)

    def test_age_factor_year_3(self):
        """Test birds in year 3 have 70% production"""
        # 18 + 52 + 52 + 10 = 132 weeks
        factor = self.service.calculate_egg_production_factor(age_weeks=132, laying_start_weeks=18)
        self.assertEqual(factor, 0.70)

    def test_age_factor_year_4(self):
        """Test birds in year 4 have 50% production"""
        # 18 + 52 + 52 + 52 + 10 = 184 weeks
        factor = self.service.calculate_egg_production_factor(age_weeks=184, laying_start_weeks=18)
        self.assertEqual(factor, 0.50)

    def test_age_factor_year_5_plus(self):
        """Test old birds have 30% production"""
        # 18 + 52 + 52 + 52 + 52 + 10 = 236 weeks
        factor = self.service.calculate_egg_production_factor(age_weeks=236, laying_start_weeks=18)
        self.assertEqual(factor, 0.30)

    def test_age_factor_none_assumes_peak(self):
        """Test None age assumes peak production"""
        factor = self.service.calculate_egg_production_factor(age_weeks=None, laying_start_weeks=18)
        self.assertEqual(factor, 1.0)

    # Milk Production Factor Tests

    def test_goat_male_no_milk(self):
        """Test male goats produce no milk"""
        factor = self.service.calculate_milk_production_factor(
            age_months=24, sex='male', purpose='dairy', milking_start_months=10
        )
        self.assertEqual(factor, 0.0)

    def test_goat_buck_no_milk(self):
        """Test bucks produce no milk"""
        factor = self.service.calculate_milk_production_factor(
            age_months=24, sex='buck', purpose='dairy', milking_start_months=10
        )
        self.assertEqual(factor, 0.0)

    def test_goat_wether_no_milk(self):
        """Test wethers produce no milk"""
        factor = self.service.calculate_milk_production_factor(
            age_months=24, sex='wether', purpose='dairy', milking_start_months=10
        )
        self.assertEqual(factor, 0.0)

    def test_goat_meat_breed_no_milk(self):
        """Test meat breed goats produce no milk"""
        factor = self.service.calculate_milk_production_factor(
            age_months=24, sex='female', purpose='meat', milking_start_months=10
        )
        self.assertEqual(factor, 0.0)

    def test_goat_too_young(self):
        """Test goats too young to milk"""
        factor = self.service.calculate_milk_production_factor(
            age_months=6, sex='female', purpose='dairy', milking_start_months=10
        )
        self.assertEqual(factor, 0.0)

    def test_goat_first_lactation(self):
        """Test goats in first lactation have 70% production"""
        # 10 months at first freshening + 6 months into lactation = 16 months
        factor = self.service.calculate_milk_production_factor(
            age_months=16, sex='female', purpose='dairy', milking_start_months=10
        )
        self.assertEqual(factor, 0.70)

    def test_goat_peak_years(self):
        """Test goats in peak years (2-5) have 100% production"""
        # 10 + 12 (year 1) + 12 (year 2) = 34 months
        factor = self.service.calculate_milk_production_factor(
            age_months=34, sex='female', purpose='dairy', milking_start_months=10
        )
        self.assertEqual(factor, 1.0)

    def test_goat_year_6(self):
        """Test goats in year 6 have 85% production"""
        # 10 + 12*5 = 70 months
        factor = self.service.calculate_milk_production_factor(
            age_months=70, sex='female', purpose='dairy', milking_start_months=10
        )
        self.assertEqual(factor, 0.85)

    def test_goat_year_7_plus(self):
        """Test old goats have 70% production"""
        # 10 + 12*6 = 82 months
        factor = self.service.calculate_milk_production_factor(
            age_months=82, sex='female', purpose='dairy', milking_start_months=10
        )
        self.assertEqual(factor, 0.70)

    def test_goat_none_age_assumes_peak(self):
        """Test None age assumes peak production for goats"""
        factor = self.service.calculate_milk_production_factor(
            age_months=None, sex='female', purpose='dairy', milking_start_months=10
        )
        self.assertEqual(factor, 1.0)

    # Integration Tests

    def test_calculate_age_adjusted_production_chickens(self):
        """Test full production calculation for chickens"""
        production, metadata = self.service.calculate_age_adjusted_production(
            species='chickens',
            breed='rhode-island-red',
            age_weeks=40,
            age_months=None,
            quantity=10,
            sex='hen',
            purpose='eggs'
        )

        # 10 chickens × 275 eggs/year × 1.0 factor = 2750
        self.assertEqual(production, 2750.0)
        self.assertEqual(metadata['breed_name'], 'Rhode Island Red')
        self.assertEqual(metadata['age_factor'], 1.0)
        self.assertEqual(metadata['quantity'], 10)

    def test_calculate_age_adjusted_production_young_chickens(self):
        """Test production calculation for young chickens not yet laying"""
        production, metadata = self.service.calculate_age_adjusted_production(
            species='chickens',
            breed='rhode-island-red',
            age_weeks=12,
            age_months=None,
            quantity=10,
            sex='hen',
            purpose='eggs'
        )

        # 10 chickens × 275 eggs/year × 0.0 factor = 0
        self.assertEqual(production, 0.0)
        self.assertEqual(metadata['age_factor'], 0.0)

    def test_calculate_age_adjusted_production_old_chickens(self):
        """Test production calculation for old chickens"""
        production, metadata = self.service.calculate_age_adjusted_production(
            species='chickens',
            breed='rhode-island-red',
            age_weeks=132,  # Year 3
            age_months=None,
            quantity=10,
            sex='hen',
            purpose='eggs'
        )

        # 10 chickens × 275 eggs/year × 0.70 factor = 1925
        self.assertEqual(production, 1925.0)
        self.assertEqual(metadata['age_factor'], 0.70)

    def test_calculate_age_adjusted_production_goats(self):
        """Test full production calculation for goats"""
        production, metadata = self.service.calculate_age_adjusted_production(
            species='goats',
            breed='alpine',
            age_weeks=None,
            age_months=34,  # Year 2 of production
            quantity=1,
            sex='female',
            purpose='dairy'
        )

        # 1 goat × 2500 lbs/year × 1.0 factor = 2500
        self.assertEqual(production, 2500.0)
        self.assertEqual(metadata['breed_name'], 'Alpine')
        self.assertEqual(metadata['age_factor'], 1.0)

    def test_calculate_age_adjusted_production_male_goat(self):
        """Test production calculation for male goat (should be zero)"""
        production, metadata = self.service.calculate_age_adjusted_production(
            species='goats',
            breed='alpine',
            age_weeks=None,
            age_months=34,
            quantity=1,
            sex='male',
            purpose='dairy'
        )

        # Male = 0
        self.assertEqual(production, 0.0)
        self.assertEqual(metadata['age_factor'], 0.0)

    def test_normalize_breed_name(self):
        """Test breed name normalization"""
        self.assertEqual(
            self.service.normalize_breed_name('Rhode Island Red'),
            'rhode-island-red'
        )
        self.assertEqual(
            self.service.normalize_breed_name('ISA Brown'),
            'isa-brown'
        )
        self.assertEqual(
            self.service.normalize_breed_name('LaMancha'),
            'lamancha'
        )
        self.assertEqual(
            self.service.normalize_breed_name('Khaki Campbell'),
            'khaki-campbell'
        )
        self.assertIsNone(self.service.normalize_breed_name(None))
        self.assertEqual(self.service.normalize_breed_name(''), None)

    def test_convenience_function(self):
        """Test convenience function works"""
        production, metadata = calculate_livestock_production(
            species='chickens',
            breed='leghorn',
            age_weeks=40,
            quantity=5
        )

        # 5 × 300 × 1.0 = 1500
        self.assertEqual(production, 1500.0)


if __name__ == '__main__':
    unittest.main()
