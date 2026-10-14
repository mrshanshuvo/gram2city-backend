import { Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { RiderService } from './rider.service';
import { ParcelModel } from '../../db/models';
import { io } from '../../socket/socket';

export const submitApplication = async (req: Request, res: Response) => {
  try {
    const application = {
      ...req.body,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    const result = await RiderService.submitApplication(application);

    if (io) {
      io.emit('new_rider_application', {
        name: application.name,
        email: application.email,
        district: application.district,
      });
    }

    res
      .status(201)
      .send({ success: true, insertedId: (result as any)._id || (result as any).insertedId });
  } catch (error) {
    res.status(500).send({ success: false, message: 'Failed to submit application' });
  }
};

export const getAllRiders = async (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    const pageNum = parseInt(req.query.page as string) || 1;
    const sizeNum = parseInt(req.query.size as string) || 50;

    const { riders, totalItems } = await RiderService.getAllRiders(
      status as string,
      pageNum,
      sizeNum,
    );
    const totalPages = Math.ceil(totalItems / sizeNum);

    res.send({
      status: 'success',
      data: riders,
      pagination: {
        totalItems,
        totalPages,
        currentPage: pageNum,
        limit: sizeNum,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      },
    });
  } catch (error) {
    res.status(500).send({ success: false, message: 'Failed to fetch riders' });
  }
};

export const getAssignedParcels = async (req: Request, res: Response) => {
  try {
    const riderEmail = req.user?.email as string;
    const rider = await RiderService.getRiderByEmail(riderEmail);

    if (!rider)
      return res.status(404).send({ success: false, message: 'Rider profile not found.' });

    const parcels = await RiderService.getAssignedParcels(new ObjectId(String(rider._id)));
    res.send({ success: true, count: parcels.length, data: parcels });
  } catch (error) {
    res.status(500).send({ success: false, message: 'Failed to fetch assigned parcels.' });
  }
};

export const updateParcelDeliveryStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { delivery_status } = req.body;
    const riderEmail = req.user?.email as string;

    const rider = await RiderService.getRiderByEmail(riderEmail);
    if (!rider) return res.status(404).send({ success: false, message: 'Rider not found.' });

    const result = await RiderService.updateParcelDeliveryStatus(
      id as string,
      new ObjectId(String(rider._id)),
      delivery_status,
    );
    if (!result.success) {
      return res.status(404).send(result);
    }
    res.send(result);
  } catch (error) {
    res.status(500).send({ success: false, message: 'Failed to update status.' });
  }
};

export const getRiderReviews = async (req: Request, res: Response) => {
  try {
    const email = req.user?.email as string;
    const reviews = await RiderService.getRiderReviews(email);
    res.send({ success: true, count: reviews.length, data: reviews });
  } catch (error) {
    res.status(500).send({ success: false, message: 'Failed to fetch reviews.' });
  }
};

export const getRiderStats = async (req: Request, res: Response) => {
  try {
    const email = (req.params.email || req.user?.email) as string;
    const stats = await RiderService.getRiderStats(email);
    res.send({ success: true, stats, ...stats });
  } catch (error) {
    res.status(500).send({ success: false, message: 'Failed to fetch stats.' });
  }
};

export const requestPayout = async (req: Request, res: Response) => {
  try {
    const email = req.user?.email as string;
    const { parcelId } = req.body;
    let { amount } = req.body;

    if (!amount && parcelId) {
      const parcel = await ParcelModel.findOne({ _id: new ObjectId(String(parcelId)) }).lean();
      if (!parcel) {
        return res.status(404).send({ success: false, message: 'Parcel not found.' });
      }
      amount = parcel.rider_earning || 0;
    }

    if (!amount || Number(amount) < 50) {
      return res.status(400).send({ success: false, message: 'Minimum payout amount is 50 BDT.' });
    }

    const result = await RiderService.requestPayout(email, Number(amount), parcelId);
    if (!result.success) {
      return res.status(400).send(result);
    }
    res.send(result);
  } catch (error) {
    res.status(500).send({ success: false, message: 'Failed to request payout' });
  }
};
