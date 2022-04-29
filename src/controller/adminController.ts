import { Request, Response } from "express";
const Models = require("../models");
const multer = require("multer");
import fs from "fs";
const Joi = require("joi");
// import Joi from "joi";
const sequelize = require("../models/index").sequelize;
import helper from "../helper";

const adminController = {
  testAdmin: (req: Request, res: Response) => {
    res.send("admin api v1.0 test2");
  },

  addProduct: async (req: Request, res: Response) => {
    const t = await sequelize.transaction();
    try {
      const schema = Joi.object().keys({
        title: Joi.string().min(2).required(),
        description: Joi.string().min(10).required(),
        brand: Joi.string().min(2).required(),
        type: Joi.string().min(2).required(),
        price: Joi.number().required(),
        discount: Joi.number().required(),
        images: Joi.array().required(),
      });
      const result = schema.validate(req.body);
      if (result.error) {
        return helper.validationError(res, result.error?.details?.[0]?.message || "Validation error");
      }
      const { images, ...productData } = req.body;
      const product = await Models.Products.create(productData);
      if (images) {
        for (let i = 0; i < images.length; i++) {
          await Models.Images.create(
            {
              productId: product.id,
              ...images[i],
            },
            { transaction: t }
          );
        }
      }
      await t.commit();
      return helper.dieJsonSuccess(res, [], "added product successfully", 200);
    } catch (error) {
      return helper.dieJsonError(res, [], error?.message || "Something went wrong when adding product", 400);
    }
  },

  updateProduct: async (req: Request, res: Response) => {
    const t = await sequelize.transaction();
    try {
      const { id, images, deleteImages, ...productData } = req.body;
      const updateSchema = Joi.object().keys({
        title: Joi.string().min(2),
        description: Joi.string().min(10),
        brand: Joi.string().min(2),
        type: Joi.string().min(2),
        price: Joi.number(),
        discount: Joi.number(),
        images: Joi.array(),
        deleteImages: Joi.array(),
      });
      const validationResult = updateSchema.validate(productData);
      if (validationResult.error) {
        return helper.validationError(res, validationResult.error?.details?.[0]?.message || "Validation error");
      }
      const product = await Models.Products.update(productData, {
        where: {
          id: req.body.id,
        },
        transaction: t,
      });
      if (!product) {
        return helper.dieJsonError(res, [], "Unable to update product", 404);
      }
      if (images) {
        for (let i = 0; i < images.length; i++) {
          const imageUpdate = await Models.Images.create(
            {
              productId: id,
              ...images[i],
            },
            { transaction: t }
          );
          if (!imageUpdate) {
            await t.rollback();
            return helper.dieJsonError(res, [], "Unable to update product", 404);
          }
        }
      }
      console.log({ deleteImages });
      if (deleteImages) {
        const imagePaths: string[] = deleteImages
          .map((image: any) => {
            return [image.original, image.avif, image.webp];
          })
          .flat();
        const imageIds: number[] = deleteImages.map((image: any) => image.id);
        await helper.deleteImagesById(imageIds);
        const status = await helper.unlinkFiles(imagePaths);
        if (!status) {
          await t.commit();
          return helper.dieJsonSuccess(res, [], "updated products with some error in removing images", 200);
        }
      }
      await t.commit();
      return helper.dieJsonSuccess(res, [], "updated product successfully", 200);
    } catch (error) {
      await t.rollback();
      return helper.dieJsonError(res, [], error?.message || "Something went wrong when updating product", 400);
    }
  },

  getProduct: async (req: Request, res: Response) => {
    try {
      const likeCount = await helper.getLikesByProductId(Number(req.params.id));
      const product = await Models.Products.findOne({
        where: {
          id: req.params.id,
        },
        include: [
          {
            model: Models.Images,
            as: "images",
          },
        ],
      });
      if (!product) {
        return helper.dieJsonError(res, [], "Product not found", 404);
      }
      product.dataValues.likes = likeCount;
      return helper.dieJsonSuccess(res, product, "successfull", 200);
    } catch (error) {
      helper.dieJsonErrorDefault(res, error);
    }
  },

  getProducts: async (req: Request, res: Response) => {
    try {
      const page: number = Number(req.query.page) || 1;
      const limit: number = Number(req.query.limit) || 10;
      const offset = limit * (page - 1);
      const products = await Models.Products.findAndCountAll({
        include: [
          {
            model: Models.Images,
            as: "images",
          },
        ],
        distinct: true,
        limit,
        offset,
      });
      if (!products) {
        return helper.dieJsonError(res, [], "Products not found", 404);
      }
      products.totalPages = Math.ceil(products.count / limit);
      products.page = page;
      products.pageSize = limit;
      Promise.all(
        products.rows.map(async (product: any) => {
          const likeCount = await helper.getLikesByProductId(product.id);
          product.dataValues.likes = likeCount;
          return product;
        })
      ).then(() => helper.dieJsonSuccess(res, products, "successfull", 200));
    } catch (error) {
      helper.dieJsonErrorDefault(res, error);
    }
  },

  uploadProductPhotos: async (req: Request, res: Response) => {
    try {
      const path = "./public/images/products/";

      const storage = multer.diskStorage({
        destination: function (
          req: Request,
          file: Express.Multer.File,
          cb: (error: Error | null, destination: string) => void
        ) {
          cb(null, path);
        },
        filename: function (
          req: Request,
          file: Express.Multer.File,
          cb: (error: Error | null, destination: string) => void
        ) {
          cb(null, file.fieldname + "-" + Date.now() + file.originalname.match(/\..*$/)[0]);
        },
      });

      const multi_upload = multer({
        storage,
        limits: { fileSize: 1 * 1024 * 1024 * 10 }, // 1MB
        fileFilter: (req: Request, file: Express.Multer.File, cb: any) => {
          if (file.mimetype == "image/png" || file.mimetype == "image/jpg" || file.mimetype == "image/jpeg") {
            cb(null, true);
          } else {
            cb(null, false);
            const err = new Error("Only .png, .jpg and .jpeg format allowed!");
            err.name = "ExtensionError";
            return cb(err);
          }
        },
      }).array("images", 12);

      multi_upload(req, res, function (err: any) {
        if (err) return helper.dieJsonError(res, [], err.message || "Something went wrong when uploading images", 400);

        // Everything went fine.
        Promise.all((req.files as any[]).map((file: Express.Multer.File) => helper.convertPicture(file, path)))
          .then((data: []) => helper.dieJsonSuccess(res, data, "Successfully uploaded images", 200))
          .catch((err) => {
            (req.files as any).map((file: Express.Multer.File) => fs.unlink(file.path, (err: any) => console.log(err)));
            return helper.dieJsonErrorDefault(res, err);
          });
      });
    } catch (error) {
      return helper.dieJsonError(res, [], error?.message || "Something went wrong when uploading images", 400);
    }
  },

  //update product photos is not needed as we are not updating product photos, we are just adding new photos. So we can use the same uploadProductPhotos api. for updating photos we can use updateProduct api.
  updateProductPhotos: async (req: Request, res: Response) => {
    try {
      const path = "./public/images/products/";
      const data: any = await helper.uploadPhotos(req as any, res, path);
      if (!data) {
        return helper.dieJsonError(res, [], "Unable to update product photos", 404);
      }
      helper.dieJsonSuccess(res, data, "Successfully uploaded images", 200);
    } catch (error) {
      return helper.dieJsonError(res, [], error?.message || "Something went wrong when uploading images", 400);
    }
  },

  deleteProductPhotos: async (req: Request, res: Response) => {
    try {
      const { deleteImages } = req.body;
      const imagePaths: string[] = deleteImages
        .map((image: any) => {
          return [image.original, image.avif, image.webp];
        })
        .flat();
      await helper.unlinkFiles(imagePaths);
      helper.dieJsonSuccess(res, [], "Successfully deleted images", 200);
    } catch (error) {
      return helper.dieJsonError(res, [], error?.message || "Something went wrong when deleting images", 400);
    }
  },
};

export default adminController;
