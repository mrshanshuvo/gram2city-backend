import { Request, Response, NextFunction } from 'express';
import { verifyAuthToken, verifyAdmin, verifyRider, verifyMerchant } from '../../src/middleware/auth';
import * as jwtUtils from '../../src/utils/jwt';
import { UserModel, MerchantModel, RiderModel } from '../../src/db/models';

describe('Auth & RBAC Middlewares', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      headers: {},
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  describe('verifyAuthToken', () => {
    it('returns 401 if authorization header is absent', async () => {
      await verifyAuthToken(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.send).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, message: 'Unauthorized: No token provided' }),
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('returns 401 if token format is invalid after Bearer stripping', async () => {
      mockReq.headers = { authorization: 'Bearer ' };

      await verifyAuthToken(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.send).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, message: 'Unauthorized: Invalid token format' }),
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('returns 401 if token verification throws an error', async () => {
      mockReq.headers = { authorization: 'Bearer invalid.token.here' };
      jest.spyOn(jwtUtils, 'verifyAccessToken').mockImplementation(() => {
        throw new Error('jwt expired');
      });

      await verifyAuthToken(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.send).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, message: 'Unauthorized: Invalid or expired token' }),
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('attaches user to request and calls next() on valid token', async () => {
      mockReq.headers = { authorization: 'Bearer valid.jwt.token' };
      const mockUser = {
        email: 'user@example.com',
        role: 'user' as const,
        name: 'Test User',
      };
      jest.spyOn(jwtUtils, 'verifyAccessToken').mockReturnValue(mockUser as any);

      await verifyAuthToken(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.user).toEqual(mockUser);
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });

  describe('verifyAdmin', () => {
    it('returns 403 if user in database is not an admin', async () => {
      mockReq.user = { email: 'user@example.com', role: 'user', name: 'User' };
      jest.spyOn(UserModel, 'findOne').mockReturnValue({
        lean: jest.fn().mockResolvedValue({ role: 'user' }),
      } as any);

      await verifyAdmin(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.send).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, message: 'Forbidden' }),
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('calls next() if user in database is an admin', async () => {
      mockReq.user = { email: 'admin@example.com', role: 'admin', name: 'Admin' };
      jest.spyOn(UserModel, 'findOne').mockReturnValue({
        lean: jest.fn().mockResolvedValue({ role: 'admin' }),
      } as any);

      await verifyAdmin(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });

  describe('verifyRider', () => {
    it('calls next() if user role is rider', async () => {
      mockReq.user = { email: 'rider@example.com', role: 'rider', name: 'Rider' };
      jest.spyOn(UserModel, 'findOne').mockReturnValue({
        lean: jest.fn().mockResolvedValue({ role: 'rider' }),
      } as any);

      await verifyRider(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('calls next() if user is admin and has an active rider profile', async () => {
      mockReq.user = { email: 'admin@example.com', role: 'admin', name: 'Admin Rider' };
      jest.spyOn(UserModel, 'findOne').mockReturnValue({
        lean: jest.fn().mockResolvedValue({ role: 'admin' }),
      } as any);
      jest.spyOn(RiderModel, 'findOne').mockReturnValue({
        lean: jest.fn().mockResolvedValue({ email: 'admin@example.com' }),
      } as any);

      await verifyRider(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('returns 403 if user is neither a rider nor an admin with rider profile', async () => {
      mockReq.user = { email: 'user@example.com', role: 'user', name: 'Regular User' };
      jest.spyOn(UserModel, 'findOne').mockReturnValue({
        lean: jest.fn().mockResolvedValue({ role: 'user' }),
      } as any);

      await verifyRider(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.send).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, message: 'Rider access required' }),
      );
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('verifyMerchant', () => {
    it('calls next() if user role is merchant', async () => {
      mockReq.user = { email: 'merchant@example.com', role: 'merchant', name: 'Merchant' };
      jest.spyOn(UserModel, 'findOne').mockReturnValue({
        lean: jest.fn().mockResolvedValue({ role: 'merchant' }),
      } as any);

      await verifyMerchant(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('calls next() if admin has merchant profile', async () => {
      mockReq.user = { email: 'admin@example.com', role: 'admin', name: 'Admin' };
      jest.spyOn(UserModel, 'findOne').mockReturnValue({
        lean: jest.fn().mockResolvedValue({ role: 'admin' }),
      } as any);
      jest.spyOn(MerchantModel, 'findOne').mockReturnValue({
        lean: jest.fn().mockResolvedValue({ email: 'admin@example.com' }),
      } as any);

      await verifyMerchant(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('returns 403 if user is regular user', async () => {
      mockReq.user = { email: 'user@example.com', role: 'user', name: 'User' };
      jest.spyOn(UserModel, 'findOne').mockReturnValue({
        lean: jest.fn().mockResolvedValue({ role: 'user' }),
      } as any);

      await verifyMerchant(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
    });
  });
});
