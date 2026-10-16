import pytest

from salary_compass.tax import TaxInput, compute_tax, tax_free_monthly_salary


def test_tax_free_at_50k_per_month():
    # 6,00,000 gross -> exemption 2,00,000 -> taxable 4,00,000 = general threshold
    r = compute_tax(TaxInput(annual_salary=600_000))
    assert r.taxable_income == 400_000
    assert r.net_tax == 0
    assert tax_free_monthly_salary("general") == pytest.approx(50_000)


def test_slabs_and_rebate():
    # 12,00,000 gross -> exemption 4,00,000 -> taxable 8,00,000
    # 3,00,000 @10% + 1,00,000 @15% = 45,000
    r = compute_tax(TaxInput(annual_salary=1_200_000))
    assert r.taxable_income == 800_000
    assert r.gross_tax == 45_000
    # rebate = min(3% x 8,00,000 = 24,000, 10% x 1,00,000 = 10,000, 7,50,000)
    r2 = compute_tax(TaxInput(annual_salary=1_200_000, eligible_investment=100_000))
    assert r2.rebate == 10_000
    assert r2.net_tax == 35_000
    assert r2.investment_for_max_rebate == 240_000


def test_exemption_cap_binds_for_high_salary():
    r = compute_tax(TaxInput(annual_salary=3_000_000))
    assert r.exemption == 500_000
    assert r.taxable_income == 2_500_000
    # 30k + 60k + 100k + (2.5M-0.4M-1.2M=0.9M)*25% = 415,000
    assert r.gross_tax == 415_000
    assert r.marginal_rate == 0.25


def test_minimum_tax():
    # taxable just above threshold -> tiny slab tax, floor of 5,000 applies
    r = compute_tax(TaxInput(annual_salary=610_000))
    assert r.gross_tax < 5_000
    assert r.net_tax == 5_000 and r.minimum_tax_applied
    assert compute_tax(TaxInput(annual_salary=610_000, new_taxpayer=True)).net_tax == 1_000


def test_category_thresholds():
    assert compute_tax(TaxInput(annual_salary=675_000, category="woman_or_senior")).net_tax == 0
    assert compute_tax(TaxInput(annual_salary=675_000, category="general")).net_tax > 0
    parent = compute_tax(TaxInput(annual_salary=675_000, parent_of_disabled=True))
    assert parent.threshold == 450_000


def test_rebate_never_exceeds_tax():
    r = compute_tax(TaxInput(annual_salary=640_000, eligible_investment=1_000_000))
    assert r.rebate <= r.gross_tax
