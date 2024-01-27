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

export {
    registerUser
}