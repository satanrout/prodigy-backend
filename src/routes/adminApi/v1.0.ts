import express, { Request } from "express";
import multer from "multer";
import adminController from "../../controller/adminController";

const router = express.Router();
const uploadProduct = multer({ dest: "./public/images/products/" });

router.get("/admin/v1.0/test", adminController.testAdmin);

router.get("/admin/v1.0/product/:id", adminController.getProduct);

router.get("/admin/v1.0/products", adminController.getProducts);

router.post("/admin/v1.0/add_product", adminController.addProduct);

router.put("/admin/v1.0/update_product", adminController.updateProduct);

router.post("/admin/v1.0/update_images", adminController.updateProductPhotos);

router.delete("/admin/v1.0/delete_images", adminController.deleteProductPhotos);

router.post("/admin/v1.0/upload_images", adminController.uploadProductPhotos);

module.exports = router;
