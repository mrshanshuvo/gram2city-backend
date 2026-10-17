import { z } from 'zod';

export const allowedUploadFolders = [
  'gram2city/avatars',
  'gram2city/chat',
  'gram2city/parcels',
  'gram2city/cms',
  'gram2city/config',
] as const;

export type AllowedUploadFolder = (typeof allowedUploadFolders)[number];

export const uploadSignatureSchema = z.object({
  body: z.object({
    folder: z.enum(allowedUploadFolders).default('gram2city/chat'),
  }),
});

export type UploadSignatureInput = z.infer<typeof uploadSignatureSchema>['body'];
