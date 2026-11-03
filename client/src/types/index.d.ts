export type BlockType =
  | 'paragraph'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'task'
  | 'bullet'
  | 'numbered'
  | 'quote'
  | 'callout'
  | 'code'
  | 'divider'
  | 'image';

export interface MarkAttributes {
  bold?: boolean | null;
  italic?: boolean | null;
  underline?: boolean | null;
  strike?: boolean | null;
  code?: boolean | null;
  link?: string | null;
}

export interface BlockMark {
  from: number;
  to: number;
  attributes?: MarkAttributes;
}

export interface NoteBlock {
  id: string;
  type: BlockType;
  text: string;
  indent?: number;
  marks?: BlockMark[];
  checked?: boolean;
}

export interface User {
  _id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

export interface Note {
  _id: string;
  title: string;
  icon?: string;
  content: NoteBlock[];
  user?: string | User;
  workspace?: string;
  isFavorite?: boolean;
  isArchived?: boolean;
  isPublished?: boolean;
  accessRole?: 'owner' | 'editor' | 'commenter' | 'viewer';
  lastOpenedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Toast {
  id: string;
  title?: string;
  message: string;
  type: 'success' | 'error' | 'info';
  duration?: number;
}
