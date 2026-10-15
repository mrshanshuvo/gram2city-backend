import { Request, Response } from 'express';
import { UserService } from './user.service';
import { User, Avatar, Address } from './user.interface';
import { catchAsync } from '../../utils/catchAsync';

// ─── USER CONTROLLERS ────────────────────────────────────────────────────────

export const searchUsers = catchAsync(async (req: Request, res: Response) => {
  const emailQuery = req.query.email as string | undefined;
  if (!emailQuery) return res.status(400).send({ error: 'Email query is required' });
  const users = await UserService.searchUsers(emailQuery);
  res.send(users);
});

export const getStaffList = catchAsync(async (_req: Request, res: Response) => {
  const staff = await UserService.getStaffList();
  res.send(staff);
});

export const getUsersSummary = catchAsync(async (_req: Request, res: Response) => {
  const summary = await UserService.getUsersSummary();
  res.send({
    success: true,
    ...summary,
  });
});

export const updateUserRole = catchAsync(async (req: Request, res: Response) => {
  const { email } = req.params;
  const { role } = req.body || {};
  const result = await UserService.updateUserRole(email as string, role);
  res.send({ success: true, modifiedCount: result.modifiedCount });
});

export const updateUserProfile = catchAsync(async (req: Request, res: Response) => {
  const { email } = req.params;
  const { name, photoURL, phone, address } = req.body || {};
  if (req.user?.email !== email) {
    return res.status(403).send({ success: false, message: 'Unauthorized' });
  }

  const isComplete = !!(name && phone && address);

  const result = await UserService.updateUserProfile(email as string, {
    name,
    photoURL,
    phone,
    address,
    isProfileComplete: isComplete,
  });
  res.send({
    success: true,
    modifiedCount: result.modifiedCount,
    isProfileComplete: isComplete,
  });
});

export const registerUser = catchAsync(async (req: Request, res: Response) => {
  const email = req.user?.email;
  if (!email) {
    return res.status(400).send({ success: false, message: 'Email not found in token' });
  }

  const existingUser = await UserService.getUserByEmail(email);
  if (existingUser) {
    return res.status(200).send({
      success: true,
      message: 'User already exists',
      existing: true,
    });
  }

  const name = req.body?.name || req.user?.name;
  const photoURL = req.body?.photoURL || req.user?.picture;

  const newUser: User = {
    email,
    name,
    photoURL,
    role: 'user',
    isProfileComplete: false,
    created_at: new Date().toISOString(),
    last_login: new Date().toISOString(),
  };

  const result = await UserService.createUserRecord(newUser);
  res.status(201).send({
    success: true,
    insertedId:
      (result as { _id?: unknown; insertedId?: unknown })._id ||
      (result as { insertedId?: unknown }).insertedId,
  });
});

export const syncUser = catchAsync(async (req: Request, res: Response) => {
  const email = req.user?.email;
  if (!email) return res.status(401).send({ success: false, message: 'Unauthorized' });

  const name = req.body?.name || req.user?.name;
  const photoURL = req.body?.photoURL || req.user?.picture;

  const updateDoc: Record<string, unknown> = {
    $setOnInsert: {
      email,
      role: 'user',
      created_at: new Date().toISOString(),
    },
    $set: {
      last_login: new Date().toISOString(),
      ...(name ? { name } : {}),
      ...(photoURL ? { photoURL } : {}),
    },
  };

  await UserService.syncUser(email, updateDoc as Parameters<typeof UserService.syncUser>[1]);
  const user = await UserService.getUserByEmail(email);
  res.send({ success: true, user });
});

export const getUserStats = catchAsync(async (req: Request, res: Response) => {
  const { email } = req.params;
  const stats = await UserService.getUserStats(email as string);
  res.send(stats);
});

export const getUserByEmail = catchAsync(async (req: Request, res: Response) => {
  const { email } = req.params;
  const user = await UserService.getUserByEmail(email as string);
  if (!user) {
    return res.status(404).send({ success: false, message: 'User not found' });
  }
  res.send(user);
});

// ─── AVATAR CONTROLLERS ──────────────────────────────────────────────────────

export const getRandomAvatar = catchAsync(async (_req: Request, res: Response) => {
  const avatar = await UserService.getRandomAvatar();
  res.json(avatar);
});

export const getAllAvatars = catchAsync(async (_req: Request, res: Response) => {
  const avatars = await UserService.getAllAvatars();
  res.json(avatars);
});

export const addAvatar = catchAsync(async (req: Request, res: Response) => {
  const { url, name, category } = req.body;
  if (!url) return res.status(400).json({ message: 'URL is required' });

  const newAvatar: Avatar = {
    url,
    name: name || 'Default Avatar',
    category: category || 'General',
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  const result = await UserService.addAvatar(newAvatar);
  res.status(201).json({
    ...newAvatar,
    _id:
      (result as { _id?: unknown; insertedId?: unknown })._id ||
      (result as { insertedId?: unknown }).insertedId,
  });
});

export const magicGenerateAvatars = catchAsync(async (req: Request, res: Response) => {
  const { style, count } = req.body;
  const selectedStyle = style || 'lorelei';
  const selectedCount = count || 10;

  const newAvatars: Avatar[] = Array.from({ length: selectedCount }).map((_, i) => ({
    url: `https://api.dicebear.com/7.x/${selectedStyle}/svg?seed=${Math.random().toString(36).substring(7)}`,
    name: `Magic ${selectedStyle} ${i + 1}`,
    category: 'AI Generated',
    isActive: true,
    createdAt: new Date().toISOString(),
  }));

  const result = await UserService.magicGenerateAvatars(newAvatars);
  res.status(201).json({
    count:
      (result as { insertedCount?: number }).insertedCount ??
      (result as unknown as unknown[]).length,
  });
});

export const deleteAvatar = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await UserService.deleteAvatar(id as string);
  if (result.deletedCount === 0) {
    return res.status(404).json({ message: 'Avatar not found' });
  }
  res.json({ message: 'Avatar deleted successfully' });
});

export const getMyAddresses = catchAsync(async (req: Request, res: Response) => {
  const addresses = await UserService.getAddresses(req.user?.email as string);
  res.send({ success: true, data: addresses });
});

export const addAddress = catchAsync(async (req: Request, res: Response) => {
  const { label, fullName, phone, address, district, region, isDefault } = req.body;
  const result = await UserService.addAddress(
    {
      label,
      fullName,
      phone,
      address,
      district,
      region,
      isDefault: !!isDefault,
    } as Omit<Address, '_id' | 'userEmail' | 'createdAt'>,
    req.user?.email as string,
  );
  res.status(201).send({
    success: true,
    id:
      (result as { _id?: unknown; insertedId?: unknown })._id ||
      (result as { insertedId?: unknown }).insertedId,
  });
});

export const deleteAddress = catchAsync(async (req: Request, res: Response) => {
  await UserService.deleteAddress(req.params.id as string, req.user?.email as string);
  res.send({ success: true, message: 'Address deleted' });
});
