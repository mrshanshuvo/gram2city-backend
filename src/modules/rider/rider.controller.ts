import { Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { RiderService } from './rider.service';
import { ParcelModel } from '../../db/models';
import { io } from '../../socket/socket';
import { catchAsync } from '../../utils/catchAsync';

export const submitApplication = catchAsync(async (req: Request, res: Response) => {
  const application = {
    ...req.body,
    status: 'pending' as const,
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

  res.status(201).send({ success: true, insertedId: result._id.toString() });
});

export const getAllRiders = catchAsync(async (req: Request, res: Response) => {
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
});

export const getAssignedParcels = catchAsync(async (req: Request, res: Response) => {
  const riderEmail = req.user?.email as string;
  const rider = await RiderService.getRiderByEmail(riderEmail);

  if (!rider) return res.status(404).send({ success: false, message: 'Rider profile not found.' });

  const parcels = await RiderService.getAssignedParcels(new ObjectId(String(rider._id)));
  res.send({ success: true, count: parcels.length, data: parcels });
});

export const updateParcelDeliveryStatus = catchAsync(async (req: Request, res: Response) => {
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
});

export const getRiderReviews = catchAsync(async (req: Request, res: Response) => {
  const email = req.user?.email as string;
  const reviews = await RiderService.getRiderReviews(email);
  res.send({ success: true, count: reviews.length, data: reviews });
});

export const getRiderStats = catchAsync(async (req: Request, res: Response) => {
  const email = (req.params.email || req.user?.email) as string;
  const stats = await RiderService.getRiderStats(email);
  res.send({ success: true, stats, ...stats });
});

export const requestPayout = catchAsync(async (req: Request, res: Response) => {
  const email = req.user?.email as string;
  const { parcelId } = req.body;
  let { amount } = req.body;

  if (!amount && parcelId) {
    if (!ObjectId.isValid(String(parcelId))) {
      return res.status(400).send({ success: false, message: 'Invalid parcel ID.' });
    }
    const parcel = await ParcelModel.findOne({ _id: new ObjectId(String(parcelId)) }).lean();
    if (!parcel) {
      return res.status(404).send({ success: false, message: 'Parcel not found.' });
    }
    if (parcel.assigned_rider_email !== email) {
      return res
        .status(403)
        .send({ success: false, message: 'You are not assigned to this parcel.' });
    }
    if (parcel.delivery_status !== 'delivered') {
      return res
        .status(400)
        .send({ success: false, message: 'Parcel must be delivered before requesting cashout.' });
    }
    amount = parcel.rider_earning || 0;
  }

  if (parcelId) {
    if (!amount || Number(amount) <= 0) {
      return res
        .status(400)
        .send({ success: false, message: 'No valid earnings found for this parcel.' });
    }
  } else {
    if (!amount || Number(amount) < 50) {
      return res.status(400).send({ success: false, message: 'Minimum payout amount is 50 BDT.' });
    }
  }

  const result = await RiderService.requestPayout(email, Number(amount), parcelId);
  if (!result.success) {
    return res.status(400).send(result);
  }
  res.send(result);
});
