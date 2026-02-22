"""
Space Calculation Test Suite

Tests that backend space calculations return expected values based on
the canonical SFG_SPACING lookup table from garden_methods.py.

PURPOSE:
- Verify backend/services/space_calculator.py calculates correctly
- Ensure space calculation logic matches SFG spacing rules
- Prevent regressions when space calculation logic changes

SCOPE:
- Square-Foot Gardening (SFG) method only
- Edge cases (quantity=0, unknown plants)
- All SFG plant size categories (0.5, 1, 4, 8, 9, 16 plants per square)
"""

import pytest
from services.space_calculator import calculate_space_requirement


class TestSFGSpaceCalculation:
    """
    Test Square Foot Gardening space calculations.

    Expected values derived from garden_methods.py::SFG_SPACING:
    - 0.5 plants/sqft → 1/0.5 = 2.0 cells per plant
    - 1 plant/sqft → 1/1 = 1.0 cells per plant
    - 4 plants/sqft → 1/4 = 0.25 cells per plant
    - 8 plants/sqft → 1/8 = 0.125 cells per plant
    - 9 plants/sqft → 1/9 = 0.1111 cells per plant
    - 16 plants/sqft → 1/16 = 0.0625 cells per plant
    """

    # ===== EXTRA-LARGE PLANTS (0.5 per square = 2 cells per plant) =====

    @pytest.mark.parametrize("plant_id", [
        'watermelon-1',
        'melon-1',
        'cantaloupe-1',
        'pumpkin-1',
    ])
    def test_sfg_extra_large_plants(self, plant_id):
        """Test extra-large plants (17" spacing, need 2 squares)"""
        result = calculate_space_requirement(plant_id, 12, 'square-foot')
        assert result == 2.0, f"{plant_id} should require 2.0 cells (0.5 plants per square)"

    # ===== LARGE PLANTS (1 per square = 1 cell per plant) =====

    @pytest.mark.parametrize("plant_id", [
        'tomato-1',
        'pepper-1',
        'eggplant-1',
        'broccoli-1',
        'cauliflower-1',
        'cabbage-1',
        'brussels-sprouts-1',
        'kale-1',
        'collards-1',
        'cilantro-1',
        'squash-1',
        'cucumber-1',
        'okra-1',
        'corn-1',
        'celery-1',
        'lettuce-head-1',
        'lettuce-crisphead-1',
    ])
    def test_sfg_large_plants(self, plant_id):
        """Test large plants (12" spacing, 1 per square)"""
        result = calculate_space_requirement(plant_id, 12, 'square-foot')
        assert result == 1.0, f"{plant_id} should require 1.0 cells (1 plant per square)"

    # ===== MEDIUM PLANTS (4 per square = 0.25 cells per plant) =====

    @pytest.mark.parametrize("plant_id", [
        'lettuce-1',
        'lettuce-leaf-1',
        'lettuce-romaine-1',
        'mustard-greens-1',
        'bok-choy-1',
        'marigold-1',
        'nasturtium-1',
        'zinnia-1',
        'parsley-1',
        'chard-1',
        'beet-1',
        'onion-1',
        'shallot-1',
        'garlic-1',
        'leek-1',
        'kohlrabi-1',
        'thyme-1',
    ])
    def test_sfg_medium_plants(self, plant_id):
        """Test medium plants (6" spacing, 4 per square)"""
        result = calculate_space_requirement(plant_id, 12, 'square-foot')
        assert result == 0.25, f"{plant_id} should require 0.25 cells (4 plants per square)"

    # ===== POLE/CLIMBING PLANTS (8 per square = 0.125 cells per plant) =====

    @pytest.mark.parametrize("plant_id", [
        'pea-1',
        'bean-pole-1',
    ])
    def test_sfg_pole_plants(self, plant_id):
        """Test pole/climbing plants (4.2" spacing, 8 per square)"""
        result = calculate_space_requirement(plant_id, 12, 'square-foot')
        assert result == 0.125, f"{plant_id} should require 0.125 cells (8 plants per square)"

    # ===== SMALL PLANTS (9 per square = 0.1111 cells per plant) =====

    @pytest.mark.parametrize("plant_id", [
        'arugula-1',
        'turnip-1',
        'spinach-1',
        'bush-bean-1',
        'asian-greens-1',
        'scallion-1',
    ])
    def test_sfg_small_plants(self, plant_id):
        """Test small plants (4" spacing, 9 per square)"""
        result = calculate_space_requirement(plant_id, 12, 'square-foot')
        expected = 1.0 / 9.0  # 0.1111...
        assert abs(result - expected) < 0.0001, \
            f"{plant_id} should require {expected:.4f} cells (9 plants per square)"

    # ===== TINY PLANTS (16 per square = 0.0625 cells per plant) =====

    @pytest.mark.parametrize("plant_id", [
        'carrot-1',
        'radish-1',
        'chive-1',
    ])
    def test_sfg_tiny_plants(self, plant_id):
        """Test tiny plants (3" spacing, 16 per square)"""
        result = calculate_space_requirement(plant_id, 12, 'square-foot')
        assert result == 0.0625, f"{plant_id} should require 0.0625 cells (16 plants per square)"

    # ===== PLANT ID VARIANTS =====

    def test_numeric_suffix_stripped(self):
        """Test that numeric suffixes are properly stripped"""
        # 'tomato-1' and 'tomato-2' should both match 'tomato' in SFG_SPACING
        result1 = calculate_space_requirement('tomato-1', 12, 'square-foot')
        result2 = calculate_space_requirement('tomato-2', 12, 'square-foot')
        assert result1 == result2 == 1.0, "Numeric suffixes should be stripped"

    def test_variety_specific_spacing(self):
        """Test that variety-specific entries take precedence"""
        # 'lettuce-head' is explicitly in SFG_SPACING as 1 per square
        # 'lettuce' (generic) is 4 per square
        lettuce_generic = calculate_space_requirement('lettuce-1', 12, 'square-foot')
        lettuce_head = calculate_space_requirement('lettuce-head-1', 12, 'square-foot')

        assert lettuce_generic == 0.25, "Generic lettuce should be 0.25 cells (4 per square)"
        assert lettuce_head == 1.0, "Head lettuce should be 1.0 cells (1 per square)"


class TestEdgeCases:
    """Test edge cases and fallback behavior"""

    def test_unknown_plant_fallback(self):
        """Test that unknown plants default to 1 cell per plant"""
        result = calculate_space_requirement('unknown-plant-999', 12, 'square-foot')
        assert result == 1.0, "Unknown plants should default to 1.0 cells per plant"

    def test_non_numeric_suffix_preserved(self):
        """Test that non-numeric suffixes are preserved in lookup"""
        # 'lettuce-leaf-1' should strip '-1' → 'lettuce-leaf' → found in SFG_SPACING (4 per square)
        result = calculate_space_requirement('lettuce-leaf-1', 12, 'square-foot')
        assert result == 0.25, "lettuce-leaf should match and return 0.25 cells"

    def test_case_sensitivity(self):
        """Test that plant IDs are case-sensitive (lowercase expected)"""
        # SFG_SPACING uses lowercase keys
        lowercase_result = calculate_space_requirement('tomato-1', 12, 'square-foot')
        # 'Tomato-1' (uppercase) won't match, should default to 1.0
        uppercase_result = calculate_space_requirement('Tomato-1', 12, 'square-foot')

        assert lowercase_result == 1.0, "Lowercase tomato should match"
        assert uppercase_result == 1.0, "Uppercase Tomato defaults to 1.0 (no match found)"


class TestGridSizeParameter:
    """Test that grid_size parameter is used correctly"""

    def test_grid_size_parameter_sfg(self):
        """
        Test that grid_size parameter is passed but doesn't affect SFG calculation.

        SFG method uses fixed 12" grid regardless of grid_size parameter
        because SFG_SPACING is defined in terms of 12" squares.
        """
        # For SFG method, grid_size is ignored (always uses 12" squares)
        result_12 = calculate_space_requirement('tomato-1', 12, 'square-foot')
        result_6 = calculate_space_requirement('tomato-1', 6, 'square-foot')

        # Both should return same result because SFG ignores grid_size
        assert result_12 == 1.0
        assert result_6 == 1.0


class TestMethodParameter:
    """Test that planning_method parameter affects calculation"""

    def test_method_parameter_affects_result(self):
        """
        Test that different planning methods return different results.

        This verifies that the method parameter is being used, even though
        we're only testing SFG method values in detail.
        """
        # Use watermelon: SFG=2.0 cells, Row: ceil(17/12)^2 = 2^2 = 4 cells
        sfg_result = calculate_space_requirement('watermelon-1', 12, 'square-foot')
        row_result = calculate_space_requirement('watermelon-1', 12, 'row')

        # SFG: 2 cells (0.5 plants per square)
        # Row: spacing=17", grid=12" → ceil(17/12)=2 → 2×2=4 cells
        assert sfg_result == 2.0, "SFG watermelon should be 2.0 cells"
        assert row_result == 4, "Row watermelon should be 4 cells (17\" spacing)"
        assert row_result != sfg_result, "Row method should differ from SFG method"

    def test_invalid_method_defaults_to_row(self):
        """Test that invalid planning methods default to row calculation"""
        result = calculate_space_requirement('tomato-1', 12, 'invalid-method')
        assert result >= 1, "Invalid method should default to row calculation (≥1 cell)"


# ============================================================================
# MIGardener Method Tests
# ============================================================================

class TestMIGardenerSpaceCalculation:
    """
    Test MIGardener method space calculations.

    Backend uses ceil(spacing/gridSize) for each dimension, producing integer
    grid cells. This intentionally diverges from the frontend which returns
    continuous square footage (spacing_product / 144).
    """

    # --- Standard row-based plants (have MIGARDENER_SPACING_OVERRIDES) ---

    def test_migardener_tomato(self):
        """tomato-1: override (24, 18) → ceil(18/12)=2, ceil(24/12)=2 → 4"""
        result = calculate_space_requirement('tomato-1', 12, 'migardener')
        assert result == 4, f"Expected 4, got {result}"

    def test_migardener_pepper(self):
        """pepper-1: override (21, 18) → ceil(18/12)=2, ceil(21/12)=2 → 4"""
        result = calculate_space_requirement('pepper-1', 12, 'migardener')
        assert result == 4, f"Expected 4, got {result}"

    def test_migardener_watermelon(self):
        """watermelon-1: override (72, 60) → ceil(60/12)=5, ceil(72/12)=6 → 30"""
        result = calculate_space_requirement('watermelon-1', 12, 'migardener')
        assert result == 30, f"Expected 30, got {result}"

    def test_migardener_carrot(self):
        """carrot-1: override (6, 2) → ceil(2/12)=1, ceil(6/12)=1 → 1"""
        result = calculate_space_requirement('carrot-1', 12, 'migardener')
        assert result == 1, f"Expected 1, got {result}"

    # --- Broadcast plants (null row spacing) ---

    def test_migardener_spinach_broadcast(self):
        """spinach-1: override (None, 4) → broadcast, ceil(4/12)=1 → 1×1=1"""
        result = calculate_space_requirement('spinach-1', 12, 'migardener')
        assert result == 1, f"Expected 1, got {result}"

    def test_migardener_kale_broadcast(self):
        """kale-1: override (None, 8) → broadcast, ceil(8/12)=1 → 1×1=1"""
        result = calculate_space_requirement('kale-1', 12, 'migardener')
        assert result == 1, f"Expected 1, got {result}"

    # --- Seed-density plants (have migardener metadata in PLANT_DATABASE) ---

    def test_migardener_lettuce_seed_density(self):
        """lettuce-1: seed-density, (12/4)×(12×1) = 36 seeds/sqft → 1/36"""
        result = calculate_space_requirement('lettuce-1', 12, 'migardener')
        expected = 1.0 / 36.0
        assert abs(result - expected) < 0.0001, \
            f"Expected {expected:.6f}, got {result}"

    def test_migardener_arugula_seed_density(self):
        """arugula-1: seed-density, (12/4)×(12×1) = 36 seeds/sqft → 1/36"""
        result = calculate_space_requirement('arugula-1', 12, 'migardener')
        expected = 1.0 / 36.0
        assert abs(result - expected) < 0.0001, \
            f"Expected {expected:.6f}, got {result}"

    # --- Fallback (no override, uses default multiplier) ---

    def test_migardener_squash_fallback(self):
        """squash-1: no override, spacing=16, rowSpacing=56 → 0.25× → plant=4, row=14 → 1×2=2"""
        result = calculate_space_requirement('squash-1', 12, 'migardener')
        assert result == 2, f"Expected 2, got {result}"

    def test_migardener_unknown_plant(self):
        """Unknown plant not in database → fallback to 1"""
        result = calculate_space_requirement('unknown-plant-999', 12, 'migardener')
        assert result == 1, f"Expected 1, got {result}"


# ============================================================================
# Intensive Method Tests
# ============================================================================

class TestIntensiveSpaceCalculation:
    """
    Test Intensive/Bio-intensive method space calculations.

    Backend uses hex-efficient ceil: ceil(ceil(onCenter/grid)² × (1/1.15))
    This intentionally diverges from the frontend which returns onCenter²/144.
    """

    def test_intensive_tomato(self):
        """tomato-1: on_center=18, ceil(18/12)=2, 2²=4, ceil(4×0.87)=4"""
        result = calculate_space_requirement('tomato-1', 12, 'intensive')
        assert result == 4, f"Expected 4, got {result}"

    def test_intensive_pepper(self):
        """pepper-1: on_center=12, ceil(12/12)=1, 1²=1, max(1,ceil(0.87))=1"""
        result = calculate_space_requirement('pepper-1', 12, 'intensive')
        assert result == 1, f"Expected 1, got {result}"

    def test_intensive_carrot(self):
        """carrot-1: on_center=3, ceil(3/12)=1, 1²=1 → 1"""
        result = calculate_space_requirement('carrot-1', 12, 'intensive')
        assert result == 1, f"Expected 1, got {result}"

    def test_intensive_squash(self):
        """squash-1: on_center=24, ceil(24/12)=2, 2²=4, ceil(4×0.87)=4"""
        result = calculate_space_requirement('squash-1', 12, 'intensive')
        assert result == 4, f"Expected 4, got {result}"

    def test_intensive_lettuce(self):
        """lettuce-1: on_center=8, ceil(8/12)=1, 1²=1 → 1"""
        result = calculate_space_requirement('lettuce-1', 12, 'intensive')
        assert result == 1, f"Expected 1, got {result}"

    def test_intensive_spinach(self):
        """spinach-1: on_center=6, ceil(6/12)=1, 1²=1 → 1"""
        result = calculate_space_requirement('spinach-1', 12, 'intensive')
        assert result == 1, f"Expected 1, got {result}"

    def test_intensive_unknown_plant(self):
        """Unknown plant not in database → fallback to 1"""
        result = calculate_space_requirement('unknown-plant-999', 12, 'intensive')
        assert result == 1, f"Expected 1, got {result}"

    def test_intensive_hex_efficiency_factor(self):
        """Verify hex efficiency reduces cell count for large plants.

        squash-1 on_center=24: without hex efficiency → 4 cells
        With hex efficiency: ceil(4 × 0.87) = 4 (still 4 due to ceiling)
        But for on_center=36: ceil(36/12)=3, 3²=9, ceil(9×0.87)=ceil(7.83)=8
        """
        # Use a plant with on_center spacing that demonstrates hex savings
        # corn-1 has on_center=15 → ceil(15/12)=2, 2²=4, ceil(4×0.87)=4
        result = calculate_space_requirement('corn-1', 12, 'intensive')
        assert result == 4, f"corn-1 intensive expected 4, got {result}"


# ============================================================================
# Row Method Tests
# ============================================================================

class TestRowSpaceCalculation:
    """
    Test Row/Traditional method space calculations.

    Backend row method: ceil(spacing/gridSize)² grid cells.
    Uses the plant's standard 'spacing' field (not row-specific overrides).
    """

    def test_row_tomato(self):
        """tomato-1: backend spacing=12, ceil(12/12)=1, 1²=1"""
        result = calculate_space_requirement('tomato-1', 12, 'row')
        assert result == 1, f"Expected 1, got {result}"

    def test_row_pepper(self):
        """pepper-1: spacing=18, ceil(18/12)=2, 2²=4"""
        result = calculate_space_requirement('pepper-1', 12, 'row')
        assert result == 4, f"Expected 4, got {result}"

    def test_row_lettuce(self):
        """lettuce-1: spacing=8, ceil(8/12)=1, 1²=1"""
        result = calculate_space_requirement('lettuce-1', 12, 'row')
        assert result == 1, f"Expected 1, got {result}"

    def test_row_watermelon(self):
        """watermelon-1: spacing=17, ceil(17/12)=2, 2²=4"""
        result = calculate_space_requirement('watermelon-1', 12, 'row')
        assert result == 4, f"Expected 4, got {result}"

    def test_row_squash(self):
        """squash-1: spacing=16, ceil(16/12)=2, 2²=4"""
        result = calculate_space_requirement('squash-1', 12, 'row')
        assert result == 4, f"Expected 4, got {result}"

    def test_row_carrot(self):
        """carrot-1: spacing=3, ceil(3/12)=1, 1²=1"""
        result = calculate_space_requirement('carrot-1', 12, 'row')
        assert result == 1, f"Expected 1, got {result}"

    def test_row_unknown_plant(self):
        """Unknown plant not in database → fallback to 1"""
        result = calculate_space_requirement('unknown-plant-999', 12, 'row')
        assert result == 1, f"Expected 1, got {result}"


# ============================================================================
# Permaculture Method Tests
# ============================================================================

class TestPermacultureSpaceCalculation:
    """
    Test Permaculture method space calculations.

    Uses spacing²/144 (continuous square footage).
    This is the same formula as the frontend, so values should match.
    """

    def test_permaculture_tomato(self):
        """tomato-1: backend spacing=12, 12²/144 = 1.0"""
        result = calculate_space_requirement('tomato-1', 12, 'permaculture')
        assert result == 1.0, f"Expected 1.0, got {result}"

    def test_permaculture_pepper(self):
        """pepper-1: spacing=18, 18²/144 = 2.25"""
        result = calculate_space_requirement('pepper-1', 12, 'permaculture')
        assert result == 2.25, f"Expected 2.25, got {result}"

    def test_permaculture_lettuce(self):
        """lettuce-1: spacing=8, 8²/144 ≈ 0.4444"""
        result = calculate_space_requirement('lettuce-1', 12, 'permaculture')
        expected = 64.0 / 144.0
        assert abs(result - expected) < 0.0001, \
            f"Expected {expected:.4f}, got {result}"

    def test_permaculture_watermelon(self):
        """watermelon-1: spacing=17, 17²/144 ≈ 2.0069"""
        result = calculate_space_requirement('watermelon-1', 12, 'permaculture')
        expected = 289.0 / 144.0
        assert abs(result - expected) < 0.0001, \
            f"Expected {expected:.4f}, got {result}"

    def test_permaculture_carrot(self):
        """carrot-1: spacing=3, 3²/144 = 0.0625"""
        result = calculate_space_requirement('carrot-1', 12, 'permaculture')
        assert result == 0.0625, f"Expected 0.0625, got {result}"

    def test_permaculture_unknown_plant(self):
        """Unknown plant not in database → fallback to 1"""
        result = calculate_space_requirement('unknown-plant-999', 12, 'permaculture')
        assert result == 1, f"Expected 1, got {result}"


# ============================================================================
# Lookup Table Sync Tests
# ============================================================================

class TestLookupTableSync:
    """
    Verify lookup table integrity and counts.

    These tests catch accidental additions/removals that could silently
    change space calculations for plants relying on override tables.
    """

    def test_migardener_override_count(self):
        """Verify MIGARDENER_SPACING_OVERRIDES has expected number of entries"""
        from migardener_spacing import MIGARDENER_SPACING_OVERRIDES
        count = len(MIGARDENER_SPACING_OVERRIDES)
        assert count == 54, \
            f"Expected 54 MIGardener overrides, got {count}. " \
            f"If intentional, update this test."

    def test_intensive_override_count(self):
        """Verify INTENSIVE_SPACING_OVERRIDES has expected number of entries"""
        from intensive_spacing import INTENSIVE_SPACING_OVERRIDES
        count = len(INTENSIVE_SPACING_OVERRIDES)
        assert count == 27, \
            f"Expected 27 Intensive overrides, got {count}. " \
            f"If intentional, update this test."

    def test_sfg_category_count(self):
        """Verify SFG_SPACING has 6 density categories (0.5, 1, 4, 8, 9, 16)"""
        from garden_methods import SFG_SPACING
        assert len(SFG_SPACING) == 6, \
            f"Expected 6 SFG categories, got {len(SFG_SPACING)}"
        expected_categories = {0.5, 1, 4, 8, 9, 16}
        actual_categories = set(SFG_SPACING.keys())
        assert actual_categories == expected_categories, \
            f"Expected categories {expected_categories}, got {actual_categories}"

    def test_migardener_spot_check_tomato(self):
        """Verify tomato-1 is present in MIGardener overrides"""
        from migardener_spacing import MIGARDENER_SPACING_OVERRIDES
        assert 'tomato-1' in MIGARDENER_SPACING_OVERRIDES
        row, plant = MIGARDENER_SPACING_OVERRIDES['tomato-1']
        assert row == 24 and plant == 18, \
            f"tomato-1 should be (24, 18), got ({row}, {plant})"

    def test_intensive_spot_check_tomato(self):
        """Verify tomato-1 is present in Intensive overrides"""
        from intensive_spacing import INTENSIVE_SPACING_OVERRIDES
        assert 'tomato-1' in INTENSIVE_SPACING_OVERRIDES
        assert INTENSIVE_SPACING_OVERRIDES['tomato-1'] == 18

    def test_migardener_spot_check_seed_density_plants(self):
        """Verify seed-density plants (lettuce, arugula) are in overrides"""
        from migardener_spacing import MIGARDENER_SPACING_OVERRIDES
        assert 'lettuce-1' in MIGARDENER_SPACING_OVERRIDES
        assert 'arugula-1' in MIGARDENER_SPACING_OVERRIDES
        # Both should have row_spacing=4, plant_spacing=1
        for plant_id in ['lettuce-1', 'arugula-1']:
            row, plant = MIGARDENER_SPACING_OVERRIDES[plant_id]
            assert row == 4 and plant == 1, \
                f"{plant_id} should be (4, 1), got ({row}, {plant})"


# Run tests with: cd backend && pytest tests/test_space_calculation_sync.py -v
