"""Slab-boundary tests against the spec §3.2.2 (UNVERIFIED) FY 2025-26 config.

Amounts in poisha. The engine must reproduce hand-computed figures exactly.
"""

import pytest

from server.services.tax.engine import compute, investment_rebate, slab_tax

# Spec slabs, poisha (৳1 = 100 poisha)
SLABS = [
    {"up_to": 350_000_00, "rate_bps": 0},
    {"up_to": 450_000_00, "rate_bps": 500},
    {"up_to": 750_000_00, "rate_bps": 1000},
    {"up_to": 1_150_000_00, "rate_bps": 1500},
    {"up_to": 1_750_000_00, "rate_bps": 2000},
    {"up_to": None, "rate_bps": 2500},
]
NO_RULES: dict = {}
THRESHOLDS: dict = {}


@pytest.mark.parametrize(
    ("taxable", "expected"),
    [
        (0, 0),
        (350_000_00, 0),                       # exactly at the 0% ceiling
        (350_000_01, 0),                       # 1 poisha in the 5% band floors to 0
        (450_000_00, 5_000_00),                # full 5% band: 1L * 5%
        (750_000_00, 35_000_00),               # + 3L * 10%
        (1_150_000_00, 95_000_00),             # + 4L * 15%
        (1_750_000_00, 215_000_00),            # + 6L * 20%
        (2_750_000_00, 465_000_00),            # + 10L * 25%
    ],
)
def test_slab_boundaries(taxable: int, expected: int):
    tax, _ = slab_tax(taxable, SLABS)
    assert tax == expected


def test_zero_band_override_widens_first_slab():
    # e.g. women / senior citizens threshold ৳4,00,000
    tax_general, _ = slab_tax(450_000_00, SLABS)
    tax_female, _ = slab_tax(450_000_00, SLABS, zero_band_override=400_000_00)
    assert tax_general == 5_000_00
    assert tax_female == 2_500_00  # only ৳50k in the 5% band


def test_salary_exemption_and_full_compute():
    rules = {
        "salary_exemption_share_bps": 3333,
        "salary_exemption_cap": 450_000_00,
        "rebate_rate_bps": 1500,
        "max_investment_share_bps": 2000,
        "max_investment": 1_000_000_00,
    }
    # ৳12,00,000 gross -> exemption = min(1/3 * 12L, 4.5L) = ৳3,99,960
    result = compute(1_200_000_00, SLABS, THRESHOLDS, rules)
    assert result.exemption == 1_200_000_00 * 3333 // 10_000
    assert result.taxable_annual == 1_200_000_00 - result.exemption
    # slab tax on ৳8,00,040: 0 + 5% * 1L + 10% * 3L + 15% * 50,040-... hand check:
    # taxable 800_040_00 -> 5% band 100_000_00 -> 5_000_00; 10% band 300_000_00
    # -> 30_000_00; 15% band 50_040_00 -> 7_506_00; total 42_506_00
    assert result.gross_tax == 42_506_00
    assert result.net_tax_annual == result.gross_tax - result.rebate
    assert result.monthly_tds == result.net_tax_annual // 12


def test_rebate_caps():
    rules = {
        "rebate_rate_bps": 1500,
        "max_investment_share_bps": 2000,   # 20% of taxable
        "max_investment": 1_000_000_00,     # ৳10 lakh absolute
    }
    taxable = 1_000_000_00
    # investment above the 20%-of-income cap: only 2L eligible -> 15% = 30k
    assert investment_rebate(taxable, 500_000_00, rules) == 30_000_00
    # small investment: fully eligible
    assert investment_rebate(taxable, 100_000_00, rules) == 15_000_00


def test_rebate_never_exceeds_tax():
    rules = {"rebate_rate_bps": 1500, "max_investment_share_bps": 10_000, "max_investment": 0}
    result = compute(
        400_000_00, SLABS, THRESHOLDS,
        {**rules}, eligible_investment=400_000_00,
    )
    assert result.rebate <= result.gross_tax
    assert result.net_tax_annual >= 0


def test_min_tax_floor():
    thresholds = {"min_tax": 5_000_00}
    result = compute(360_000_00, SLABS, thresholds, NO_RULES)
    # slab tax = 10k * 5% = ৳500 -> floored up to ৳5,000
    assert result.gross_tax == 500_00
    assert result.min_tax_applied
    assert result.net_tax_annual == 5_000_00


def test_zero_income_no_min_tax():
    thresholds = {"min_tax": 5_000_00}
    result = compute(300_000_00, SLABS, thresholds, NO_RULES)
    assert result.net_tax_annual == 0  # no tax due -> floor does not apply
