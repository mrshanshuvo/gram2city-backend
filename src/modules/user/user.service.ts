import { ObjectId } from 'mongodb';
import { UserModel, ParcelModel, AvatarModel, AddressModel } from '../../db/models';
import { User, Avatar, UserStats, Address } from './user.interface';

export class UserService {
  static async searchUsers(emailQuery: string): Promise<User[]> {
    return UserModel.find({ email: { $regex: emailQuery, $options: 'i' } })
      .select('email createdAt role name photoURL')
      .limit(10)
      .lean() as unknown as User[];
  }

  static async getStaffList(): Promise<User[]> {
    return UserModel.find({ role: { $in: ['admin', 'superAdmin'] } })
      .select('email role name last_login')
      .lean() as unknown as User[];
  }

  static async getUsersSummary() {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startOfToday = new Date(now.setHours(0, 0, 0, 0));

    const stats = await UserModel.aggregate([
      {
        $facet: {
          roleCounts: [{ $group: { _id: '$role', count: { $sum: 1 } } }],
          recentlyJoined: [
            { $match: { created_at: { $gte: sevenDaysAgo.toISOString() } } },
            { $count: 'count' },
          ],
          activeToday: [
            { $match: { last_login: { $gte: startOfToday.toISOString() } } },
            { $count: 'count' },
          ],
        },
      },
    ]);

    const roleMap = stats[0].roleCounts.reduce(
      (acc: Record<string, number>, curr: { _id: string; count: number }) => {
        acc[curr._id] = curr.count;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      superAdmin: roleMap.superAdmin || 0,
      admin: roleMap.admin || 0,
      user: roleMap.user || 0,
      rider: roleMap.rider || 0,
      recentlyJoined: stats[0].recentlyJoined[0]?.count || 0,
      activeToday: stats[0].activeToday[0]?.count || 0,
      total:
        (roleMap.user || 0) +
        (roleMap.admin || 0) +
        (roleMap.superAdmin || 0) +
        (roleMap.rider || 0),
    };
  }

  static async updateUserRole(email: string, role: string) {
    return UserModel.updateOne({ email }, { $set: { role: role as User['role'] } });
  }

  static async updateUserProfile(email: string, updateData: Partial<User>) {
    return UserModel.updateOne({ email }, { $set: updateData });
  }

  static async getUserByEmail(email: string): Promise<User | null> {
    return UserModel.findOne({ email }).lean() as unknown as User | null;
  }

  static async createUserRecord(newUser: User) {
    return UserModel.create(newUser);
  }

  static async syncUser(email: string, updateDoc: Record<string, unknown>): Promise<void> {
    await UserModel.updateOne({ email }, updateDoc, {
      upsert: true,
    });
  }

  static async getUserStats(email: string): Promise<UserStats> {
    const stats = await ParcelModel.aggregate([
      { $match: { created_by: email } },
      {
        $group: {
          _id: null,
          totalBooked: { $sum: 1 },
          unpaidCount: {
            $sum: { $cond: [{ $ne: ['$payment_status', 'paid'] }, 1, 0] },
          },
          totalSpent: {
            $sum: {
              $cond: [{ $eq: ['$payment_status', 'paid'] }, '$cost', 0],
            },
          },
        },
      },
    ]);

    return {
      totalBooked: stats[0]?.totalBooked || 0,
      unpaidCount: stats[0]?.unpaidCount || 0,
      totalSpent: stats[0]?.totalSpent || 0,
    };
  }

  static async getRandomAvatar(): Promise<Avatar | { url: string }> {
    const avatars = (await AvatarModel.find({ isActive: true }).lean()) as unknown as Avatar[];
    if (avatars.length === 0) {
      return {
        url:
          'https://api.dicebear.com/7.x/lorelei/svg?seed=' +
          Math.random().toString(36).substring(7),
      };
    }
    const randomIndex = Math.floor(Math.random() * avatars.length);
    return avatars[randomIndex];
  }

  static async getAllAvatars(): Promise<Avatar[]> {
    return AvatarModel.find({ isActive: true }).lean() as unknown as Avatar[];
  }

  static async addAvatar(avatar: Omit<Avatar, '_id'>) {
    return AvatarModel.create(avatar);
  }

  static async magicGenerateAvatars(newAvatars: Omit<Avatar, '_id'>[]) {
    return AvatarModel.insertMany(newAvatars);
  }

  static async deleteAvatar(id: string) {
    return AvatarModel.deleteOne({ _id: new ObjectId(id) });
  }

  static async getAddresses(email: string): Promise<Address[]> {
    return AddressModel.find({ userEmail: email })
      .sort({ isDefault: -1, createdAt: -1 })
      .lean() as unknown as Address[];
  }

  static async addAddress(
    address: Omit<Address, '_id' | 'userEmail' | 'createdAt'>,
    email: string,
  ) {
    if (address.isDefault) {
      await AddressModel.updateMany({ userEmail: email }, { $set: { isDefault: false } });
    }
    const newAddress = {
      ...address,
      userEmail: email,
      createdAt: new Date().toISOString(),
    };
    return AddressModel.create(newAddress);
  }

  static async deleteAddress(id: string, email: string) {
    return AddressModel.deleteOne({
      _id: new ObjectId(String(id)),
      userEmail: email,
    });
  }
}
