import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { startScheduler, stopScheduler } from '../../src/scheduler/index.js';

describe('Scheduler Service (FR-10)', () => {
  it('berhasil memulai dan menghentikan scheduler cron', () => {
    const task = startScheduler({
      sendFn: async () => {}
    });

    assert.ok(task);
    assert.equal(typeof task.stop, 'function');

    // Hentikan scheduler
    stopScheduler();
  });
});
