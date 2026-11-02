const { z } = require('zod');

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier');
const email = z.string().trim().toLowerCase().email().max(254);
const role = z.enum(['editor', 'commenter', 'viewer']);

const mark = z.object({
  from: z.number().int().nonnegative(),
  to: z.number().int().positive(),
  attributes: z.object({
    bold: z.boolean().optional(),
    italic: z.boolean().optional(),
    underline: z.boolean().optional(),
    strike: z.boolean().optional(),
    code: z.boolean().optional(),
    link: z.union([z.string().url().max(2048), z.literal('')]).optional(),
  }).refine((value) => Object.keys(value).length > 0, 'Mark attributes are required'),
}).refine((value) => value.to > value.from, 'Mark end must be after its start');

const block = z.object({
  id: z.string().min(1).max(100),
  type: z.enum(['paragraph', 'h1', 'h2', 'h3', 'task', 'code', 'quote', 'callout', 'bullet', 'numbered', 'divider', 'image', 'file', 'table']),
  text: z.string().max(100_000).default(''),
  checked: z.boolean().optional(),
  marks: z.array(mark).max(10_000).optional(),
}).passthrough();

const auth = {
  register: z.object({
    name: z.string().trim().min(1).max(100),
    email,
    password: z.string().min(8).max(128),
    invitationToken: z.string().min(40).max(200).optional(),
  }),
  login: z.object({ email, password: z.string().min(1).max(128) }),
  profile: z.object({
    name: z.string().trim().min(1).max(100).optional(),
    avatarUrl: z.union([z.literal(''), z.string().url().max(2048)]).optional(),
  }).refine((value) => Object.keys(value).length > 0, 'At least one field is required'),
  changePassword: z.object({
    currentPassword: z.string().min(1).max(128),
    newPassword: z.string().min(8).max(128),
  }),
  deleteAccount: z.object({ password: z.string().min(1).max(128) }),
};

const notes = {
  list: z.object({ archived: z.enum(['true', 'false']).optional(), workspaceId: objectId.optional() }),
  id: z.object({ id: objectId }),
  create: z.object({
    title: z.string().trim().min(1).max(200).optional(),
    icon: z.string().max(16).optional(),
    content: z.array(block).max(10_000).optional(),
    workspace: objectId.optional(),
  }),
  update: z.object({
    title: z.string().trim().min(1).max(200).optional(),
    content: z.array(block).max(10_000).optional(),
    icon: z.string().max(16).optional(),
    saveReason: z.enum(['autosave', 'manual']).optional(),
  }).refine((value) => Object.keys(value).length > 0, 'At least one field is required'),
  preferences: z.object({
    favorite: z.boolean().optional(),
    lastOpenedAt: z.coerce.date().nullable().optional(),
    sidebarExpanded: z.boolean().optional(),
  }).refine((value) => Object.keys(value).length > 0, 'At least one preference is required'),
  reorder: z.object({
    noteIds: z.array(objectId).min(1).max(10_000).refine((ids) => new Set(ids).size === ids.length, 'Note identifiers must be unique'),
  }),
};

const revisions = {
  params: z.object({ id: objectId, revisionId: objectId }),
  create: z.object({ name: z.string().trim().max(120).optional() }),
};

const sharing = {
  noteId: z.object({ noteId: objectId }),
  noteUser: z.object({ noteId: objectId, userId: objectId }),
  noteInvitation: z.object({ noteId: objectId, invitationId: objectId }),
  invite: z.object({ email, role: role.default('viewer') }),
  updateRole: z.object({ role }),
  publicAccess: z.object({
    isPublished: z.boolean(),
    expiresAt: z.string().datetime().nullable().optional(),
    password: z.string().min(8).max(128).optional(),
  }),
  userSearch: z.object({ q: z.string().trim().min(2).max(100) }),
};

module.exports = { auth, notes, revisions, sharing };
