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

    if (rfToken) {
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

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshUserToken
}