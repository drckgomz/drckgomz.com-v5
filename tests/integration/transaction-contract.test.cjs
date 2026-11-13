/* eslint-disable @typescript-eslint/no-require-imports */
// Design-contract tests ONLY. No production route uses this synthetic transaction engine.
// Real database adapters must later pass equivalent isolation/rollback tests.
const test = require('node:test');
const assert = require('node:assert/strict');
class SyntheticTransactions {
  constructor(state) { this.state = structuredClone(state); this.queue = Promise.resolve(); }
  async transaction(work) {
    const previous = this.queue; let unlock;
    this.queue = new Promise(resolve => { unlock = resolve; });
    await previous;
    try {
      const draft = structuredClone(this.state);
      const result = await work(draft);
      this.state = draft;
      return result;
    } finally { unlock(); }
  }
}
test('proposed transaction contract: failed replacement retains all original references', async () => {
  const repo = new SyntheticTransactions({ media: ['old'], revision: 1 });
  await assert.rejects(repo.transaction(async draft => { draft.media = []; throw new Error('synthetic insert failure'); }));
  assert.deepEqual(repo.state, { media: ['old'], revision: 1 });
});
test('proposed transaction contract: reorder checks one shared revision inside serialization', async () => {
  const repo = new SyntheticTransactions({ media: ['a', 'b'], revision: 1 });
  const reorder = order => repo.transaction(async draft => {
    if (draft.revision !== 1) throw new Error('conflict');
    draft.media = order; draft.revision++;
  });
  const result = await Promise.allSettled([reorder(['b', 'a']), reorder(['a', 'b'])]);
  assert.deepEqual(result.map(r => r.status), ['fulfilled', 'rejected']);
  assert.equal(repo.state.revision, 2); assert.deepEqual(repo.state.media, ['b', 'a']);
});
test('proposed transaction contract: actor revocation is checked at the write boundary', async () => {
  const repo = new SyntheticTransactions({ actorActive: true, postStatus: 'draft' });
  await repo.transaction(async draft => { draft.actorActive = false; });
  await assert.rejects(repo.transaction(async draft => { if (!draft.actorActive) throw new Error('forbidden'); draft.postStatus = 'public'; }));
  assert.equal(repo.state.postStatus, 'draft');
});
test('proposed transaction contract: competing owner removals leave one active owner', async () => {
  const repo = new SyntheticTransactions({ owners: ['a', 'b'] });
  const remove = owner => repo.transaction(async draft => {
    if (draft.owners.length <= 1) throw new Error('last owner');
    draft.owners = draft.owners.filter(id => id !== owner);
  });
  const result = await Promise.allSettled([remove('a'), remove('b')]);
  assert.equal(result.filter(r => r.status === 'fulfilled').length, 1); assert.equal(repo.state.owners.length, 1);
});
test('proposed transaction contract: failed post deletion rolls back media and parent together', async () => {
  const repo = new SyntheticTransactions({ post: 'p', media: ['a'] });
  await assert.rejects(repo.transaction(async draft => { draft.media = []; draft.post = null; throw new Error('synthetic audit failure'); }));
  assert.deepEqual(repo.state, { post: 'p', media: ['a'] });
});
