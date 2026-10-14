import { Request, Response } from 'express';
import { AdminService } from './admin.service';

export const getAuditLogs = async (req: Request, res: Response) => {
  try {
    const logs = await AdminService.getAuditLogs();
    res.send({ success: true, logs });
  } catch (error) {
    res.status(500).send({ success: false, message: 'Failed to fetch logs' });
  }
};

export const getStats = async (req: Request, res: Response) => {
  try {
    const stats = await AdminService.getStats();
    res.send({ success: true, stats });
  } catch (error) {
    res.status(500).send({ success: false, message: 'Failed to aggregate stats' });
  }
};

export const announce = async (req: Request, res: Response) => {
  const { message } = req.body;
  try {
    const userCount = await AdminService.createAnnouncement(message, req.user?.email as string);
    res.send({
      success: true,
      message: `Announcement sent to ${userCount} users.`,
    });
  } catch (error) {
    res.status(500).send({ success: false, message: 'Failed to send announcement' });
  }
};

export const getSettings = async (req: Request, res: Response) => {
  try {
    const settings = await AdminService.getSettings();
    res.send({ success: true, settings });
  } catch (error) {
    res.status(500).send({ success: false, message: 'Server error' });
  }
};

export const updateSettings = async (req: Request, res: Response) => {
  const { base_delivery_fee, cost_per_kg, rider_commission_percentage } = req.body;
  try {
    await AdminService.updateSettings(
      { base_delivery_fee, cost_per_kg, rider_commission_percentage },
      req.user?.email as string,
    );
    res.send({ success: true, message: 'Settings updated and logged.' });
  } catch (error) {
    res.status(500).send({ success: false, message: 'Failed to update settings' });
  }
};

export const updateUserStatus = async (req: Request, res: Response) => {
  const email = req.params.email as string;
  const { status } = req.body;
  try {
    await AdminService.updateUserStatus(email, status, req.user?.email as string);
    res.send({
      success: true,
      message: `User account ${status} successfully.`,
    });
  } catch (error) {
    res.status(500).send({ success: false, message: 'Failed to update user status' });
  }
};

export const getAllParcels = async (req: Request, res: Response) => {
  try {
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
  } catch (error) {
    res.status(500).send({ success: false, message: 'Failed to fetch all parcels' });
  }
};

export const assignRider = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { riderId } = req.body;
  try {
    const result = await AdminService.assignRiderToParcel(
      id as string,
      riderId,
      req.user?.email as string,
    );
    if (!result.success) {
      return res.status(400).send(result);
    }
    res.send(result);
  } catch (error) {
    res.status(500).send({ success: false, message: 'Failed to assign rider' });
  }
};

export const getMerchants = async (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    const merchants = await AdminService.getMerchants(status as string);
    res.send({ success: true, data: merchants, merchants });
  } catch (error) {
    res.status(500).send({ success: false, message: 'Failed to fetch merchants' });
  }
};

export const updateMerchantStatus = async (req: Request, res: Response) => {
  try {
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
  } catch (error) {
    res.status(500).send({ success: false, message: 'Failed to update status' });
  }
};

export const updateRiderStatus = async (req: Request, res: Response) => {
  try {
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
  } catch (error) {
    res.status(500).send({ success: false, message: 'Failed to update rider status' });
  }
};

export const getFleet = async (req: Request, res: Response) => {
  try {
    const fleetStats = await AdminService.getFleetDistribution();
    res.send({ success: true, data: fleetStats });
  } catch (error) {
    res.status(500).send({ success: false, message: 'Failed to fetch fleet stats' });
  }
};

export const getPayouts = async (req: Request, res: Response) => {
  try {
    const payouts = await AdminService.getPayouts();
    res.send({ success: true, data: payouts, payouts });
  } catch (_error) {
    res.status(500).send({ success: false, message: 'Failed to fetch payouts' });
  }
};

export const updatePayoutStatus = async (req: Request, res: Response) => {
  try {
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
  } catch (error) {
    res.status(500).send({ success: false, message: 'Failed to update payout status' });
  }
};

export const getAllUsers = async (req: Request, res: Response) => {
  try {
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
  } catch (error) {
    res.status(500).send({ success: false, message: 'Failed to fetch users' });
  }
};
