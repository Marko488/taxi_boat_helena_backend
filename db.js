import dotenv from "dotenv";
dotenv.config();
import mysql from "mysql2/promise";

export const pool = mysql.createPool({
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
});
