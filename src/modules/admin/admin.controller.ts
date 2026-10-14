import { Request, Response } from 'express';
import { AdminService } from './admin.service';
import { catchAsync } from '../../utils/catchAsync';

export const getAuditLogs = catchAsync(async (req: Request, res: Response) => {
  const logs = await AdminService.getAuditLogs();
  res.send({ success: true, logs });
});

export const getStats = catchAsync(async (req: Request, res: Response) => {
  const stats = await AdminService.getStats();
  res.send({ success: true, stats });
});

export const announce = catchAsync(async (req: Request, res: Response) => {
  const { message } = req.body;
  const userCount = await AdminService.createAnnouncement(message, req.user?.email as string);
  res.send({
    success: true,
    message: `Announcement sent to ${userCount} users.`,
  });
});

export const getSettings = catchAsync(async (req: Request, res: Response) => {
  const settings = await AdminService.getSettings();
  res.send({ success: true, settings });
});

export const updateSettings = catchAsync(async (req: Request, res: Response) => {
  const { base_delivery_fee, cost_per_kg, rider_commission_percentage } = req.body;
  await AdminService.updateSettings(
    { base_delivery_fee, cost_per_kg, rider_commission_percentage },
    req.user?.email as string,
  );
  res.send({ success: true, message: 'Settings updated and logged.' });
});

export const updateUserStatus = catchAsync(async (req: Request, res: Response) => {
  const email = req.params.email as string;
  const { status } = req.body;
  await AdminService.updateUserStatus(email, status, req.user?.email as string);
  res.send({
    success: true,
    message: `User account ${status} successfully.`,
  });
});

export const getAllParcels = catchAsync(async (req: Request, res: Response) => {
  const { delivery_status, startDate, endDate } = req.query;
  const page = parseInt(req.query.page as string) || 1;
  const size = parseInt(req.query.size as string) || 10;

  const { parcels, totalItems } = await AdminService.getAllParcels(
    {
      delivery_status: delivery_status as string,
      startDate: startDate as string,
      endDate: endDate as string,
    },
    page,
    size,
  );

  const totalPages = Math.ceil(totalItems / size);

  res.send({
    status: 'success',
    success: true,
    data: parcels,
    parcels,
    pagination: {
      totalItems,
      totalPages,
      currentPage: page,
      limit: size,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  });
});

export const assignRider = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { riderId } = req.body;
  const result = await AdminService.assignRiderToParcel(
    id as string,
    riderId,
    req.user?.email as string,
  );
  if (!result.success) {
    return res.status(400).send(result);
  }
  res.send(result);
});

export const getMerchants = catchAsync(async (req: Request, res: Response) => {
  const { status } = req.query;
  const merchants = await AdminService.getMerchants(status as string);
  res.send({ success: true, data: merchants, merchants });
});

export const updateMerchantStatus = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;

  const result = await AdminService.updateMerchantStatus(
    id as string,
    status,
    req.user?.email as string,
  );
  if (!result.success) {
    return res.status(404).send(result);
  }
  res.send(result);
});

export const updateRiderStatus = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;

  const result = await AdminService.updateRiderStatus(
    id as string,
    status,
    req.user?.email as string,
  );
  if (!result.success) {
    return res.status(404).send(result);
  }
  res.send(result);
});

export const getFleet = catchAsync(async (req: Request, res: Response) => {
  const fleetStats = await AdminService.getFleetDistribution();
  res.send({ success: true, data: fleetStats });
});

export const getPayouts = catchAsync(async (req: Request, res: Response) => {
  const payouts = await AdminService.getPayouts();
  res.send({ success: true, data: payouts, payouts });
});

export const updatePayoutStatus = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;

  const result = await AdminService.updatePayoutStatus(
    id as string,
    status,
    req.user?.email as string,
  );
  if (!result.success) {
    return res.status(404).send(result);
  }
  res.send(result);
});

export const getAllUsers = catchAsync(async (req: Request, res: Response) => {
  const search = req.query.search as string;
  const page = parseInt(req.query.page as string) || 1;
  const size = parseInt(req.query.size as string) || 10;

  const result = await AdminService.getAllUsers(search, page, size);
  res.send({
    success: true,
    users: result.users,
    totalItems: result.totalItems,
    totalPages: Math.ceil(result.totalItems / size),
    currentPage: page,
  });
});
