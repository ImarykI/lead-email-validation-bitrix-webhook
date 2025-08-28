import { initPool } from "./dbPoll.js";

const pool = initPool();

//Return previous email verification status if exists, otherwise, return null
const getEmailVerificationStatusFromDB = async (email) => {

    const [[result]] = await pool.query(
        `SELECT verification_status
        FROM verified_emails
        WHERE email = ?
        `, [email]
    );

    if(!result){
        return null;
    }

    return Object.values(result)[0];
}

const addVerifiedEmailToDB = async (email, status) => {
        const result = await pool.query(
            `INSERT INTO verified_emails (email, verification_status)
            VALUES (?, ?)
            `, [email, status]
        );

        return result;
}

export {getEmailVerificationStatusFromDB, addVerifiedEmailToDB}
