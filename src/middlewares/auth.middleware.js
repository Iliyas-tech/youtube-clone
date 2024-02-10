import { User } from "../models/user.model.js";
import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";


export const verifyToken = asyncHandler(async(req, res, next) => {
    try {
        //Get the token from cookie/headers
        console.log("req", req.header)
        const token = req?.cookies?.accessToken || 
        req?.header?.("Authorization")?.replace("Bearer ", "")

        if (!token) {
            throw new ApiError(400, "Unauthorized Request")
        }
        //Verify the token
        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)

        const user = await User.findById(decodedToken._id)
        .select("-password -refreshToken")

        if (!user) {
            throw new ApiError(401, "Invalid Access Token")
        }

        //Attach the user to req object
        req.user = user;
        
        next();
    } catch (error) {
        console.log(error); 
        throw new ApiError(401, error?.message || "Invalid access token")
    }
})