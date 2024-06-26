import {
    ApiError
} from "../utils/apiError.js";
import {
    asyncHandler
} from "../utils/asyncHandler.js";
import {
    User
} from "../models/user.model.js"
import {
    uploadToCloudinary
} from "../utils/FileUpload/Cloudinary.js";
import {
    ApiResponse
} from "../utils/ApiResponse.js";

import jwt from "jsonwebtoken"
import md5 from "md5"

const registerUser = asyncHandler(async (req, res) => {
    const {
        fullName,
        username,
        email,
        password
    } = req.body;

    //Validation Error if any
    if (
        [fullName, username, email, password].some(field =>
            field.trim() === "")
    ) {
        throw new ApiError(400, "Mandatory Fields required")
    }
    //Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        throw new ApiError(400, "Invalid Email Address")
    }

    //Check if user exists
    const is_exists = await User.findOne({
        $or: [{
            username
        }, {
            email
        }]
    })

    if (is_exists) {
        throw new ApiError(409, "User already exists")
    }

    //Get Avatar and cover images path
    const avatarLocalPath = req.files?.avatar[0]?.path;
    let coverImageLocalPath;

    if (req.files && Array.isArray(req.files.coverImage) &&
        req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path;
    }

    if (!avatarLocalPath) {
        throw new ApiError(400, "User Avatar is required")
    }

    //Upload to cloudinary
    const avatar_response = await uploadToCloudinary(avatarLocalPath);
    let cover_image_response = null;
    if (coverImageLocalPath) {
        cover_image_response = await uploadToCloudinary(coverImageLocalPath)
    }

    //Throw if avatar response if not found
    if (!avatar_response) {
        throw new ApiError(500, "Internal server error")
    }

    //Create User
    const user = await User.create({
        fullName,
        avatar: avatar_response.url,
        coverImage: cover_image_response?.url || "",
        email,
        username: username.toLowerCase(),
        password
    })

    if (!user) {
        throw new ApiError(500, "Something went wrong while creating user")
    }

    //Remove unnecessary fields
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User Created Succesfully")
    )
})


const loginUser = asyncHandler(async (req, res) => {
    const { email, username, password } = req.body;
    //Throw error if not present
    if (!email && !username) {
        throw new ApiError(400, "Username or email is required")
    }
    
    //Find the user
    const user = await User.findOne({
        $or: [{username}, {email}]
    })

    if (!user) {
        throw new ApiError(404, "User not exists")
    }

    //Validate the password
    const isPasswordCorrect = await user.isPasswordCorrect(password)
    if (!isPasswordCorrect) {
        throw new ApiError(400, "Invalid user credentials")
    }

    //Generate Access and refresh tokens
    const { accessToken, refreshToken }= await generateAccessAndRefreshTokens(user._id);

    //Logged In user info for response(without refreshToken and password)
    const loggedInUser = await User.findById(user._id)
    .select(
        "-refreshToken -password"
    )

    //Make cookie secured
    const options = {
        httpOnly: true,
        secure: true
    }
    return res.status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200, 
            { user: loggedInUser, accessToken, refreshToken },
            "User Loggedin Successfully"
        )
    )
})

const generateAccessAndRefreshTokens = async (userId) => {
    try {
        //Find the user
        const userDetails = await User.findById(userId);
        const accessToken = await userDetails.generateAccessToken();
        const refreshToken = await userDetails.generateRefreshToken();

        //DB Save: refreshToken to User
        userDetails.refreshToken = refreshToken;
        userDetails.save({validateBeforeSave: false}); //Explicit false to bypass validation checks

        return { accessToken, refreshToken }
    } catch (error) {
        throw new ApiError(500, "Error while generating access and refresh tokens")
    }
}

const logoutUser = asyncHandler(async (req, res) =>{
    //Update the refresh token of user, since req has user object
    await User.findByIdAndUpdate(
        { _id: req.user._id}, 
        {$unset: {refreshToken: 1}}
    )

    //Unset the cookies as well
    const options = {
        httpOnly: true,
        secure: true
    }

    return res.status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logout successfully"))

})

const refreshUserToken = asyncHandler(async (req, res) => {
    //Access incoming token with headers/cookies
    const rfToken = req.header("Authorization").replace("Bearer ", "")
                    || req.cookies.refreshToken;

    if (!rfToken) {
        throw new ApiError(401, "UnAuthorized request")
    }

    //Verify the incoming refresh token
    try {
        const decodedToken = jwt.verify(rfToken, process.env.REFRESH_TOKEN_SECRET);
    
        if (!decodedToken) {
            throw new ApiError(401, "UnAuthorized Token")
        }
    
        const saved_user = await User.findById(decodedToken._id);
    
        if (!saved_user) {
            new ApiError(401, "UnAuthorized token")
        }
    
        //Check: User stored refresh token and incoming refresh token (Using md5 Hash)
        const incomingRTHash = md5(rfToken);
        const userRTHash = md5(saved_user?.refreshToken)
    
        if (incomingRTHash !== userRTHash) {
            new ApiError(401, "Refresh Token is expired or used")
        }
    
        //Generate Access and Refresh Token and save user
        const { accessToken, newRefreshToken } = await generateAccessAndRefreshTokens(saved_user._id); //Generate and save in user db
    
        //Return the accessToken and refreshToken
        const options = {
            httpOnly: true,
            secure: true
        }
    
        return res.status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(
            new ApiResponse(200, {accessToken, refreshToken: newRefreshToken}, "Access Token refresh successful")
        )
    } catch (error) {
        console.log("refresh token error", error)
        throw new ApiError(401, error?.message || "Invalid refresh token")
    }

})

//Change password
const changeUserPassword = asyncHandler(async (req, res) => {
    //Get old and new passwords from request

    const { oldPassword, newPassword} = req.body;

    if (!oldPassword || !newPassword) {
        throw new ApiError(400, "Old and new password required")
    }

    //Get user details which given by middlware
    const userInfo = await User.findById(req.user?._id);

    if (!userInfo) {
        throw new ApiError(404, "User not found")
    }

    //Compare the passwords
    const isPasswordMatch = await userInfo.isPasswordCorrect(oldPassword)
    if (!isPasswordMatch) {
        throw new ApiError(400, "Old Password is not correct")
    }

    userInfo.password = newPassword
    await userInfo.save({ validateBeforeSave: false })

    return res.status(200).json(
        new ApiResponse(200, {}, "User password change successfully")
    )
})

//Updating Avatar or Cover Image
const updateAvatarOrCoverImage = asyncHandler(async(req, res) =>{
    const coverImageLocalPath = req?.files?.coverImage && req?.files?.coverImage[0]?.path;
    const avatarLocalPath = req?.files?.avatar && req?.files?.avatar[0]?.path

    if (!coverImageLocalPath && !avatarLocalPath) {
        throw new ApiError(400, "Please provide image to upload")
    }

    //Throw error if both passed
    if (coverImageLocalPath && avatarLocalPath) {
        throw new ApiError(400, "Either cover image or avatar accepted")
    }

    //TODO: Delete the existing coverImage | avatar

    let updatedUser = {}

    if (avatarLocalPath) {
        //Upload to cloudinary
        const avatarRemoteObj = await uploadToCloudinary(avatarLocalPath)
        if (avatarRemoteObj) {
            //Update the updated url of avatar
            updatedUser = await User.findByIdAndUpdate(
                { _id: req.user?._id}, 
                {
                    $set: {
                        avatar: avatarRemoteObj.url
                    }
                },
                { new: true }
            ).select("-password")
        }
    }

    //For CoverImage
    else {
        //Upload to cloudinary
        const coverImageRemoteObj = await uploadToCloudinary(coverImageLocalPath)
        if (coverImageRemoteObj) {
            //Update the updated url of coverImage
            updatedUser = await User.findByIdAndUpdate(
                { _id: req.user?._id}, 
                {
                    $set: {
                        coverImage: coverImageRemoteObj.url
                    }
                },
                { new: true }
            ).select("-password")
        }
    }

    return res.status(200)
    .json(new ApiResponse(200, updatedUser, "Image updated succesfully"))
})

//Get User Channel Profile details
const getChannelProfileDetails = asyncHandler(async (req, res) =>{
    const { username } = req?.params && req?.params?.username.trim();

    if (!username) {
        throw new ApiError(400, "User Profile required")
    }

    const channelDetails = await User.aggregate([
        {
            $match: {
                username: username.toLowerCase()
            },
        },
        {
            $lookup: {
                from: "subscriptions",
                let: { userId: "$_id" },
                pipeline: [
                    {
                        $match: {
                            $expr: {$eq: ["$$userId", "$channel"]}
                        }
                    },
                    {
                        $count: "totalCount"
                    }
                ],
                as: "subscriptionCount"
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                let: { userId: "$_id"},
                pipeline: [
                    {
                        $expr: { $eq: ["$$userId", "$subscriber"]}
                    },
                    {
                        $count: "totalCount"
                    }
                ],
                as: "channelSubscribedToCount"
            }
        },
        {
            $addFields: {
                subscribersCount: { $arrayElemAt: ["$subscriptionCount.totalCount", 0]},
                channelSubscriptionCount: { $arrayElemAt: ["channelSubscribedToCount.totalCount", 0]},
                isSubscribed: {
                    $in: ["$req.user?._id", "$subscribers.subscriber"]
                }
            }
        },
        {
            $project: {
                fullName: 1,
                username: 1,
                email: 1,
                avatar: 1,
                coverImage: 1,
                subscribersCount: 1,
                channelSubscriptionCount: 1,
                isSubscribed: 1
            }
        }
    ])

    if (!channelDetails || channelDetails.length === 0) {
        throw new ApiError(404, "Channel not found")
    }

    return res.status(200)
    .json(new ApiResponse(200, channelDetails[0], "User channel fetched succesfully"))
})

const getUserWatchHistory = asyncHandler(async (req, res) =>{
    const userWatchHistory = await User.aggregate([
        {
            $match: {
                _id: req.user?._id
            }
        },
        {
            $lookup: {
                from: 'videos',
                localField: 'watchHistory',
                foreignField: '_id',
                as: 'userWatchHistory',
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "ownerDetails",
                            pipeline: [
                                {
                                    $project: {
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields: {
                            owner: {
                                $first: "$ownerDetails"
                            }
                        }
                    }
                ]
            }
        }
    ])

    return res.status(200)
    .json(new ApiResponse(200, userWatchHistory[0].watchHistory, "User watch history fetched succesfully"))
})

const forgotPassword = asyncHandler(async(req,res) => {
     //Get user details which given by middlware
     const userInfo = await User.findById(req.user?._id);

     if (!userInfo) {
         throw new ApiError(404, "User not found")
     }
     userInfo.password = newPassword
     await userInfo.save({ validateBeforeSave: false })
 
     return res.status(200).json(
         new ApiResponse(200, {}, "User password change successfully")
     )
})
export {
    registerUser,
    loginUser,
    logoutUser,
    refreshUserToken,
    changeUserPassword,
    updateAvatarOrCoverImage,
    getChannelProfileDetails,
    getUserWatchHistory,
    forgotPassword
}