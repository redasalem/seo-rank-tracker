import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const baseUrl = process.env.BASE_URL || "https://seo-rank-tracer-server.vercel.app";
const MONGODB_URL = process.env.MONGODB_URL;
const CRON_SECRET = process.env.CRON_SECRET;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!CRON_SECRET || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error("❌ ERROR: Missing required environment variables (CRON_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD).");
    process.exit(1);
}

async function runTests() {
    let dbConnected = false;
    let throwawayEmail = `test-${Date.now()}@example.com`;
    let throwawayPassword = "Password123!";
    let throwawayUserId = null;
    let throwawayToken = null;
    let adminToken = null;
    let dbLimits = null;

    if (MONGODB_URL) {
        try {
            console.log("=== CONNECTING TO DATABASE ===");
            await mongoose.connect(MONGODB_URL);
            dbConnected = true;
            console.log("✅ DB Connected");

            // 1. Check current limits from settings collection
            const planLimitsDoc = await mongoose.connection.db.collection('settings').findOne({ key: "planLimits" });
            dbLimits = planLimitsDoc ? planLimitsDoc.value : null;
            console.log("Current DB Plan Limits settings (retrieved from Mongo):", JSON.stringify(dbLimits, null, 2));
        } catch (err) {
            console.warn("⚠️ Database connection failed. Limits check and verification bypass will rely on API requests.", err.message);
        }
    } else {
        console.log("ℹ️ MONGODB_URL not provided. Skipping direct database connections.");
    }

    try {
        console.log("\n=== 1. BASIC HEALTH ===");
        const healthRes = await fetch(`${baseUrl}/`);
        console.log(`GET / Status: ${healthRes.status}`);
        console.log(`GET / Body: ${await healthRes.text()}`);

        console.log("\n=== 2. AUTH FLOW ===");
        // POST /api/auth/register
        const registerRes = await fetch(`${baseUrl}/api/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: "E2E Free User", email: throwawayEmail, password: throwawayPassword })
        });
        console.log(`POST /api/auth/register Status: ${registerRes.status}`);
        const registerBody = await registerRes.json();
        console.log(`POST /api/auth/register Body:`, JSON.stringify(registerBody));

        if (dbConnected) {
            // Let's verify the user in the database so we can log in
            const userInDb = await mongoose.connection.db.collection('users').findOne({ email: throwawayEmail });
            if (userInDb) {
                throwawayUserId = userInDb._id;
                await mongoose.connection.db.collection('users').updateOne(
                    { _id: throwawayUserId },
                    { $set: { isEmailVerified: true, isVerified: true } }
                );
                console.log(`✅ Auto-verified throwaway user: ${throwawayEmail} in DB`);
            }
        }

        if (throwawayUserId) {
            // POST /api/auth/login with valid throwaway credentials (only if verified)
            const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: throwawayEmail, password: throwawayPassword })
            });
            console.log(`POST /api/auth/login (Throwaway) Status: ${loginRes.status}`);
            const loginBody = await loginRes.json();
            throwawayToken = loginBody.token;
            console.log(`POST /api/auth/login (Throwaway) Success: ${!!throwawayToken}`);
        }

        // POST /api/auth/login with wrong password
        const wrongLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: ADMIN_EMAIL, password: "wrong_password" })
        });
        console.log(`POST /api/auth/login (Wrong Password) Status: ${wrongLoginRes.status}`);
        console.log(`POST /api/auth/login (Wrong Password) Body:`, await wrongLoginRes.text());

        // GET /api/auth/getCurrentUser with no token
        const noTokenRes = await fetch(`${baseUrl}/api/auth/getCurrentUser`);
        console.log(`GET /api/auth/getCurrentUser (No Token) Status: ${noTokenRes.status}`);
        console.log(`GET /api/auth/getCurrentUser (No Token) Body:`, await noTokenRes.text());

        // Log in as Admin to get Admin Token
        const adminLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
        });
        console.log(`POST /api/auth/login (Admin) Status: ${adminLoginRes.status}`);
        const adminLoginBody = await adminLoginRes.json();
        adminToken = adminLoginBody.token;
        console.log(`POST /api/auth/login (Admin) Success: ${!!adminToken}`);

        if (adminToken) {
            // GET /api/auth/getCurrentUser with valid admin token
            const validTokenRes = await fetch(`${baseUrl}/api/auth/getCurrentUser`, {
                headers: { "Authorization": `Bearer ${adminToken}` }
            });
            console.log(`GET /api/auth/getCurrentUser (With Token) Status: ${validTokenRes.status}`);
            console.log(`GET /api/auth/getCurrentUser (With Token) Body:`, await validTokenRes.text());
        }

        console.log("\n=== 3. CRON ROUTES ===");
        // periodic-reports cron checks
        const prNoAuth = await fetch(`${baseUrl}/api/cron/periodic-reports`);
        console.log(`GET /api/cron/periodic-reports (No Auth) Status: ${prNoAuth.status}`);
        console.log(`GET /api/cron/periodic-reports (No Auth) Body:`, await prNoAuth.text());

        const prWrongAuth = await fetch(`${baseUrl}/api/cron/periodic-reports`, {
            headers: { "Authorization": "Bearer wrong_secret" }
        });
        console.log(`GET /api/cron/periodic-reports (Wrong Auth) Status: ${prWrongAuth.status}`);
        console.log(`GET /api/cron/periodic-reports (Wrong Auth) Body:`, await prWrongAuth.text());

        const prCorrectAuth = await fetch(`${baseUrl}/api/cron/periodic-reports`, {
            headers: { "Authorization": `Bearer ${CRON_SECRET}` }
        });
        console.log(`GET /api/cron/periodic-reports (Correct Auth) Status: ${prCorrectAuth.status}`);
        console.log(`GET /api/cron/periodic-reports (Correct Auth) Body:`, await prCorrectAuth.text());

        // daily cron checks
        const dailyNoAuth = await fetch(`${baseUrl}/api/cron/daily`);
        console.log(`GET /api/cron/daily (No Auth) Status: ${dailyNoAuth.status}`);
        console.log(`GET /api/cron/daily (No Auth) Body:`, await dailyNoAuth.text());

        const dailyWrongAuth = await fetch(`${baseUrl}/api/cron/daily`, {
            headers: { "Authorization": "Bearer wrong_secret" }
        });
        console.log(`GET /api/cron/daily (Wrong Auth) Status: ${dailyWrongAuth.status}`);
        console.log(`GET /api/cron/daily (Wrong Auth) Body:`, await dailyWrongAuth.text());

        const dailyCorrectAuth = await fetch(`${baseUrl}/api/cron/daily`, {
            headers: { "Authorization": `Bearer ${CRON_SECRET}` }
        });
        console.log(`GET /api/cron/daily (Correct Auth) Status: ${dailyCorrectAuth.status}`);
        console.log(`GET /api/cron/daily (Correct Auth) Body:`, await dailyCorrectAuth.text());

        if (adminToken) {
            console.log("\n=== 4. ADMIN & NOTIFICATION ROUTES (OBJECTID VALIDATION) ===");
            // Admin malformed ObjectId
            const malformedAdminRes = await fetch(`${baseUrl}/api/admin/users/invalid-id-format`, {
                headers: { "Authorization": `Bearer ${adminToken}` }
            });
            console.log(`GET /api/admin/users/invalid-id-format (Admin) Status: ${malformedAdminRes.status}`);
            console.log(`GET /api/admin/users/invalid-id-format (Admin) Body:`, await malformedAdminRes.text());

            // Notification malformed ObjectId
            const malformedNotificationRes = await fetch(`${baseUrl}/api/notifications/invalid-id/read`, {
                method: "PUT",
                headers: { "Authorization": `Bearer ${adminToken}` }
            });
            console.log(`PUT /api/notifications/invalid-id/read Status: ${malformedNotificationRes.status}`);
            console.log(`PUT /api/notifications/invalid-id/read Body:`, await malformedNotificationRes.text());

            console.log("\n=== 5. PLAN LIMITS ===");
            // Fetch Settings from admin API
            const settingsRes = await fetch(`${baseUrl}/api/admin/settings`, {
                headers: { "Authorization": `Bearer ${adminToken}` }
            });
            console.log(`GET /api/admin/settings Status: ${settingsRes.status}`);
            const settingsBody = await settingsRes.json();
            console.log(`GET /api/admin/settings Body:`, JSON.stringify(settingsBody, null, 2));
        }

        if (throwawayToken) {
            const keywordsLimit = dbLimits && dbLimits.free ? dbLimits.free.keywords : 3;
            console.log(`\nAttempting to add up to ${keywordsLimit + 1} keywords for free user...`);
            for (let i = 1; i <= keywordsLimit + 1; i++) {
                const addRes = await fetch(`${baseUrl}/api/rank`, {
                    method: "POST",
                    headers: { 
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${throwawayToken}`
                    },
                    body: JSON.stringify({
                        keyword: `keyword-${i}-${Date.now()}`,
                        url: "https://example.com",
                        country: "US"
                    })
                });
                console.log(`Keyword ${i} add Status: ${addRes.status}`);
                const addBody = await addRes.json();
                console.log(`Keyword ${i} add Body:`, JSON.stringify(addBody));
            }
        }

        console.log("\n=== 6. CORS & BASIC SECURITY SANITY ===");
        // deliberate broken request to check CORS and stack leak
        const badRequestRes = await fetch(`${baseUrl}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "invalid json string"
        });
        console.log(`Bad Request CORS Access-Control-Allow-Origin: ${badRequestRes.headers.get("access-control-allow-origin")}`);
        console.log(`Bad Request Status: ${badRequestRes.status}`);
        console.log(`Bad Request Body:`, await badRequestRes.text());

    } catch (e) {
        console.error("Test execution failed with error:", e);
    } finally {
        if (dbConnected) {
            // Clean up throwaway keywords and user
            if (throwawayUserId) {
                console.log("\n=== CLEANING UP DATABASE ===");
                const userDeleted = await mongoose.connection.db.collection('users').deleteOne({ _id: throwawayUserId });
                const keywordsDeleted = await mongoose.connection.db.collection('keywordtrackings').deleteMany({ userId: throwawayUserId });
                console.log(`Deleted throwaway user: ${userDeleted.deletedCount}, deleted keywords: ${keywordsDeleted.deletedCount}`);
            }
            await mongoose.disconnect();
            console.log("DB Disconnected");
        }
    }
}

runTests();
