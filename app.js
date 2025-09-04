const express = require("express");
const session = require("express-session");
const router = express.Router();
require("dotenv").config();
// const routes = require("./routes/index");
// const mongoose = require("mongoose");
// const swaggerJSDoc = require("swagger-jsdoc");
// const swaggerUi = require("swagger-ui-express");
// const passport = require("passport");
// const url = process.env.MONGODB_PROD;
// const swaggerDefinition = require("./config").SWAGGER_DEFINATION;
var cors = require("cors");
var app = express();
router.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(
  cors({
    origin: "*",
  })
);
app.use(
  session({
    secret: process.env.JWT_SECRET,
    resave: false,
    saveUninitialized: false,
  })
);
// app.use("/public", express.static("public"));
// app.use("/uploads", express.static("uploads"));

// mongoose.connect(url, { useNewUrlParser: true });

//swagger
// const options = {
//   swaggerDefinition,
//   apis: ["./swagger/*.js"],
// };

// const swaggerSpec = swaggerJSDoc(options);
// app.get("/swagger.json", function (req, res) {
//   res.setHeader("Content-Type", "application/json");
//   res.send(swaggerSpec);
// });

// app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// const con = mongoose.connection;

// con.on("open", () => {
//   console.log("Connected...");
// });

//Routes
// app.use("/", routes(router));
// app.use(passport.initialize());
// app.use(passport.session());

// error handler
app.use((error, req, res, next) => {
  if (!error) {
    return next();
  }
  console.log(error);
  res.status(error.status || 500).send({
    status: error.status || 500,
    error: error.message || error,
    data: error.data || "",
  });
});

app.listen(3000, () => {
  console.log("Server started");
});
