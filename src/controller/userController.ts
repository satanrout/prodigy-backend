import { Request, Response } from "express";
import Joi from "joi";
const { Op } = require("sequelize");
const Models = require("../models");
import helper from "../helper";

const userController = {
  getProduct: async (req: any, res: Response) => {
    try {
      const incrementViews = await helper.incrementViews(req.params.id);

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

      if (!incrementViews) {
        return helper.dieJsonSuccess(res, product, "successful but unable to increment views", 200);
      }
      return helper.dieJsonSuccess(res, product, "successful", 200);
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
      return helper.dieJsonSuccess(res, products, "successfull", 200);
    } catch (error) {
      helper.dieJsonErrorDefault(res, error);
    }
  },

  searchProducts: async (req: Request, res: Response) => {
    try {
      const page: number = req.body.page || 1;
      const limit: number = req.body.limit || 10;
      const offset = limit * (page - 1);
      const query = req.body.query;
      const products = await Models.Products.findAndCountAll({
        where: {
          [Op.or]: [
            {
              title: {
                [Op.like]: `%${query}%`,
              },
            },
            {
              brand: {
                [Op.like]: `%${query}%`,
              },
            },
            {
              type: {
                [Op.like]: `%${query}%`,
              },
            },
            {
              price: {
                [Op.like]: `%${query}%`,
              },
            },
          ],
        },
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
      return helper.dieJsonSuccess(res, products, "successfull", 200);
    } catch (error) {
      helper.dieJsonErrorDefault(res, error);
    }
  },

  signUp: async (req: Request, res: Response) => {
    const t = await Models.sequelize.transaction();
    try {
      const { password, ...userData } = req.body;
      const userSchema = Joi.object().keys({
        name: Joi.string().min(3).max(30).required(),
        email: Joi.string().email().required(),
        password: Joi.string().min(6).max(30).required(),
      });
      const validationResult = userSchema.validate(req.body);
      if (validationResult.error) {
        return helper.validationError(res, validationResult.error?.details?.[0]?.message || "Validation error");
      }

      const isUserExists = await helper.findUserByEmail(userData.email);
      if (isUserExists) return helper.dieJsonError(res, [], "User already exists", 409);

      const hashedPassword = await helper.hashPassword(password);
      if (!hashedPassword) return helper.dieJsonError(res, [], "Error hashing password", 500);

      const user = await Models.Users.create({ ...userData, password: hashedPassword });
      if (!user) {
        return helper.dieJsonError(res, [], "Error creating user", 500);
      }

      return helper.dieJsonSuccess(res, [], "You have signed up successfully", 200);
    } catch (error) {
      helper.dieJsonErrorDefault(res, error);
    }
  },

  login: async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      const user: any = await helper.findUserByEmail(email);
      if (!user) return helper.dieJsonError(res, [], "User not found", 404);

      const isPasswordValid = await helper.comparePassword(password, user.password);
      if (!isPasswordValid) return helper.dieJsonError(res, [], "Invalid password", 401);

      const payload = { id: user.id, email: user.email };
      const token = await helper.generateToken(res, payload);
      const userData = JSON.parse(JSON.stringify(user));
      const data: any = { ...userData, token };

      return helper.dieJsonSuccess(res, data, "You have logged in successfully", 200);
    } catch (error) {
      helper.dieJsonErrorDefault(res, error);
    }
  },

  addToWishlist: async (req: any, res: Response) => {
    try {
      const userId = req.user.id;
      const productId = req.body.productId;

      const isProductExists = await helper.findWishlist(userId, productId);
      if (isProductExists) return helper.dieJsonError(res, [], "Product already exists in wishlist", 409);

      const wishlist = await Models.Wishlists.create({ userId, productId });
      if (!wishlist) {
        return helper.dieJsonError(res, [], "Error creating wishlist", 500);
      }
      return helper.dieJsonSuccess(res, [], "Product added to wishlist successfully", 200);
    } catch (error) {
      helper.dieJsonErrorDefault(res, error);
    }
  },

  removeFromWishlist: async (req: any, res: Response) => {
    try {
      const userId = req.user.id;
      const productId = req.body.productId;

      const isProductExists = await helper.findWishlist(userId, productId);
      if (!isProductExists) return helper.dieJsonError(res, [], "Product not found in wishlist", 404);

      const wishlist = await Models.Wishlists.destroy({ where: { userId, productId } });
      if (!wishlist) {
        return helper.dieJsonError(res, [], "Error deleting wishlist", 500);
      }

      return helper.dieJsonSuccess(res, [], "Product removed from wishlist successfully", 200);
    } catch (error) {
      helper.dieJsonErrorDefault(res, error);
    }
  },

  getWishlist: async (req: any, res: Response) => {
    try {
      const userId = req.user.id;
      const [result, metadata] = await Models.sequelize.query(
        `SELECT p.*
        FROM Products p
          INNER JOIN Wishlists w ON p.id = w.productId
          INNER JOIN Users u ON w.userId  = u.id where w.userId = ${userId}`
      );

      // const wishlist = await Models.Products.findAll({
      //   include: [
      //     {
      //       model: Models.Images,
      //       as: "images",
      //     },
      //     {
      //       model: Models.Wishlists,
      //       as: "wishlists",
      //       where: {
      //         userId,
      //       },
      //     },
      //   ],
      // });
      console.log(result.length);
      if (!result) {
        return helper.dieJsonError(res, [], "Wishlist not found", 404);
      }
      return helper.dieJsonSuccess(res, result, `found ${result.length} wishlist products`, 200);
    } catch (error) {
      helper.dieJsonErrorDefault(res, error);
    }
  },
};

export default userController;
