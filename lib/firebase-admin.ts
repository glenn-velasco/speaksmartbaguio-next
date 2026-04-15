import * as admin from "firebase-admin";


if (!admin.apps.length) {

    try {

        var serviceAccount = require("../speaksmart-baguio-firebase-adminsdk-fbsvc-015b2c876d.json");

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });

    } catch (error) {

        console.error("Firebase admin initialization error", error);
    }

}

const adminDb = admin.firestore();
const adminAuth = admin.auth();

export { adminDb, adminAuth, admin };