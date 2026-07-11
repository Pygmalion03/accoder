# LeetCode Sample Input Handling

## Problem

LeetCode examples use core-function notation such as `nums = [2,7,11,15], target = 9`. The practice runner executes a complete ACM program and expects plain standard input. Automatically copying the LeetCode notation into `stdin` causes readers such as Java `Scanner.nextInt()` to fail before the user's algorithm runs.

## Design

- Keep the original LeetCode example in the full problem statement.
- Do not automatically load a sample from a LeetCode memory page into executable `stdin` or expected output.
- Leave both test fields empty for a new LeetCode memory workspace and when its sample-load button is pressed.
- Show a short message explaining that the example is not ACM standard input and must be entered according to the program's read order.
- Preserve manually edited workspace input. If an old workspace cache exactly matches the stored LeetCode example, treat it as stale automatic input and clear it once.
- Preserve existing automatic sample loading for seed problems and any problem with explicit ACM test cases.

## Boundary

This change does not attempt to convert arbitrary LeetCode examples into ACM input. The runner, captured statement, and stored sample data remain unchanged; only the practice view decides whether the stored example is executable.

## Verification

- A LeetCode memory problem leaves `stdin` and expected output empty and returns the explanatory message.
- A seed problem still restores its first ACM test case.
- The full web and server test suites continue to pass.
