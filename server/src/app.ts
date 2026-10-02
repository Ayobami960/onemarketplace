import express from "express"
import cors from "cors"
import { ApiResponse } from "./types/common.types.js";
import { API_PREFIX, SERVICE_NAME } from "./config/constants.js";
import { apiRouter } from "./routes/index.js";
import { notFoundHandler } from "./middleware/not-found-middleware.js";
import { errorHandler } from "./middleware/error.middleware.js";
export const app = express();

app.disable("x-power-by");
app.use(express.json({
    limit: "2mb",
    verify: (request, _response, body) => {
        (request as Express.Request).rawBody = Buffer.from(body);
    },
}));
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      return callback(null, true);
    }
    // Allow all origins in development
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.urlencoded({ extended: true}));

app.get("/", (_request, response)=> {
    const body: ApiResponse<never> = {
        success: true,
        message: "One MarketPlace.io Api is running.",
    };

    response.status(200).json(body);
}) 


app.get("/health", (_request, response) => {
  response.status(200).json({
    status: "ok",
    service: SERVICE_NAME,
  });
});

app.use(API_PREFIX, apiRouter)
app.use(notFoundHandler);
app.use(errorHandler);