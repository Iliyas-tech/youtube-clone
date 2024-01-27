import { v2 as cloudinary } from "cloudinary"
import fs from "fs"
          
cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadToCloudinary = async (localFilePath) =>{
    try {
        if (!localFilePath) return null;

        //Upload to cloudinary
        const fileUploadedResponse = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto" //Detect the file extension automatically
        })
        //unlink file after uploaded to cloudinary
        fs.unlinkSync(localFilePath)
        return fileUploadedResponse
    }
    catch(error) {
        console.log("Error while uploading file to cloudinary", error)
        /* Unlink/Remove locally saved temp file */
        fs.unlinkSync(localFilePath)
        return null;
    }
}

export {uploadToCloudinary}