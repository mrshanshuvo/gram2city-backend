import { Router } from 'express';
import {
  searchUsers,
  getStaffList,
  getUsersSummary,
  updateUserRole,
  updateUserProfile,
  registerUser,
  syncUser,
  getUserStats,
  getUserByEmail,
  getRandomAvatar,
  getAllAvatars,
  addAvatar,
  magicGenerateAvatars,
  deleteAvatar,
  getMyAddresses,
  addAddress,
  deleteAddress,
} from './user.controller';
import { verifyAuthToken, verifyAdmin } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { registerUserSchema, updateProfileSchema } from './user.schema';

const router = Router();

// User Profile & Authority Control
router.get('/users/search', verifyAuthToken, verifyAdmin, searchUsers);
router.get('/users/staff', verifyAuthToken, verifyAdmin, getStaffList);
router.get('/users/summary', verifyAuthToken, verifyAdmin, getUsersSummary);
router.patch('/users/:email/role', verifyAuthToken, verifyAdmin, updateUserRole);
router.patch('/users/:email', verifyAuthToken, validate(updateProfileSchema), updateUserProfile);
router.post('/users', verifyAuthToken, validate(registerUserSchema), registerUser);
router.post('/users/sync', verifyAuthToken, syncUser);
router.get('/user/stats/:email', verifyAuthToken, getUserStats);
router.get('/users/:email', verifyAuthToken, getUserByEmail);

// Avatar Library Operations
router.get('/avatars/random', getRandomAvatar);
router.get('/avatars', getAllAvatars);
router.post('/avatars', verifyAuthToken, verifyAdmin, addAvatar);
router.post('/avatars/magic-generate', verifyAuthToken, verifyAdmin, magicGenerateAvatars);
router.delete('/avatars/:id', verifyAuthToken, verifyAdmin, deleteAvatar);

// Address Book Operations
router.get('/addresses', verifyAuthToken, getMyAddresses);
router.post('/addresses', verifyAuthToken, addAddress);
router.delete('/addresses/:id', verifyAuthToken, deleteAddress);

export default router;
