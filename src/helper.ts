import { NextFunction, Response } from "express";
const sharp = require("sharp");
const bcrypt = require("bcrypt");
const JWT = require("jsonwebtoken");
const multer = require("multer");
import fs from "fs";
import { responseObject } from "./helper.interface";
const Models = require("./models");

const helper = {
  dieJsonSuccess: (res: Response, result: [], msg: string, httpCode: number) => {
    result = result || [];
    let arr: responseObject = {};
    arr.status = true;
    arr.msg = msg;
    arr.data = result;
    return res.status(httpCode).send(arr);
  },

  dieJsonError: (res: Response, result: [], msg: string, httpCode: number) => {
    result = result || [];
    let arr: responseObject = {};
    arr.status = false;
    arr.msg = msg;
    arr.data = result;
    return res.status(httpCode).send(arr);
  },

  dieJsonErrorDefault: (res: Response, error?: any) => {
    const message: string = error?.message || "Something went wrong";
    helper.dieJsonError(res, [], message, 500);
  },

  validationError: (res: Response, errorMessage: string) => {
    helper.dieJsonError(res, [], errorMessage, 400);
  },

  convertPicture: (file: any, path: string) => {
    return new Promise(async (resolve, reject) => {
      try {
        const tempName = file.filename.substr(0, file.filename.lastIndexOf("."));
        const urlPath = path.substr(1, path.length);
        const converted = tempName + ".webp";
        const convertedAvif = tempName + ".avif";

        const webp = await sharp(file.path)
          .toFormat("webp")
          .toFile(path + converted, (err: any, info: any) => err && reject(err));

        const avif = await sharp(file.path)
          .toFormat("avif")
          .toFile(path + convertedAvif, (err: any, info: any) => err && reject(err));

        if (webp && avif) {
          const result = {
            original: urlPath + file.filename,
            webp: urlPath + converted,
            avif: urlPath + convertedAvif,
            path: urlPath,
          };
          return resolve(result);
        }
        return reject("error converting file");
      } catch (error) {
        return reject(error);
      }
    });
  },

  uploadPhotos: (req: any, res: Response, path: string) => {
    return new Promise(async (resolve, reject) => {
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

      multi_upload(req as any, res, function (err: any) {
        if (err) return reject(err);

        // Everything went fine.
        Promise.all((req.files as any[]).map((file: Express.Multer.File) => helper.convertPicture(file, path)))
          .then((data: []) => resolve(data))
          .catch((err) => {
            (req.files as any[]).map((file: Express.Multer.File) =>
              fs.unlink(file.path, (err: any) => console.log(err))
            );
            return reject(err);
          });
      });
    });
  },
  unlinkFiles: (paths: string[]) => {
    console.log("unlinkFiles", paths);
    return new Promise(async (resolve, reject) => {
      Promise.all(
        paths.map((path: any) => {
          fs.unlink("." + path, (err: any) => {
            if (err) return resolve(false);
            return resolve(true);
          });
        })
      );
    });
  },
  deleteImagesById: (idArr: number[]) => {
    return new Promise(async (resolve, reject) => {
      try {
        await Models.Images.destroy({
          where: {
            id: idArr,
          },
        });
        resolve(true);
      } catch (error) {
        reject(error);
      }
    });
  },
  hashPassword: async (password: string) => {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    return hash;
  },
  comparePassword: async (password: string, hash: string) => {
    const result = await bcrypt.compare(password, hash);
    console.log(result);
    return result;
  },
  generateToken: (res: Response, payload: {}) => {
    try {
      const token = JWT.sign(payload, process.env.JWT_SECRET_KEY);
      if (!token) res.status(500).json({ message: "unable to generate token" });
      return token;
    } catch (error) {
      res.status(500).json({ status: "error", message: error });
    }
  },

  validateToken: (req: any, res: Response, next: NextFunction) => {
    try {
      if (!req.headers.authorization) return res.status(401).json({ status: "error", message: "no token provided" });

      const token = req.headers.authorization.split(" ")[1];
      if (!token) return res.status(401).json({ message: "No token provided" });

      const decoded = JWT.verify(token, process.env.JWT_SECRET_KEY);
      if (!decoded) return res.status(401).json({ status: "error", message: "Invalid token" });

      req.user = decoded;
      next();
    } catch (error) {
      res.status(401).json({
        status: "error",
        error: error,
      });
    }
  },
  findUserByEmail: async (email: string) => {
    return new Promise(async (resolve, reject) => {
      try {
        const user = await Models.Users.findOne({
          where: {
            email: email,
          },
        });
        resolve(user);
      } catch (error) {
        reject(error);
      }
    });
  },
  incrementViews: async (id: number) => {
    return new Promise(async (resolve, reject) => {
      try {
        const views = await Models.Products.findOne({
          where: {
            id: id,
          },
        });
        if (views) {
          await views.increment("views");
          resolve(true);
        } else {
          resolve(false);
        }
      } catch (error) {
        reject(error);
      }
    });
  },
  incrementLikes: async (id: number) => {
    return new Promise(async (resolve, reject) => {
      try {
        const likes = await Models.Products.findOne({
          where: {
            id: id,
          },
        });
        if (likes) {
          await likes.increment("likes");
          resolve(true);
        } else {
          resolve(false);
        }
      } catch (error) {
        reject(error);
      }
    });
  },
  decrementLikes: async (id: number) => {
    return new Promise(async (resolve, reject) => {
      try {
        const likes = await Models.Products.findOne({
          where: {
            id: id,
          },
        });
        if (likes) {
          await likes.decrement("likes");
          resolve(true);
        } else {
          resolve(false);
        }
      } catch (error) {
        reject(error);
      }
    });
  },
  getLikesByProductId: async (id: number) => {
    return new Promise(async (resolve, reject) => {
      try {
        const wishlists = await Models.Wishlists.count({
          where: {
            productId: id,
          },
        });
        resolve(wishlists);
      } catch (error) {
        reject(error);
      }
    });
  },
  findWishlist: async (userId: number, productId: number) => {
    return new Promise(async (resolve, reject) => {
      try {
        const wishlist = await Models.Wishlists.findOne({
          where: {
            userId: userId,
            productId: productId,
          },
        });
        resolve(wishlist);
      } catch (error) {
        reject(error);
      }
    });
  },
  removeWishlist: async (userId: number, productId: number) => {
    return new Promise(async (resolve, reject) => {
      try {
        await Models.Wishlists.destroy({
          where: {
            userId: userId,
            productId: productId,
          },
        });
        resolve(true);
      } catch (error) {
        reject(error);
      }
    });
  },
};

export default helper;
