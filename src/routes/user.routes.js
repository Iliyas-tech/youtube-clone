import { Router } from "express"
import { registerUser, loginUser, logoutUser, refreshUserToken, changeUserPassword, updateAvatarOrCoverImage, getChannelProfileDetails, getUserWatchHistory } from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyToken } from "../middlewares/auth.middleware.js";

const router = Router();

//Register User with File upload as middleware
router.route("/register").post(
    upload.fields([
        {
            name: "avatar",
            maxCount: 1
        },
        {
            name: "coverImage",
            maxCount: 1
        }
    ]), 
    registerUser
)

//Login User
router.route("/login").post(loginUser);

//Logout
router.route("/logout").post(verifyToken, logoutUser)

//Refresh Token
router.route("/refresh-token").post(refreshUserToken)

//Change User Password
//Middleware added so that we can only allow to change only when user logs in
router.route("/change-password").post(verifyToken, changeUserPassword); 

//Update coverImage or avatar
router.route("/update-image").patch(
    verifyToken,  //Allow to upload images only if logged in
    upload.fields([
        {
            name: "avatar",
            maxCount: 1
        },
        {
            name: "coverImage",
            maxCount: 1
        }
    ]),
    updateAvatarOrCoverImage
)

//Get User channel profile
router.route("/channel/:username").get(verifyToken, getChannelProfileDetails)

//Get User Watch History
router.route("/watch-history").get(verifyToken, getUserWatchHistory)

export default router