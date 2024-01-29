import { User } from "../models/user.model";
import { ApiError } from "../utils/apiError";
import { asyncHandler } from "../utils/asyncHandler";


export const verifyToken = asyncHandler(async(req, res, next) => {
    try {
        //Get the token from cookie/headers
        const token = req.cookies?.accessToken || 
        req.headers("Authorization").replace("Bearer ", "")

        if (!token) {
            throw new ApiError(400, "Unauthorized Request")
        }
        //Verify the token
        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)

        const user = await User.findById(decodedToken._id)
        .select("-password -refreshToken")

        //Attach the user to req object
        req.user = user;
        
        next();
    } catch (error) {
        console.log(error); 
        throw new ApiError(401, error?.message || "Invalid access token")
    }
})