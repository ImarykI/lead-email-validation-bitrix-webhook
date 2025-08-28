import mysql from "mysql2";
import "dotenv/config.js";

let pool;

const initPool = () => {
    if (!pool){

        try{
            pool = mysql.createPool({
                host : process.env.MYSQL_HOST,
                user : process.env.MYSQL_USER,
                password : process.env.MYSQL_PASSWORD,
                database : process.env.MYSQL_DATABASE
            }).promise();

            console.log(new Date().toLocaleString(), ': Pool initialized.');

        } catch (error){
    
            console.error(new Date().toLocaleString(), ': Error connecting to database. ', error);
            return undefined;
            
        }
    }   

    return pool;
}

export {initPool}
