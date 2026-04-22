"""
Tests for `sfg_spacing.get_sfg_cells_required` resolver.

Covers the three lookup passes (exact, prefix, iterative multi-segment strip)
and their interaction with the numeric variant-suffix stripper. Added
2026-04-22 alongside the Group E fix (multi-segment IDs like
`shallot-from-seed` need to resolve even when the table has only the base
entry).
"""

from sfg_spacing import get_sfg_cells_required


class TestDigitSuffixStripping:
    """Variant suffixes like '-1' are stripped to the base plant."""

    def test_tomato_1_strips_to_tomato(self):
        # tomato is in the 1-per-square bucket.
        assert get_sfg_cells_required('tomato-1') == 1.0

    def test_carrot_1_strips_to_carrot(self):
        # carrot is in the 16-per-square bucket.
        assert get_sfg_cells_required('carrot-1') == 1.0 / 16

    def test_lettuce_head_1_strips_only_trailing_digit(self):
        # 'lettuce-head' is in the 1-per-square bucket. The digit stripper must
        # NOT turn 'lettuce-head-1' into 'lettuce' (which is in the 4-per-square
        # bucket — wrong lookup).
        assert get_sfg_cells_required('lettuce-head-1') == 1.0


class TestExactAndPrefixMatching:
    """Direct base lookups; prefix only fires on base-prefix patterns."""

    def test_bean_resolves_to_9_bucket(self):
        # Added 2026-04-22: previously fell through to bean-pole (8/square).
        assert get_sfg_cells_required('bean') == 1.0 / 9

    def test_bean_1_resolves_to_9_bucket(self):
        # Same fix — post-strip base is 'bean', now an explicit 9/square entry.
        assert get_sfg_cells_required('bean-1') == 1.0 / 9

    def test_unknown_plant_defaults_to_one_cell(self):
        assert get_sfg_cells_required('made-up-plant-xyz') == 1.0


class TestMultiSegmentFallback:
    """Iterative segment-strip fallback for multi-segment IDs."""

    def test_shallot_from_seed_hits_explicit_entry(self):
        # Added 2026-04-22 to the 4-per-square bucket directly.
        assert get_sfg_cells_required('shallot-from-seed') == 1.0 / 4

    def test_shallot_from_sets_hits_explicit_entry(self):
        assert get_sfg_cells_required('shallot-from-sets') == 1.0 / 4

    def test_iterative_strip_falls_back_to_base_plant(self):
        # Hypothetical ID not explicitly listed: strip trailing segments until
        # we find a base-plant entry. 'shallot-from-something-unknown' is not
        # in the table, so the fallback strips to 'shallot-from-something' →
        # 'shallot-from' (no match) → 'shallot' (match, 4/square bucket).
        assert get_sfg_cells_required('shallot-from-something-unknown') == 1.0 / 4

    def test_digit_plus_multi_segment_combo(self):
        # 'shallot-from-seed-1' → digit stripper yields 'shallot-from-seed' →
        # exact match on explicit entry.
        assert get_sfg_cells_required('shallot-from-seed-1') == 1.0 / 4
