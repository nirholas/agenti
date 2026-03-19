import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMatrixEditContent, buildMatrixTextContent } from '../src/channels/matrix/index.ts';

test('buildMatrixTextContent returns plain text body', () => {
  const content = buildMatrixTextContent('hello');
  assert.equal(content.msgtype, 'm.text');
  assert.equal(content.body, 'hello');
  assert.ok(!('formatted_body' in content));
});

test('buildMatrixTextContent returns formatted body for markdown', () => {
  const content = buildMatrixTextContent('**bold**');
  assert.equal(content.msgtype, 'm.text');
  assert.equal(content.body, '**bold**');
  assert.equal(content.format, 'org.matrix.custom.html');
  assert.equal(content.formatted_body, '<strong>bold</strong>');
});

test('buildMatrixEditContent wraps replace relation', () => {
  const content = buildMatrixEditContent('updated', 'event-123');
  assert.equal(content.msgtype, 'm.text');
  assert.equal(content.body, '* updated');
  assert.deepEqual(content['m.relates_to'], {
    rel_type: 'm.replace',
    event_id: 'event-123',
  });
  assert.deepEqual(content['m.new_content'], buildMatrixTextContent('updated'));
});
