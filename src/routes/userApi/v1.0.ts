import userController from "../../controller/userController";
import helper from "../../helper";

const express = require("express");

const router = express.Router();

router.get("/user/v1.0/product/:id", userController.getProduct);

router.get("/user/v1.0/products", userController.getProducts);

router.post("/user/v1.0/search", userController.searchProducts);

router.post("/user/v1.0/signup", userController.signUp);

router.post("/user/v1.0/login", userController.login);

//logout will be done from the frontend by deleting the token from the local storage or cookies
// router.post("/user/v1.0/logout", userController.logout);

router.post("/user/v1.0/wishlist", helper.validateToken, userController.addToWishlist);

router.delete("/user/v1.0/wishlist", helper.validateToken, userController.removeFromWishlist);

router.get("/user/v1.0/wishlist", helper.validateToken, userController.getWishlist);

module.exports = router;
