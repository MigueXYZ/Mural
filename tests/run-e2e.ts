/**
 * Mural (OrdemTools) - Master E2E Automated Test Runner
 * Executes all 5 test tiers (Features F01-F27, Boundaries, Combinations, Scenarios, Adversarial),
 * renders structured CLI matrices, and enforces strict exit code gates (0 on pass, 1 on fail).
 */

import { runSuites } from './harness';

// Import all test suites to populate registry
import './tier1_features.test';
import './tier2_boundaries.test';
import './tier3_combinations.test';
import './tier4_scenarios.test';
import './tier5_adversarial.test';
import './tier6_taiga_us.test';

async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('       MURAL (ORDEMTOOLS) - 5-TIER E2E TEST SUITE RUNNER');
  console.log('='.repeat(80));
  console.log('Starting execution of all registered test tiers...\n');

  const startTime = Date.now();
  const results = await runSuites();
  const totalDuration = Date.now() - startTime;

  console.log('-'.repeat(80));
  console.log(
    `| ${'SUITE / FEATURE GROUP'.padEnd(50)} | ${'PASS'.padStart(6)} | ${'FAIL'.padStart(6)} | ${'TIME'.padStart(8)} |`
  );
  console.log('-'.repeat(80));

  let tier1Pass = 0,
    tier1Fail = 0;
  let tier2Pass = 0,
    tier2Fail = 0;
  let tier3Pass = 0,
    tier3Fail = 0;
  let tier4Pass = 0,
    tier4Fail = 0;
  let tier5Pass = 0,
    tier5Fail = 0;

  for (const suite of results.suites) {
    const isFail = suite.failed > 0;
    const mark = isFail ? '✖' : '✔';
    const suiteLine = `${mark} ${suite.name}`;

    console.log(
      `| ${suiteLine.slice(0, 50).padEnd(50)} | ${String(suite.passed).padStart(6)} | ${String(
        suite.failed
      ).padStart(6)} | ${(suite.durationMs + 'ms').padStart(8)} |`
    );

    if (suite.name.startsWith('F0') || suite.name.startsWith('F1') || suite.name.startsWith('F2')) {
      tier1Pass += suite.passed;
      tier1Fail += suite.failed;
    } else if (suite.name.startsWith('Tier 2')) {
      tier2Pass += suite.passed;
      tier2Fail += suite.failed;
    } else if (suite.name.startsWith('Combination')) {
      tier3Pass += suite.passed;
      tier3Fail += suite.failed;
    } else if (suite.name.startsWith('Scenario')) {
      tier4Pass += suite.passed;
      tier4Fail += suite.failed;
    } else if (suite.name.startsWith('Tier 5')) {
      tier5Pass += suite.passed;
      tier5Fail += suite.failed;
    }
  }

  console.log('-'.repeat(80));

  // Tier Aggregation Summary Matrix
  console.log('\n' + '='.repeat(80));
  console.log('                 TIER AGGREGATION & VERIFICATION MATRIX');
  console.log('='.repeat(80));
  console.log(
    `  Tier 1 (Feature Contracts F01-F27) : ${tier1Pass} passed, ${tier1Fail} failed (${
      tier1Fail === 0 ? 'PASS' : 'FAIL'
    })`
  );
  console.log(
    `  Tier 2 (Boundaries & Corners)       : ${tier2Pass} passed, ${tier2Fail} failed (${
      tier2Fail === 0 ? 'PASS' : 'FAIL'
    })`
  );
  console.log(
    `  Tier 3 (Cross-Feature Combinations) : ${tier3Pass} passed, ${tier3Fail} failed (${
      tier3Fail === 0 ? 'PASS' : 'FAIL'
    })`
  );
  console.log(
    `  Tier 4 (Real-World GM Scenarios)    : ${tier4Pass} passed, ${tier4Fail} failed (${
      tier4Fail === 0 ? 'PASS' : 'FAIL'
    })`
  );
  console.log(
    `  Tier 5 (Adversarial Coverage Hard.) : ${tier5Pass} passed, ${tier5Fail} failed (${
      tier5Fail === 0 ? 'PASS' : 'FAIL'
    })`
  );
  console.log('='.repeat(80));

  // Report failures if any
  if (results.failed > 0) {
    console.log('\n' + '!'.repeat(80));
    console.log('                          TEST FAILURES DETECTED');
    console.log('!'.repeat(80));

    for (const suite of results.suites) {
      for (const testCase of suite.tests) {
        if (!testCase.passed) {
          console.log(`\n✖ [${suite.name}] > ${testCase.name}`);
          console.log(`  Error: ${testCase.error?.message || testCase.error}`);
          if (testCase.error?.stack) {
            console.log(`  Stack:\n${testCase.error.stack}`);
          }
        }
      }
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log(
    `  TOTAL TESTS: ${results.total}  |  PASSED: ${results.passed}  |  FAILED: ${results.failed}  |  DURATION: ${totalDuration}ms`
  );
  console.log('='.repeat(80));

  if (results.failed === 0) {
    console.log('\n>>> OVERALL RESULT: ALL E2E TEST TIERS PASSED PERFECTLY (100%) <<<\n');
    process.exit(0);
  } else {
    console.error(`\n>>> OVERALL RESULT: ${results.failed} TEST(S) FAILED <<<\n`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal Test Runner Execution Error:', err);
  process.exit(1);
});
