import mysql from "mysql2";
import dotenv from "dotenv"

dotenv.config({path: "./env/database.env"});

const pool = mysql.createPool({
    host : process.env.MYSQL_HOST,
    user : process.env.MYSQL_USER,
    password : process.env.MYSQL_PASSWORD,
    database : process.env.MYSQL_DATABASE
}).promise();

const [result] = await pool.query("SELECT * FROM verified_emails");

console.log(result);