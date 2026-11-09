const { Client } = require("pg");
require("dotenv").config();

async function testConnection() {
    const client = new Client({
        host: "127.0.0.1",
        port: 5432,
        database: "uomi_db",
        user: "postgres",
        password: process.env.DB_PASSWORD
    });

    try {
        await client.connect();

        console.log("SUCCESS: PostgreSQL connected!");

        const result = await client.query(
            "SELECT current_database(), current_user"
        );

        console.log(result.rows[0]);

    } catch (error) {
        console.log("FAILED:", error.message);
    } finally {
        await client.end().catch(() => {});
    }
}

testConnection();