import * as assert from 'assert';
import * as sinon from 'sinon';
import { isCancellationError } from '../../cancellation.js';
import { gate } from '../gate.js';

suite('Gate Test Suite', () => {
	test('timeout rejects the caller but keeps the gate held on the in-flight op (no duplicate execution)', async () => {
		const clock = sinon.useFakeTimers();
		try {
			let executionCount = 0;

			class TestClass {
				@gate(undefined, { timeout: 50 })
				async method(): Promise<number> {
					const count = ++executionCount;
					// First call takes longer than the 50ms timeout; later calls complete quickly
					await new Promise(resolve => setTimeout(resolve, count === 1 ? 200 : 10));
					return count;
				}
			}

			const instance = new TestClass();

			const p1 = instance.method();
			// Attach the rejection assertion before the timeout fires (avoids unhandled rejection)
			const rejection = assert.rejects(
				p1,
				err => isCancellationError(err) && err.message.includes('Gate timeout'),
			);

			await clock.tickAsync(50);
			// Caller-facing promise honors the timeout/reject semantics
			await rejection;

			// The in-flight (non-cancellable) op is still running: a new call must JOIN it,
			// not start a duplicate execution
			const p2 = instance.method();
			await clock.tickAsync(150);
			assert.strictEqual(executionCount, 1, 'gate must not be cleared while the op is still in-flight');
			assert.strictEqual(await p2, 1, 'joining call should get the real result of the in-flight op');

			// Once the op settled, the gate is released and a fresh call runs
			const p3 = instance.method();
			await clock.tickAsync(10);
			assert.strictEqual(executionCount, 2);
			assert.strictEqual(await p3, 2);
		} finally {
			clock.restore();
		}
	});

	test('rejectOnTimeout:false retries only after the in-flight op settles and keeps the gate held through the retry', async () => {
		const clock = sinon.useFakeTimers();
		try {
			let executionCount = 0;
			let activeCount = 0;
			let maxActive = 0;

			class TestClass {
				@gate(undefined, { timeout: 50, rejectOnTimeout: false })
				async method(): Promise<number> {
					const count = ++executionCount;
					activeCount++;
					maxActive = Math.max(maxActive, activeCount);
					await new Promise(resolve => setTimeout(resolve, 200));
					activeCount--;
					return count;
				}
			}

			const instance = new TestClass();

			const p1 = instance.method();

			await clock.tickAsync(50);
			// Timeout fired, but no retry yet: the in-flight op is still running
			assert.strictEqual(executionCount, 1, 'retry must not start while the in-flight op is still running');

			await clock.tickAsync(150);
			// In-flight op settled at t=200; only now does the retry start
			assert.strictEqual(executionCount, 2, 'retry must start only after the in-flight op settles');

			// Gate stays held through the retry: a concurrent call joins it instead of duplicating
			const p3 = instance.method();
			await clock.tickAsync(200);
			assert.strictEqual(executionCount, 2, 'call during retry must join the retry, not start a third execution');

			assert.strictEqual(await p1, 2, 'timed-out caller should get the retry result');
			assert.strictEqual(await p3, 2);

			// The retry never ran concurrently with the (non-cancellable) original op
			assert.strictEqual(maxActive, 1, 'original op and retry must never overlap');
		} finally {
			clock.restore();
		}
	});

	test('rejectOnTimeout:false does not retry when the op completes before the timeout', async () => {
		const clock = sinon.useFakeTimers();
		try {
			let executionCount = 0;

			class TestClass {
				@gate(undefined, { timeout: 500, rejectOnTimeout: false })
				async method(): Promise<number> {
					executionCount++;
					await new Promise(resolve => setTimeout(resolve, 10));
					return executionCount;
				}
			}

			const instance = new TestClass();

			const p1 = instance.method();
			await clock.tickAsync(10);
			assert.strictEqual(await p1, 1);

			await clock.tickAsync(500);
			assert.strictEqual(executionCount, 1, 'no retry when the op completed before the timeout');
		} finally {
			clock.restore();
		}
	});
});
