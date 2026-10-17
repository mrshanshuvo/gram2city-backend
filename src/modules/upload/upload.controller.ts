import { Request, Response } from 'express';
import { v2 as cloudinary } from 'cloudinary';
import { config } from '../../config';
import { catchAsync } from '../../utils/catchAsync';
import { AllowedUploadFolder } from './upload.schema';

// Ensure Cloudinary SDK is initialized with credentials
cloudinary.config({
  cloud_name: config.CLOUDINARY_CLOUD_NAME,
  api_key: config.CLOUDINARY_API_KEY,
  api_secret: config.CLOUDINARY_API_SECRET,
});

export const getUploadSignature = catchAsync(async (req: Request, res: Response) => {
  const folder: AllowedUploadFolder = (req.body?.folder as AllowedUploadFolder) || 'gram2city/chat';
  const timestamp = Math.floor(Date.now() / 1000);

  const paramsToSign = {
    folder,
    timestamp,
  };

  const signature = cloudinary.utils.api_sign_request(paramsToSign, config.CLOUDINARY_API_SECRET);

  res.status(200).json({
    success: true,
    data: {
      signature,
      timestamp,
      apiKey: config.CLOUDINARY_API_KEY,
      cloudName: config.CLOUDINARY_CLOUD_NAME,
      folder,
    },
  });
});
