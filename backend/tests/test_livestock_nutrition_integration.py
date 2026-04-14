"""
Integration tests for livestock nutrition with breed-specific production rates
"""

import unittest
import os
import sqlite3
import tempfile
from datetime import datetime, timedelta
from services.nutritional_service import NutritionalService


class TestLivestockNutritionIntegration(unittest.TestCase):
    """Integration tests for livestock nutrition calculations"""

    def setUp(self):
        """Set up test database and service"""
        # Create a temporary database
        self.db_fd, self.db_path = tempfile.mkstemp()
        self.service = NutritionalService(db_path=self.db_path)
        self.conn = sqlite3.connect(self.db_path)
        self.cursor = self.conn.cursor()

        # Create required tables
        self._create_tables()

        # Create test user
        self.cursor.execute("""
            INSERT INTO users (id, username, email, password_hash)
            VALUES (1, 'testuser', 'test@example.com', 'hash')
        """)
        self.conn.commit()

    def tearDown(self):
        """Clean up test database"""
        self.conn.close()
        os.close(self.db_fd)
        os.unlink(self.db_path)

    def _create_tables(self):
        """Create necessary database tables for testing"""
        # Users table
        self.cursor.execute("""
            CREATE TABLE users (
                id INTEGER PRIMARY KEY,
                username TEXT NOT NULL,
                email TEXT NOT NULL,
                password_hash TEXT NOT NULL
            )
        """)

        # Chicken table
        self.cursor.execute("""
            CREATE TABLE chicken (
                id INTEGER PRIMARY KEY,
                user_id INTEGER NOT NULL,
                name TEXT,
                breed TEXT,
                quantity INTEGER DEFAULT 1,
                hatch_date DATETIME,
                purpose TEXT,
                sex TEXT,
                status TEXT DEFAULT 'active',
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        """)

        # Duck table
        self.cursor.execute("""
            CREATE TABLE duck (
                id INTEGER PRIMARY KEY,
                user_id INTEGER NOT NULL,
                name TEXT,
                breed TEXT,
                quantity INTEGER DEFAULT 1,
                hatch_date DATETIME,
                purpose TEXT,
                sex TEXT,
                status TEXT DEFAULT 'active',
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        """)

        # Livestock table
        self.cursor.execute("""
            CREATE TABLE livestock (
                id INTEGER PRIMARY KEY,
                user_id INTEGER NOT NULL,
                name TEXT,
                species TEXT NOT NULL,
                breed TEXT,
                birth_date DATETIME,
                sex TEXT,
                purpose TEXT,
                status TEXT DEFAULT 'active',
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        """)

        # Beehive table
        self.cursor.execute("""
            CREATE TABLE beehive (
                id INTEGER PRIMARY KEY,
                user_id INTEGER NOT NULL,
                name TEXT,
                status TEXT DEFAULT 'active',
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        """)

        # Nutritional data table (matching actual schema)
        self.cursor.execute("""
            CREATE TABLE nutritional_data (
                id INTEGER PRIMARY KEY,
                source_type VARCHAR(50) NOT NULL,
                source_id VARCHAR(100) NOT NULL,
                name VARCHAR(200) NOT NULL,
                usda_fdc_id INTEGER,
                calories FLOAT,
                protein_g FLOAT,
                carbs_g FLOAT,
                fat_g FLOAT,
                fiber_g FLOAT,
                vitamin_a_iu FLOAT,
                vitamin_c_mg FLOAT,
                vitamin_k_mcg FLOAT,
                vitamin_e_mg FLOAT,
                folate_mcg FLOAT,
                calcium_mg FLOAT,
                iron_mg FLOAT,
                magnesium_mg FLOAT,
                potassium_mg FLOAT,
                zinc_mg FLOAT,
                average_yield_lbs_per_plant FLOAT,
                average_yield_lbs_per_sqft FLOAT,
                average_yield_lbs_per_tree_year FLOAT,
                data_source VARCHAR(100),
                notes TEXT,
                last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                user_id INTEGER,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        """)

        # Add test nutritional data for chicken eggs (per lb)
        self.cursor.execute("""
            INSERT INTO nutritional_data (
                source_type, source_id, name, user_id,
                calories, protein_g, fat_g
            ) VALUES ('livestock', 'chicken-egg', 'Chicken Egg', 1, 650, 57, 43)
        """)

        # Add test nutritional data for duck eggs (per lb)
        self.cursor.execute("""
            INSERT INTO nutritional_data (
                source_type, source_id, name, user_id,
                calories, protein_g, fat_g
            ) VALUES ('livestock', 'duck-egg', 'Duck Egg', 1, 700, 60, 50)
        """)

        # Add test nutritional data for goat milk (per lb)
        self.cursor.execute("""
            INSERT INTO nutritional_data (
                source_type, source_id, name, user_id,
                calories, protein_g, fat_g
            ) VALUES ('livestock', 'goat-milk', 'Goat Milk', 1, 310, 16, 16)
        """)

        self.conn.commit()

    def test_young_chickens_zero_production(self):
        """Test that young chickens not yet laying produce zero eggs"""
        # Add chickens that are 12 weeks old (not yet laying)
        hatch_date = datetime.utcnow() - timedelta(weeks=12)
        self.cursor.execute("""
            INSERT INTO chicken (user_id, name, breed, quantity, hatch_date, status)
            VALUES (1, 'Young Flock', 'Rhode Island Red', 10, ?, 'active')
        """, (hatch_date,))
        self.conn.commit()

        # Calculate nutrition
        result = self.service.calculate_livestock_nutrition(user_id=1)

        # Young chickens produce 0 eggs, so they won't be in by_animal_type
        # (Only animals with actual production are included)
        self.assertNotIn('chickens', result['by_animal_type'])
        # Totals should be zero or minimal
        self.assertEqual(result['totals']['calories'], 0)

    def test_peak_chickens_use_breed_rate(self):
        """Test that chickens at peak age use breed-specific rates"""
        # Add Rhode Island Red chickens at 40 weeks (peak production)
        hatch_date = datetime.utcnow() - timedelta(weeks=40)
        self.cursor.execute("""
            INSERT INTO chicken (user_id, name, breed, quantity, hatch_date, status)
            VALUES (1, 'Peak Flock', 'Rhode Island Red', 10, ?, 'active')
        """, (hatch_date,))
        self.conn.commit()

        # Calculate nutrition
        result = self.service.calculate_livestock_nutrition(user_id=1)

        # Should produce ~2,750 eggs (10 × 275 × 1.0)
        self.assertIn('chickens', result['by_animal_type'])
        self.assertEqual(result['by_animal_type']['chickens']['count'], 10)
        production_str = result['by_animal_type']['chickens']['production']
        self.assertIn('2,750', production_str)  # Should be 2,750 eggs/year

    def test_leghorn_higher_production(self):
        """Test that Leghorns produce more eggs than default"""
        # Add Leghorn chickens at 40 weeks (peak production)
        hatch_date = datetime.utcnow() - timedelta(weeks=40)
        self.cursor.execute("""
            INSERT INTO chicken (user_id, name, breed, quantity, hatch_date, status)
            VALUES (1, 'Leghorn Flock', 'Leghorn', 10, ?, 'active')
        """, (hatch_date,))
        self.conn.commit()

        # Calculate nutrition
        result = self.service.calculate_livestock_nutrition(user_id=1)

        # Should produce ~3,000 eggs (10 × 300 × 1.0)
        self.assertIn('chickens', result['by_animal_type'])
        production_str = result['by_animal_type']['chickens']['production']
        self.assertIn('3,000', production_str)  # Leghorns produce 300 eggs/year

    def test_old_chickens_reduced_production(self):
        """Test that old chickens have reduced production"""
        # Add chickens at 132 weeks (2.5 years old, year 3 of laying)
        hatch_date = datetime.utcnow() - timedelta(weeks=132)
        self.cursor.execute("""
            INSERT INTO chicken (user_id, name, breed, quantity, hatch_date, status)
            VALUES (1, 'Old Flock', 'Rhode Island Red', 10, ?, 'active')
        """, (hatch_date,))
        self.conn.commit()

        # Calculate nutrition
        result = self.service.calculate_livestock_nutrition(user_id=1)

        # Should produce ~1,925 eggs (10 × 275 × 0.70)
        self.assertIn('chickens', result['by_animal_type'])
        production_str = result['by_animal_type']['chickens']['production']
        self.assertIn('1,925', production_str)  # 70% of peak

    def test_mixed_age_chickens(self):
        """Test that mixed age chickens calculate correctly"""
        # Add young chickens (not laying)
        hatch_date_young = datetime.utcnow() - timedelta(weeks=12)
        self.cursor.execute("""
            INSERT INTO chicken (user_id, name, breed, quantity, hatch_date, status)
            VALUES (1, 'Young Flock', 'Rhode Island Red', 5, ?, 'active')
        """, (hatch_date_young,))

        # Add peak chickens
        hatch_date_peak = datetime.utcnow() - timedelta(weeks=40)
        self.cursor.execute("""
            INSERT INTO chicken (user_id, name, breed, quantity, hatch_date, status)
            VALUES (1, 'Peak Flock', 'Rhode Island Red', 5, ?, 'active')
        """, (hatch_date_peak,))

        self.conn.commit()

        # Calculate nutrition
        result = self.service.calculate_livestock_nutrition(user_id=1)

        # Total count should be 10
        self.assertEqual(result['by_animal_type']['chickens']['count'], 10)
        # Production should be 1,375 eggs (5 × 0 + 5 × 275)
        production_str = result['by_animal_type']['chickens']['production']
        self.assertIn('1,375', production_str)

    def test_chickens_no_breed_uses_default(self):
        """Test that chickens without breed use species default"""
        hatch_date = datetime.utcnow() - timedelta(weeks=40)
        self.cursor.execute("""
            INSERT INTO chicken (user_id, name, breed, quantity, hatch_date, status)
            VALUES (1, 'No Breed Flock', NULL, 10, ?, 'active')
        """, (hatch_date,))
        self.conn.commit()

        # Calculate nutrition
        result = self.service.calculate_livestock_nutrition(user_id=1)

        # Should use default (250 eggs/year) = 2,500 total
        self.assertIn('chickens', result['by_animal_type'])
        production_str = result['by_animal_type']['chickens']['production']
        self.assertIn('2,500', production_str)

    def test_chickens_no_age_assumes_peak(self):
        """Test that chickens without age data assume peak production"""
        self.cursor.execute("""
            INSERT INTO chicken (user_id, name, breed, quantity, hatch_date, status)
            VALUES (1, 'Unknown Age Flock', 'Rhode Island Red', 10, NULL, 'active')
        """)
        self.conn.commit()

        # Calculate nutrition
        result = self.service.calculate_livestock_nutrition(user_id=1)

        # Should assume peak (275 eggs/year) = 2,750 total
        self.assertIn('chickens', result['by_animal_type'])
        production_str = result['by_animal_type']['chickens']['production']
        self.assertIn('2,750', production_str)

    def test_ducks_breed_specific_production(self):
        """Test that ducks use breed-specific production rates"""
        # Add Khaki Campbell ducks at peak age
        hatch_date = datetime.utcnow() - timedelta(weeks=30)
        self.cursor.execute("""
            INSERT INTO duck (user_id, name, breed, quantity, hatch_date, status)
            VALUES (1, 'Khaki Flock', 'Khaki Campbell', 5, ?, 'active')
        """, (hatch_date,))
        self.conn.commit()

        # Calculate nutrition
        result = self.service.calculate_livestock_nutrition(user_id=1)

        # Should produce ~1,500 eggs (5 × 300 × 1.0)
        self.assertIn('ducks', result['by_animal_type'])
        production_str = result['by_animal_type']['ducks']['production']
        self.assertIn('1,500', production_str)

    def test_male_goats_no_milk(self):
        """Test that male goats produce no milk"""
        birth_date = datetime.utcnow() - timedelta(days=730)  # 2 years old
        self.cursor.execute("""
            INSERT INTO livestock (user_id, name, species, breed, birth_date, sex, purpose, status)
            VALUES (1, 'Buck', 'goat', 'Alpine', ?, 'male', 'breeding', 'active')
        """, (birth_date,))
        self.conn.commit()

        # Calculate nutrition
        result = self.service.calculate_livestock_nutrition(user_id=1)

        # Male goats produce 0 milk, so they won't be in by_animal_type
        # (Only animals with actual production are included)
        self.assertNotIn('goats', result['by_animal_type'])
        # Totals should be zero
        self.assertEqual(result['totals']['calories'], 0)

    def test_dairy_goats_breed_specific_production(self):
        """Test that dairy goats use breed-specific rates"""
        # Add Alpine goat at peak age (3 years old, in year 2 of production)
        birth_date = datetime.utcnow() - timedelta(days=1095)  # ~3 years
        self.cursor.execute("""
            INSERT INTO livestock (user_id, name, species, breed, birth_date, sex, purpose, status)
            VALUES (1, 'Doe', 'goat', 'Alpine', ?, 'female', 'dairy', 'active')
        """, (birth_date,))
        self.conn.commit()

        # Calculate nutrition
        result = self.service.calculate_livestock_nutrition(user_id=1)

        # Should produce ~2,500 lbs (1 × 2500 × 1.0)
        self.assertIn('goats', result['by_animal_type'])
        production_str = result['by_animal_type']['goats']['production']
        self.assertIn('2,500', production_str)

    def test_nigerian_dwarf_lower_production(self):
        """Test that Nigerian Dwarf goats have lower milk production"""
        birth_date = datetime.utcnow() - timedelta(days=730)  # 2 years old
        self.cursor.execute("""
            INSERT INTO livestock (user_id, name, species, breed, birth_date, sex, purpose, status)
            VALUES (1, 'Mini Doe', 'goat', 'Nigerian Dwarf', ?, 'female', 'dairy', 'active')
        """, (birth_date,))
        self.conn.commit()

        # Calculate nutrition
        result = self.service.calculate_livestock_nutrition(user_id=1)

        # Should produce ~750 lbs (1 × 750 × 1.0)
        self.assertIn('goats', result['by_animal_type'])
        production_str = result['by_animal_type']['goats']['production']
        self.assertIn('750', production_str)

    def test_young_goats_no_milk(self):
        """Test that young goats not yet mature produce no milk"""
        birth_date = datetime.utcnow() - timedelta(days=180)  # 6 months old
        self.cursor.execute("""
            INSERT INTO livestock (user_id, name, species, breed, birth_date, sex, purpose, status)
            VALUES (1, 'Young Doe', 'goat', 'Alpine', ?, 'female', 'dairy', 'active')
        """, (birth_date,))
        self.conn.commit()

        # Calculate nutrition
        result = self.service.calculate_livestock_nutrition(user_id=1)

        # Young goats produce 0 milk, so they won't be in by_animal_type
        # (Only animals with actual production are included)
        self.assertNotIn('goats', result['by_animal_type'])
        # Totals should be zero
        self.assertEqual(result['totals']['calories'], 0)

    def test_mixed_species(self):
        """Test that multiple species calculate correctly together"""
        # Add chickens
        hatch_date = datetime.utcnow() - timedelta(weeks=40)
        self.cursor.execute("""
            INSERT INTO chicken (user_id, name, breed, quantity, hatch_date, status)
            VALUES (1, 'Chicken Flock', 'Rhode Island Red', 10, ?, 'active')
        """, (hatch_date,))

        # Add ducks
        self.cursor.execute("""
            INSERT INTO duck (user_id, name, breed, quantity, hatch_date, status)
            VALUES (1, 'Duck Flock', 'Khaki Campbell', 5, ?, 'active')
        """, (hatch_date,))

        # Add goats
        birth_date = datetime.utcnow() - timedelta(days=730)
        self.cursor.execute("""
            INSERT INTO livestock (user_id, name, species, breed, birth_date, sex, purpose, status)
            VALUES (1, 'Doe', 'goat', 'Alpine', ?, 'female', 'dairy', 'active')
        """, (birth_date,))

        self.conn.commit()

        # Calculate nutrition
        result = self.service.calculate_livestock_nutrition(user_id=1)

        # All three species should be present
        self.assertIn('chickens', result['by_animal_type'])
        self.assertIn('ducks', result['by_animal_type'])
        self.assertIn('goats', result['by_animal_type'])

        # Check counts
        self.assertEqual(result['by_animal_type']['chickens']['count'], 10)
        self.assertEqual(result['by_animal_type']['ducks']['count'], 5)
        self.assertEqual(result['by_animal_type']['goats']['count'], 1)

        # Totals should include all contributions
        self.assertGreater(result['totals']['calories'], 0)
        self.assertGreater(result['totals']['protein_g'], 0)


if __name__ == '__main__':
    unittest.main()
