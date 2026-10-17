import { Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { ParcelService } from './parcel.service';
import { Parcel } from './parcel.interface';
import { io } from '../../socket/socket';
import { uploadToCloudinary } from '../../utils/upload';
import { catchAsync } from '../../utils/catchAsync';

export const getMyParcels = catchAsync(async (req: Request, res: Response) => {
  const email = (req.query.email as string) || (req.user?.email as string);
  const { payment_status, delivery_status, rider_email } = req.query;

  const parcels = await ParcelService.getMyParcels(
    email,
    payment_status as string,
    delivery_status as string,
    rider_email as string,
  );

  res.send({ success: true, count: parcels.length, data: parcels, parcels });
});

export const getMyParcelStats = catchAsync(async (req: Request, res: Response) => {
  const email = req.user?.email as string;
  const stats = await ParcelService.getMyParcelStats(email);
  res.send({ success: true, stats });
});

export const bookParcel = catchAsync(async (req: Request, res: Response) => {
  const {
    parcelName,
    parcelType,
    weight,
    receiverName,
    receiverPhone,
    deliveryAddress,
    receiverDistrict,
    senderPhone,
    deliveryDate,
    requiredVehicle = 'bike',
    merchantId,
    codAmount,
  } = req.body;

  if (
    !parcelName ||
    !weight ||
    !receiverName ||
    !receiverPhone ||
    !deliveryAddress ||
    !receiverDistrict
  ) {
    return res.status(400).send({ success: false, message: 'Missing required fields.' });
  }

  const weightNum = Number(weight);
  const { totalCost, riderEarning, adminProfit } = await ParcelService.calculateCost(
    weightNum,
    requiredVehicle as string,
  );

  const trackingId = `G2C-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  const newParcel: Parcel = {
    trackingId,
    parcelName,
    parcelType,
    created_by: req.user?.email as string,
    creation_date: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    weight: weightNum,
    parcelWeight: weightNum,
    receiverName,
    receiverPhone,
    receiverPhoneNumber: receiverPhone,
    deliveryAddress,
    receiverDistrict,
    receiverRegion: receiverDistrict,
    senderPhone,
    senderContact: senderPhone,
    senderDistrict: req.body.senderDistrict || '',
    senderRegion: req.body.senderDistrict || '',
    senderName: req.body.senderName || req.user?.name || 'Anonymous',
    deliveryDate,
    cost: totalCost,
    rider_earning: riderEarning,
    admin_profit: adminProfit,
    payment_status: 'unpaid',
    delivery_status: 'pending',
    requiredVehicle: requiredVehicle as Parcel['requiredVehicle'],
    merchantId: merchantId ? new ObjectId(String(merchantId)) : undefined,
    codAmount: codAmount ? Number(codAmount) : undefined,
  };

  const result = await ParcelService.bookParcel(newParcel);

  if (io) {
    io.emit('new_parcel', {
      trackingId,
      sender: newParcel.senderName,
      destination: newParcel.receiverDistrict,
      cost: totalCost,
    });
  }

  res.status(201).send({
    success: true,
    message: 'Parcel booked successfully!',
    trackingId,
    cost: totalCost,
    id: result.insertedId,
  });
});

export const getParcelById = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const email = req.user?.email as string;

  const parcel = await ParcelService.getParcelById(id as string);

  if (!parcel) {
    return res.status(404).send({ success: false, message: 'Parcel not found.' });
  }

  if (parcel.created_by !== email && req.user?.role !== 'admin') {
    return res.status(403).send({ success: false, message: 'Unauthorized access.' });
  }

  res.send({ success: true, data: parcel });
});

export const updateParcel = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const email = req.user?.email as string;
  const updateData = req.body;

  const parcel = await ParcelService.getParcelById(id as string);

  if (!parcel) {
    return res.status(404).send({ success: false, message: 'Parcel not found.' });
  }

  if (parcel.created_by !== email) {
    return res.status(403).send({ success: false, message: 'Unauthorized.' });
  }

  if (parcel.delivery_status !== 'pending') {
    return res.status(400).send({
      success: false,
      message: 'Cannot update a parcel that is already in transit.',
    });
  }

  if (updateData.weight) {
    const weightNum = Number(updateData.weight);
    const { totalCost, riderEarning, adminProfit } = await ParcelService.calculateCost(
      weightNum,
      parcel.requiredVehicle,
    );

    updateData.cost = totalCost;
    updateData.rider_earning = riderEarning;
    updateData.admin_profit = adminProfit;
    updateData.parcelWeight = weightNum;
  }

  if (updateData.receiverPhone) updateData.receiverPhoneNumber = updateData.receiverPhone;
  if (updateData.receiverDistrict) updateData.receiverRegion = updateData.receiverDistrict;

  await ParcelService.updateParcel(id as string, updateData);

  res.send({ success: true, message: 'Parcel updated successfully.' });
});

export const deleteParcel = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const email = req.user?.email as string;

  const parcel = await ParcelService.getParcelById(id as string);

  if (!parcel) return res.status(404).send({ success: false, message: 'Parcel not found.' });

  if (parcel.created_by !== email) {
    return res.status(403).send({
      success: false,
      message: 'Unauthorized to cancel this parcel.',
    });
  }

  if (parcel.delivery_status !== 'pending') {
    return res.status(400).send({
      success: false,
      message: 'Cannot cancel a parcel that is already assigned or in transit.',
    });
  }

  await ParcelService.deleteParcel(id as string);
  res.send({ success: true, message: 'Parcel cancelled successfully.' });
});

export const markPicked = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await ParcelService.markPicked(id as string);

  if (result.modifiedCount === 0) {
    return res.status(404).send({ success: false, message: 'Parcel not found' });
  }

  res.send({ success: true, message: 'Parcel picked up successfully.' });
});

export const bulkIngestParcels = catchAsync(async (req: Request, res: Response) => {
  const { parcels, merchantId } = req.body;
  if (!Array.isArray(parcels))
    return res.status(400).send({ success: false, message: 'Invalid data format' });

  const newParcels = (parcels as Array<Record<string, unknown>>).map(
    (p) =>
      ({
        trackingId: `G2C-B-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        parcelName: (p.parcelName as string) || 'Bulk Item',
        parcelType: (p.parcelType as string) || 'Package',
        created_by: req.user?.email as string,
        creation_date: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        weight: Number(p.weight) || 1,
        parcelWeight: Number(p.weight) || 1,
        receiverName: p.receiverName as string,
        receiverPhone: p.receiverPhone as string,
        receiverPhoneNumber: p.receiverPhone as string,
        deliveryAddress: p.deliveryAddress as string,
        receiverDistrict: p.receiverDistrict as string,
        receiverRegion: p.receiverDistrict as string,
        senderName: req.user?.name || 'Merchant',
        senderPhone: (p.senderPhone as string) || '',
        cost: Number(p.cost) || 50,
        payment_status: 'unpaid' as const,
        delivery_status: 'pending' as const,
        merchantId: merchantId ? new ObjectId(String(merchantId)) : undefined,
        codAmount: Number(p.codAmount) || 0,
      }) as Parcel,
  );

  await ParcelService.bulkIngestParcels(newParcels, req.user?.email as string);

  res.status(201).send({
    success: true,
    message: `${newParcels.length} parcels uploaded successfully.`,
  });
});

export const markDelivered = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await ParcelService.markDelivered(id as string);

  if (result.modifiedCount === 0) {
    return res.status(404).send({ success: false, message: 'Parcel not found' });
  }

  res.send({ success: true, message: 'Parcel delivered successfully.' });
});

export const getTrackingHistory = catchAsync(async (req: Request, res: Response) => {
  const { trackingId } = req.params;
  const updates = await ParcelService.getTrackingHistory(trackingId as string);

  if (updates.length === 0) {
    return res.status(404).send({
      success: false,
      message: 'No tracking history found for this ID.',
    });
  }

  res.send({ success: true, trackingId, history: updates });
});

export const getRecentTrackings = catchAsync(async (_req: Request, res: Response) => {
  const recentUpdates = await ParcelService.getRecentTrackings();
  res.send({ success: true, history: recentUpdates });
});

export const addManualTrackingUpdate = catchAsync(async (req: Request, res: Response) => {
  const { trackingId, status, details, location } = req.body;

  if (!trackingId || !status || !details) {
    return res.status(400).send({ success: false, message: 'Missing required fields' });
  }

  const result = await ParcelService.addManualTrackingUpdate(trackingId, status, details, location);
  res.status(201).send({
    success: true,
    message: 'Tracking update added.',
    id:
      (result as { _id?: unknown; insertedId?: unknown })._id ||
      (result as { insertedId?: unknown }).insertedId,
  });
});

export const uploadImage = catchAsync(async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).send({
      success: false,
      message: 'No file uploaded or file type not supported',
    });
  }

  const url = await uploadToCloudinary(req.file, 'gram2city/parcels');
  res.send({ success: true, url });
});
