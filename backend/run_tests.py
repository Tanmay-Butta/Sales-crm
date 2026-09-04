"""
Sales CRM - Master Test Runner
Executes automated test suites for Goals 1 through 10 as specified in README.md.
"""

import sys
import os
import time
import unittest

# Ensure backend root is on sys.path
backend_dir = os.path.abspath(os.path.dirname(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)


def run_all_goals():
    print("=" * 75)
    print(" SALES CRM - AUTOMATED TEST SUITE (GOALS 1 THROUGH 10)")
    print("=" * 75)

    test_modules = [
        ("Goal 1: Accounts and Roles", "tests.test_goal1_accounts_roles"),
        ("Goal 2: Companies", "tests.test_goal2_companies"),
        ("Goal 3: Deals inside Companies", "tests.test_goal3_deals"),
        ("Goal 4: Deal Lifecycle with Rules", "tests.test_goal4_lifecycle"),
        ("Goal 5: Collaborators", "tests.test_goal5_collaborators"),
        ("Goal 6: Finding Deals (Search, Filter, Sort, Paginate)", "tests.test_goal6_search_pagination"),
        ("Goal 7: Acting on Many Deals at Once & CSV Export", "tests.test_goal7_bulk_and_export"),
        ("Goal 8: Dashboard Metrics & Charts", "tests.test_goal8_dashboard"),
        ("Goal 9: History You Cannot Rewrite", "tests.test_goal9_history_audit"),
        ("Goal 10: Past-Due Deal Alerts", "tests.test_goal10_alerts"),
    ]

    loader = unittest.TestLoader()
    total_passed = 0
    total_run = 0
    all_success = True
    start_time = time.time()

    for goal_title, module_name in test_modules:
        print(f"\n--- Running {goal_title} ---")
        suite = loader.loadTestsFromName(module_name)
        runner = unittest.TextTestRunner(verbosity=1)
        res = runner.run(suite)
        total_run += res.testsRun
        if not res.wasSuccessful():
            all_success = False
            print(f"[FAIL] {goal_title} had {len(res.failures)} failures and {len(res.errors)} errors.")
        else:
            total_passed += res.testsRun
            print(f"[PASS] {goal_title} - {res.testsRun}/{res.testsRun} tests passed.")

    duration = time.time() - start_time
    print("\n" + "=" * 75)
    print(f" SUMMARY: Ran {total_run} tests across all 10 goals in {duration:.2f}s")
    if all_success:
        print(" ALL GOAL 1-10 TEST CASES PASSED SUCCESSFULLY (100% PASS RATE)!")
        print("=" * 75)
        sys.exit(0)
    else:
        print(" SOME TESTS FAILED. See details above.")
        print("=" * 75)
        sys.exit(1)


if __name__ == '__main__':
    run_all_goals()
