import axios from "axios";
import express, { Application, Request, Response } from "express";
import https from "https";
import fs from "fs";
import multer from "multer";
import { request } from "http";
const cors = require("cors");
require("dotenv").config();
const routes = require("./routes");
const sequelize = require("./models/index").sequelize;

const app: Application = express();
const upload: any = multer();

//middle wares
app.use(cors());
app.use(express.json());
app.use("/public", express.static("public"));
app.use(routes);

app.get("/", (req: Request, res: Response) => res.send("server working"));

app.get("/downloadImages", (req: Request, res: Response) => {
  axios
    .get("https://fakestoreapi.com/products")
    .then(({ data }) => {
      // return helper.dieJsonSuccess(res, data.data, "success", 200);
      data.forEach((item: any) => {
        const image = item.image;
        const file = fs.createWriteStream(image.split("/").pop(-1));
        https.get(image, (response) => {
          response.pipe(file);
        });
      });
      const images = data.map((item: any) => item.image);
      res.send(images);
    })
    .catch((e) => console.log(e));
});

const port = process.env.PORT;

sequelize
  .sync({ alter: true })
  .then(() => {
    console.log("Database is connected");
    app.listen(3000, () => console.log(`server started in port ${port}`));
  })
  .catch((err: any) => console.log(err));
