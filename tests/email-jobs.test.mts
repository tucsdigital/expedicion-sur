import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EMAIL_JOB_STALE_SENDING_MS,
  isEmailJobEligibleForProcessing,
} from '../lib/sales/email-jobs.ts';

const now = Date.parse('2026-10-22T12:00:00.000Z');

test('procesa emails pendientes o fallidos cuando llegó su próximo intento', () => {
  assert.equal(
    isEmailJobEligibleForProcessing({ status: 'pending', nextAttemptAt: new Date(now - 1) }, now),
    true
  );
  assert.equal(
    isEmailJobEligibleForProcessing({ status: 'failed', nextAttemptAt: { seconds: now / 1000 } }, now),
    true
  );
  assert.equal(
    isEmailJobEligibleForProcessing({ status: 'pending', nextAttemptAt: new Date(now + 1000) }, now),
    false
  );
});

test('no vuelve a tomar un email que sigue enviándose, pero recupera uno atascado', () => {
  assert.equal(
    isEmailJobEligibleForProcessing({
      status: 'sending',
      nextAttemptAt: new Date(now - EMAIL_JOB_STALE_SENDING_MS * 2),
      updatedAt: new Date(now - EMAIL_JOB_STALE_SENDING_MS + 1000),
    }, now),
    false
  );
  assert.equal(
    isEmailJobEligibleForProcessing({
      status: 'sending',
      nextAttemptAt: new Date(now - EMAIL_JOB_STALE_SENDING_MS * 2),
      updatedAt: new Date(now - EMAIL_JOB_STALE_SENDING_MS - 1000),
    }, now),
    true
  );
});
