const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const mongoose = require('mongoose');
const request = require('supertest');
const { io: createClient } = require('socket.io-client');
const Y = require('yjs');

require('dotenv').config();

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-only-secret-that-is-long-enough-for-integration-tests';
process.env.CLIENT_URL = 'http://localhost:5173';

const { server, io } = require('../server');
const { flushAllDocuments } = require('../services/collaborationService');

let baseUrl;
const testDatabaseName = `otion_t_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 8)}`;

before(async () => {
  const uri = process.env.TEST_MONGO_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('TEST_MONGO_URI or MONGO_URI must be configured');
  await mongoose.connect(uri, { dbName: testDatabaseName });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => io.close(resolve));
  await flushAllDocuments();
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

const register = async (name, email) => {
  const response = await request(server)
    .post('/api/auth/register')
    .send({ name, email, password: 'password-123' })
    .expect(201);
  return response.body;
};

const authenticated = (method, path, token) => request(server)[method](path)
  .set('Authorization', `Bearer ${token}`);

const waitForEvent = (emitter, eventName, timeoutMs = 8_000) => Promise.race([
  once(emitter, eventName).then(([payload]) => payload),
  new Promise((_, reject) => setTimeout(() => reject(new Error(`Timed out waiting for ${eventName}`)), timeoutMs)),
]);

test('security headers and request validation are enforced', async () => {
  const health = await request(server).get('/api/health').expect(200);
  assert.equal(health.headers['x-content-type-options'], 'nosniff');
  assert.equal(health.headers['x-powered-by'], undefined);
  await request(server).post('/api/uploads/sign').expect(404);

  const invalid = await request(server)
    .post('/api/auth/register')
    .send({ name: '', email: 'not-an-email', password: 'short' })
    .expect(400);
  assert.equal(invalid.body.error.code, 'VALIDATION_ERROR');
  assert.ok(invalid.body.error.requestId);
  assert.ok(invalid.body.error.details.length >= 2);
});

test('note authorization, sharing, public privacy, and socket revocation work end to end', async () => {
  const owner = await register('Owner', 'owner@example.com');
  const collaborator = await register('Collaborator', 'collaborator@example.com');

  const ownerWorkspaces = await authenticated('get', '/api/workspaces', owner.token).expect(200);
  assert.equal(ownerWorkspaces.body.length, 1);
  assert.equal(ownerWorkspaces.body[0].membershipRole, 'owner');

  const created = await authenticated('post', '/api/notes', owner.token)
    .send({ title: 'Private roadmap' })
    .expect(201);
  const noteId = created.body._id;

  const child = await authenticated('post', '/api/notes', owner.token)
    .send({ title: 'Second note', workspace: ownerWorkspaces.body[0]._id })
    .expect(201);
  await authenticated('patch', '/api/notes/reorder', owner.token)
    .send({ noteIds: [child.body._id, noteId] })
    .expect(200);
  const orderedNotes = await authenticated('get', '/api/notes', owner.token).expect(200);
  assert.deepEqual(orderedNotes.body.slice(0, 2).map((note) => note._id), [child.body._id, noteId]);
  await authenticated('patch', `/api/notes/${noteId}/archive`, owner.token).expect(200);
  const archivedTree = await authenticated('get', '/api/notes?archived=true', owner.token).expect(200);
  assert.ok(archivedTree.body.some((note) => note._id === noteId));
  assert.ok(!archivedTree.body.some((note) => note._id === child.body._id));
  await authenticated('patch', `/api/notes/${noteId}/restore`, owner.token).expect(200);

  const concealed = await authenticated('get', `/api/notes/${noteId}`, collaborator.token).expect(404);
  assert.equal(concealed.body.message, 'Note not found');
  await request(server).get(`/api/public/${'x'.repeat(43)}`).expect(404);
  const concealedSearch = await authenticated('get', '/api/search?q=Private', collaborator.token).expect(200);
  assert.equal(concealedSearch.body.length, 0);

  await authenticated('post', `/api/share/${noteId}/invite`, owner.token)
    .send({ email: collaborator.email, role: 'editor' })
    .expect(201);
  const sharedSearch = await authenticated('get', '/api/search?q=Private', collaborator.token).expect(200);
  assert.equal(sharedSearch.body[0]._id, noteId);

  const pendingInvite = await authenticated('post', `/api/share/${noteId}/invite`, owner.token)
    .send({ email: 'new-person@example.com', role: 'commenter' })
    .expect(202);
  assert.ok(pendingInvite.body.invitationToken.length >= 40);
  await request(server).post('/api/auth/register').send({
    name: 'Wrong Invite', email: 'wrong-person@example.com', password: 'password-123', invitationToken: pendingInvite.body.invitationToken,
  }).expect(400);
  const invitedRegistration = await request(server).post('/api/auth/register').send({
    name: 'New Person', email: 'new-person@example.com', password: 'password-123', invitationToken: pendingInvite.body.invitationToken,
  }).expect(201);
  const invitedPage = await authenticated('get', `/api/notes/${noteId}`, invitedRegistration.body.token).expect(200);
  assert.equal(invitedPage.body.accessRole, 'commenter');

  const collaboratorWorkspaces = await authenticated('get', '/api/workspaces', collaborator.token).expect(200);
  assert.ok(collaboratorWorkspaces.body.some((workspace) => workspace._id === ownerWorkspaces.body[0]._id && workspace.membershipRole === 'guest'));

  const shared = await authenticated('get', `/api/notes/${noteId}`, collaborator.token).expect(200);
  assert.equal(shared.body.accessRole, 'editor');
  assert.equal(shared.body.isFavorite, false);
  const comment = await authenticated('post', `/api/comments/note/${noteId}`, collaborator.token)
    .send({ content: 'Looks good @owner@example.com' })
    .expect(201);
  const comments = await authenticated('get', `/api/comments/note/${noteId}`, owner.token).expect(200);
  assert.equal(comments.body[0]._id, comment.body._id);
  await authenticated('patch', `/api/comments/${comment.body._id}/resolve`, owner.token)
    .send({ resolved: true })
    .expect(200);
  const ownerNotifications = await authenticated('get', '/api/notifications', owner.token).expect(200);
  assert.ok(ownerNotifications.body.some((notification) => notification.type === 'mention'));

  await authenticated('patch', `/api/notes/${noteId}/preferences`, owner.token)
    .send({ favorite: true })
    .expect(200);
  const ownerFavorite = await authenticated('get', `/api/notes/${noteId}`, owner.token).expect(200);
  const collaboratorNotFavorite = await authenticated('get', `/api/notes/${noteId}`, collaborator.token).expect(200);
  assert.equal(ownerFavorite.body.isFavorite, true);
  assert.equal(collaboratorNotFavorite.body.isFavorite, false);

  await authenticated('put', `/api/notes/${noteId}`, collaborator.token)
    .send({ title: 'Collaboratively updated' })
    .expect(200);

  const checkpoint = await authenticated('post', `/api/notes/${noteId}/revisions`, collaborator.token)
    .send({ name: 'Collaboration checkpoint' })
    .expect(201);
  await authenticated('put', `/api/notes/${noteId}`, collaborator.token)
    .send({ title: 'Temporary title', saveReason: 'manual' })
    .expect(200);
  const restored = await authenticated('post', `/api/notes/${noteId}/revisions/${checkpoint.body._id}/restore`, collaborator.token)
    .send({})
    .expect(200);
  assert.equal(restored.body.title, 'Collaboratively updated');

  await authenticated('patch', `/api/share/${noteId}/user/${collaborator._id}`, owner.token)
    .send({ role: 'commenter' })
    .expect(200);
  await authenticated('put', `/api/notes/${noteId}`, collaborator.token)
    .send({ title: 'Forbidden update' })
    .expect(403);
  await authenticated('post', `/api/comments/note/${noteId}`, collaborator.token)
    .send({ content: 'Commenters can discuss without editing' })
    .expect(201);
  await authenticated('patch', `/api/share/${noteId}/user/${collaborator._id}`, owner.token)
    .send({ role: 'viewer' })
    .expect(200);

  const publicAccess = await authenticated('patch', `/api/share/${noteId}/public`, owner.token)
    .send({ isPublished: true })
    .expect(200);
  assert.ok(publicAccess.body.token.length >= 40);
  const published = await request(server).get(`/api/public/${publicAccess.body.token}`).expect(200);
  assert.equal(published.body.title, 'Collaboratively updated');

  await authenticated('patch', `/api/share/${noteId}/public`, owner.token)
    .send({ isPublished: false })
    .expect(200);
  const hidden = await request(server).get(`/api/public/${publicAccess.body.token}`).expect(404);
  assert.equal(hidden.body.message, 'Note not found');

  const protectedAccess = await authenticated('patch', `/api/share/${noteId}/public`, owner.token)
    .send({ isPublished: true, password: 'protected-123', expiresAt: new Date(Date.now() + 86_400_000).toISOString() })
    .expect(200);
  await request(server).get(`/api/public/${protectedAccess.body.token}`).expect(401);
  await request(server).post(`/api/public/${protectedAccess.body.token}/unlock`).send({ password: 'wrong-password' }).expect(401);
  const unlocked = await request(server).post(`/api/public/${protectedAccess.body.token}/unlock`).send({ password: 'protected-123' }).expect(200);
  assert.equal(unlocked.body.title, 'Collaboratively updated');
  await authenticated('patch', `/api/share/${noteId}/public`, owner.token).send({ isPublished: false }).expect(200);

  await authenticated('patch', `/api/share/${noteId}/user/${collaborator._id}`, owner.token)
    .send({ role: 'editor' })
    .expect(200);

  const socket = createClient(baseUrl, {
    auth: { token: collaborator.token },
    transports: ['websocket'],
    forceNew: true,
  });
  const ownerSocket = createClient(baseUrl, {
    auth: { token: owner.token },
    transports: ['websocket'],
    forceNew: true,
  });
  const collaboratorConnected = socket.connected ? Promise.resolve() : waitForEvent(socket, 'connect');
  const ownerConnected = ownerSocket.connected ? Promise.resolve() : waitForEvent(ownerSocket, 'connect');
  await Promise.all([collaboratorConnected, ownerConnected]);
  const collaboratorRole = waitForEvent(socket, 'permission-changed');
  const collaboratorSync = waitForEvent(socket, 'collab-sync');
  const ownerSync = waitForEvent(ownerSocket, 'collab-sync');
  socket.emit('join-note', { noteId });
  ownerSocket.emit('join-note', { noteId });
  const role = await collaboratorRole;
  assert.equal(role.role, 'editor');

  const collaboratorDoc = new Y.Doc();
  const ownerDoc = new Y.Doc();
  Y.applyUpdate(collaboratorDoc, new Uint8Array((await collaboratorSync).update));
  Y.applyUpdate(ownerDoc, new Uint8Array((await ownerSync).update));
  let collaboratorUpdate;
  let ownerUpdate;
  collaboratorDoc.on('update', (update, origin) => { if (origin === 'local') collaboratorUpdate = Array.from(update); });
  ownerDoc.on('update', (update, origin) => { if (origin === 'local') ownerUpdate = Array.from(update); });
  collaboratorDoc.transact(() => collaboratorDoc.getArray('blocks').get(0).get('text').insert(0, 'C'), 'local');
  ownerDoc.transact(() => ownerDoc.getArray('blocks').get(0).get('text').insert(0, 'O'), 'local');
  const updateForOwner = waitForEvent(ownerSocket, 'collab-update');
  const updateForCollaborator = waitForEvent(socket, 'collab-update');
  socket.emit('collab-update', { noteId, update: collaboratorUpdate });
  ownerSocket.emit('collab-update', { noteId, update: ownerUpdate });
  Y.applyUpdate(ownerDoc, new Uint8Array((await updateForOwner).update));
  Y.applyUpdate(collaboratorDoc, new Uint8Array((await updateForCollaborator).update));
  const ownerText = ownerDoc.getArray('blocks').get(0).get('text').toString();
  const collaboratorText = collaboratorDoc.getArray('blocks').get(0).get('text').toString();
  assert.equal(ownerText, collaboratorText);
  assert.equal(ownerText.length, 2);

  ownerDoc.transact(() => ownerDoc.getArray('blocks').get(0).get('text').format(0, 1, { bold: true, link: 'https://example.com' }), 'local');
  const formattedForCollaborator = waitForEvent(socket, 'collab-update');
  ownerSocket.emit('collab-update', { noteId, update: ownerUpdate });
  Y.applyUpdate(collaboratorDoc, new Uint8Array((await formattedForCollaborator).update));
  const formattedDelta = collaboratorDoc.getArray('blocks').get(0).get('text').toDelta();
  assert.ok(formattedDelta.some((operation) => operation.attributes?.bold && operation.attributes?.link === 'https://example.com'));

  const revokedEvent = waitForEvent(socket, 'access-revoked');
  await authenticated('delete', `/api/share/${noteId}/user/${collaborator._id}`, owner.token).expect(200);
  await revokedEvent;
  socket.close();
  ownerSocket.close();
  collaboratorDoc.destroy();
  ownerDoc.destroy();

  await authenticated('get', `/api/notes/${noteId}`, collaborator.token).expect(404);
});

test('unauthenticated sockets are rejected', async () => {
  const socket = createClient(baseUrl, { transports: ['websocket'], forceNew: true });
  const error = await waitForEvent(socket, 'connect_error');
  assert.equal(error.message, 'Authentication required');
  socket.close();
});

test('profile, password, export, and account deletion flows are protected', async () => {
  const account = await register('Account User', 'account@example.com');
  const updated = await authenticated('patch', '/api/auth/profile', account.token)
    .send({ name: 'Updated Account', avatarUrl: 'https://example.com/avatar.png' })
    .expect(200);
  assert.equal(updated.body.name, 'Updated Account');

  await authenticated('patch', '/api/auth/password', account.token)
    .send({ currentPassword: 'wrong-password', newPassword: 'new-password-123' })
    .expect(401);
  await authenticated('patch', '/api/auth/password', account.token)
    .send({ currentPassword: 'password-123', newPassword: 'new-password-123' })
    .expect(200);
  await request(server).post('/api/auth/login').send({ email: account.email, password: 'password-123' }).expect(401);
  await request(server).post('/api/auth/login').send({ email: account.email, password: 'new-password-123' }).expect(200);

  const exported = await authenticated('get', '/api/auth/export', account.token).expect(200);
  assert.equal(exported.body.profile.email, account.email);
  assert.equal(exported.body.workspaces.length, 1);

  await authenticated('delete', '/api/auth/account', account.token)
    .send({ password: 'new-password-123' })
    .expect(200);
  await authenticated('get', '/api/auth/me', account.token).expect(401);
});
