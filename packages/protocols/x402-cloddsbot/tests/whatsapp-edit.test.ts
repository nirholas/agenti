import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWhatsAppJid,
  buildWhatsAppMessageKey,
  buildWhatsAppReaction,
  buildWhatsAppPollPayload,
  WHATSAPP_POLL_MAX_OPTIONS,
  normalizeWhatsAppGroupJid,
  normalizeWhatsAppUserId,
} from '../src/channels/whatsapp/index.ts';

test('buildWhatsAppJid appends WhatsApp domain', () => {
  assert.equal(buildWhatsAppJid('1234567890'), '1234567890@s.whatsapp.net');
  assert.equal(buildWhatsAppJid('123@s.whatsapp.net'), '123@s.whatsapp.net');
});

test('buildWhatsAppMessageKey sets fromMe and ids', () => {
  const key = buildWhatsAppMessageKey('123@s.whatsapp.net', 'abc');
  assert.equal(key.remoteJid, '123@s.whatsapp.net');
  assert.equal(key.id, 'abc');
  assert.equal(key.fromMe, true);
});

test('buildWhatsAppMessageKey supports participant + fromMe override', () => {
  const key = buildWhatsAppMessageKey('123@g.us', 'abc', { fromMe: false, participant: '555@s.whatsapp.net' });
  assert.equal(key.remoteJid, '123@g.us');
  assert.equal(key.fromMe, false);
  assert.equal(key.participant, '555@s.whatsapp.net');
});

test('buildWhatsAppReaction builds remove payload', () => {
  const reaction = buildWhatsAppReaction('123@s.whatsapp.net', 'abc', '👍', true);
  assert.equal(reaction.text, '');
  assert.equal(reaction.key?.id, 'abc');
});

test('buildWhatsAppPollPayload trims options and clamps count', () => {
  const poll = buildWhatsAppPollPayload('Question', [' yes ', 'no', ''], true);
  assert.equal(poll.name, 'Question');
  assert.equal(poll.values.length, 2);
  assert.equal(poll.selectableCount, 2);

  const many = Array.from({ length: WHATSAPP_POLL_MAX_OPTIONS + 2 }, (_, i) => `opt${i}`);
  const pollMax = buildWhatsAppPollPayload('Q', many, false);
  assert.equal(pollMax.values.length, WHATSAPP_POLL_MAX_OPTIONS);
  assert.equal(pollMax.selectableCount, 1);
});

test('normalizeWhatsAppUserId strips non-digits', () => {
  assert.equal(normalizeWhatsAppUserId('whatsapp:+1 (555) 123-4567'), '15551234567');
  assert.equal(normalizeWhatsAppUserId('15551234567@s.whatsapp.net'), '15551234567');
});

test('normalizeWhatsAppGroupJid preserves group ids', () => {
  assert.equal(normalizeWhatsAppGroupJid('1203-456@g.us'), '1203-456@g.us');
  assert.equal(normalizeWhatsAppGroupJid('WHATSAPP:1203-456@G.US'), '1203-456@g.us');
});
